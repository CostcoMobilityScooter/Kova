const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { requireAdmin } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Assign roles when members react to a message')
    .addSubcommand(s => s.setName('add')
      .setDescription('Add a reaction role to a message')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID to add reaction to').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji to react with').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)))
    .addSubcommand(s => s.setName('remove')
      .setDescription('Remove a reaction role')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list')
      .setDescription('List all reaction roles in this server')),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
      const messageId = interaction.options.getString('message_id');
      const emoji = interaction.options.getString('emoji');
      const role = interaction.options.getRole('role');

      // Fetch and react to the message
      const msg = await interaction.channel.messages.fetch(messageId).catch(() => null);
      if (!msg) return interaction.editReply({ embeds: [errorEmbed('Not Found', 'Could not find that message in this channel.')] });

      await msg.react(emoji).catch(() => {});

      db.prepare('INSERT OR REPLACE INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?, ?)')
        .run(guildId, interaction.channelId, messageId, emoji, role.id);

      return interaction.editReply({ embeds: [successEmbed('Reaction Role Added', `Reacting with ${emoji} on that message will give/remove ${role}.`)] });
    }

    if (sub === 'remove') {
      const messageId = interaction.options.getString('message_id');
      const emoji = interaction.options.getString('emoji');

      const existing = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?').get(guildId, messageId, emoji);
      if (!existing) return interaction.editReply({ embeds: [errorEmbed('Not Found', 'No reaction role found for that message/emoji combo.')] });

      db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?').run(guildId, messageId, emoji);
      return interaction.editReply({ embeds: [successEmbed('Removed', `Reaction role for ${emoji} removed.`)] });
    }

    if (sub === 'list') {
      const rows = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ?').all(guildId);
      if (!rows.length) return interaction.editReply({ embeds: [infoEmbed('Reaction Roles', 'No reaction roles set up yet.')] });

      const lines = rows.map(r => {
        const role = interaction.guild.roles.cache.get(r.role_id);
        return `${r.emoji} → ${role ? role.toString() : `Unknown (${r.role_id})`} in <#${r.channel_id}>`;
      });

      return interaction.editReply({ embeds: [infoEmbed('Reaction Roles', lines.join('\n'))] });
    }
  },
};
