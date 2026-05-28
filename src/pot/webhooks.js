const { config } = require("../config");
const { execute, getDefaultCommunityId, one } = require("../db/database");
const { runCustomChatCommand } = require("../systems/potbotActions");
const { audit } = require("../systems/audit");
const { upsertPlayerProfile } = require("../systems/players");

function findAgid(payload) {
  return payload?.agid || payload?.AGID || payload?.playerId || payload?.player_id || null;
}

function findMessage(payload) {
  return payload?.message || payload?.Message || payload?.chat || payload?.command || payload?.Command || "";
}

function findDiscordId(payload) {
  return payload?.discordId || payload?.discord_id || payload?.DiscordId || null;
}

function findAlderonUsername(payload) {
  return payload?.playerName || payload?.PlayerName || payload?.username || payload?.Username || "";
}

async function handlePotWebhook(eventType, payload, client, communityId = null) {
  const resolvedCommunityId = communityId || await getDefaultCommunityId();
  const agid = findAgid(payload);

  await execute(
    `INSERT INTO pot_events (community_id, event_type, agid, payload_json)
     VALUES (:communityId, :eventType, :agid, CAST(:payload AS JSON))`,
    {
      communityId: resolvedCommunityId,
      eventType,
      agid,
      payload: JSON.stringify(payload),
    }
  );

  if (["player-report", "player-hack", "server-error", "security-alert"].includes(eventType)) {
    await notifyStaff(eventType, payload, client);
  }

  if (eventType === "player-login" && agid) {
    await upsertPlayerProfile({
      communityId: resolvedCommunityId,
      agid,
      alderonUsername: findAlderonUsername(payload),
    });
  }

  if (["player-chat", "player-command"].includes(eventType)) {
    await handlePlayerMessage(resolvedCommunityId, eventType, payload);
  }
}

async function handlePlayerMessage(communityId, eventType, payload) {
  const settings = await getSettings(communityId);
  const agid = findAgid(payload);
  const message = findMessage(payload).trim();
  if (!message) return;

  if (settings.autoVerifyLinkCodes) {
    const pending = await one(
      `SELECT * FROM player_links
       WHERE community_id = :communityId
         AND verification_code IS NOT NULL
         AND INSTR(:message, verification_code) > 0
       LIMIT 1`,
      { communityId, message }
    );

    if (pending) {
      await execute(
        `UPDATE player_links
         SET verified = 1, verification_code = NULL, agid = :agid
         WHERE community_id = :communityId AND discord_id = :discordId`,
        {
          communityId,
          agid: agid || pending.agid,
          discordId: pending.discord_id,
        }
      );
      await upsertPlayerProfile({
        communityId,
        agid: agid || pending.agid,
        discordId: pending.discord_id,
        alderonUsername: findAlderonUsername(payload),
      });
      await audit({ communityId, actor: "webhook", action: "player.autoVerify", target: agid || pending.agid });
    }
  }

  const prefix = settings.commandPrefix || "!";
  if (!message.startsWith(prefix)) return;

  const trigger = message.split(/\s+/)[0];
  await runCustomChatCommand({
    communityId,
    trigger,
    discordId: findDiscordId(payload),
    agidFromPayload: agid,
    context: {
      message,
      eventType,
      playerName: findAlderonUsername(payload),
    },
  }).catch(error => audit({
    communityId,
    actor: agid || "in-game",
    action: "customCommand.failed",
    target: trigger,
    details: { error: error.message },
  }));
}

async function getSettings(communityId) {
  const rows = await require("../db/database").query(
    "SELECT setting_key, setting_value FROM community_settings WHERE community_id = :communityId",
    { communityId }
  );
  return Object.fromEntries(rows.map(row => [
    row.setting_key,
    row.setting_value === "true" ? true : row.setting_value === "false" ? false : row.setting_value,
  ]));
}

async function notifyStaff(eventType, payload, client) {
  if (!config.staffLogChannelId) return;

  const channel = await client.channels.fetch(config.staffLogChannelId).catch(() => null);
  if (!channel) return;

  const body = JSON.stringify(payload, null, 2).slice(0, 1800);
  await channel.send({
    content: `Path of Titans alert: ${eventType}\n\`\`\`json\n${body}\n\`\`\``,
    allowedMentions: { parse: [] },
  });
}

module.exports = { handlePotWebhook };
