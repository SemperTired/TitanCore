# TitanCore

**TitanCore** is a Path of Titans community operations bot built around Discord, Source RCON, Path of Titans webhooks, MySQL, and an admin dashboard. It is designed to bring server management, economy systems, moderation, analytics, event tooling, player engagement, and multi-community administration into one deployable ecosystem.

> TitanCore is server administration software. It is intended for Path of Titans community server owners, staff teams, and community managers using official server-side tools such as RCON and webhooks.

---

## Highlights

- **Discord bot** with slash commands for server ops, economy, moderation, analytics, events, and account linking.
- **Path of Titans RCON integration** for announcements, saves, player lists, raw commands, and configurable reward actions.
- **Webhook ingestion** for player activity, reports, server alerts, chat commands, purchases, security events, and analytics.
- **MySQL-backed storage** for persistent, production-ready player and community data.
- **Multi-community dashboard** so each community can access only its own players, wallets, settings, events, and logs.
- **Economy system** with wallets, ledger entries, shop items, paid rewards, and staff-controlled balance editing.
- **Player management** with AGID profiles, Discord account linking, notes, flags, last-seen data, and verification workflows.
- **Moderation tools** for notes, kicks, moderation history, reports, security alerts, and case tracking.
- **Event infrastructure** for creating events, starting events, tracking scores, and showing leaderboards.
- **Player engagement tools** through configurable in-game chat commands, teleports, shop rewards, and daily/server perks.
- **Dino and nesting records** for tracking dinosaur profiles, growth, diet, gender, nesting limits, and notes.
- **Audit logging** for dashboard edits, wallet changes, RCON actions, server presets, and administrative changes.
- **Docker-ready deployment** with a production deployment checklist.

---

## Feature Overview

### Discord Commands

TitanCore registers slash commands for staff and player-facing workflows.

| Command | Purpose |
| --- | --- |
| `/server announce` | Send an in-game announcement through RCON. |
| `/server players` | Request the current player list from the server. |
| `/server save` | Trigger a server save. |
| `/server rcon` | Run a raw RCON command for trusted staff. |
| `/link` | Link a Discord account to an Alderon Games ID. |
| `/economy balance` | Show the linked player wallet balance. |
| `/economy shop` | Show enabled shop items. |
| `/economy buy` | Purchase a configured shop reward. |
| `/economy add` | Staff command to add coins to a player wallet. |
| `/mod note` | Add a moderation note. |
| `/mod kick` | Create a case and kick a player by AGID. |
| `/mod history` | Show recent moderation history for a player. |
| `/analytics today` | Show webhook activity counts for today. |
| `/analytics player` | Show recent webhook events for a player. |
| `/event create` | Create a community event. |
| `/event start` | Mark an event active and announce it in-game. |
| `/event leaderboard` | Show event scores. |

### Admin Dashboard

The dashboard is available at:

```txt
http://localhost:3000/dashboard
```

Dashboard areas:

| Area | What It Does |
| --- | --- |
| Overview | Server activity, recent webhook events, bot readiness, audit logs, and totals. |
| Players | Create and edit player profiles, AGIDs, Discord IDs, usernames, and notes. |
| Wallets | Set, add, or subtract player balances with ledger entries. |
| Shop | Configure purchasable RCON-backed rewards. |
| Teleports | Configure paid or free teleport locations. |
| Commands | Configure in-game chat commands such as `!marks`, `!heal`, and `!grow`. |
| Dino Profiles | Track dinosaur, growth, diet, gender, notes, and nesting limits. |
| Events | Create and manage community events. |
| Moderation | Inspect moderation cases, reports, security alerts, and server errors. |
| Server | Run server presets or raw RCON commands. |
| Settings | Update shop text, banking, auto-verification, and command prefix settings. |
| Communities | Global-owner tools for creating communities and issuing scoped dashboard tokens. |

### Economy System

TitanCore stores economy data in MySQL and supports:

- Player wallets.
- Staff balance edits.
- Ledger history for every wallet change.
- Shop items with prices.
- RCON-backed purchases.
- Paid teleports.
- Configurable command costs.
- Per-community economy isolation.

Example shop reward template:

```txt
givemarks {agid} 2500
```

When a player buys that item, `{agid}` is replaced with their linked Alderon Games ID.

### Player Profiles And Linking

Player data is stored by community and can include:

- Alderon Games ID.
- Discord ID.
- Alderon username.
- Staff notes.
- Flags.
- Last seen timestamp.
- Wallet balance.
- Moderation history.
- Dino profiles.
- Nesting records.

Players can run:

```txt
/link agid:<their-agid>
```

TitanCore generates a verification code. If Path of Titans `PlayerChat` or `PlayerCommand` webhooks are enabled, the bot can auto-verify the link when the player sends the code in-game.

### Moderation

Moderation features include:

- Case tracking.
- Staff notes.
- Kick actions through RCON.
- Player history lookup.
- Player report webhook ingestion.
- Player hack/security alert ingestion.
- Server error alerting.
- Full audit log visibility.

### Analytics

TitanCore records Path of Titans webhook payloads into MySQL for reporting and staff review.

Tracked event categories can include:

- Player login.
- Player logout.
- Player killed.
- Player report.
- Player chat.
- Player command.
- Player purchase.
- Player hack.
- Server start.
- Server restart.
- Server error.
- Security alert.
- Admin command.

### Event Infrastructure

Event tools include:

- Event creation.
- Active/scheduled status.
- Event announcements through RCON.
- Score tracking.
- Leaderboards.
- Dashboard event management.

### Multi-Community Model

TitanCore is designed so multiple communities can run through one bot/dashboard instance.

- `DASHBOARD_ADMIN_TOKEN` is the global owner token.
- Global owners can create communities in the dashboard.
- Each community can have separate dashboard users.
- Each dashboard token resolves to one community.
- Every major table is scoped by `community_id`.
- Communities cannot see or edit another community's players, wallets, shop, teleports, commands, events, cases, logs, or settings.

Community-scoped webhook URL format:

```txt
https://your-domain.com/pot/webhooks/community/{community-slug}/{event-name}
```

Example:

```txt
https://your-domain.com/pot/webhooks/community/default/player-login
```

---

## Technology Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js |
| Discord | discord.js |
| Web Server | Express |
| Database | MySQL |
| RCON | rcon-client |
| Validation | zod |
| Dashboard | Static HTML, CSS, and JavaScript served by Express |
| Deployment | npm, PM2, Docker, or VPS |

---

## Database Tables

TitanCore creates the database and all required tables with:

```bash
npm run db:init
```

Current schema includes:

```txt
communities
dashboard_users
community_settings
player_profiles
player_links
wallets
ledger
shop_items
teleport_locations
custom_commands
dino_profiles
nests
moderation_cases
pot_events
events
event_scores
audit_logs
```

---

## First Run

Use this section while running locally, testing, or preparing the bot before public deployment.

### 1. Install Requirements

Install:

- Node.js 20+
- MySQL 8+
- A Path of Titans server with RCON enabled
- A Discord application and bot token

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=

POT_RCON_HOST=
POT_RCON_PORT=7779
POT_RCON_PASSWORD=

WEBHOOK_PORT=3000
WEBHOOK_SECRET=
STAFF_LOG_CHANNEL_ID=
DASHBOARD_ADMIN_TOKEN=

MYSQL_HOST=
MYSQL_PORT=3306
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=TitanCore

DEFAULT_COMMUNITY_SLUG=default
DEFAULT_COMMUNITY_NAME=TitanCore Default Community
```

### 4. Initialize MySQL

This creates the database, tables, default community, default dashboard user, settings, shop items, teleports, and custom commands.

```bash
npm run db:init
```

### 5. Deploy Discord Slash Commands

```bash
npm run deploy
```

### 6. Start In Development

```bash
npm run dev
```

### 7. Open Dashboard

```txt
http://localhost:3000/dashboard
```

Use the value of `DASHBOARD_ADMIN_TOKEN` to unlock the dashboard.

---

## Discord Developer Portal Setup

1. Go to the Discord Developer Portal.
2. Create a new application.
3. Add a bot.
4. Copy the bot token into `DISCORD_TOKEN`.
5. Copy the application ID into `DISCORD_CLIENT_ID`.
6. Copy your test server ID into `DISCORD_GUILD_ID`.
7. Under OAuth2 URL Generator, select:
   - `bot`
   - `applications.commands`
8. Recommended permissions:
   - Send Messages
   - Use Slash Commands
   - Manage Roles, if role sync is added
   - Kick Members, if Discord moderation is added
   - Ban Members, only if needed

---

## Path of Titans RCON Setup

Example `Game.ini`:

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

For production, allowlist the bot server IP if your hosting setup supports it:

```ini
[SourceRCON]
IPAllowList=YOUR_BOT_SERVER_IP
```

---

## Path of Titans Webhook Setup

Use `Format="General"` so TitanCore can process webhook payloads itself.

Single/default community example:

```ini
[ServerWebhooks]
bEnabled=true
Format="General"
PlayerLogin="https://your-domain.com/pot/webhooks/community/default/player-login"
PlayerLogout="https://your-domain.com/pot/webhooks/community/default/player-logout"
PlayerKilled="https://your-domain.com/pot/webhooks/community/default/player-killed"
PlayerReport="https://your-domain.com/pot/webhooks/community/default/player-report"
PlayerChat="https://your-domain.com/pot/webhooks/community/default/player-chat"
PlayerCommand="https://your-domain.com/pot/webhooks/community/default/player-command"
PlayerPurchase="https://your-domain.com/pot/webhooks/community/default/player-purchase"
PlayerHack="https://your-domain.com/pot/webhooks/community/default/player-hack"
ServerStart="https://your-domain.com/pot/webhooks/community/default/server-start"
ServerRestart="https://your-domain.com/pot/webhooks/community/default/server-restart"
ServerError="https://your-domain.com/pot/webhooks/community/default/server-error"
SecurityAlert="https://your-domain.com/pot/webhooks/community/default/security-alert"
AdminCommand="https://your-domain.com/pot/webhooks/community/default/admin-command"
```

---

## Deploying To The Public Web

When you are ready to deploy to the world wide web:

1. Use a VPS or dedicated host.
2. Use HTTPS with a real domain.
3. Put the dashboard behind HTTPS.
4. Rotate any credentials that were shared during setup.
5. Use a long random `DASHBOARD_ADMIN_TOKEN`.
6. Firewall the MySQL port.
7. Firewall and allowlist the RCON port.
8. Back up MySQL daily.
9. Test RCON templates on a staging server.
10. Run the bot with PM2, Docker, or another process manager.

Production start:

```bash
npm start
```

Docker:

```bash
docker build -t titancore-pot-bot .
docker run --env-file .env -p 3000:3000 titancore-pot-bot
```

---

## Security Notes

- Never commit `.env`.
- Rotate credentials if they were pasted into chat or shared publicly.
- Use one dashboard token per community admin or staff member.
- Disable staff tokens when people leave.
- Keep raw RCON access restricted to trusted owners only.
- Prefer dashboard presets and configured actions over raw RCON.
- Back up MySQL before large schema or economy changes.
- Keep the dashboard behind HTTPS in production.

---

## Project Scripts

| Script | Description |
| --- | --- |
| `npm install` | Install dependencies. |
| `npm run db:init` | Create/upgrade MySQL database tables and seed defaults. |
| `npm run deploy` | Register Discord slash commands for the configured guild. |
| `npm run dev` | Start with nodemon for development. |
| `npm start` | Start the bot normally. |
| `npm run check` | Syntax-check core entry files. |

---

## Roadmap

- Role-based dashboard permissions per feature area.
- Scheduled engagement jobs such as daily rewards and recurring announcements.
- More detailed analytics dashboards and charts.
- Subscription/billing controls for hosted multi-community use.
- Staff action exports and moderation report downloads.
- Optional migration tooling for importing legacy bot data.

