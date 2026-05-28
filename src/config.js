require("dotenv").config();

const config = {
  discordToken: process.env.DISCORD_TOKEN,
  discordClientId: process.env.DISCORD_CLIENT_ID,
  discordGuildId: process.env.DISCORD_GUILD_ID,
  databasePath: process.env.DATABASE_PATH || "./data/potbot.sqlite",
  webhookPort: Number(process.env.WEBHOOK_PORT || 3000),
  webhookSecret: process.env.WEBHOOK_SECRET,
  dashboardAdminToken: process.env.DASHBOARD_ADMIN_TOKEN,
  staffLogChannelId: process.env.STAFF_LOG_CHANNEL_ID,
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

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

module.exports = { config, requireConfig };
