const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");
const { execute, getCommunityIdForGuild, one, query } = require("../../db/database");
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
    const communityId = await getCommunityIdForGuild(interaction.guildId);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      const result = await execute(
        `INSERT INTO events (community_id, name, type, starts_at, config_json)
         VALUES (:communityId, :name, :type, UTC_TIMESTAMP(), JSON_OBJECT())`,
        {
          communityId,
          name: interaction.options.getString("name"),
          type: interaction.options.getString("type"),
        }
      );

      return interaction.reply({ ephemeral: true, content: `Event created with ID ${result.insertId}.` });
    }

    if (subcommand === "start") {
      await interaction.deferReply({ ephemeral: true });
      const eventId = interaction.options.getInteger("event_id");
      const event = await one(
        "SELECT * FROM events WHERE community_id = :communityId AND id = :eventId",
        { communityId, eventId }
      );
      if (!event) return interaction.editReply("Event not found.");

      await execute(
        "UPDATE events SET status = 'active', starts_at = UTC_TIMESTAMP() WHERE community_id = :communityId AND id = :eventId",
        { communityId, eventId }
      );
      await sendRcon(`announce Event started: ${event.name}`);
      return interaction.editReply(`Event ${event.name} is now active.`);
    }

    const eventId = interaction.options.getInteger("event_id");
    const rows = await query(
      `SELECT agid, score
       FROM event_scores
       WHERE community_id = :communityId AND event_id = :eventId
       ORDER BY score DESC
       LIMIT 10`,
      { communityId, eventId }
    );
    const lines = rows.map((row, index) => `${index + 1}. ${row.agid}: ${row.score}`);
    return interaction.reply({ ephemeral: true, content: lines.length ? lines.join("\n") : "No scores yet." });
  },
};
