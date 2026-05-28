const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");
const { getStore, nextId, saveStore } = require("../../db/database");
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
    const subcommand = interaction.options.getSubcommand();
    const agid = interaction.options.getString("agid");

    if (subcommand === "history") {
      const cases = getStore().moderationCases
        .filter(row => row.agid === agid)
        .sort((a, b) => b.id - a.id)
        .slice(0, 10);
      const lines = cases.map(row => `#${row.id} ${row.type} ${row.created_at}: ${row.reason}`);
      return interaction.editReply(lines.length ? lines.join("\n") : "No moderation history found.");
    }

    const reason = interaction.options.getString("reason").replaceAll("\n", " ").slice(0, 180);
    const data = getStore();
    data.moderationCases.push({
      id: nextId("moderationCases"),
      agid,
      discord_id: null,
      type: subcommand,
      reason,
      moderator_discord_id: interaction.user.id,
      expires_at: null,
      created_at: new Date().toISOString(),
    });
    saveStore();

    if (subcommand === "kick") {
      const response = await sendRcon(`kick ${agid} ${reason}`);
      return interaction.editReply(`Kick case created.\n\`\`\`\n${response || "OK"}\n\`\`\``);
    }

    return interaction.editReply("Moderation note created.");
  },
};
