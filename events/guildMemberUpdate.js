const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const added = newRoles.filter(r => !oldRoles.has(r.id));
    const removed = oldRoles.filter(r => !newRoles.has(r.id));

    if (added.size === 0 && removed.size === 0) return;

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('🎭 Roles Updated')
      .addFields({ name: 'Member', value: `<@${newMember.id}>`, inline: true })
      .setTimestamp();

    if (added.size) embed.addFields({ name: 'Roles Added', value: added.map(r => r.toString()).join(', ') });
    if (removed.size) embed.addFields({ name: 'Roles Removed', value: removed.map(r => r.toString()).join(', ') });

    await sendLog(client, newMember.guild.id, 'roles', embed);
  },
};
