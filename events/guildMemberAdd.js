const { db, ensureGuild } = require('../utils/database');
const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const { guild } = member;
    ensureGuild(guild.id);

    // Welcome message
    const welcome = db.prepare('SELECT * FROM welcome WHERE guild_id = ?').get(guild.id);
    if (welcome?.enabled && welcome.channel_id) {
      const channel = guild.channels.cache.get(welcome.channel_id);
      if (channel) {
        const msg = (welcome.message || 'Welcome {user} to {server}!')
          .replace('{user}', `<@${member.id}>`)
          .replace('{server}', guild.name)
          .replace('{membercount}', guild.memberCount);

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('👋 Welcome!')
          .setDescription(msg)
          .setThumbnail(member.user.displayAvatarURL())
          .setFooter({ text: `Member #${guild.memberCount}` })
          .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // Auto roles
    const autoroles = db.prepare('SELECT * FROM autoroles WHERE guild_id = ?').all(guild.id);
    for (const { role_id } of autoroles) {
      const role = guild.roles.cache.get(role_id);
      if (role) await member.roles.add(role).catch(() => {});
    }

    // Unverified role + DM verification flow
    const verification = db.prepare('SELECT * FROM verification WHERE guild_id = ?').get(guild.id);
    if (verification?.enabled) {
      if (verification.unverified_role) {
        const role = guild.roles.cache.get(verification.unverified_role);
        if (role) await member.roles.add(role).catch(() => {});
      }
      // Send DM verification flow
      const { startVerificationDM } = require('../handlers/verifyHandler');
      await startVerificationDM(member, verification);
    }

    // Log join
    const joinEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('📥 Member Joined')
      .setDescription(`<@${member.id}> joined the server`)
      .addFields(
        { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();
    await sendLog(client, guild.id, 'joins', joinEmbed);
  },
};
