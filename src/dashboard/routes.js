const path = require("node:path");
const express = require("express");
const { z } = require("zod");
const { config } = require("../config");
const { getStore, nextId, saveStore } = require("../db/database");
const { audit } = require("../systems/audit");
const { addCoins } = require("../systems/economy");
const { linkPlayer, upsertPlayerProfile } = require("../systems/players");
const { runServerPreset } = require("../systems/potbotActions");
const { sendRcon } = require("../pot/rcon");

function createDashboardRouter(client) {
  const router = express.Router();
  const publicDir = path.join(__dirname, "public");

  router.use("/dashboard", express.static(publicDir));
  router.get("/", (_req, res) => res.redirect("/dashboard"));

  router.use("/api", requireDashboardAuth);

  router.get("/api/overview", (_req, res) => {
    const data = getStore();
    const today = new Date().toISOString().slice(0, 10);
    const todayEvents = data.potEvents.filter(event => event.created_at.startsWith(today));

    res.json({
      counts: {
        players: data.playerProfiles.length,
        linked: data.playerLinks.filter(link => link.verified === 1).length,
        wallets: data.wallets.length,
        shopItems: data.shopItems.length,
        moderationCases: data.moderationCases.length,
        todayEvents: todayEvents.length,
        activeEvents: data.events.filter(event => event.status === "active").length,
      },
      recentEvents: data.potEvents.slice(-20).reverse(),
      auditLogs: data.auditLogs.slice(-25).reverse(),
      bot: {
        ready: client?.isReady?.() || false,
        user: client?.user?.tag || null,
      },
    });
  });

  router.get("/api/store", (_req, res) => {
    res.json(getStore());
  });

  router.patch("/api/settings", (req, res) => {
    const body = z.object({
      shopTitle: z.string().min(1).optional(),
      shopDescription: z.string().optional(),
      bankEnabled: z.boolean().optional(),
      autoVerifyLinkCodes: z.boolean().optional(),
      commandPrefix: z.string().min(1).max(3).optional(),
    }).parse(req.body);

    Object.assign(getStore().settings, body);
    audit({ actor: "dashboard", action: "settings.update", details: body });
    saveStore();
    res.json(getStore().settings);
  });

  router.post("/api/players", (req, res) => {
    const body = z.object({
      agid: z.string().min(1),
      alderonUsername: z.string().optional(),
      discordId: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const profile = upsertPlayerProfile(body);
    audit({ actor: "dashboard", action: "player.upsert", target: body.agid, details: body });
    res.json(profile);
  });

  router.post("/api/players/link", (req, res) => {
    const body = z.object({
      discordId: z.string().min(1),
      agid: z.string().min(1),
      verified: z.boolean().default(true),
    }).parse(req.body);

    res.json(linkPlayer({ ...body, actor: "dashboard" }));
  });

  router.patch("/api/wallets/:agid", (req, res) => {
    const body = z.object({
      mode: z.enum(["set", "add", "subtract"]),
      amount: z.number().int(),
      reason: z.string().min(1),
    }).parse(req.body);

    const data = getStore();
    let wallet = data.wallets.find(row => row.agid === req.params.agid);
    if (!wallet) {
      wallet = { agid: req.params.agid, balance: 0, updated_at: new Date().toISOString() };
      data.wallets.push(wallet);
    }

    if (body.mode === "set") {
      const delta = body.amount - wallet.balance;
      wallet.balance = body.amount;
      data.ledger.push({
        id: nextId("ledger"),
        agid: req.params.agid,
        amount: delta,
        reason: body.reason,
        actor_discord_id: "dashboard",
        created_at: new Date().toISOString(),
      });
    } else {
      const amount = body.mode === "subtract" ? -Math.abs(body.amount) : Math.abs(body.amount);
      addCoins({ agid: req.params.agid, amount, reason: body.reason, actorDiscordId: "dashboard" });
    }

    wallet.updated_at = new Date().toISOString();
    audit({ actor: "dashboard", action: "wallet.update", target: req.params.agid, details: body });
    saveStore();
    res.json(data.wallets.find(row => row.agid === req.params.agid));
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
    starts_at: z.string().optional().default(() => new Date().toISOString()),
    ends_at: z.string().nullable().optional().default(null),
    status: z.string().optional().default("scheduled"),
    config_json: z.string().optional().default("{}"),
  }));

  router.post("/api/rcon", async (req, res, next) => {
    try {
      const body = z.object({ command: z.string().min(1) }).parse(req.body);
      const response = await sendRcon(body.command);
      audit({ actor: "dashboard", action: "rcon.raw", details: { command: body.command, response } });
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
      res.json(await runServerPreset({ actor: "dashboard", action: body.action, values: body.values }));
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

function requireDashboardAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer || req.get("x-admin-token");

  if (!config.dashboardAdminToken || token !== config.dashboardAdminToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

function crud(router, routeName, collectionName, schema) {
  router.get(`/api/${routeName}`, (_req, res) => {
    res.json(getStore()[collectionName]);
  });

  router.post(`/api/${routeName}`, (req, res) => {
    const body = schema.parse(req.body);
    const data = getStore();
    const item = {
      id: nextId(collectionName),
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    data[collectionName].push(item);
    audit({ actor: "dashboard", action: `${collectionName}.create`, target: String(item.id), details: body });
    saveStore();
    res.status(201).json(item);
  });

  router.patch(`/api/${routeName}/:id`, (req, res) => {
    const body = schema.partial().parse(req.body);
    const data = getStore();
    const item = data[collectionName].find(row => row.id === Number(req.params.id));
    if (!item) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    Object.assign(item, body, { updated_at: new Date().toISOString() });
    audit({ actor: "dashboard", action: `${collectionName}.update`, target: String(item.id), details: body });
    saveStore();
    res.json(item);
  });

  router.delete(`/api/${routeName}/:id`, (req, res) => {
    const data = getStore();
    const before = data[collectionName].length;
    data[collectionName] = data[collectionName].filter(row => row.id !== Number(req.params.id));
    if (data[collectionName].length === before) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    audit({ actor: "dashboard", action: `${collectionName}.delete`, target: req.params.id });
    saveStore();
    res.sendStatus(204);
  });
}

module.exports = { createDashboardRouter };
