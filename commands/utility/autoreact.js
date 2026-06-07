const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db, ensureGuild } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoreact')
    .setDescription('Auto-reaction management')
    .addSubcommand(s => s.setName('add').setDescription('Add an auto-reaction to a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to react in').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji to react with').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove an auto-reaction from a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all auto-reactions'))
    .addSubcommand(s => s.setName('clear').setDescription('Clear all auto-reactions from a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    ensureGuild(interaction.guildId);
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const channel = interaction.options.getChannel('channel');
      const emoji = interaction.options.getString('emoji');
      const existing = db.prepare('SELECT COUNT(*) as cnt FROM auto_reactions WHERE guild_id = ? AND channel_id = ?').get(interaction.guildId, channel.id);
      if (existing.cnt >= 5) return interaction.reply({ content: '❌ Max 5 auto-reactions per channel.', ephemeral: true });
      db.prepare('INSERT OR IGNORE INTO auto_reactions (guild_id, channel_id, emoji) VALUES (?, ?, ?)').run(interaction.guildId, channel.id, emoji);
      return interaction.reply({ content: `✅ Will auto-react with ${emoji} in ${channel}.`, ephemeral: true });
    }

    if (sub === 'remove') {
      const channel = interaction.options.getChannel('channel');
      const emoji = interaction.options.getString('emoji');
      db.prepare('DELETE FROM auto_reactions WHERE guild_id = ? AND channel_id = ? AND emoji = ?').run(interaction.guildId, channel.id, emoji);
      return interaction.reply({ content: `✅ Removed ${emoji} auto-reaction from ${channel}.`, ephemeral: true });
    }

    if (sub === 'list') {
      const rows = db.prepare('SELECT * FROM auto_reactions WHERE guild_id = ?').all(interaction.guildId);
      if (!rows.length) return interaction.reply({ content: '❌ No auto-reactions set up.', ephemeral: true });
      const grouped = {};
      for (const r of rows) {
        if (!grouped[r.channel_id]) grouped[r.channel_id] = [];
        grouped[r.channel_id].push(r.emoji);
      }
      const lines = Object.entries(grouped).map(([cid, emojis]) => `<#${cid}>: ${emojis.join(' ')}`).join('\n');
      const embed = new EmbedBuilder().setTitle('⚡ Auto-Reactions').setDescription(lines).setColor(0x5865f2);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'clear') {
      const channel = interaction.options.getChannel('channel');
      db.prepare('DELETE FROM auto_reactions WHERE guild_id = ? AND channel_id = ?').run(interaction.guildId, channel.id);
      return interaction.reply({ content: `✅ Cleared all auto-reactions from ${channel}.`, ephemeral: true });
    }
  }
};
