# Deployment Checklist

## Discord Developer Portal

1. Create an application at https://discord.com/developers/applications.
2. Add a bot.
3. Copy the bot token into `DISCORD_TOKEN`.
4. Copy the application ID into `DISCORD_CLIENT_ID`.
5. Enable `Server Members Intent` if you plan to use role sync.
6. OAuth2 invite scopes:
   - `bot`
   - `applications.commands`
7. Minimum bot permissions:
   - `Send Messages`
   - `Use Slash Commands`
   - `Manage Roles` if role sync is enabled
   - `Kick Members` or `Ban Members` only if Discord moderation is enabled

## Environment

Copy `.env.example` to `.env` and set every value.

`DASHBOARD_ADMIN_TOKEN` should be a long random password. This is the global owner token and can create communities plus community-scoped dashboard users.

Required MySQL values:

```env
MYSQL_HOST=
MYSQL_PORT=3306
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=TitanCore
DEFAULT_COMMUNITY_SLUG=default
DEFAULT_COMMUNITY_NAME=TitanCore Default Community
```

## Path of Titans RCON

Add this to `Game.ini`, changing the password and IP allowlist:

```ini
[SourceRCON]
bEnabled=true
bLogging=true
Password="UseALongSecurePassword123!"
Port=7779
IP="0.0.0.0"
IPAllowList=YOUR_BOT_SERVER_IP
MaxFailedAttempts=5
MaxConnectionsPerIP=1
MaxLoginAttempts=1
```

## Path of Titans Webhooks

Use `Format="General"` so TitanCore can process the events:

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

## Local Run

```bash
npm install
npm run db:init
npm run deploy
npm start
```

Open:

```txt
http://localhost:3000/dashboard
```

## Docker Run

```bash
docker build -t titancore-pot-bot .
docker run --env-file .env -p 3000:3000 -v titancore-data:/app/data titancore-pot-bot
```

## Production Notes

- Put the dashboard behind HTTPS.
- Firewall the RCON port and use `IPAllowList`.
- Back up the MySQL database daily.
- Test every configured RCON command template on a staging server before staff use it.
- Use one dashboard token per staff member or community admin, then rotate tokens when staff leave.
