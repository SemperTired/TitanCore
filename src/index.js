const express = require("express");
const { Client, Collection, Events, GatewayIntentBits } = require("discord.js");
const { config, requireConfig } = require("./config");
const { initDb } = require("./db/init");
const { commands } = require("./discord/commands");
const { handleInteraction } = require("./discord/handlers/interactions");
const { createDashboardRouter } = require("./dashboard/routes");
const { handlePotWebhook } = require("./pot/webhooks");

requireConfig();
initDb();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
for (const command of commands) {
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, interaction => {
  handleInteraction(client, interaction);
});

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(createDashboardRouter(client));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/pot/webhooks/:event", async (req, res, next) => {
  try {
    await handlePotWebhook(req.params.event, req.body, client);
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.webhookPort, () => {
  console.log(`Webhook server listening on port ${config.webhookPort}`);
});

client.login(config.discordToken);
