const { EmbedBuilder } = require('discord.js');
const { db } = require('../utils/database');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user, client) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

    const guildId = reaction.message.guildId;
    if (!guildId) return;
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

    // ── Reaction Roles ────────────────────────────────────────
    const rr = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?')
      .get(guildId, reaction.message.id, emoji);

    if (rr) {
      const role = guild.roles.cache.get(rr.role_id);
      if (role) {
        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role).catch(() => {});
        } else {
          await member.roles.add(role).catch(() => {});
        }
      }
    }

    // ── Starboard ─────────────────────────────────────────────
    if (reaction.emoji.name !== '⭐') return;

    const config = db.prepare('SELECT * FROM starboard_config WHERE guild_id = ? AND enabled = 1').get(guildId);
    if (!config) return;

    const starCount = reaction.count;
    if (starCount < config.threshold) return;

    const msg = reaction.message;
    if (msg.channelId === config.channel_id) return; // Don't star the starboard itself

    const existing = db.prepare('SELECT * FROM starboard_entries WHERE guild_id = ? AND original_message_id = ?')
      .get(guildId, msg.id);

    const starChannel = guild.channels.cache.get(config.channel_id);
    if (!starChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setAuthor({ name: msg.author.username, iconURL: msg.author.displayAvatarURL() })
      .setDescription(msg.content || null)
      .addFields({ name: 'Source', value: `[Jump to message](${msg.url})`, inline: true })
      .setFooter({ text: `#${msg.channel.name}` })
      .setTimestamp(msg.createdAt);

    if (msg.attachments.size > 0) {
      const img = msg.attachments.find(a => a.contentType?.startsWith('image/'));
      if (img) embed.setImage(img.url);
    }

    if (existing) {
      // Update the star count on existing starboard post
      const sbMsg = await starChannel.messages.fetch(existing.starboard_message_id).catch(() => null);
      if (sbMsg) await sbMsg.edit({ content: `⭐ **${starCount}**`, embeds: [embed] }).catch(() => {});
    } else {
      // Post new starboard entry
      const sent = await starChannel.send({ content: `⭐ **${starCount}**`, embeds: [embed] }).catch(() => null);
      if (sent) {
        db.prepare('INSERT INTO starboard_entries (guild_id, original_message_id, starboard_message_id) VALUES (?, ?, ?)')
          .run(guildId, msg.id, sent.id);
      }
    }
  },
};
