const { db, ensureGuild } = require('../utils/database');
const { EmbedBuilder } = require('discord.js');

const DISBOARD_ID = '302050872383242240';

// Spam tracking
const spamMap = new Map(); // userId -> { count, lastTime }
const raidMap = new Map(); // guildId -> { joins: [], lastAlert }

function getXpForLevel(level) {
  return 100 * (level + 1);
}

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    ensureGuild(message.guild.id);
    const guildId = message.guild.id;

    // ── Auto-mod ──────────────────────────────────────────────
    const modConfig = db.prepare('SELECT * FROM mod_config WHERE guild_id = ?').get(guildId);
    const member = message.member;

    if (modConfig) {
      // Word filter
      if (modConfig.filter_enabled) {
        const words = db.prepare('SELECT word FROM filtered_words WHERE guild_id = ?').all(guildId).map(r => r.word.toLowerCase());
        const content = message.content.toLowerCase();
        if (words.some(w => content.includes(w))) {
          await message.delete().catch(() => {});
          const warn = await message.channel.send(`⚠️ <@${message.author.id}>, that word is not allowed here.`);
          setTimeout(() => warn.delete().catch(() => {}), 5000);
          return;
        }
      }

      // Anti-spam
      if (modConfig.antispam_enabled && !member?.permissions.has('ManageMessages')) {
        const key = `${guildId}:${message.author.id}`;
        const now = Date.now();
        const entry = spamMap.get(key) || { count: 0, lastTime: now };

        if (now - entry.lastTime < 5000) {
          entry.count++;
        } else {
          entry.count = 1;
          entry.lastTime = now;
        }
        spamMap.set(key, entry);

        if (entry.count >= 5) {
          // Delete recent messages and mute
          const msgs = await message.channel.messages.fetch({ limit: 10 }).catch(() => null);
          if (msgs) {
            const toDelete = msgs.filter(m => m.author.id === message.author.id);
            await message.channel.bulkDelete(toDelete).catch(() => {});
          }
          await message.member.timeout(5 * 60 * 1000, 'Auto-mod: Spamming').catch(() => {});
          const warn = await message.channel.send(`⚠️ <@${message.author.id}> has been muted for spamming.`);
          setTimeout(() => warn.delete().catch(() => {}), 8000);
          spamMap.delete(key);
          return;
        }
      }
    }

    // ── Sticky Messages ───────────────────────────────────────
    const sticky = db.prepare('SELECT * FROM sticky_messages WHERE guild_id = ? AND channel_id = ?').get(guildId, message.channelId);
    if (sticky) {
      // Delete old sticky
      const oldMsg = await message.channel.messages.fetch(sticky.last_message_id).catch(() => null);
      if (oldMsg) await oldMsg.delete().catch(() => {});
      // Repost
      const newSticky = await message.channel.send({ embeds: [
        { color: 0xf1c40f, description: `📌 **Sticky:** ${sticky.content}`, footer: { text: 'Sticky Message' } }
      ] }).catch(() => null);
      if (newSticky) {
        db.prepare('UPDATE sticky_messages SET last_message_id = ? WHERE guild_id = ? AND channel_id = ?')
          .run(newSticky.id, guildId, message.channelId);
      }
    }

    // ── Message Count ─────────────────────────────────────────
    db.prepare(`INSERT INTO message_counts (guild_id, user_id, count) VALUES (?, ?, 1)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET count = count + 1`).run(guildId, message.author.id);

    // ── Auto-Reactions ────────────────────────────────────────
    const autoReacts = db.prepare('SELECT emoji FROM auto_reactions WHERE guild_id = ? AND channel_id = ?').all(guildId, message.channelId);
    for (const { emoji } of autoReacts) {
      await message.react(emoji).catch(() => {});
    }

    // ── AFK: Remove AFK when user sends a message ─────────────
    const afkSelf = db.prepare('SELECT * FROM afk WHERE guild_id = ? AND user_id = ?').get(guildId, message.author.id);
    if (afkSelf) {
      db.prepare('DELETE FROM afk WHERE guild_id = ? AND user_id = ?').run(guildId, message.author.id);
      const reply = await message.reply('👋 Welcome back! Your AFK status has been removed.').catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => {}), 5000);
      // Remove [AFK] from nickname
      try {
        const nick = message.member.nickname || '';
        if (nick.startsWith('[AFK]')) await message.member.setNickname(nick.replace('[AFK] ', '').trim()).catch(() => {});
      } catch {}
    }

    // ── AFK: Notify when user pings an AFK user ───────────────
    const mentionedUsers = message.mentions.users;
    for (const [, user] of mentionedUsers) {
      if (user.id === message.author.id) continue;
      const afk = db.prepare('SELECT * FROM afk WHERE guild_id = ? AND user_id = ?').get(guildId, user.id);
      if (afk) {
        const since = `<t:${afk.set_at}:R>`;
        const reply = await message.reply(`💤 **${user.username}** is AFK ${since}: ${afk.reason}`).catch(() => null);
        if (reply) setTimeout(() => reply.delete().catch(() => {}), 8000);
      }
    }

    // ── Bump Reminder (Disboard) ──────────────────────────────
    if (message.author.id === DISBOARD_ID && message.embeds.length > 0) {
      const embed = message.embeds[0];
      if (embed.description?.includes('Bump done')) {
        const config = db.prepare('SELECT * FROM bump_config WHERE guild_id = ? AND enabled = 1').get(guildId);
        if (config) {
          const bumpTime = Math.floor(Date.now() / 1000);
          db.prepare('UPDATE bump_config SET last_bump = ? WHERE guild_id = ?').run(bumpTime, guildId);
          const remindAt = bumpTime + 7200;
          db.prepare('INSERT OR REPLACE INTO bump_reminders (guild_id, remind_at) VALUES (?, ?)').run(guildId, remindAt);
        }
      }
    }

    // ── XP / Levels ───────────────────────────────────────────
    const levelsConfig = db.prepare('SELECT * FROM levels_config WHERE guild_id = ?').get(guildId);
    if (levelsConfig?.enabled) {
      const now = Math.floor(Date.now() / 1000);
      const xpPerMessage = levelsConfig.xp_per_message || 15;

      let userLevel = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(guildId, message.author.id);
      if (!userLevel) {
        db.prepare('INSERT INTO user_levels (guild_id, user_id) VALUES (?, ?)').run(guildId, message.author.id);
        userLevel = { xp: 0, level: 0, last_message: 0 };
      }

      // Cooldown: 1 message per minute earns XP
      if (now - userLevel.last_message >= 60) {
        const xpGain = Math.floor(Math.random() * xpPerMessage) + Math.floor(xpPerMessage / 2);
        const newXp = (userLevel.xp || 0) + xpGain;
        let newLevel = userLevel.level || 0;
        let leveledUp = false;

        while (newXp >= getXpForLevel(newLevel)) {
          newLevel++;
          leveledUp = true;
        }

        db.prepare('UPDATE user_levels SET xp = ?, level = ?, last_message = ? WHERE guild_id = ? AND user_id = ?')
          .run(newXp, newLevel, now, guildId, message.author.id);

        if (leveledUp) {
          // Level up message
          const lvlMsg = (levelsConfig.message || 'GG {user}, you reached level {level}!')
            .replace('{user}', `<@${message.author.id}>`)
            .replace('{level}', newLevel);

          const lvlChannel = levelsConfig.channel_id ? message.guild.channels.cache.get(levelsConfig.channel_id) : message.channel;
          if (lvlChannel) {
            const embed = new EmbedBuilder()
              .setColor(0xf1c40f)
              .setDescription(`🎉 ${lvlMsg}`)
              .setTimestamp();
            await lvlChannel.send({ embeds: [embed] }).catch(() => {});
          }

          // Level roles
          const levelRoles = db.prepare('SELECT * FROM level_roles WHERE guild_id = ? AND level_required <= ?').all(guildId, newLevel);
          for (const lr of levelRoles) {
            const role = message.guild.roles.cache.get(lr.role_id);
            if (role && !message.member.roles.cache.has(lr.role_id)) {
              await message.member.roles.add(role).catch(() => {});
            }
          }
        }
      }
    }
  },
};
