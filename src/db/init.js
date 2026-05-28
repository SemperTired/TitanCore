const { getStore, nextId, saveStore } = require("./database");

function initDb() {
  const data = getStore();

  if (data.shopItems.length === 0) {
    data.shopItems.push(
      {
        id: nextId("shopItems"),
        name: "Starter Marks Pack",
        price: 250,
        rcon_command_template: "givemarks {agid} 500",
        enabled: 1,
      },
      {
        id: nextId("shopItems"),
        name: "Event Bonus Marks",
        price: 1000,
        rcon_command_template: "givemarks {agid} 2500",
        enabled: 1,
      }
    );
  }

  if (data.teleportLocations.length === 0) {
    data.teleportLocations.push(
      {
        id: nextId("teleportLocations"),
        name: "Grand Plains",
        tag: "grand-plains",
        rcon_command_template: "teleport {agid} grand-plains",
        price: 100,
        cooldown_seconds: 300,
        enabled: 1,
      },
      {
        id: nextId("teleportLocations"),
        name: "Safezone",
        tag: "safezone",
        rcon_command_template: "teleport {agid} safezone",
        price: 0,
        cooldown_seconds: 600,
        enabled: 1,
      }
    );
  }

  if (data.customCommands.length === 0) {
    data.customCommands.push(
      {
        id: nextId("customCommands"),
        name: "marks",
        trigger: "!marks",
        description: "Give linked player a starter marks pack.",
        rcon_command_template: "givemarks {agid} 2000",
        cost: 0,
        cooldown_seconds: 86400,
        enabled: 1,
      },
      {
        id: nextId("customCommands"),
        name: "heal",
        trigger: "!heal",
        description: "Run a configurable heal command for the linked player.",
        rcon_command_template: "heal {agid}",
        cost: 50,
        cooldown_seconds: 1800,
        enabled: 1,
      },
      {
        id: nextId("customCommands"),
        name: "grow",
        trigger: "!grow",
        description: "Run a configurable grow command for the linked player.",
        rcon_command_template: "setattr {agid} Growth 1",
        cost: 500,
        cooldown_seconds: 86400,
        enabled: 1,
      }
    );
  }

  saveStore();
}

if (require.main === module) {
  initDb();
  console.log("Database initialized.");
}

module.exports = { initDb };
