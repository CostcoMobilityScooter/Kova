const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, client) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('✏️ Message Edited')
      .addFields(
        { name: 'Author', value: `<@${newMessage.author.id}> (${newMessage.author.tag})`, inline: true },
        { name: 'Channel', value: `<#${newMessage.channelId}>`, inline: true },
        { name: 'Before', value: oldMessage.content?.slice(0, 512) || '*Unknown*' },
        { name: 'After', value: newMessage.content?.slice(0, 512) || '*Empty*' }
      )
      .setTimestamp();

    await sendLog(client, newMessage.guild.id, 'edited', embed);
  },
};
