const { config } = require("../config");
const { getStore, nextId, saveStore } = require("../db/database");
const { runCustomChatCommand } = require("../systems/potbotActions");
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

async function handlePotWebhook(eventType, payload, client) {
  const data = getStore();
  const agid = findAgid(payload);

  data.potEvents.push({
    id: nextId("potEvents"),
    event_type: eventType,
    agid,
    payload_json: JSON.stringify(payload),
    created_at: new Date().toISOString(),
  });

  if (["player-report", "player-hack", "server-error", "security-alert"].includes(eventType)) {
    await notifyStaff(eventType, payload, client);
  }

  if (eventType === "player-login" && agid) {
    if (!data.wallets.some(wallet => wallet.agid === agid)) {
      data.wallets.push({ agid, balance: 0, updated_at: new Date().toISOString() });
    }
    upsertPlayerProfile({ agid, alderonUsername: findAlderonUsername(payload) });
  }

  if (["player-chat", "player-command"].includes(eventType)) {
    await handlePlayerMessage(eventType, payload);
  }

  saveStore();
}

async function handlePlayerMessage(eventType, payload) {
  const data = getStore();
  const agid = findAgid(payload);
  const message = findMessage(payload).trim();
  if (!message) return;

  if (data.settings.autoVerifyLinkCodes) {
    const pending = data.playerLinks.find(link => link.verification_code && message.includes(link.verification_code));
    if (pending) {
      pending.verified = 1;
      pending.verification_code = null;
      if (agid) pending.agid = agid;
      upsertPlayerProfile({ agid: pending.agid, discordId: pending.discord_id, alderonUsername: findAlderonUsername(payload) });
    }
  }

  const prefix = data.settings.commandPrefix || "!";
  if (!message.startsWith(prefix)) return;

  const trigger = message.split(/\s+/)[0];
  await runCustomChatCommand({
    trigger,
    discordId: findDiscordId(payload),
    agidFromPayload: agid,
    context: {
      message,
      eventType,
      playerName: findAlderonUsername(payload),
    },
  }).catch(error => {
    data.auditLogs.push({
      id: nextId("auditLogs"),
      actor: agid || "in-game",
      action: "customCommand.failed",
      target: trigger,
      details: { error: error.message },
      created_at: new Date().toISOString(),
    });
  });
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
