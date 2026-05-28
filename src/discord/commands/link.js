const { SlashCommandBuilder } = require("discord.js");
const { execute, getCommunityIdForGuild } = require("../../db/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your Discord account to your Alderon Games ID")
    .addStringOption(opt =>
      opt.setName("agid").setDescription("Your Alderon Games ID").setRequired(true)
    ),

  async execute(interaction) {
    const communityId = await getCommunityIdForGuild(interaction.guildId);
    const agid = interaction.options.getString("agid").trim();
    const code = `TITAN-${Math.floor(100000 + Math.random() * 900000)}`;

    await execute(
      `INSERT INTO player_links (community_id, discord_id, agid, verified, verification_code)
       VALUES (:communityId, :discordId, :agid, 0, :code)
       ON DUPLICATE KEY UPDATE
         agid = VALUES(agid),
         verified = 0,
         verification_code = VALUES(verification_code)`,
      { communityId, discordId: interaction.user.id, agid, code }
    );

    await interaction.reply({
      ephemeral: true,
      content: `Link started for AGID \`${agid}\`.\nVerification code: \`${code}\`\nSend this code in-game if PlayerChat/PlayerCommand webhooks are enabled, or give it to staff for manual verification.`,
    });
  },
};
