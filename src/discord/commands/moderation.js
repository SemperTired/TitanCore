const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");
const { execute, getCommunityIdForGuild, query } = require("../../db/database");
const { sendRcon } = require("../../pot/rcon");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mod")
    .setDescription("Moderation case tracking and server action tools")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addSubcommand(sub =>
      sub
        .setName("note")
        .setDescription("Add a moderation note")
        .addStringOption(opt => opt.setName("agid").setDescription("Alderon Games ID").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Note").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("kick")
        .setDescription("Kick a player by AGID")
        .addStringOption(opt => opt.setName("agid").setDescription("Alderon Games ID").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("history")
        .setDescription("Show moderation history")
        .addStringOption(opt => opt.setName("agid").setDescription("Alderon Games ID").setRequired(true))
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const communityId = await getCommunityIdForGuild(interaction.guildId);
    const subcommand = interaction.options.getSubcommand();
    const agid = interaction.options.getString("agid");

    if (subcommand === "history") {
      const cases = await query(
        `SELECT id, type, reason, created_at
         FROM moderation_cases
         WHERE community_id = :communityId AND agid = :agid
         ORDER BY id DESC
         LIMIT 10`,
        { communityId, agid }
      );
      const lines = cases.map(row => `#${row.id} ${row.type} ${row.created_at}: ${row.reason}`);
      return interaction.editReply(lines.length ? lines.join("\n") : "No moderation history found.");
    }

    const reason = interaction.options.getString("reason").replaceAll("\n", " ").slice(0, 180);
    await execute(
      `INSERT INTO moderation_cases (community_id, agid, type, reason, moderator_discord_id)
       VALUES (:communityId, :agid, :type, :reason, :moderatorDiscordId)`,
      {
        communityId,
        agid,
        type: subcommand,
        reason,
        moderatorDiscordId: interaction.user.id,
      }
    );

    if (subcommand === "kick") {
      const response = await sendRcon(`kick ${agid} ${reason}`);
      return interaction.editReply(`Kick case created.\n\`\`\`\n${response || "OK"}\n\`\`\``);
    }

    return interaction.editReply("Moderation note created.");
  },
};
