const { SlashCommandBuilder } = require("discord.js");
const { getStore } = require("../../db/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("analytics")
    .setDescription("Server analytics from Path of Titans webhooks")
    .addSubcommand(sub =>
      sub.setName("today").setDescription("Show today's event counts")
    )
    .addSubcommand(sub =>
      sub
        .setName("player")
        .setDescription("Show recent events for a player")
        .addStringOption(opt => opt.setName("agid").setDescription("Alderon Games ID").setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "today") {
      const today = new Date().toISOString().slice(0, 10);
      const counts = new Map();
      for (const event of getStore().potEvents) {
        if (!event.created_at.startsWith(today)) continue;
        counts.set(event.event_type, (counts.get(event.event_type) || 0) + 1);
      }
      const lines = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([eventType, count]) => `${eventType}: ${count}`);
      return interaction.reply({ ephemeral: true, content: lines.length ? lines.join("\n") : "No events recorded today." });
    }

    const agid = interaction.options.getString("agid");
    const rows = getStore().potEvents
      .filter(event => event.agid === agid)
      .sort((a, b) => b.id - a.id)
      .slice(0, 10);
    const lines = rows.map(row => `${row.created_at}: ${row.event_type}`);
    return interaction.reply({ ephemeral: true, content: lines.length ? lines.join("\n") : "No events found for that player." });
  },
};
