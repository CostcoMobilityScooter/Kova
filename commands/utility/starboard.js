const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { requireAdmin } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('Configure the starboard')
    .addSubcommand(s => s.setName('setup')
      .setDescription('Set the starboard channel and threshold')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post starred messages').setRequired(true))
      .addIntegerOption(o => o.setName('threshold').setDescription('Number of ⭐ needed (default: 3)').setMinValue(1)))
    .addSubcommand(s => s.setName('disable')
      .setDescription('Disable the starboard'))
    .addSubcommand(s => s.setName('info')
      .setDescription('View current starboard settings')),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const threshold = interaction.options.getInteger('threshold') ?? 3;

      db.prepare('INSERT OR REPLACE INTO starboard_config (guild_id, channel_id, threshold, enabled) VALUES (?, ?, ?, 1)')
        .run(guildId, channel.id, threshold);

      return interaction.editReply({ embeds: [successEmbed('Starboard Set', `Starboard enabled in ${channel} with a threshold of **${threshold} ⭐**.`)] });
    }

    if (sub === 'disable') {
      db.prepare('UPDATE starboard_config SET enabled = 0 WHERE guild_id = ?').run(guildId);
      return interaction.editReply({ embeds: [successEmbed('Disabled', 'Starboard has been disabled.')] });
    }

    if (sub === 'info') {
      const config = db.prepare('SELECT * FROM starboard_config WHERE guild_id = ?').get(guildId);
      if (!config) return interaction.editReply({ embeds: [infoEmbed('Starboard', 'Starboard is not configured. Use `/starboard setup` to enable it.')] });

      return interaction.editReply({ embeds: [infoEmbed('Starboard', [
        `**Status:** ${config.enabled ? '✅ Enabled' : '❌ Disabled'}`,
        `**Channel:** <#${config.channel_id}>`,
        `**Threshold:** ${config.threshold} ⭐`,
      ].join('\n'))] });
    }
  },
};
