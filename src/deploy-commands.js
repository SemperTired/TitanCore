const { REST, Routes } = require("discord.js");
const { config, requireConfig } = require("./config");
const { commands } = require("./discord/commands");

requireConfig();

const rest = new REST({ version: "10" }).setToken(config.discordToken);

async function deployCommands() {
  await rest.put(
    Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
    { body: commands.map(command => command.data.toJSON()) }
  );

  console.log("Guild slash commands deployed.");
}

deployCommands().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
