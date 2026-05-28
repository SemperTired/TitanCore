const { getStore, nextId, saveStore } = require("../db/database");
const { sendRcon } = require("../pot/rcon");

function getLinkedAgid(discordId) {
  return getStore().playerLinks.find(link => link.discord_id === discordId && link.verified === 1)?.agid;
}

function getBalance(agid) {
  const data = getStore();
  let wallet = data.wallets.find(row => row.agid === agid);
  if (!wallet) {
    wallet = { agid, balance: 0, updated_at: new Date().toISOString() };
    data.wallets.push(wallet);
    saveStore();
  }
  return wallet.balance;
}

function addCoins({ agid, amount, reason, actorDiscordId }) {
  const data = getStore();
  let wallet = data.wallets.find(row => row.agid === agid);
  if (!wallet) {
    wallet = { agid, balance: 0, updated_at: new Date().toISOString() };
    data.wallets.push(wallet);
  }

  wallet.balance += amount;
  wallet.updated_at = new Date().toISOString();
  data.ledger.push({
    id: nextId("ledger"),
    agid,
    amount,
    reason,
    actor_discord_id: actorDiscordId || null,
    created_at: new Date().toISOString(),
  });
  saveStore();
  return wallet.balance;
}

async function buyItem({ discordId, itemId }) {
  const data = getStore();
  const agid = getLinkedAgid(discordId);
  if (!agid) throw new Error("You need to link and verify your Alderon Games ID first.");

  const item = data.shopItems.find(row => row.id === itemId && row.enabled === 1);
  if (!item) throw new Error("That shop item does not exist or is disabled.");

  const balance = getBalance(agid);
  if (balance < item.price) throw new Error(`You need ${item.price} coins, but you only have ${balance}.`);

  const command = item.rcon_command_template.replaceAll("{agid}", agid);

  const wallet = data.wallets.find(row => row.agid === agid);
  wallet.balance -= item.price;
  wallet.updated_at = new Date().toISOString();
  data.ledger.push({
    id: nextId("ledger"),
    agid,
    amount: -item.price,
    reason: `Purchased ${item.name}`,
    actor_discord_id: discordId,
    created_at: new Date().toISOString(),
  });
  saveStore();
  const rconResponse = await sendRcon(command);

  return { item, balance: getBalance(agid), rconResponse };
}

module.exports = { addCoins, buyItem, getBalance, getLinkedAgid };
