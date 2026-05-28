const path = require("node:path");
const express = require("express");
const { z } = require("zod");
const { getDashboardContext, one, query, execute } = require("../db/database");
const { audit } = require("../systems/audit");
const { addCoins, setBalance } = require("../systems/economy");
const { linkPlayer, upsertPlayerProfile } = require("../systems/players");
const { runServerPreset } = require("../systems/potbotActions");
const { sendRcon } = require("../pot/rcon");

const collectionMap = {
  shopItems: {
    table: "shop_items",
    columns: ["name", "price", "rcon_command_template", "enabled"],
    select: "id, name, price, rcon_command_template, enabled, created_at, updated_at",
  },
  teleportLocations: {
    table: "teleport_locations",
    columns: ["name", "tag", "rcon_command_template", "price", "cooldown_seconds", "enabled"],
    select: "id, name, tag, rcon_command_template, price, cooldown_seconds, enabled, created_at, updated_at",
  },
  customCommands: {
    table: "custom_commands",
    columns: ["name", "trigger_text", "description", "rcon_command_template", "cost", "cooldown_seconds", "enabled"],
    select: "id, name, trigger_text AS `trigger`, description, rcon_command_template, cost, cooldown_seconds, enabled, created_at, updated_at",
  },
  dinoProfiles: {
    table: "dino_profiles",
    columns: ["agid", "dinosaur", "gender", "growth", "diet", "notes", "nesting_limit"],
    select: "id, agid, dinosaur, gender, growth, diet, notes, nesting_limit, created_at, updated_at",
  },
  events: {
    table: "events",
    columns: ["name", "type", "starts_at", "ends_at", "status", "config_json"],
    select: "id, name, type, starts_at, ends_at, status, config_json, created_at, updated_at",
  },
};

function createDashboardRouter(client) {
  const router = express.Router();
  const publicDir = path.join(__dirname, "public");

  router.use("/dashboard", express.static(publicDir));
  router.get("/", (_req, res) => res.redirect("/dashboard"));

  router.use("/api", requireDashboardAuth);

  router.get("/api/overview", async (req, res, next) => {
    try {
      const communityId = req.dashboard.communityId;
      const counts = {
        players: await count("player_profiles", communityId),
        linked: Number((await one("SELECT COUNT(*) AS count FROM player_links WHERE community_id = :communityId AND verified = 1", { communityId })).count),
        wallets: await count("wallets", communityId),
        shopItems: await count("shop_items", communityId),
        moderationCases: await count("moderation_cases", communityId),
        todayEvents: Number((await one("SELECT COUNT(*) AS count FROM pot_events WHERE community_id = :communityId AND DATE(created_at) = UTC_DATE()", { communityId })).count),
        activeEvents: Number((await one("SELECT COUNT(*) AS count FROM events WHERE community_id = :communityId AND status = 'active'", { communityId })).count),
      };

      res.json({
        counts,
        community: req.dashboard.community,
        recentEvents: await query(
          "SELECT id, event_type, agid, payload_json, created_at FROM pot_events WHERE community_id = :communityId ORDER BY id DESC LIMIT 20",
          { communityId }
        ),
        auditLogs: await query(
          "SELECT id, actor, action, target, details_json, created_at FROM audit_logs WHERE community_id = :communityId ORDER BY id DESC LIMIT 25",
          { communityId }
        ),
        bot: {
          ready: client?.isReady?.() || false,
          user: client?.user?.tag || null,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/store", async (req, res, next) => {
    try {
      res.json(await getStoreShape(req.dashboard.communityId));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/settings", async (req, res, next) => {
    try {
      const body = z.object({
        shopTitle: z.string().min(1).optional(),
        shopDescription: z.string().optional(),
        bankEnabled: z.boolean().optional(),
        autoVerifyLinkCodes: z.boolean().optional(),
        commandPrefix: z.string().min(1).max(3).optional(),
      }).parse(req.body);

      for (const [settingKey, value] of Object.entries(body)) {
        await execute(
          `INSERT INTO community_settings (community_id, setting_key, setting_value)
           VALUES (:communityId, :settingKey, :settingValue)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          { communityId: req.dashboard.communityId, settingKey, settingValue: String(value) }
        );
      }
      await audit({ communityId: req.dashboard.communityId, actor: req.dashboard.actor, action: "settings.update", details: body });
      res.json(await getSettings(req.dashboard.communityId));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/admin/communities", requireGlobalOwner, async (_req, res, next) => {
    try {
      res.json(await query("SELECT id, slug, name, discord_guild_id, created_at FROM communities ORDER BY id ASC"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/admin/communities", requireGlobalOwner, async (req, res, next) => {
    try {
      const body = z.object({
        slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
        name: z.string().min(2).max(160),
        discordGuildId: z.string().optional().default(""),
        dashboardLabel: z.string().min(2).max(120),
        dashboardToken: z.string().min(12),
      }).parse(req.body);

      await execute(
        `INSERT INTO communities (slug, name, discord_guild_id)
         VALUES (:slug, :name, :guildId)
         ON DUPLICATE KEY UPDATE name = VALUES(name), discord_guild_id = VALUES(discord_guild_id)`,
        { slug: body.slug, name: body.name, guildId: body.discordGuildId || null }
      );
      const community = await one("SELECT * FROM communities WHERE slug = :slug", { slug: body.slug });
      await seedCommunityDefaults(community.id);
      await createDashboardUser({
        communityId: community.id,
        label: body.dashboardLabel,
        token: body.dashboardToken,
        role: "owner",
      });
      await audit({ communityId: req.dashboard.communityId, actor: req.dashboard.actor, action: "community.upsert", target: body.slug, details: { name: body.name } });
      res.status(201).json(community);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/admin/dashboard-users", requireOwner, async (req, res, next) => {
    try {
      const body = z.object({
        communityId: z.number().int().positive().optional(),
        label: z.string().min(2).max(120),
        dashboardToken: z.string().min(12),
        role: z.enum(["owner", "admin", "moderator", "viewer"]).default("admin"),
      }).parse(req.body);

      const communityId = req.dashboard.actor === "dashboard:global-admin"
        ? body.communityId || req.dashboard.communityId
        : req.dashboard.communityId;
      const result = await createDashboardUser({
        communityId,
        label: body.label,
        token: body.dashboardToken,
        role: body.role,
      });
      await audit({ communityId, actor: req.dashboard.actor, action: "dashboardUser.create", target: body.label, details: { role: body.role } });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/players", async (req, res, next) => {
    try {
      const body = z.object({
        agid: z.string().min(1),
        alderonUsername: z.string().optional(),
        discordId: z.string().optional(),
        notes: z.string().optional(),
      }).parse(req.body);

      const profile = await upsertPlayerProfile({ communityId: req.dashboard.communityId, ...body });
      await audit({ communityId: req.dashboard.communityId, actor: req.dashboard.actor, action: "player.upsert", target: body.agid, details: body });
      res.json(profile);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/players/link", async (req, res, next) => {
    try {
      const body = z.object({
        discordId: z.string().min(1),
        agid: z.string().min(1),
        verified: z.boolean().default(true),
      }).parse(req.body);

      res.json(await linkPlayer({ communityId: req.dashboard.communityId, ...body, actor: req.dashboard.actor }));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/wallets/:agid", async (req, res, next) => {
    try {
      const body = z.object({
        mode: z.enum(["set", "add", "subtract"]),
        amount: z.number().int(),
        reason: z.string().min(1),
      }).parse(req.body);

      const amount = body.mode === "subtract" ? -Math.abs(body.amount) : Math.abs(body.amount);
      const balance = body.mode === "set"
        ? await setBalance({
            communityId: req.dashboard.communityId,
            agid: req.params.agid,
            balance: body.amount,
            reason: body.reason,
            actorDiscordId: req.dashboard.actor,
          })
        : await addCoins({
            communityId: req.dashboard.communityId,
            agid: req.params.agid,
            amount,
            reason: body.reason,
            actorDiscordId: req.dashboard.actor,
          });

      await audit({ communityId: req.dashboard.communityId, actor: req.dashboard.actor, action: "wallet.update", target: req.params.agid, details: body });
      res.json({ agid: req.params.agid, balance });
    } catch (error) {
      next(error);
    }
  });

  crud(router, "shop-items", "shopItems", z.object({
    name: z.string().min(1),
    price: z.number().int().min(0),
    rcon_command_template: z.string().min(1),
    enabled: z.number().int().min(0).max(1).default(1),
  }));

  crud(router, "teleports", "teleportLocations", z.object({
    name: z.string().min(1),
    tag: z.string().min(1),
    rcon_command_template: z.string().min(1),
    price: z.number().int().min(0).default(0),
    cooldown_seconds: z.number().int().min(0).default(0),
    enabled: z.number().int().min(0).max(1).default(1),
  }));

  crud(router, "custom-commands", "customCommands", z.object({
    name: z.string().min(1),
    trigger: z.string().min(1),
    description: z.string().optional().default(""),
    rcon_command_template: z.string().min(1),
    cost: z.number().int().min(0).default(0),
    cooldown_seconds: z.number().int().min(0).default(0),
    enabled: z.number().int().min(0).max(1).default(1),
  }));

  crud(router, "dino-profiles", "dinoProfiles", z.object({
    agid: z.string().min(1),
    dinosaur: z.string().min(1),
    gender: z.string().optional().default("unknown"),
    growth: z.string().optional().default("unknown"),
    diet: z.string().optional().default("unknown"),
    notes: z.string().optional().default(""),
    nesting_limit: z.number().int().min(0).default(0),
  }));

  crud(router, "events", "events", z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    starts_at: z.string().optional().default(() => new Date().toISOString().slice(0, 19).replace("T", " ")),
    ends_at: z.string().nullable().optional().default(null),
    status: z.string().optional().default("scheduled"),
    config_json: z.string().optional().default("{}"),
  }));

  router.post("/api/rcon", async (req, res, next) => {
    try {
      const body = z.object({ command: z.string().min(1) }).parse(req.body);
      const response = await sendRcon(body.command);
      await audit({ communityId: req.dashboard.communityId, actor: req.dashboard.actor, action: "rcon.raw", details: { command: body.command, response } });
      res.json({ response });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/server-action", async (req, res, next) => {
    try {
      const body = z.object({
        action: z.string().min(1),
        values: z.record(z.string()).default({}),
      }).parse(req.body);
      res.json(await runServerPreset({
        communityId: req.dashboard.communityId,
        actor: req.dashboard.actor,
        action: body.action,
        values: body.values,
      }));
    } catch (error) {
      next(error);
    }
  });

  router.use("/api", (error, _req, res, _next) => {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.flatten() });
      return;
    }

    console.error(error);
    res.status(500).json({ error: error.message || "Internal server error" });
  });

  return router;
}

async function requireDashboardAuth(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
    const token = bearer || req.get("x-admin-token");
    const context = await getDashboardContext(token);

    if (!context) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    context.community = await one("SELECT id, slug, name, discord_guild_id FROM communities WHERE id = :communityId", {
      communityId: context.communityId,
    });
    req.dashboard = context;
    next();
  } catch (error) {
    next(error);
  }
}

function crud(router, routeName, collectionName, schema) {
  const meta = collectionMap[collectionName];

  router.get(`/api/${routeName}`, async (req, res, next) => {
    try {
      res.json(await selectCollection(collectionName, req.dashboard.communityId));
    } catch (error) {
      next(error);
    }
  });

  router.post(`/api/${routeName}`, async (req, res, next) => {
    try {
      const body = normalizeBody(collectionName, schema.parse(req.body));
      const columnNames = meta.columns;
      const placeholders = columnNames.map(column => `:${column}`).join(", ");
      const result = await execute(
        `INSERT INTO ${meta.table} (community_id, ${columnNames.join(", ")})
         VALUES (:communityId, ${placeholders})`,
        { communityId: req.dashboard.communityId, ...body }
      );
      await audit({ communityId: req.dashboard.communityId, actor: req.dashboard.actor, action: `${collectionName}.create`, target: String(result.insertId), details: body });
      res.status(201).json(await selectById(collectionName, req.dashboard.communityId, result.insertId));
    } catch (error) {
      next(error);
    }
  });

  router.patch(`/api/${routeName}/:id`, async (req, res, next) => {
    try {
      const body = normalizeBody(collectionName, schema.partial().parse(req.body));
      const allowed = Object.fromEntries(Object.entries(body).filter(([key]) => meta.columns.includes(key)));
      if (Object.keys(allowed).length === 0) {
        res.status(400).json({ error: "No valid fields supplied." });
        return;
      }
      const setClause = Object.keys(allowed).map(column => `${column} = :${column}`).join(", ");
      const result = await execute(
        `UPDATE ${meta.table}
         SET ${setClause}
         WHERE community_id = :communityId AND id = :id`,
        { communityId: req.dashboard.communityId, id: Number(req.params.id), ...allowed }
      );
      if (result.affectedRows !== 1) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await audit({ communityId: req.dashboard.communityId, actor: req.dashboard.actor, action: `${collectionName}.update`, target: req.params.id, details: allowed });
      res.json(await selectById(collectionName, req.dashboard.communityId, Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  });

  router.delete(`/api/${routeName}/:id`, async (req, res, next) => {
    try {
      const result = await execute(
        `DELETE FROM ${meta.table} WHERE community_id = :communityId AND id = :id`,
        { communityId: req.dashboard.communityId, id: Number(req.params.id) }
      );
      if (result.affectedRows !== 1) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await audit({ communityId: req.dashboard.communityId, actor: req.dashboard.actor, action: `${collectionName}.delete`, target: req.params.id });
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });
}

function requireOwner(req, res, next) {
  if (req.dashboard.role !== "owner") {
    res.status(403).json({ error: "Owner access required" });
    return;
  }
  next();
}

function requireGlobalOwner(req, res, next) {
  if (req.dashboard.actor !== "dashboard:global-admin") {
    res.status(403).json({ error: "Global owner token required" });
    return;
  }
  next();
}

async function seedCommunityDefaults(communityId) {
  const defaults = {
    shopTitle: "TitanCore Shop",
    shopDescription: "Spend community coins on rewards, marks, teleports, and server perks.",
    bankEnabled: "true",
    autoVerifyLinkCodes: "true",
    commandPrefix: "!",
  };

  for (const [settingKey, settingValue] of Object.entries(defaults)) {
    await execute(
      `INSERT INTO community_settings (community_id, setting_key, setting_value)
       VALUES (:communityId, :settingKey, :settingValue)
       ON DUPLICATE KEY UPDATE setting_value = setting_value`,
      { communityId, settingKey, settingValue }
    );
  }
}

async function createDashboardUser({ communityId, label, token, role }) {
  const { hashToken } = require("../db/database");
  const result = await execute(
    `INSERT INTO dashboard_users (community_id, label, token_hash, role)
     VALUES (:communityId, :label, :tokenHash, :role)
     ON DUPLICATE KEY UPDATE label = VALUES(label), role = VALUES(role), enabled = 1`,
    { communityId, label, tokenHash: hashToken(token), role }
  );
  return { id: result.insertId, community_id: communityId, label, role };
}

async function getStoreShape(communityId) {
  const settings = await getSettings(communityId);
  return {
    playerProfiles: await query("SELECT * FROM player_profiles WHERE community_id = :communityId ORDER BY updated_at DESC LIMIT 500", { communityId }),
    playerLinks: await query("SELECT * FROM player_links WHERE community_id = :communityId ORDER BY updated_at DESC LIMIT 500", { communityId }),
    wallets: await query("SELECT agid, balance, updated_at FROM wallets WHERE community_id = :communityId ORDER BY balance DESC LIMIT 500", { communityId }),
    ledger: await query("SELECT id, agid, amount, reason, actor_discord_id, created_at FROM ledger WHERE community_id = :communityId ORDER BY id DESC LIMIT 500", { communityId }),
    shopItems: await selectCollection("shopItems", communityId),
    teleportLocations: await selectCollection("teleportLocations", communityId),
    customCommands: await selectCollection("customCommands", communityId),
    dinoProfiles: await selectCollection("dinoProfiles", communityId),
    events: await selectCollection("events", communityId),
    moderationCases: await query("SELECT * FROM moderation_cases WHERE community_id = :communityId ORDER BY id DESC LIMIT 500", { communityId }),
    potEvents: await query("SELECT id, event_type, agid, payload_json, created_at FROM pot_events WHERE community_id = :communityId ORDER BY id DESC LIMIT 500", { communityId }),
    auditLogs: await query("SELECT id, actor, action, target, details_json, created_at FROM audit_logs WHERE community_id = :communityId ORDER BY id DESC LIMIT 500", { communityId }),
    eventScores: await query("SELECT * FROM event_scores WHERE community_id = :communityId ORDER BY score DESC LIMIT 500", { communityId }),
    settings,
  };
}

async function getSettings(communityId) {
  const rows = await query(
    "SELECT setting_key, setting_value FROM community_settings WHERE community_id = :communityId",
    { communityId }
  );
  return Object.fromEntries(rows.map(row => [
    row.setting_key,
    row.setting_value === "true" ? true : row.setting_value === "false" ? false : row.setting_value,
  ]));
}

async function count(table, communityId) {
  return Number((await one(`SELECT COUNT(*) AS count FROM ${table} WHERE community_id = :communityId`, { communityId })).count);
}

async function selectCollection(collectionName, communityId) {
  const meta = collectionMap[collectionName];
  return query(
    `SELECT ${meta.select}
     FROM ${meta.table}
     WHERE community_id = :communityId
     ORDER BY id DESC
     LIMIT 500`,
    { communityId }
  );
}

async function selectById(collectionName, communityId, id) {
  const meta = collectionMap[collectionName];
  return one(
    `SELECT ${meta.select} FROM ${meta.table} WHERE community_id = :communityId AND id = :id`,
    { communityId, id }
  );
}

function normalizeBody(collectionName, body) {
  if (collectionName === "customCommands" && body.trigger) {
    body.trigger_text = body.trigger;
    delete body.trigger;
  }
  if (collectionName === "events" && body.config_json) {
    JSON.parse(body.config_json);
  }
  return body;
}

module.exports = { createDashboardRouter };
