const { db } = require('../utils/database');

const inviteCache = new Map();

async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const map = new Map();
    invites.forEach(inv => map.set(inv.code, inv.uses || 0));
    inviteCache.set(guild.id, map);
  } catch {}
}

module.exports = { inviteCache, cacheInvites };
