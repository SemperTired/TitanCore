require("dotenv").config();

const config = {
  discordToken: process.env.DISCORD_TOKEN,
  discordClientId: process.env.DISCORD_CLIENT_ID,
  discordGuildId: process.env.DISCORD_GUILD_ID,
  databasePath: process.env.DATABASE_PATH || "./data/potbot.sqlite",
  webhookPort: Number(process.env.WEBHOOK_PORT || 3000),
  webhookSecret: process.env.WEBHOOK_SECRET,
  dashboardAdminToken: process.env.DASHBOARD_ADMIN_TOKEN,
  defaultCommunitySlug: process.env.DEFAULT_COMMUNITY_SLUG || "default",
  defaultCommunityName: process.env.DEFAULT_COMMUNITY_NAME || "TitanCore Default Community",
  staffLogChannelId: process.env.STAFF_LOG_CHANNEL_ID,
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "TitanCore",
  },
  rcon: {
    host: process.env.POT_RCON_HOST || "127.0.0.1",
    port: Number(process.env.POT_RCON_PORT || 7779),
    password: process.env.POT_RCON_PASSWORD,
  },
};

function requireConfig() {
  const missing = [];

  if (!config.discordToken) missing.push("DISCORD_TOKEN");
  if (!config.discordClientId) missing.push("DISCORD_CLIENT_ID");
  if (!config.discordGuildId) missing.push("DISCORD_GUILD_ID");
  if (!config.rcon.password) missing.push("POT_RCON_PASSWORD");
  if (!config.dashboardAdminToken) missing.push("DASHBOARD_ADMIN_TOKEN");
  if (!config.mysql.user) missing.push("MYSQL_USER");
  if (!config.mysql.password) missing.push("MYSQL_PASSWORD");
  if (!config.mysql.database) missing.push("MYSQL_DATABASE");

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

module.exports = { config, requireConfig };
