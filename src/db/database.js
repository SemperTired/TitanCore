const crypto = require("node:crypto");
const mysql = require("mysql2/promise");
const { config } = require("../config");

let pool;

function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    timezone: "Z",
  });

  return pool;
}

async function query(sql, params = {}) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

async function execute(sql, params = {}) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

async function one(sql, params = {}) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function transaction(callback) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getDefaultCommunityId() {
  const community = await one(
    "SELECT id FROM communities WHERE slug = :slug LIMIT 1",
    { slug: config.defaultCommunitySlug }
  );
  if (!community) throw new Error("Default community has not been initialized. Run npm run db:init.");
  return community.id;
}

async function getCommunityIdForGuild(guildId) {
  if (guildId) {
    const community = await one(
      "SELECT id FROM communities WHERE discord_guild_id = :guildId LIMIT 1",
      { guildId }
    );
    if (community) return community.id;
  }
  return getDefaultCommunityId();
}

async function getDashboardContext(token) {
  if (!token) return null;

  if (config.dashboardAdminToken && token === config.dashboardAdminToken) {
    return {
      communityId: await getDefaultCommunityId(),
      role: "owner",
      actor: "dashboard:global-admin",
    };
  }

  const user = await one(
    `SELECT dashboard_users.*, communities.name AS community_name
     FROM dashboard_users
     JOIN communities ON communities.id = dashboard_users.community_id
     WHERE dashboard_users.token_hash = :tokenHash
       AND dashboard_users.enabled = 1
     LIMIT 1`,
    { tokenHash: hashToken(token) }
  );

  if (!user) return null;

  return {
    communityId: user.community_id,
    role: user.role,
    actor: `dashboard:${user.label}`,
    dashboardUserId: user.id,
  };
}

module.exports = {
  execute,
  getCommunityIdForGuild,
  getDashboardContext,
  getDefaultCommunityId,
  getPool,
  hashToken,
  one,
  query,
  transaction,
};
