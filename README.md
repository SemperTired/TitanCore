# Path of Titans Ecosystem Bot

A Node.js starter bot for Path of Titans community servers. It combines Discord slash commands, Source RCON, Path of Titans webhooks, MySQL-backed economy storage, moderation cases, analytics ingestion, event infrastructure, and a multi-community dashboard.

## PotBot-Style Feature Coverage

- Discord slash commands for server, economy, moderation, analytics, events, and account linking.
- RCON command runner plus safer server presets.
- Path of Titans webhook ingestion and activity analytics.
- Player profiles, Discord-to-AGID linking, and optional in-game link-code verification.
- Wallets, ledger, shop items, paid rewards, and dashboard wallet editing.
- Configurable RCON-backed shop rewards, teleports, and in-game chat commands.
- Dino profile and nesting records.
- Moderation cases, reports, security alerts, and audit logs.
- Admin dashboard at `/dashboard` with token authentication.
- Dockerfile and deployment checklist.
- MySQL tenant model so each community only sees and modifies its own player/economy/server data.

## First Run

1. Install Node.js 20+.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in Discord, RCON, MySQL, channel, and webhook settings.
4. Create the MySQL database, tables, default community, default settings, and seed records:

   ```bash
   npm run db:init
   ```

5. Register test-guild slash commands:

   ```bash
   npm run deploy
   ```

6. Start the bot:

   ```bash
   npm run dev
   ```

7. Open the dashboard:

   ```txt
   http://localhost:3000/dashboard
   ```

   Use `DASHBOARD_ADMIN_TOKEN` from `.env` to unlock it.

## Path of Titans Game.ini RCON Example

```ini
[SourceRCON]
bEnabled=true
bLogging=true
Password="UseALongSecurePassword123!"
Port=7779
IP="0.0.0.0"
MaxFailedAttempts=5
MaxConnectionsPerIP=1
MaxLoginAttempts=1
```

## Path of Titans Game.ini Webhook Example

```ini
[ServerWebhooks]
bEnabled=true
Format="General"
PlayerLogin="https://your-domain.com/pot/webhooks/player-login"
PlayerLogout="https://your-domain.com/pot/webhooks/player-logout"
PlayerKilled="https://your-domain.com/pot/webhooks/player-killed"
PlayerReport="https://your-domain.com/pot/webhooks/player-report"
PlayerChat="https://your-domain.com/pot/webhooks/player-chat"
PlayerCommand="https://your-domain.com/pot/webhooks/player-command"
ServerError="https://your-domain.com/pot/webhooks/server-error"
SecurityAlert="https://your-domain.com/pot/webhooks/security-alert"
```

## Current Slash Commands

- `/server announce`
- `/server players`
- `/server save`
- `/server rcon`
- `/link`
- `/economy balance`
- `/economy shop`
- `/economy buy`
- `/economy add`
- `/mod note`
- `/mod kick`
- `/mod history`
- `/analytics today`
- `/analytics player`
- `/event create`
- `/event start`
- `/event leaderboard`

## Dashboard Areas

- Overview: server activity, audit log, bot readiness, and counts.
- Players: create or edit player profiles.
- Wallets: set, add, or subtract player balances with ledger entries.
- Shop: configure purchasable RCON-backed rewards.
- Teleports: configure paid or free teleport destinations.
- Commands: configure in-game chat commands such as `!marks`, `!heal`, and `!grow`.
- Dino Profiles: track dinosaurs, growth, diet, gender, and nesting limits.
- Events: create and manage community events.
- Moderation: inspect cases, reports, and alerts.
- Server: run presets or raw RCON.
- Settings: update shop, banking, link verification, and command prefix settings.
- Communities: global-owner tools for creating communities and issuing community-scoped dashboard tokens.

## Multi-Community Access

The dashboard uses bearer-token authentication.

- `DASHBOARD_ADMIN_TOKEN` is the global owner token.
- Global owners can create communities from the dashboard.
- Each community can have one or more dashboard users in `dashboard_users`.
- Every player, wallet, shop item, teleport, command, dino profile, event, moderation case, webhook event, and audit log is scoped by `community_id`.
- Community-specific webhooks can use:

  ```txt
  https://your-domain.com/pot/webhooks/community/{community-slug}/{event-name}
  ```

  Example:

  ```txt
  https://your-domain.com/pot/webhooks/community/default/player-login
  ```

## Next Implementation Targets

- Auto-verify `/link` from `PlayerChat` or `PlayerCommand` webhooks.
- Add role-based command allowlists beyond Discord default permissions.
- Add a web dashboard for shop, cases, economy ledger, and event management.
- Add scheduled engagement jobs: daily rewards, recurring announcements, event reminders.
- Add billing/subscription controls if you plan to host this as a paid multi-community service.
