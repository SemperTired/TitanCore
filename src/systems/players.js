const { execute, one } = require("../db/database");
const { audit } = require("./audit");

async function upsertPlayerProfile({ communityId, agid, alderonUsername = "", discordId = "", notes = "" }) {
  await execute(
    `INSERT INTO player_profiles (community_id, agid, alderon_username, discord_id, notes, flags)
     VALUES (:communityId, :agid, :alderonUsername, :discordId, :notes, JSON_ARRAY())
     ON DUPLICATE KEY UPDATE
       alderon_username = COALESCE(NULLIF(VALUES(alderon_username), ''), alderon_username),
       discord_id = COALESCE(NULLIF(VALUES(discord_id), ''), discord_id),
       notes = COALESCE(NULLIF(VALUES(notes), ''), notes)`,
    { communityId, agid, alderonUsername, discordId, notes }
  );

  await execute(
    `INSERT IGNORE INTO wallets (community_id, agid, balance)
     VALUES (:communityId, :agid, 0)`,
    { communityId, agid }
  );

  return one(
    "SELECT * FROM player_profiles WHERE community_id = :communityId AND agid = :agid",
    { communityId, agid }
  );
}

async function linkPlayer({ communityId, discordId, agid, verified = false, actor = "dashboard" }) {
  await execute(
    `INSERT INTO player_links (community_id, discord_id, agid, verified, verification_code)
     VALUES (:communityId, :discordId, :agid, :verified, NULL)
     ON DUPLICATE KEY UPDATE
       agid = VALUES(agid),
       verified = VALUES(verified),
       verification_code = NULL`,
    { communityId, discordId, agid, verified: verified ? 1 : 0 }
  );

  await upsertPlayerProfile({ communityId, agid, discordId });
  await audit({ communityId, actor, action: "player.link", target: agid, details: { discordId, verified } });

  return one(
    "SELECT * FROM player_links WHERE community_id = :communityId AND discord_id = :discordId",
    { communityId, discordId }
  );
}

module.exports = { linkPlayer, upsertPlayerProfile };
