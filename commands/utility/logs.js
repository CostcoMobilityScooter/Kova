const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('View or manage logs')
    .addSubcommand(s => s.setName('view').setDescription('View recent logs from the log channel').addChannelOption(o => o.setName('channel').setDescription('Channel to view logs from')))
    .addSubcommand(s => s.setName('clear').setDescription('Clear the log channel'))
    .addSubcommand(s => s.setName('export').setDescription('Export recent logs as a text file')),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const config = db.prepare('SELECT * FROM logs_config WHERE guild_id = ?').get(guildId);

    if (!config?.channel_id) return interaction.editReply({ embeds: [errorEmbed('No Log Channel', 'Set a log channel first with `/setup logs channel`.')] });

    const logChannel = interaction.guild.channels.cache.get(config.channel_id);
    if (!logChannel) return interaction.editReply({ embeds: [errorEmbed('Channel Not Found', 'Log channel no longer exists.')] });

    if (sub === 'view') {
      const channel = interaction.options.getChannel('channel') || logChannel;
      const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
      if (!messages || !messages.size) return interaction.editReply({ embeds: [errorEmbed('No Logs', 'No recent logs found.')] });

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x3498db).setTitle(`📋 Recent Logs — #${channel.name}`).setDescription(`[Jump to channel](${channel.url})\n\nShowing the last ${messages.size} log entries.`).setTimestamp()] });
    }

    if (sub === 'clear') {
      const messages = await logChannel.messages.fetch({ limit: 100 }).catch(() => null);
      if (messages?.size) await logChannel.bulkDelete(messages, true).catch(() => {});
      return interaction.editReply({ embeds: [successEmbed('Logs Cleared', `Cleared messages from ${logChannel}.`)] });
    }

    if (sub === 'export') {
      const messages = await logChannel.messages.fetch({ limit: 100 }).catch(() => null);
      if (!messages?.size) return interaction.editReply({ embeds: [errorEmbed('No Logs', 'No messages to export.')] });

      const lines = [...messages.values()].reverse().map(m => {
        const time = new Date(m.createdTimestamp).toISOString();
        const content = m.embeds.length ? `[EMBED] ${m.embeds[0]?.title || ''}: ${m.embeds[0]?.description || ''}` : m.content;
        return `[${time}] ${content}`;
      });

      const filePath = path.join('/tmp', `logs-${guildId}-${Date.now()}.txt`);
      fs.writeFileSync(filePath, lines.join('\n'));

      await interaction.editReply({ files: [{ attachment: filePath, name: `logs-${interaction.guild.name}.txt` }] });
      fs.unlinkSync(filePath);
    }
  },
};
