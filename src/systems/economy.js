const { execute, one, transaction } = require("../db/database");
const { sendRcon } = require("../pot/rcon");

async function getLinkedAgid({ communityId, discordId }) {
  return (await one(
    `SELECT agid FROM player_links
     WHERE community_id = :communityId AND discord_id = :discordId AND verified = 1`,
    { communityId, discordId }
  ))?.agid;
}

async function ensureWallet(communityId, agid) {
  await execute(
    "INSERT IGNORE INTO wallets (community_id, agid, balance) VALUES (:communityId, :agid, 0)",
    { communityId, agid }
  );
}

async function getBalance(communityId, agid) {
  await ensureWallet(communityId, agid);
  return Number((await one(
    "SELECT balance FROM wallets WHERE community_id = :communityId AND agid = :agid",
    { communityId, agid }
  )).balance);
}

async function addCoins({ communityId, agid, amount, reason, actorDiscordId }) {
  await ensureWallet(communityId, agid);
  await transaction(async connection => {
    await connection.execute(
      `UPDATE wallets
       SET balance = balance + :amount
       WHERE community_id = :communityId AND agid = :agid`,
      { communityId, agid, amount }
    );
    await connection.execute(
      `INSERT INTO ledger (community_id, agid, amount, reason, actor_discord_id)
       VALUES (:communityId, :agid, :amount, :reason, :actorDiscordId)`,
      { communityId, agid, amount, reason, actorDiscordId: actorDiscordId || null }
    );
  });

  return getBalance(communityId, agid);
}

async function setBalance({ communityId, agid, balance, reason, actorDiscordId }) {
  await ensureWallet(communityId, agid);
  await transaction(async connection => {
    const [walletRows] = await connection.execute(
      "SELECT balance FROM wallets WHERE community_id = :communityId AND agid = :agid FOR UPDATE",
      { communityId, agid }
    );
    const current = Number(walletRows[0]?.balance || 0);
    const delta = balance - current;
    await connection.execute(
      "UPDATE wallets SET balance = :balance WHERE community_id = :communityId AND agid = :agid",
      { communityId, agid, balance }
    );
    await connection.execute(
      `INSERT INTO ledger (community_id, agid, amount, reason, actor_discord_id)
       VALUES (:communityId, :agid, :delta, :reason, :actorDiscordId)`,
      { communityId, agid, delta, reason, actorDiscordId: actorDiscordId || null }
    );
  });

  return getBalance(communityId, agid);
}

async function buyItem({ communityId, discordId, itemId }) {
  const agid = await getLinkedAgid({ communityId, discordId });
  if (!agid) throw new Error("You need to link and verify your Alderon Games ID first.");

  const item = await one(
    "SELECT * FROM shop_items WHERE community_id = :communityId AND id = :itemId AND enabled = 1",
    { communityId, itemId }
  );
  if (!item) throw new Error("That shop item does not exist or is disabled.");

  await transaction(async connection => {
    await connection.execute(
      "INSERT IGNORE INTO wallets (community_id, agid, balance) VALUES (:communityId, :agid, 0)",
      { communityId, agid }
    );
    const [result] = await connection.execute(
      `UPDATE wallets
       SET balance = balance - :price
       WHERE community_id = :communityId AND agid = :agid AND balance >= :price`,
      { communityId, agid, price: item.price }
    );
    if (result.affectedRows !== 1) {
      throw new Error(`You need ${item.price} coins to buy ${item.name}.`);
    }
    await connection.execute(
      `INSERT INTO ledger (community_id, agid, amount, reason, actor_discord_id)
       VALUES (:communityId, :agid, :amount, :reason, :discordId)`,
      {
        communityId,
        agid,
        amount: -Number(item.price),
        reason: `Purchased ${item.name}`,
        discordId,
      }
    );
  });

  const command = item.rcon_command_template.replaceAll("{agid}", agid);
  const rconResponse = await sendRcon(command);

  return { item, balance: await getBalance(communityId, agid), rconResponse };
}

module.exports = { addCoins, buyItem, getBalance, getLinkedAgid, setBalance };
