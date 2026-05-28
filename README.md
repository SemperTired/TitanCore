# Path of Titans Ecosystem Bot

A Node.js starter bot for Path of Titans community servers. It combines Discord slash commands, Source RCON, Path of Titans webhooks, economy storage, moderation cases, analytics ingestion, and event infrastructure. The starter uses a local JSON store so it installs cleanly on Windows; move to Postgres before running a large production economy.

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

## First Run

1. Install Node.js 20+.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in Discord, RCON, channel, and webhook settings.
4. Initialize the database:

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

## Next Implementation Targets

- Auto-verify `/link` from `PlayerChat` or `PlayerCommand` webhooks.
- Add role-based command allowlists beyond Discord default permissions.
- Add a web dashboard for shop, cases, economy ledger, and event management.
- Add scheduled engagement jobs: daily rewards, recurring announcements, event reminders.
- Move storage to Postgres for large production servers.
