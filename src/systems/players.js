const { getStore, nextId, saveStore } = require("../db/database");
const { audit } = require("./audit");

function upsertPlayerProfile({ agid, alderonUsername = "", discordId = "", notes = "" }) {
  const data = getStore();
  let profile = data.playerProfiles.find(row => row.agid === agid);

  if (!profile) {
    profile = {
      id: nextId("playerProfiles"),
      agid,
      alderon_username: alderonUsername,
      discord_id: discordId,
      notes,
      flags: [],
      last_seen_at: null,
      created_at: new Date().toISOString(),
    };
    data.playerProfiles.push(profile);
  } else {
    profile.alderon_username = alderonUsername || profile.alderon_username;
    profile.discord_id = discordId || profile.discord_id;
    profile.notes = notes || profile.notes;
  }

  if (!data.wallets.some(wallet => wallet.agid === agid)) {
    data.wallets.push({ agid, balance: 0, updated_at: new Date().toISOString() });
  }

  saveStore();
  return profile;
}

function linkPlayer({ discordId, agid, verified = false, actor = "dashboard" }) {
  const data = getStore();
  let link = data.playerLinks.find(row => row.discord_id === discordId);

  if (!link) {
    link = {
      discord_id: discordId,
      agid,
      verified: verified ? 1 : 0,
      verification_code: null,
      created_at: new Date().toISOString(),
    };
    data.playerLinks.push(link);
  } else {
    link.agid = agid;
    link.verified = verified ? 1 : 0;
    link.verification_code = null;
  }

  upsertPlayerProfile({ agid, discordId });
  audit({ actor, action: "player.link", target: agid, details: { discordId, verified } });
  saveStore();
  return link;
}

module.exports = { linkPlayer, upsertPlayerProfile };
