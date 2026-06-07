const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('botinfo').setDescription('View information about the bot'),

  async execute(interaction, client) {
    await interaction.deferReply();

    const uptime = Date.now() - client.startTime;
    const d = Math.floor(uptime / 86400000);
    const h = Math.floor((uptime % 86400000) / 3600000);
    const m = Math.floor((uptime % 3600000) / 60000);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🤖 Kova — ${client.user.username}`)
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Users', value: `${client.users.cache.size}`, inline: true },
        { name: 'Commands', value: `${client.commands.size}`, inline: true },
        { name: 'Uptime', value: `${d}d ${h}h ${m}m`, inline: true },
        { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'discord.js', value: require('discord.js').version, inline: true },
      )
      .setFooter({ text: `ID: ${client.user.id}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
