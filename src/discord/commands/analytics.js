const { SlashCommandBuilder } = require("discord.js");
const { getCommunityIdForGuild, query } = require("../../db/database");

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
    const communityId = await getCommunityIdForGuild(interaction.guildId);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "today") {
      const rows = await query(
        `SELECT event_type, COUNT(*) AS count
         FROM pot_events
         WHERE community_id = :communityId AND DATE(created_at) = UTC_DATE()
         GROUP BY event_type
         ORDER BY count DESC`,
        { communityId }
      );
      const lines = rows.map(row => `${row.event_type}: ${row.count}`);
      return interaction.reply({ ephemeral: true, content: lines.length ? lines.join("\n") : "No events recorded today." });
    }

    const agid = interaction.options.getString("agid");
    const rows = await query(
      `SELECT event_type, created_at
       FROM pot_events
       WHERE community_id = :communityId AND agid = :agid
       ORDER BY id DESC
       LIMIT 10`,
      { communityId, agid }
    );
    const lines = rows.map(row => `${row.created_at}: ${row.event_type}`);
    return interaction.reply({ ephemeral: true, content: lines.length ? lines.join("\n") : "No events found for that player." });
  },
};
