const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check server currency balance')
    .addUserOption(o => o.setName('user').setDescription('User to check (defaults to yourself)')),

  async execute(interaction, client) {
    await interaction.deferReply();
    const user = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;

    db.prepare('INSERT OR IGNORE INTO user_currency (guild_id, user_id) VALUES (?, ?)').run(guildId, user.id);
    const data = db.prepare('SELECT * FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, user.id);

    const rank = db.prepare('SELECT COUNT(*) as r FROM user_currency WHERE guild_id = ? AND balance > ?').get(guildId, data.balance).r + 1;

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(`💰 ${user.tag}'s Balance`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'Balance', value: `**${data.balance} coins**`, inline: true },
        { name: 'Rank', value: `**#${rank}**`, inline: true }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
