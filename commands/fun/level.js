const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { errorEmbed } = require('../../utils/embeds');

function xpForLevel(level) { return 100 * (level + 1); }

function buildBar(current, needed, length = 20) {
  const filled = Math.round((current / needed) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your level or another member\'s level')
    .addUserOption(o => o.setName('user').setDescription('User to check')),

  async execute(interaction, client) {
    await interaction.deferReply();

    const user = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;

    const data = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(guildId, user.id);
    if (!data) {
      return interaction.editReply({ embeds: [errorEmbed('No Data', `${user.tag} hasn't earned any XP yet.`)] });
    }

    const needed = xpForLevel(data.level);
    const rank = db.prepare('SELECT COUNT(*) as r FROM user_levels WHERE guild_id = ? AND xp > ?').get(guildId, data.xp).r + 1;

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(`📊 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'Level', value: `**${data.level}**`, inline: true },
        { name: 'XP', value: `**${data.xp}** / ${needed}`, inline: true },
        { name: 'Rank', value: `**#${rank}**`, inline: true },
        { name: 'Progress', value: `\`${buildBar(data.xp % needed || data.xp, needed)}\` ${Math.round(((data.xp % needed || data.xp) / needed) * 100)}%` }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
