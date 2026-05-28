const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");
const { addCoins, buyItem, getBalance, getLinkedAgid } = require("../../systems/economy");
const { getStore } = require("../../db/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription("Coins, shop, and purchases")
    .addSubcommand(sub =>
      sub.setName("balance").setDescription("Show your coin balance")
    )
    .addSubcommand(sub =>
      sub.setName("shop").setDescription("Show the shop")
    )
    .addSubcommand(sub =>
      sub
        .setName("buy")
        .setDescription("Buy a shop item")
        .addIntegerOption(opt =>
          opt.setName("item_id").setDescription("Shop item ID").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add coins to a player")
        .addStringOption(opt =>
          opt.setName("agid").setDescription("Alderon Games ID").setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName("amount").setDescription("Coin amount").setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("reason").setDescription("Ledger reason").setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "balance") {
      const agid = getLinkedAgid(interaction.user.id);
      if (!agid) {
        return interaction.reply({ ephemeral: true, content: "You need to run `/link` and be verified first." });
      }

      return interaction.reply({ ephemeral: true, content: `Balance: ${getBalance(agid)} coins.` });
    }

    if (subcommand === "shop") {
      const items = getStore().shopItems
        .filter(item => item.enabled === 1)
        .sort((a, b) => a.price - b.price);
      const lines = items.map(item => `#${item.id} - ${item.name}: ${item.price} coins`);
      return interaction.reply({ ephemeral: true, content: lines.length ? lines.join("\n") : "The shop is empty." });
    }

    if (subcommand === "buy") {
      await interaction.deferReply({ ephemeral: true });
      const itemId = interaction.options.getInteger("item_id");
      const result = await buyItem({ discordId: interaction.user.id, itemId });
      return interaction.editReply(`Purchased ${result.item.name}. New balance: ${result.balance} coins.`);
    }

    if (subcommand === "add") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ ephemeral: true, content: "You need Manage Server permission to add coins." });
      }

      const balance = addCoins({
        agid: interaction.options.getString("agid"),
        amount: interaction.options.getInteger("amount"),
        reason: interaction.options.getString("reason"),
        actorDiscordId: interaction.user.id,
      });

      return interaction.reply({ ephemeral: true, content: `Coins updated. New balance: ${balance}.` });
    }
  },
};
