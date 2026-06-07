const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { requireAdmin } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Configure roles to auto-assign when a member joins')
    .addSubcommand(s => s.setName('add')
      .setDescription('Add a role to auto-assign on join')
      .addRoleOption(o => o.setName('role').setDescription('Role to add').setRequired(true)))
    .addSubcommand(s => s.setName('remove')
      .setDescription('Remove a role from auto-assign')
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list')
      .setDescription('View all auto-assigned roles'))
    .addSubcommand(s => s.setName('clear')
      .setDescription('Remove all auto-assign roles')),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
      const role = interaction.options.getRole('role');
      const existing = db.prepare('SELECT * FROM autoroles WHERE guild_id = ? AND role_id = ?').get(guildId, role.id);
      if (existing) return interaction.editReply({ embeds: [errorEmbed('Already Added', `${role} is already in the auto-assign list.`)] });

      db.prepare('INSERT INTO autoroles (guild_id, role_id) VALUES (?, ?)').run(guildId, role.id);
      return interaction.editReply({ embeds: [successEmbed('Role Added', `${role} will now be given to all new members.`)] });
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role');
      const existing = db.prepare('SELECT * FROM autoroles WHERE guild_id = ? AND role_id = ?').get(guildId, role.id);
      if (!existing) return interaction.editReply({ embeds: [errorEmbed('Not Found', `${role} is not in the auto-assign list.`)] });

      db.prepare('DELETE FROM autoroles WHERE guild_id = ? AND role_id = ?').run(guildId, role.id);
      return interaction.editReply({ embeds: [successEmbed('Role Removed', `${role} will no longer be auto-assigned.`)] });
    }

    if (sub === 'list') {
      const roles = db.prepare('SELECT * FROM autoroles WHERE guild_id = ?').all(guildId);
      if (!roles.length) return interaction.editReply({ embeds: [infoEmbed('Auto Roles', 'No auto-assign roles configured. Use `/autorole add` to add one.')] });

      const lines = roles.map(r => {
        const role = interaction.guild.roles.cache.get(r.role_id);
        return role ? `• ${role}` : `• Unknown role (${r.role_id})`;
      });

      return interaction.editReply({ embeds: [infoEmbed('Auto Roles', `These roles are given to all new members:\n\n${lines.join('\n')}`)] });
    }

    if (sub === 'clear') {
      db.prepare('DELETE FROM autoroles WHERE guild_id = ?').run(guildId);
      return interaction.editReply({ embeds: [successEmbed('Cleared', 'All auto-assign roles have been removed.')] });
    }
  },
};
