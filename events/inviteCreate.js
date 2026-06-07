const { db } = require('../utils/database');

// Cache invites per guild: Map<guildId, Map<code, uses>>
const inviteCache = new Map();

module.exports = {
  name: 'inviteCreate',
  async execute(invite) {
    const cache = inviteCache.get(invite.guild.id) || new Map();
    cache.set(invite.code, invite.uses || 0);
    inviteCache.set(invite.guild.id, cache);
  }
};
