const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");
const { getStore, nextId, saveStore } = require("../../db/database");
const { sendRcon } = require("../../pot/rcon");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event")
    .setDescription("Create and run community events")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Create an event")
        .addStringOption(opt => opt.setName("name").setDescription("Event name").setRequired(true))
        .addStringOption(opt => opt.setName("type").setDescription("Event type").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("start")
        .setDescription("Start an event")
        .addIntegerOption(opt => opt.setName("event_id").setDescription("Event ID").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("leaderboard")
        .setDescription("Show event leaderboard")
        .addIntegerOption(opt => opt.setName("event_id").setDescription("Event ID").setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      const data = getStore();
      const id = nextId("events");
      data.events.push({
        id,
        name: interaction.options.getString("name"),
        type: interaction.options.getString("type"),
        starts_at: new Date().toISOString(),
        ends_at: null,
        status: "scheduled",
        config_json: "{}",
      });
      saveStore();

      return interaction.reply({ ephemeral: true, content: `Event created with ID ${id}.` });
    }

    if (subcommand === "start") {
      await interaction.deferReply({ ephemeral: true });
      const eventId = interaction.options.getInteger("event_id");
      const data = getStore();
      const event = data.events.find(row => row.id === eventId);
      if (!event) return interaction.editReply("Event not found.");

      event.status = "active";
      event.starts_at = new Date().toISOString();
      saveStore();
      await sendRcon(`announce Event started: ${event.name}`);
      return interaction.editReply(`Event ${event.name} is now active.`);
    }

    const eventId = interaction.options.getInteger("event_id");
    const rows = getStore().eventScores
      .filter(score => score.event_id === eventId)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    const lines = rows.map((row, index) => `${index + 1}. ${row.agid}: ${row.score}`);
    return interaction.reply({ ephemeral: true, content: lines.length ? lines.join("\n") : "No scores yet." });
  },
};
