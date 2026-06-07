const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db, ensureGuild } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Invite tracking')
    .addSubcommand(s => s.setName('check').setDescription('Check invite count')
      .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false)))
    .addSubcommand(s => s.setName('leaderboard').setDescription('Top inviters'))
    .addSubcommand(s => s.setName('who').setDescription('Who invited a user')
      .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(true))),

  async execute(interaction) {
    ensureGuild(interaction.guildId);
    const sub = interaction.options.getSubcommand();

    if (sub === 'check') {
      const target = interaction.options.getUser('user') || interaction.user;
      const row = db.prepare('SELECT * FROM invite_tracking WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, target.id);
      const embed = new EmbedBuilder()
        .setTitle('📨 Invite Stats')
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: 'User', value: `${target}`, inline: true },
          { name: 'Total Invites', value: String(row?.total || 0), inline: true },
          { name: 'Left', value: String(row?.left || 0), inline: true }
        )
        .setColor(0x5865f2);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'leaderboard') {
      const rows = db.prepare('SELECT user_id, total FROM invite_tracking WHERE guild_id = ? ORDER BY total DESC LIMIT 10').all(interaction.guildId);
      if (!rows.length) return interaction.reply({ content: '❌ No invite data yet.', ephemeral: true });
      const lines = rows.map((r, i) => `**${i + 1}.** <@${r.user_id}> — ${r.total} invite${r.total !== 1 ? 's' : ''}`).join('\n');
      const embed = new EmbedBuilder().setTitle('📨 Invite Leaderboard').setDescription(lines).setColor(0x5865f2);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'who') {
      const target = interaction.options.getUser('user');
      const row = db.prepare('SELECT * FROM invite_joins WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, target.id);
      if (!row || !row.inviter_id) return interaction.reply({ content: `❌ No invite data found for ${target.username}.`, ephemeral: true });
      return interaction.reply({ content: `📨 ${target} was invited by <@${row.inviter_id}>.` });
    }
  }
};
