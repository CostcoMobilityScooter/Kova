require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { db } = require('./utils/database');
const { startWebServer } = require('./web/server');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

client.commands = new Collection();
client.cooldowns = new Collection();
client.startTime = Date.now();

// Load commands
function loadCommands(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      loadCommands(fullPath);
    } else if (file.name.endsWith('.js')) {
      const command = require(fullPath);
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
      }
    }
  }
}

loadCommands(path.join(__dirname, 'commands'));

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Giveaway checker — runs every 10s
setInterval(async () => {
  const now = Math.floor(Date.now() / 1000);
  const ending = db.prepare('SELECT * FROM giveaways WHERE ended = 0 AND ends_at <= ?').all(now);
  for (const giveaway of ending) {
    try {
      const guild = client.guilds.cache.get(giveaway.guild_id);
      if (!guild) continue;
      const channel = guild.channels.cache.get(giveaway.channel_id);
      if (!channel) continue;
      const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
      if (!message) continue;

      const reaction = message.reactions.cache.get('🎉');
      const users = reaction ? (await reaction.users.fetch()).filter(u => !u.bot) : new Collection();
      const winner = users.size > 0 ? users.random() : null;

      db.prepare('UPDATE giveaways SET ended = 1, winner_id = ? WHERE id = ?').run(winner?.id || null, giveaway.id);

      const embed = {
        color: 0xf1c40f,
        title: '🎉 Giveaway Ended',
        description: `**Prize:** ${giveaway.prize}\n**Winner:** ${winner ? `<@${winner.id}>` : 'No valid entries'}`,
        footer: { text: `Giveaway ID: ${giveaway.id}` },
        timestamp: new Date().toISOString(),
      };
      await message.edit({ embeds: [embed], components: [] });
      if (winner) await channel.send(`🎉 Congrats <@${winner.id}>! You won **${giveaway.prize}**!`);
      else await channel.send('No valid entries for the giveaway. No winner was selected.');
    } catch (e) {
      console.error('Giveaway error:', e);
    }
  }
}, 10000);

// Server stats updater — runs every 10 minutes
setInterval(async () => {
  const rows = db.prepare('SELECT * FROM serverstats WHERE enabled = 1').all();
  for (const row of rows) {
    try {
      const guild = client.guilds.cache.get(row.guild_id);
      if (!guild) continue;

      const members = await guild.members.fetch();
      const total = members.size;
      const bots = members.filter(m => m.user.bot).size;
      const humans = total - bots;
      const online = members.filter(m => m.presence?.status && m.presence.status !== 'offline').size;

      const updates = [
        [row.total_ch, `👥 Total: ${total}`],
        [row.humans_ch, `🧑 Humans: ${humans}`],
        [row.bots_ch, `🤖 Bots: ${bots}`],
        [row.online_ch, `🟢 Online: ${online}`],
      ];

      for (const [id, name] of updates) {
        const ch = guild.channels.cache.get(id);
        if (ch && ch.name !== name) await ch.setName(name).catch(() => {});
      }
    } catch (e) {
      console.error('Serverstats update error:', e);
    }
  }
}, 10 * 60 * 1000);

// Birthday checker — runs once per day at midnight UTC
const { ActivityType } = require('discord.js');
const { inviteCache, cacheInvites } = require('./utils/inviteCache');

client.on('guildCreate', async guild => {
  await cacheInvites(guild);
});

client.on('inviteCreate', invite => {
  const cache = inviteCache.get(invite.guild.id) || new Map();
  cache.set(invite.code, invite.uses || 0);
  inviteCache.set(invite.guild.id, cache);
});

client.on('guildMemberAdd', async member => {
  // Invite tracking
  try {
    const cached = inviteCache.get(member.guild.id) || new Map();
    const newInvites = await member.guild.invites.fetch();
    let usedCode = null;
    for (const [code, inv] of newInvites) {
      const prev = cached.get(code) || 0;
      if (inv.uses > prev) { usedCode = inv; break; }
    }
    newInvites.forEach(inv => cached.set(inv.code, inv.uses || 0));
    inviteCache.set(member.guild.id, cached);

    if (usedCode?.inviter) {
      db.prepare('INSERT OR IGNORE INTO invite_tracking (guild_id, user_id) VALUES (?, ?)').run(member.guild.id, usedCode.inviter.id);
      db.prepare('UPDATE invite_tracking SET total = total + 1 WHERE guild_id = ? AND user_id = ?').run(member.guild.id, usedCode.inviter.id);
      db.prepare('INSERT OR REPLACE INTO invite_joins (guild_id, user_id, inviter_id, invite_code) VALUES (?, ?, ?, ?)').run(member.guild.id, member.id, usedCode.inviter.id, usedCode.code);
    }
  } catch {}
});

client.on('guildMemberRemove', async member => {
  // Subtract from inviter count
  try {
    const join = db.prepare('SELECT * FROM invite_joins WHERE guild_id = ? AND user_id = ?').get(member.guild.id, member.id);
    if (join?.inviter_id) {
      db.prepare('UPDATE invite_tracking SET left = left + 1 WHERE guild_id = ? AND user_id = ?').run(member.guild.id, join.inviter_id);
    }
  } catch {}
});

// Birthday checker — runs every hour
setInterval(async () => {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const hour = now.getUTCHours();
  if (hour !== 9) return; // Only announce at 9 AM UTC

  const birthdays = db.prepare('SELECT b.*, bc.channel_id, bc.role_id FROM birthdays b JOIN birthday_config bc ON b.guild_id = bc.guild_id WHERE b.month = ? AND b.day = ?').all(month, day);
  for (const bd of birthdays) {
    try {
      const guild = client.guilds.cache.get(bd.guild_id);
      if (!guild) continue;
      const channel = guild.channels.cache.get(bd.channel_id);
      if (!channel) continue;
      await channel.send(`🎂 Happy Birthday <@${bd.user_id}>! 🎉`);
      if (bd.role_id) {
        const member = await guild.members.fetch(bd.user_id).catch(() => null);
        if (member) await member.roles.add(bd.role_id).catch(() => {});
      }
    } catch {}
  }
}, 60 * 60 * 1000);

// Bump reminder checker — runs every minute
setInterval(async () => {
  const now = Math.floor(Date.now() / 1000);
  const due = db.prepare('SELECT br.*, bc.channel_id, bc.role_id FROM bump_reminders br JOIN bump_config bc ON br.guild_id = bc.guild_id WHERE br.remind_at <= ? AND bc.enabled = 1').all(now);
  for (const row of due) {
    try {
      const guild = client.guilds.cache.get(row.guild_id);
      if (!guild) continue;
      const channel = guild.channels.cache.get(row.channel_id);
      if (!channel) continue;
      const mention = row.role_id ? `<@&${row.role_id}>` : '@here';
      await channel.send(`⏰ ${mention} It's time to bump the server! Use \`/bump\` on Disboard.`);
      db.prepare('DELETE FROM bump_reminders WHERE guild_id = ?').run(row.guild_id);
    } catch {}
  }
}, 60 * 1000);

// Status rotation — runs every minute, checks interval per guild
let statusIndex = 0;
setInterval(async () => {
  try {
    // Use statuses from the first guild that has them (global-ish rotation)
    const allStatuses = db.prepare('SELECT * FROM bot_statuses ORDER BY guild_id, id').all();
    if (!allStatuses.length) return;
    const status = allStatuses[statusIndex % allStatuses.length];
    const typeMap = { Playing: ActivityType.Playing, Watching: ActivityType.Watching, Listening: ActivityType.Listening, Competing: ActivityType.Competing };
    client.user.setActivity(status.text, { type: typeMap[status.type] || ActivityType.Playing });
    statusIndex++;
  } catch {}
}, 60 * 1000);

// Start the web dashboard. The server is created immediately so Railway's
// health checks can reach port 3000 right away; the Discord client reference
// is passed in so routes can query live bot data once the client is ready.
startWebServer(client);

client.login(process.env.TOKEN);
