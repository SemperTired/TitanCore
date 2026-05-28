async function handleInteraction(client, interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    const message = "Something went wrong while running that command.";

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: message });
      return;
    }

    await interaction.reply({ content: message, ephemeral: true });
  }
}

module.exports = { handleInteraction };
