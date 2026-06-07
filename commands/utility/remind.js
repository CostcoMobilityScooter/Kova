const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../../utils/embeds');

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const val = parseInt(match[1]);
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * units[match[2]];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a reminder')
    .addStringOption(o => o.setName('time').setDescription('Time e.g. 10m, 1h, 2d').setRequired(true))
    .addStringOption(o => o.setName('reminder').setDescription('What to remind you about').setRequired(true)),

  async execute(interaction, client) {
    const timeStr = interaction.options.getString('time');
    const reminder = interaction.options.getString('reminder');

    const ms = parseDuration(timeStr);
    if (!ms) return interaction.reply({ embeds: [errorEmbed('Invalid Time', 'Use format like `10m`, `1h`, `2d`')], ephemeral: true });
    if (ms > 7 * 24 * 60 * 60 * 1000) return interaction.reply({ embeds: [errorEmbed('Too Long', 'Max reminder time is 7 days.')], ephemeral: true });

    const fireAt = Math.floor((Date.now() + ms) / 1000);

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x3498db).setTitle('⏰ Reminder Set').setDescription(`I'll remind you about: **${reminder}**\n\n<t:${fireAt}:R>`).setTimestamp()],
      ephemeral: true,
    });

    setTimeout(async () => {
      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('⏰ Reminder!')
        .setDescription(`You asked me to remind you:\n\n**${reminder}**`)
        .setTimestamp();

      await interaction.user.send({ embeds: [embed] }).catch(async () => {
        // If DMs are closed, send in channel
        await interaction.channel?.send({ content: `<@${interaction.user.id}>`, embeds: [embed] }).catch(() => {});
      });
    }, ms);
  },
};
