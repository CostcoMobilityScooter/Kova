const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top 10 members by XP'),

  async execute(interaction, client) {
    await interaction.deferReply();

    const guildId = interaction.guildId;
    const top = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 10').all(guildId);

    if (!top.length) {
      return interaction.editReply({ content: 'No XP data yet. Members need to chat to earn XP!' });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = await Promise.all(top.map(async (row, i) => {
      const user = await client.users.fetch(row.user_id).catch(() => null);
      const name = user ? user.tag : `Unknown (${row.user_id})`;
      const medal = medals[i] || `**${i + 1}.**`;
      return `${medal} ${name} — Level **${row.level}** (${row.xp} XP)`;
    }));

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('🏆 XP Leaderboard')
      .setDescription(lines.join('\n'))
      .setFooter({ text: interaction.guild.name })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
