const { ChannelType } = require('discord.js');
const { db } = require('../utils/database');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const guildId = newState.guild?.id || oldState.guild?.id;
    if (!guildId) return;

    // --- Temp VC: Create on join trigger ---
    if (newState.channelId) {
      const config = db.prepare('SELECT * FROM tempvc_config WHERE guild_id = ? AND trigger_channel_id = ?').get(guildId, newState.channelId);
      if (config) {
        const member = newState.member;
        const name = config.name_template.replace('{user}', member.displayName);
        const category = newState.channel.parent;

        const newChannel = await newState.guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          parent: category,
          userLimit: 0,
        }).catch(() => null);

        if (newChannel) {
          db.prepare('INSERT INTO temp_vcs (guild_id, channel_id, owner_id) VALUES (?, ?, ?)').run(guildId, newChannel.id, member.id);
          await member.voice.setChannel(newChannel).catch(() => {});
        }
      }
    }

    // --- Temp VC: Delete when empty ---
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const tempVc = db.prepare('SELECT * FROM temp_vcs WHERE guild_id = ? AND channel_id = ?').get(guildId, oldState.channelId);
      if (tempVc) {
        const ch = oldState.guild.channels.cache.get(oldState.channelId);
        if (ch && ch.members.size === 0) {
          await ch.delete().catch(() => {});
          db.prepare('DELETE FROM temp_vcs WHERE id = ?').run(tempVc.id);
        }
      }
    }
  }
};
