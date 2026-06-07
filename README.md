# 🤖 Kova — Full Feature Discord Bot

A complete, self-hosted Discord bot with moderation, leveling, currency, giveaways, confessions, verification, music, tickets, and much more. No coding needed after setup — everything is configured via slash commands.

---

## ✅ Features

| System | Commands |
|---|---|
| ⚙️ Server Setup | `/setup` (full config) |
| 👋 Welcome/Goodbye | Auto messages on join/leave |
| ✅ Verification | Button-based, auto-role |
| 🎭 Self-Assign Roles | Button menu, categories |
| 🛡️ Moderation | kick, ban, warn, mute, purge, lock, etc |
| 🤖 Auto-Mod | Word filter, anti-spam, anti-raid |
| 📋 Logging | Deleted/edited msgs, joins, roles, mod actions |
| 🎉 Levels & XP | XP per message, level-up roles |
| 💰 Currency | Daily rewards, balance, give, rob, work, crime |
| 🎁 Giveaways | Timed, auto-winner, reroll |
| 🤫 Confessions | Anonymous, mod reveal/delete |
| 📊 Utility | serverinfo, userinfo, poll, remind, avatar, etc |
| 👑 Admin Tools | announce, embed, DM, stats |
| 🎫 Tickets | Panel, create, close, transcript, add/remove users |
| 🎵 Music | play, skip, stop, queue, pause, resume, volume |
| 🎮 Mini-Games | coinflip, rps, trivia, hangman |
| 💤 AFK | Auto-notify pingers, remove on return |
| ⏰ Bump Reminders | Auto-remind after Disboard bumps |
| 💬 Message Count | Per-user count + leaderboard |
| 🎂 Birthdays | Set, announce, role on birthday |
| 📨 Invite Tracking | Who invited who, leaderboard |
| 🔊 Temp VCs | Auto-create/delete voice channels |
| ⚡ Auto-Reactions | Auto-react in specific channels |
| 🎭 Status Rotation | Rotating bot status messages |

---

## 🚀 Setup

### 1. Requirements
- **Node.js v18+** — [nodejs.org](https://nodejs.org)
- A Discord Bot Token — [discord.com/developers](https://discord.com/developers/applications)

### 2. Install
```bash
# Extract the ZIP, then:
cd discord-bot
npm install
```

### 3. Configure
```bash
cp .env.example .env
```
Edit `.env`:
```
TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
```

### 4. Get your Client ID
- Go to [discord.com/developers](https://discord.com/developers/applications)
- Select your app → "General Information"
- Copy the **Application ID** → paste as `CLIENT_ID`

### 5. Invite the Bot
In the Developer Portal:
- Go to OAuth2 → URL Generator
- Scopes: `bot`, `applications.commands`
- Bot Permissions: `Administrator` (recommended) or select individually
- Copy the URL and open it to invite the bot

### 6. Deploy Commands
```bash
node deploy-commands.js
```
> ⚠️ This deploys slash commands globally. It may take up to 1 hour to appear everywhere. For instant testing, add a `GUILD_ID` to .env and modify deploy-commands.js to use `Routes.applicationGuildCommands`.

### 7. Start the Bot
```bash
node index.js
# or with auto-restart:
npm install -g pm2
pm2 start index.js --name discord-bot
```

---

## ⚙️ First-Time Server Configuration

Once the bot is in your server, run these commands as an admin:

```
/setup start                          ← Initialize all systems
/setup admin-role @YourAdminRole      ← Set admin role
/setup mod role @YourModRole          ← Set mod role

/setup welcome channel #welcome       ← Set welcome channel
/setup welcome toggle                 ← Enable welcome messages

/setup verify channel #verify         ← Set verify channel
/setup verify role @Verified          ← Role given after verifying
/setup verify unverified-role @Guest  ← Role given on join
/setup verify toggle                  ← Enable verification

/setup logs channel #bot-logs         ← Enable logging
/setup levels toggle                  ← Enable XP system
/setup giveaway toggle                ← Enable giveaways
/setup confessions channel #confess   ← Enable confessions
/setup confessions toggle
```

---

## 📁 File Structure

```
discord-bot/
├── index.js                  ← Main entry point
├── deploy-commands.js        ← Deploy slash commands
├── .env                      ← Your tokens (never share this)
├── package.json
├── data/
│   └── bot.db                ← SQLite database (auto-created)
├── utils/
│   ├── database.js           ← DB connection + schema
│   ├── embeds.js             ← Embed helpers
│   ├── permissions.js        ← isAdmin/isMod checks
│   └── logger.js             ← Log channel sender
├── events/
│   ├── ready.js
│   ├── interactionCreate.js
│   ├── messageCreate.js      ← XP + automod
│   ├── messageDelete.js
│   ├── messageUpdate.js
│   ├── guildMemberAdd.js     ← Welcome + unverified role
│   ├── guildMemberRemove.js  ← Goodbye
│   └── guildMemberUpdate.js  ← Role logging
├── handlers/
│   ├── verifyHandler.js      ← Verify button logic
│   └── roleButtonHandler.js  ← Role button logic
└── commands/
    ├── setup/setup.js        ← All /setup subcommands
    ├── mod/                  ← kick, ban, warn, timeout, purge, etc.
    ├── verification/         ← /verify, /verification
    ├── fun/                  ← level, daily, giveaway, confess, etc.
    ├── utility/              ← serverinfo, poll, remind, avatar, etc.
    └── admin/                ← /admin announce/embed/dm/stats
```

---

## 🔧 Customization

- **Welcome messages** support: `{user}`, `{server}`, `{membercount}`
- **Level-up messages** support: `{user}`, `{level}`
- **XP rate** is configurable per server via `/setup levels xp`
- **Auto-ban threshold** configurable via `/setup mod warnings [number]`
- **Word filter** — add/remove words via `/setup mod filter add/remove`

---

## ❓ Troubleshooting

| Problem | Fix |
|---|---|
| Commands not showing | Run `node deploy-commands.js`, wait up to 1hr |
| Bot can't kick/ban | Make sure bot role is above target's role |
| DMs not sending | User has DMs disabled — expected behavior |
| `better-sqlite3` install error | Run `npm rebuild better-sqlite3` |

---

## 📄 License
MIT — free to use, modify, and distribute.
