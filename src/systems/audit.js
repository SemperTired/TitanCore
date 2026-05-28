const { getStore, nextId, saveStore } = require("../db/database");

function audit({ actor = "system", action, target = null, details = {} }) {
  const data = getStore();
  data.auditLogs.push({
    id: nextId("auditLogs"),
    actor,
    action,
    target,
    details,
    created_at: new Date().toISOString(),
  });

  if (data.auditLogs.length > 1000) {
    data.auditLogs = data.auditLogs.slice(-1000);
  }

  saveStore();
}

module.exports = { audit };
