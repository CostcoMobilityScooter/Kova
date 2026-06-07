const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db, ensureGuild } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('messages')
    .setDescription('Message count stats')
    .addSubcommand(s => s.setName('count').setDescription('Check message count')
      .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false)))
    .addSubcommand(s => s.setName('leaderboard').setDescription('Top message senders in this server')),

  async execute(interaction) {
    ensureGuild(interaction.guildId);
    const sub = interaction.options.getSubcommand();

    if (sub === 'count') {
      const target = interaction.options.getUser('user') || interaction.user;
      const row = db.prepare('SELECT * FROM message_counts WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, target.id);
      const count = row?.count || 0;
      const rank = db.prepare('SELECT COUNT(*) as r FROM message_counts WHERE guild_id = ? AND count > ?').get(interaction.guildId, count).r + 1;

      const embed = new EmbedBuilder()
        .setTitle('💬 Message Count')
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: 'User', value: `${target}`, inline: true },
          { name: 'Messages', value: count.toLocaleString(), inline: true },
          { name: 'Rank', value: `#${rank}`, inline: true }
        )
        .setColor(0x5865f2);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'leaderboard') {
      const rows = db.prepare('SELECT user_id, count FROM message_counts WHERE guild_id = ? ORDER BY count DESC LIMIT 10').all(interaction.guildId);
      if (!rows.length) return interaction.reply({ content: '❌ No message data yet.', ephemeral: true });

      const lines = rows.map((r, i) => `**${i + 1}.** <@${r.user_id}> — ${r.count.toLocaleString()} messages`).join('\n');
      const embed = new EmbedBuilder()
        .setTitle('💬 Message Leaderboard')
        .setDescription(lines)
        .setColor(0x5865f2)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }
  }
};
