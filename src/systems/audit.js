const { execute } = require("../db/database");

async function audit({ communityId, actor = "system", action, target = null, details = {} }) {
  await execute(
    `INSERT INTO audit_logs (community_id, actor, action, target, details_json)
     VALUES (:communityId, :actor, :action, :target, CAST(:details AS JSON))`,
    {
      communityId,
      actor,
      action,
      target,
      details: JSON.stringify(details),
    }
  );
}

module.exports = { audit };
