const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a user')
    .addSubcommand(s => s.setName('add').setDescription('Add a role to a user')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to add').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a role from a user')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))
    .addSubcommand(s => s.setName('get').setDescription('Assign yourself a self-assignable role')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('drop').setDescription('Remove a self-assignable role from yourself')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const { db } = require('../../utils/database');

    if (sub === 'add' || sub === 'remove') {
      if (!(await requireMod(interaction))) return;
      await interaction.deferReply({ ephemeral: true });

      const target = interaction.options.getMember('user');
      const role = interaction.options.getRole('role');

      if (!target) return interaction.editReply({ embeds: [errorEmbed('Not Found', 'User not in server.')] });

      if (sub === 'add') {
        await target.roles.add(role);
        return interaction.editReply({ embeds: [successEmbed('Role Added', `Added ${role} to ${target}.`)] });
      } else {
        await target.roles.remove(role);
        return interaction.editReply({ embeds: [successEmbed('Role Removed', `Removed ${role} from ${target}.`)] });
      }
    }

    if (sub === 'get' || sub === 'drop') {
      await interaction.deferReply({ ephemeral: true });

      const role = interaction.options.getRole('role');
      const guildId = interaction.guildId;

      const selfRole = db.prepare('SELECT * FROM self_roles WHERE guild_id = ? AND role_id = ?').get(guildId, role.id);
      if (!selfRole) return interaction.editReply({ embeds: [errorEmbed('Not Self-Assignable', 'That role is not available for self-assignment.')] });

      if (sub === 'get') {
        if (interaction.member.roles.cache.has(role.id)) return interaction.editReply({ embeds: [errorEmbed('Already Have It', `You already have ${role}.`)] });
        await interaction.member.roles.add(role);
        return interaction.editReply({ embeds: [successEmbed('Role Added', `You now have ${role}.`)] });
      } else {
        if (!interaction.member.roles.cache.has(role.id)) return interaction.editReply({ embeds: [errorEmbed("Don't Have It", `You don't have ${role}.`)] });
        await interaction.member.roles.remove(role);
        return interaction.editReply({ embeds: [successEmbed('Role Removed', `Removed ${role} from you.`)] });
      }
    }
  },
};
