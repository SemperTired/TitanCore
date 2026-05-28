const fs = require("node:fs");
const path = require("node:path");
const { config } = require("../config");

const defaultData = {
  playerLinks: [],
  wallets: [],
  ledger: [],
  shopItems: [],
  moderationCases: [],
  potEvents: [],
  events: [],
  eventScores: [],
  playerProfiles: [],
  dinoProfiles: [],
  nests: [],
  teleportLocations: [],
  customCommands: [],
  auditLogs: [],
  settings: {
    shopTitle: "TitanCore Shop",
    shopDescription: "Spend community coins on rewards, marks, teleports, and server perks.",
    bankEnabled: true,
    autoVerifyLinkCodes: true,
    commandPrefix: "!",
  },
  counters: {
    ledger: 1,
    shopItems: 1,
    moderationCases: 1,
    potEvents: 1,
    events: 1,
    playerProfiles: 1,
    dinoProfiles: 1,
    nests: 1,
    teleportLocations: 1,
    customCommands: 1,
    auditLogs: 1,
  },
};

let store;

function getStorePath() {
  const configured = config.databasePath.replace(/\.sqlite$/i, ".json");
  return path.resolve(configured);
}

function getStore() {
  if (store) return store;

  const storePath = getStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });

  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(defaultData, null, 2));
  }

  store = JSON.parse(fs.readFileSync(storePath, "utf8"));
  for (const [key, value] of Object.entries(defaultData)) {
    if (store[key] === undefined) store[key] = value;
  }

  for (const [key, value] of Object.entries(defaultData.counters)) {
    if (store.counters[key] === undefined) store.counters[key] = value;
  }

  for (const [key, value] of Object.entries(defaultData.settings)) {
    if (store.settings[key] === undefined) store.settings[key] = value;
  }

  return store;
}

function saveStore() {
  fs.writeFileSync(getStorePath(), JSON.stringify(getStore(), null, 2));
}

function nextId(collectionName) {
  const data = getStore();
  const id = data.counters[collectionName] || 1;
  data.counters[collectionName] = id + 1;
  return id;
}

module.exports = { getStore, saveStore, nextId };
