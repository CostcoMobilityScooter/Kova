const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Kova is online as ${client.user.tag}`);
    console.log(`📡 Serving ${client.guilds.cache.size} guild(s)`);

    client.user.setPresence({
      activities: [{ name: `${client.guilds.cache.size} servers`, type: ActivityType.Watching }],
      status: 'online',
    });
  },
};
