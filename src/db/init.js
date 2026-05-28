const mysql = require("mysql2/promise");
const { config } = require("../config");
const { execute, getPool, hashToken, one } = require("./database");

async function ensureDatabaseExists() {
  const connection = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    multipleStatements: false,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\`
       CHARACTER SET utf8mb4
       COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

async function initDb() {
  await ensureDatabaseExists();
  await createTables();
  await seedDefaultCommunity();
}

async function createTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS communities (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(80) NOT NULL UNIQUE,
      name VARCHAR(160) NOT NULL,
      discord_guild_id VARCHAR(32) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS dashboard_users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_id BIGINT UNSIGNED NOT NULL,
      label VARCHAR(120) NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      role ENUM('owner','admin','moderator','viewer') NOT NULL DEFAULT 'admin',
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
      INDEX idx_dashboard_users_community (community_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS community_settings (
      community_id BIGINT UNSIGNED NOT NULL,
      setting_key VARCHAR(80) NOT NULL,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (community_id, setting_key),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS player_profiles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_id BIGINT UNSIGNED NOT NULL,
      agid VARCHAR(80) NOT NULL,
      alderon_username VARCHAR(160) NULL,
      discord_id VARCHAR(32) NULL,
      notes TEXT NULL,
      flags JSON NULL,
      last_seen_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_player_profiles_community_agid (community_id, agid),
      INDEX idx_player_profiles_discord (community_id, discord_id),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS player_links (
      community_id BIGINT UNSIGNED NOT NULL,
      discord_id VARCHAR(32) NOT NULL,
      agid VARCHAR(80) NOT NULL,
      verified TINYINT(1) NOT NULL DEFAULT 0,
      verification_code VARCHAR(40) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (community_id, discord_id),
      UNIQUE KEY uq_player_links_community_agid (community_id, agid),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wallets (
      community_id BIGINT UNSIGNED NOT NULL,
      agid VARCHAR(80) NOT NULL,
      balance BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (community_id, agid),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS ledger (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_id BIGINT UNSIGNED NOT NULL,
      agid VARCHAR(80) NOT NULL,
      amount BIGINT NOT NULL,
      reason VARCHAR(255) NOT NULL,
      actor_discord_id VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ledger_wallet (community_id, agid, created_at),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS shop_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(160) NOT NULL,
      price BIGINT NOT NULL DEFAULT 0,
      rcon_command_template TEXT NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_shop_items_community (community_id, enabled),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS teleport_locations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(160) NOT NULL,
      tag VARCHAR(120) NOT NULL,
      rcon_command_template TEXT NOT NULL,
      price BIGINT NOT NULL DEFAULT 0,
      cooldown_seconds INT UNSIGNED NOT NULL DEFAULT 0,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_teleport_tag (community_id, tag),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS custom_commands (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(160) NOT NULL,
      trigger_text VARCHAR(80) NOT NULL,
      description TEXT NULL,
      rcon_command_template TEXT NOT NULL,
      cost BIGINT NOT NULL DEFAULT 0,
      cooldown_seconds INT UNSIGNED NOT NULL DEFAULT 0,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_custom_command_trigger (community_id, trigger_text),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS dino_profiles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_id BIGINT UNSIGNED NOT NULL,
      agid VARCHAR(80) NOT NULL,
      dinosaur VARCHAR(120) NOT NULL,
      gender VARCHAR(40) NOT NULL DEFAULT 'unknown',
      growth VARCHAR(40) NOT NULL DEFAULT 'unknown',
      diet VARCHAR(40) NOT NULL DEFAULT 'unknown',
      notes TEXT NULL,
      nesting_limit INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_dino_profiles_player (community_id, agid),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS nests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_id BIGINT UNSIGNED NOT NULL,
      parent_agid VARCHAR(80) NOT NULL,
      child_agid VARCHAR(80) NULL,
      dinosaur VARCHAR(120) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'open',
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_nests_community_status (community_id, status),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS moderation_cases (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_id BIGINT UNSIGNED NOT NULL,
      agid VARCHAR(80) NULL,
      discord_id VARCHAR(32) NULL,
      type VARCHAR(60) NOT NULL,
      reason TEXT NOT NULL,
      moderator_discord_id VARCHAR(64) NOT NULL,
      expires_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_moderation_cases_player (community_id, agid, created_at),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS pot_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_id BIGINT UNSIGNED NOT NULL,
      event_type VARCHAR(80) NOT NULL,
      agid VARCHAR(80) NULL,
      payload_json JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pot_events_type_time (community_id, event_type, created_at),
      INDEX idx_pot_events_player_time (community_id, agid, created_at),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(160) NOT NULL,
      type VARCHAR(80) NOT NULL,
      starts_at TIMESTAMP NULL,
      ends_at TIMESTAMP NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'scheduled',
      config_json JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_events_status (community_id, status),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS event_scores (
      community_id BIGINT UNSIGNED NOT NULL,
      event_id BIGINT UNSIGNED NOT NULL,
      agid VARCHAR(80) NOT NULL,
      score BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (community_id, event_id, agid),
      INDEX idx_event_scores_rank (community_id, event_id, score),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      community_id BIGINT UNSIGNED NOT NULL,
      actor VARCHAR(160) NOT NULL,
      action VARCHAR(120) NOT NULL,
      target VARCHAR(160) NULL,
      details_json JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_logs_time (community_id, created_at),
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];

  for (const statement of statements) {
    await execute(statement);
  }
}

async function seedDefaultCommunity() {
  await execute(
    `INSERT INTO communities (slug, name, discord_guild_id)
     VALUES (:slug, :name, :guildId)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       discord_guild_id = COALESCE(VALUES(discord_guild_id), discord_guild_id)`,
    {
      slug: config.defaultCommunitySlug,
      name: config.defaultCommunityName,
      guildId: config.discordGuildId || null,
    }
  );

  const community = await one("SELECT id FROM communities WHERE slug = :slug", {
    slug: config.defaultCommunitySlug,
  });

  const defaults = {
    shopTitle: "TitanCore Shop",
    shopDescription: "Spend community coins on rewards, marks, teleports, and server perks.",
    bankEnabled: "true",
    autoVerifyLinkCodes: "true",
    commandPrefix: "!",
  };

  for (const [settingKey, settingValue] of Object.entries(defaults)) {
    await execute(
      `INSERT INTO community_settings (community_id, setting_key, setting_value)
       VALUES (:communityId, :settingKey, :settingValue)
       ON DUPLICATE KEY UPDATE setting_value = setting_value`,
      { communityId: community.id, settingKey, settingValue }
    );
  }

  await execute(
    `INSERT IGNORE INTO dashboard_users (community_id, label, token_hash, role)
     VALUES (:communityId, 'Default Community Admin', :tokenHash, 'owner')`,
    { communityId: community.id, tokenHash: hashToken(config.dashboardAdminToken) }
  );

  const shopCount = await one("SELECT COUNT(*) AS count FROM shop_items WHERE community_id = :communityId", {
    communityId: community.id,
  });
  if (Number(shopCount.count) === 0) {
    await execute(
      `INSERT INTO shop_items (community_id, name, price, rcon_command_template)
       VALUES
        (:communityId, 'Starter Marks Pack', 250, 'givemarks {agid} 500'),
        (:communityId, 'Event Bonus Marks', 1000, 'givemarks {agid} 2500')`,
      { communityId: community.id }
    );
  }

  const teleportCount = await one("SELECT COUNT(*) AS count FROM teleport_locations WHERE community_id = :communityId", {
    communityId: community.id,
  });
  if (Number(teleportCount.count) === 0) {
    await execute(
      `INSERT INTO teleport_locations (community_id, name, tag, rcon_command_template, price, cooldown_seconds)
       VALUES
        (:communityId, 'Grand Plains', 'grand-plains', 'teleport {agid} grand-plains', 100, 300),
        (:communityId, 'Safezone', 'safezone', 'teleport {agid} safezone', 0, 600)`,
      { communityId: community.id }
    );
  }

  const commandCount = await one("SELECT COUNT(*) AS count FROM custom_commands WHERE community_id = :communityId", {
    communityId: community.id,
  });
  if (Number(commandCount.count) === 0) {
    await execute(
      `INSERT INTO custom_commands
        (community_id, name, trigger_text, description, rcon_command_template, cost, cooldown_seconds)
       VALUES
        (:communityId, 'marks', '!marks', 'Give linked player a starter marks pack.', 'givemarks {agid} 2000', 0, 86400),
        (:communityId, 'heal', '!heal', 'Run a configurable heal command for the linked player.', 'heal {agid}', 50, 1800),
        (:communityId, 'grow', '!grow', 'Run a configurable grow command for the linked player.', 'setattr {agid} Growth 1', 500, 86400)`,
      { communityId: community.id }
    );
  }
}

if (require.main === module) {
  initDb()
    .then(async () => {
      console.log("MySQL database initialized.");
      await getPool().end();
    })
    .catch(async error => {
      console.error(error);
      try {
        await getPool().end();
      } catch (_ignored) {}
      process.exitCode = 1;
    });
}

module.exports = { initDb };
