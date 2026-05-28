const { Rcon } = require("rcon-client");
const { config } = require("../config");

async function sendRcon(command) {
  const rcon = await Rcon.connect({
    host: config.rcon.host,
    port: config.rcon.port,
    password: config.rcon.password,
    timeout: 5000,
  });

  try {
    return await rcon.send(command);
  } finally {
    await rcon.end();
  }
}

module.exports = { sendRcon };
