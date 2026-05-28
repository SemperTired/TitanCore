const { execute, one } = require("../db/database");
const { sendRcon } = require("../pot/rcon");
const { audit } = require("./audit");
const { addCoins, getBalance, getLinkedAgid } = require("./economy");

const cooldowns = new Map();

function renderTemplate(template, context) {
  return template.replace(/\{(\w+)\}/g, (_match, key) => context[key] ?? "");
}

function cooldownKey(kind, id, agid, communityId) {
  return `${communityId}:${kind}:${id}:${agid}`;
}

function checkCooldown(kind, item, agid, communityId) {
  const seconds = Number(item.cooldown_seconds || 0);
  if (!seconds) return;

  const key = cooldownKey(kind, item.id, agid, communityId);
  const until = cooldowns.get(key) || 0;
  const now = Date.now();
  if (until > now) {
    const remaining = Math.ceil((until - now) / 1000);
    throw new Error(`That action is on cooldown for ${remaining} more seconds.`);
  }
  cooldowns.set(key, now + seconds * 1000);
}

async function runConfiguredAction({ communityId, actor, kind, item, agid, context = {} }) {
  const cost = Number(item.cost ?? item.price ?? 0);

  if (cost > 0 && (await getBalance(communityId, agid)) < cost) {
    throw new Error(`Insufficient wallet balance. Required: ${cost}.`);
  }

  checkCooldown(kind, item, agid, communityId);

  if (cost > 0) {
    await addCoins({ communityId, agid, amount: -cost, reason: `${kind}: ${item.name || item.trigger_text}`, actorDiscordId: actor });
  }

  const command = renderTemplate(item.rcon_command_template, { agid, ...context });
  const response = await sendRcon(command);
  await audit({ communityId, actor, action: `${kind}.run`, target: agid, details: { command, response } });

  return { command, response };
}

async function runCustomChatCommand({ communityId, trigger, discordId, agidFromPayload, context = {} }) {
  const command = await one(
    `SELECT * FROM custom_commands
     WHERE community_id = :communityId AND enabled = 1 AND LOWER(trigger_text) = LOWER(:trigger)
     LIMIT 1`,
    { communityId, trigger }
  );
  if (!command) return null;

  const agid = agidFromPayload || await getLinkedAgid({ communityId, discordId });
  if (!agid) throw new Error("No linked AGID found for this command.");

  return runConfiguredAction({
    communityId,
    actor: discordId || "in-game",
    kind: "customCommand",
    item: command,
    agid,
    context,
  });
}

async function teleportPlayer({ communityId, actor, locationId, agid }) {
  const location = await one(
    "SELECT * FROM teleport_locations WHERE community_id = :communityId AND id = :locationId AND enabled = 1",
    { communityId, locationId }
  );
  if (!location) throw new Error("Teleport location not found.");

  return runConfiguredAction({ communityId, actor, kind: "teleport", item: location, agid });
}

async function runServerPreset({ communityId, actor, action, values = {} }) {
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
  await audit({ communityId, actor, action: `server.${action}`, target: null, details: { command, response } });
  return { command, response };
}

async function setEventScore({ communityId, eventId, agid, score }) {
  await execute(
    `INSERT INTO event_scores (community_id, event_id, agid, score)
     VALUES (:communityId, :eventId, :agid, :score)
     ON DUPLICATE KEY UPDATE score = VALUES(score)`,
    { communityId, eventId, agid, score }
  );
}

module.exports = {
  renderTemplate,
  runConfiguredAction,
  runCustomChatCommand,
  runServerPreset,
  setEventScore,
  teleportPlayer,
};
