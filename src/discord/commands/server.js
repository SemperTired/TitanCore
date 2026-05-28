const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");
const { sendRcon } = require("../../pot/rcon");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("Manage the Path of Titans server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName("announce")
        .setDescription("Send an in-game announcement")
        .addStringOption(opt =>
          opt.setName("message").setDescription("Announcement text").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("players").setDescription("Show online players")
    )
    .addSubcommand(sub =>
      sub.setName("save").setDescription("Request a server save")
    )
    .addSubcommand(sub =>
      sub
        .setName("rcon")
        .setDescription("Run a raw RCON command")
        .addStringOption(opt =>
          opt.setName("command").setDescription("Raw RCON command").setRequired(true)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const commandMap = {
      announce: () => `announce ${interaction.options.getString("message")}`,
      players: () => "listplayers",
      save: () => "save",
      rcon: () => interaction.options.getString("command"),
    };

    const response = await sendRcon(commandMap[subcommand]());
    await interaction.editReply(`RCON response:\n\`\`\`\n${response || "OK"}\n\`\`\``);
  },
};
