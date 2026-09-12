# Botly Tickets

**Botly Tickets** is an independent, Railway-ready Discord ticket system built with Node.js 20+ and Discord.js 14. It combines the strongest general patterns found in established open-source ticket projects—panel-driven intake, modal questions, explicit lifecycle state, claims, participants, priorities, transcripts, audit events, limits, and automation—without copying their source code, branding, assets, or distinctive text.

## Features

- Ticket creation panel with department dropdown: General, Billing, Technical, and Reports.
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
