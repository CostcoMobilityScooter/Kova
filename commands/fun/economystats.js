const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Economy stats and leaderboards')
    .addSubcommand(s => s.setName('top').setDescription('Top 10 richest members'))
    .addSubcommand(s => s.setName('stats')
      .setDescription('View detailed economy stats for a user')
      .addUserOption(o => o.setName('user').setDescription('User to check (defaults to you)'))),

  async execute(interaction, client) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ── TOP LEADERBOARD ───────────────────────────────────────────────────
    if (sub === 'top') {
      const top = db.prepare('SELECT * FROM user_currency WHERE guild_id = ? ORDER BY balance DESC LIMIT 10').all(guildId);
      if (!top.length) return interaction.editReply({ content: 'No economy data yet.' });

      const medals = ['🥇', '🥈', '🥉'];
      const lines = await Promise.all(top.map(async (row, i) => {
        const user = await client.users.fetch(row.user_id).catch(() => null);
        const name = user ? user.username : `Unknown (${row.user_id})`;
        const medal = medals[i] || `**${i + 1}.**`;
        return `${medal} **${name}** — ${row.balance.toLocaleString()} coins`;
      }));

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('💰 Economy Leaderboard')
        .setDescription(lines.join('\n'))
        .setFooter({ text: interaction.guild.name })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── USER STATS ─────────────────────────────────────────────────────────
    if (sub === 'stats') {
      const target = interaction.options.getUser('user') || interaction.user;
      const userId = target.id;

      db.prepare('INSERT OR IGNORE INTO user_currency (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
      const currency = db.prepare('SELECT * FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
      const rank = db.prepare('SELECT COUNT(*) as r FROM user_currency WHERE guild_id = ? AND balance > ?').get(guildId, currency.balance).r + 1;
      const total = db.prepare('SELECT COUNT(*) as t FROM user_currency WHERE guild_id = ?').get(guildId).t;

      // Fetch meta stats
      const getMeta = (key) => {
        const row = db.prepare('SELECT value FROM user_economy_meta WHERE guild_id = ? AND user_id = ? AND key = ?').get(guildId, userId, key);
        return row ? parseInt(row.value) : 0;
      };
      const totalEarned = getMeta('total_earned');
      const lastWork = getMeta('last_work');
      const lastCrime = getMeta('last_crime');
      const lastRob = getMeta('last_rob');

      const now = Math.floor(Date.now() / 1000);
      const fmtCooldown = (ts, cd) => ts && (now - ts < cd) ? `<t:${ts + cd}:R>` : '✅ Ready';

      // Inventory count
      const invCount = db.prepare('SELECT COUNT(*) as c FROM user_inventory WHERE guild_id = ? AND user_id = ? AND used = 0').get(guildId, userId).c;

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(`📊 ${target.username}'s Economy Stats`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '💰 Balance', value: `${currency.balance.toLocaleString()} coins`, inline: true },
          { name: '🏆 Rank', value: `#${rank} / ${total}`, inline: true },
          { name: '📈 Total Earned', value: `${totalEarned.toLocaleString()} coins`, inline: true },
          { name: '🎒 Inventory', value: `${invCount} item${invCount !== 1 ? 's' : ''}`, inline: true },
          { name: '💼 Work', value: fmtCooldown(lastWork, 3600), inline: true },
          { name: '🦹 Crime', value: fmtCooldown(lastCrime, 2700), inline: true },
          { name: '🥷 Rob', value: fmtCooldown(lastRob, 3600), inline: true },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
