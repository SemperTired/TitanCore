const { SlashCommandBuilder } = require("discord.js");
const { getStore, saveStore } = require("../../db/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your Discord account to your Alderon Games ID")
    .addStringOption(opt =>
      opt.setName("agid").setDescription("Your Alderon Games ID").setRequired(true)
    ),

  async execute(interaction) {
    const agid = interaction.options.getString("agid").trim();
    const code = `TITAN-${Math.floor(100000 + Math.random() * 900000)}`;
    const data = getStore();
    const existing = data.playerLinks.find(link => link.discord_id === interaction.user.id);

    if (existing) {
      existing.agid = agid;
      existing.verified = 0;
      existing.verification_code = code;
    } else {
      data.playerLinks.push({
        discord_id: interaction.user.id,
        agid,
        verified: 0,
        verification_code: code,
        created_at: new Date().toISOString(),
      });
    }

    saveStore();

    await interaction.reply({
      ephemeral: true,
      content: `Link started for AGID \`${agid}\`.\nVerification code: \`${code}\`\nNext: send this code to staff or wire PlayerChat/PlayerCommand webhooks to auto-verify it.`,
    });
  },
};
