const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { requireAdmin } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('Sticky messages that re-post after every message in a channel')
    .addSubcommand(s => s.setName('set')
      .setDescription('Set a sticky message in this channel')
      .addStringOption(o => o.setName('message').setDescription('The message to stick').setRequired(true)))
    .addSubcommand(s => s.setName('remove')
      .setDescription('Remove the sticky message from this channel'))
    .addSubcommand(s => s.setName('list')
      .setDescription('View all sticky messages in this server')),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    if (sub === 'set') {
      const content = interaction.options.getString('message');

      // Post the initial sticky
      const sent = await interaction.channel.send({ embeds: [
        { color: 0xf1c40f, description: `📌 **Sticky:** ${content}`, footer: { text: 'Sticky Message' } }
      ] });

      db.prepare('INSERT OR REPLACE INTO sticky_messages (guild_id, channel_id, content, last_message_id) VALUES (?, ?, ?, ?)')
        .run(guildId, channelId, content, sent.id);

      return interaction.editReply({ embeds: [successEmbed('Sticky Set', `Sticky message set in <#${channelId}>.`)] });
    }

    if (sub === 'remove') {
      const existing = db.prepare('SELECT * FROM sticky_messages WHERE guild_id = ? AND channel_id = ?').get(guildId, channelId);
      if (!existing) return interaction.editReply({ embeds: [errorEmbed('Not Found', 'No sticky message in this channel.')] });

      // Delete the last sticky message
      const lastMsg = await interaction.channel.messages.fetch(existing.last_message_id).catch(() => null);
      if (lastMsg) await lastMsg.delete().catch(() => {});

      db.prepare('DELETE FROM sticky_messages WHERE guild_id = ? AND channel_id = ?').run(guildId, channelId);
      return interaction.editReply({ embeds: [successEmbed('Removed', 'Sticky message removed.')] });
    }

    if (sub === 'list') {
      const stickies = db.prepare('SELECT * FROM sticky_messages WHERE guild_id = ?').all(guildId);
      if (!stickies.length) return interaction.editReply({ embeds: [infoEmbed('Sticky Messages', 'No sticky messages set in this server.')] });

      const lines = stickies.map(s => `<#${s.channel_id}>: ${s.content.length > 60 ? s.content.slice(0, 60) + '...' : s.content}`);
      return interaction.editReply({ embeds: [infoEmbed('Sticky Messages', lines.join('\n'))] });
    }
  },
};
