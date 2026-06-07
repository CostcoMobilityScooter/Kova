const { db } = require('../utils/database');
const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const { guild } = member;

    // Goodbye message
    const welcome = db.prepare('SELECT * FROM welcome WHERE guild_id = ?').get(guild.id);
    if (welcome?.enabled && welcome.goodbye_channel_id) {
      const channel = guild.channels.cache.get(welcome.goodbye_channel_id);
      if (channel) {
        const msg = (welcome.goodbye_message || 'Goodbye {user}!')
          .replace('{user}', member.user.tag)
          .replace('{server}', guild.name);

        const embed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('👋 Goodbye!')
          .setDescription(msg)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // Log leave
    const leaveEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('📤 Member Left')
      .setDescription(`${member.user.tag} left the server`)
      .addFields({ name: 'User ID', value: member.id, inline: true })
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();
    await sendLog(client, guild.id, 'joins', leaveEmbed);
  },
};
