# Botly Tickets

**Botly Tickets** is an independent, Railway-ready Discord ticket system built with Node.js 20+ and Discord.js 14. It combines the strongest general patterns found in established open-source ticket projects—panel-driven intake, modal questions, explicit lifecycle state, claims, participants, priorities, transcripts, audit events, limits, and automation—without copying their source code, branding, assets, or distinctive text.

## Features

- Ticket creation panel titled **📞 | Contact Botly.Dev Support** with department dropdown: General, Billing, Technical, and Reports.
- Panel wording: “Choose an Area / Category Based On Your Needs.” with the note “For Purchases Please Read Pricing.”
- Billing intake form: **Item / Service**, **Payment Method**, and optional **Extra Info**.
- Modal intake form requiring useful opening details.
- Private ticket channels with configurable category routing and support role access.
- Ticket lifecycle: open, claimed, closed, and reopened.
- Staff claim/unclaim workflow.
- Add and remove ticket participants.
- Rename tickets and set low, normal, high, or urgent priority.
- Plain-text transcripts generated from channel history and sent to a private log channel.
- Audit events for ticket creation, claim, participant changes, priority, rename, close, and reopen.
- Per-user open-ticket limits.
- Optional inactivity auto-close worker.
- Slash commands plus simple prefix commands.
- Guild-scoped command registration for fast development updates, or global registration for production.
- JSON persistence suitable for a Railway volume; use managed storage before scaling to multiple replicas.

## Bot-Hosting.net deployment tutorial

Botly Tickets is also prepared for [Bot-Hosting.net](https://bot-hosting.net/), which supports GitHub import, Node.js runtimes, startup commands, environment variables, file management, automatic restarts, and console logs.

### 1. Create the Discord application

Open the [Discord Developer Portal](https://discord.com/developers/applications), select **New Application**, name it, then open **Bot** and click **Add Bot**. Copy the token once and keep it private; never commit it to GitHub.

Under **Privileged Gateway Intents**, enable **Server Members Intent** and **Message Content Intent**, then save.

Open **OAuth2 → URL Generator**. Select the `bot` and `applications.commands` scopes. Grant View Channels, Send Messages, Embed Links, Read Message History, Attach Files, Manage Channels, Manage Roles, Manage Messages, and optionally Manage Nicknames. Open the generated URL and invite the bot to your server.

### 2. Import the GitHub repository

1. Create or log in to your Bot-Hosting.net account.
2. Choose **Create Deployment** and select the **Node.js** runtime.
3. Choose **Import from GitHub** and select `aliyusuf9671-design/Botly-Tickets`.
4. Use the `main` branch.
5. Set the install command to `npm install` if the panel has an install-command field.
6. Set the startup command to `npm start`.
7. Deploy the service.

The repository includes `package.json` and `package-lock.json`, so the host should install `discord.js` automatically. The `npm start` lifecycle also has a safety `prestart` install step for panels that skip the install command.

**Important:** Do not set the startup file or command to `.env`. `.env` is a configuration file, not a JavaScript module. Set the startup command to `npm start` (or `node src/index.js`) and add `DISCORD_TOKEN` in Bot-Hosting.net's environment-variable manager. A physical `.env` file is not required on the host.

### 3. Add environment variables

Open the deployment’s **Environment Variables** or **Startup & Env Variables Manager** and add:

| Variable | Required | Value |
|---|---:|---|
| `DISCORD_TOKEN` | Yes | The token copied from Discord Developer Portal |
| `DISCORD_GUILD_ID` | Recommended | Your server ID, for instant slash-command updates |
| `TICKET_CATEGORY_ID` | Optional | Category ID where open tickets should be created |
| `CLOSED_CATEGORY_ID` | Optional | Category ID for closed tickets |
| `SUPPORT_ROLE_ID` | Optional | Your support/staff role ID |
| `TICKET_LOG_CHANNEL_ID` | Optional | Private channel ID for audit logs and transcripts |
| `MAX_TICKETS_PER_USER` | Optional | For example `3` |
| `AUTO_CLOSE_HOURS` | Optional | `0` disables automatic closing |
| `BOTLY_PREFIX` | Optional | Defaults to `!` |

To copy Discord IDs, enable **Developer Mode** in Discord, then right-click the server, category, role, or channel and select **Copy ID**.

### 4. Start and verify

Open the Bot-Hosting.net console. A successful startup log looks similar to:

```text
Botly Tickets online as BotName#0000; registered 12 commands.
```

In Discord, run `/ticket-help`. Then run `/ticket-panel` in the channel where members should open tickets. Select a department from the panel, submit the modal, and verify that a private ticket channel is created.

### 5. Keep ticket data persistent

The bot stores ticket metadata in `data/tickets.json`. On Bot-Hosting.net, use the platform’s persistent file storage or backups if available for your deployment. Do not run multiple replicas against the same JSON file. For a larger server, move the store to the host’s provisioned MySQL, PostgreSQL, or MongoDB service before scaling.

### 6. Troubleshooting

If the bot exits immediately, check that `DISCORD_TOKEN` is present and that the startup command is exactly `npm start`. If slash commands do not appear, set `DISCORD_GUILD_ID` to the server ID and restart. If ticket channels are not private, verify Manage Channels and the configured support role/category IDs. If transcripts are missing, configure `TICKET_LOG_CHANNEL_ID` and grant Botly View Channel, Send Messages, Attach Files, and Read Message History there.

The host advertises a free plan with limited resources and manual renewal, so monitor the Bot-Hosting.net dashboard and console after deployment.

## Railway deployment

1. Create a new Railway service from this GitHub repository.
2. Set `DISCORD_TOKEN` in Railway Variables.
3. Optionally configure the IDs in `.env.example`.
4. Deploy with the included `npm start` command.

For durable ticket data, attach a Railway volume mounted at the project root or replace the small JSON store with a managed database before running multiple replicas. The bot is intentionally a single foreground worker and does not require a web server.

## Required Discord setup

Enable the **Server Members Intent** and **Message Content Intent** in the Discord Developer Portal. Give Botly View Channels, Send Messages, Embed Links, Read Message History, Attach Files, Manage Channels, Manage Roles, Manage Messages, and Manage Permissions as needed. Botly still checks staff roles and the invoking member's permissions before each operation.

## Commands

| Command | Purpose |
|---|---|
| `/ticket-panel` or `!panel` | Post the department selector panel |
| `/ticket` or `!open` | Open a ticket directly |
| `/close` | Close the current ticket and generate a transcript |
| `/reopen` | Reopen a closed ticket |
| `/claim` and `/unclaim` | Assign or release a ticket |
| `/add` and `/remove` | Manage participants |
| `/rename` | Rename a ticket channel |
| `/priority` | Set low, normal, high, or urgent priority |
| `/transcript` | Generate a manual transcript |
| `/ticket-stats` | View staff ticket statistics |
| `/ticket-help` | Show help |

## Configuration

- `DISCORD_TOKEN`: required bot token.
- `DISCORD_GUILD_ID`: optional development guild for instant slash-command updates.
- `TICKET_CATEGORY_ID`: optional category for open tickets.
- `CLOSED_CATEGORY_ID`: optional category for closed tickets.
- `SUPPORT_ROLE_ID`: optional staff role granted access to tickets.
- `TICKET_LOG_CHANNEL_ID`: optional private channel receiving audit messages and transcript attachments.
- `MAX_TICKETS_PER_USER`: maximum simultaneous tickets per member; defaults to 3.
- `AUTO_CLOSE_HOURS`: inactivity threshold; `0` disables automatic closure.
- `BOTLY_PREFIX`: prefix for text commands; defaults to `!`.

## Inspiration and licensing note

The implementation was designed independently from publicly documented patterns in [Open Ticket](https://github.com/open-discord-bots/open-ticket), [Sayrix/Ticket-Bot](https://github.com/Sayrix/Ticket-Bot), and the [Discord Tickets project](https://github.com/discord-tickets/bot). No source code from those projects is included here. Their licenses and terms remain applicable to their own repositories; review them separately before copying code or assets into this project.

## Privacy

Transcripts can contain sensitive support conversations and attachment URLs. Keep the log channel private, define a retention policy, and do not publish transcript links. The local JSON store and transcript attachments should be treated as operational data.
