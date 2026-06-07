const { db } = require('./database');
const { EmbedBuilder } = require('discord.js');

async function sendLog(client, guildId, type, embed) {
  try {
    const config = db.prepare('SELECT * FROM logs_config WHERE guild_id = ?').get(guildId);
    if (!config || !config.channel_id) return;

    const typeMap = {
      deleted: 'log_deleted',
      edited: 'log_edited',
      joins: 'log_joins',
      roles: 'log_roles',
      mod: 'log_mod',
    };

    const field = typeMap[type];
    if (field && !config[field]) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(config.channel_id);
    if (!channel) return;

    await channel.send({ embeds: [embed] });
  } catch (e) {
    // Silent fail — logging should never crash the bot
  }
}

module.exports = { sendLog };
