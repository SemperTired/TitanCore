const server = require("./server");
const economy = require("./economy");
const moderation = require("./moderation");
const analytics = require("./analytics");
const events = require("./events");
const link = require("./link");

module.exports = {
  commands: [server, economy, moderation, analytics, events, link],
};
