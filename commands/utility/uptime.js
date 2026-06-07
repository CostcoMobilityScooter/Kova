const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('uptime').setDescription('Check how long the bot has been online'),

  async execute(interaction, client) {
    const uptime = Date.now() - client.startTime;
    const d = Math.floor(uptime / 86400000);
    const h = Math.floor((uptime % 86400000) / 3600000);
    const m = Math.floor((uptime % 3600000) / 60000);
    const s = Math.floor((uptime % 60000) / 1000);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('⏱️ Uptime')
      .setDescription(`**${d}d ${h}h ${m}m ${s}s**`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
