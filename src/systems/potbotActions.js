const { getStore, saveStore } = require("../db/database");
const { sendRcon } = require("../pot/rcon");
const { audit } = require("./audit");
const { addCoins, getBalance, getLinkedAgid } = require("./economy");

const cooldowns = new Map();

function renderTemplate(template, context) {
  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    return context[key] ?? "";
  });
}

function cooldownKey(kind, id, agid) {
  return `${kind}:${id}:${agid}`;
}

function checkCooldown(kind, item, agid) {
  const seconds = Number(item.cooldown_seconds || 0);
  if (!seconds) return;

  const key = cooldownKey(kind, item.id, agid);
  const until = cooldowns.get(key) || 0;
  const now = Date.now();
  if (until > now) {
    const remaining = Math.ceil((until - now) / 1000);
    throw new Error(`That action is on cooldown for ${remaining} more seconds.`);
  }
  cooldowns.set(key, now + seconds * 1000);
}

async function runConfiguredAction({ actor, kind, item, agid, context = {} }) {
  const data = getStore();
  const cost = Number(item.cost ?? item.price ?? 0);

  if (cost > 0 && getBalance(agid) < cost) {
    throw new Error(`Insufficient wallet balance. Required: ${cost}.`);
  }

  checkCooldown(kind, item, agid);

  if (cost > 0) {
    addCoins({ agid, amount: -cost, reason: `${kind}: ${item.name || item.trigger}`, actorDiscordId: actor });
  }

  const command = renderTemplate(item.rcon_command_template, { agid, ...context });
  const response = await sendRcon(command);

  data.auditLogs.push({
    id: data.counters.auditLogs++,
    actor,
    action: `${kind}.run`,
    target: agid,
    details: { command, response },
    created_at: new Date().toISOString(),
  });
  saveStore();

  return { command, response };
}

async function runCustomChatCommand({ trigger, discordId, agidFromPayload, context = {} }) {
  const data = getStore();
  const command = data.customCommands.find(row => row.enabled === 1 && row.trigger.toLowerCase() === trigger.toLowerCase());
  if (!command) return null;

  const agid = agidFromPayload || getLinkedAgid(discordId);
  if (!agid) throw new Error("No linked AGID found for this command.");

  return runConfiguredAction({
    actor: discordId || "in-game",
    kind: "customCommand",
    item: command,
    agid,
    context,
  });
}

async function teleportPlayer({ actor, locationId, agid }) {
  const location = getStore().teleportLocations.find(row => row.id === locationId && row.enabled === 1);
  if (!location) throw new Error("Teleport location not found.");

  return runConfiguredAction({ actor, kind: "teleport", item: location, agid });
}

async function runServerPreset({ actor, action, values = {} }) {
  const presets = {
    announce: "announce {message}",
    weather: "weather {weather}",
    time: "settimeofday {time}",
    waystone: "waystonecooldown {tag} {percent}",
    save: "save",
    players: "listplayers",
  };

  if (!presets[action]) throw new Error("Unknown server preset.");

  const command = renderTemplate(presets[action], values);
  const response = await sendRcon(command);
  audit({ actor, action: `server.${action}`, target: null, details: { command, response } });
  return { command, response };
}

module.exports = {
  renderTemplate,
  runConfiguredAction,
  runCustomChatCommand,
  runServerPreset,
  teleportPlayer,
};
