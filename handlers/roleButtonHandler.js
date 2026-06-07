const { db } = require('../utils/database');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = async function roleButtonHandler(interaction, client, args) {
  const roleId = args[0];
  const guildId = interaction.guildId;

  const selfRole = db.prepare('SELECT sr.*, rc.mode FROM self_roles sr JOIN role_categories rc ON sr.category_id = rc.id WHERE sr.guild_id = ? AND sr.role_id = ?').get(guildId, roleId);
  if (!selfRole) return interaction.reply({ embeds: [errorEmbed('Role Not Found', 'That role is no longer available.')], ephemeral: true });

  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) return interaction.reply({ embeds: [errorEmbed('Role Error', 'That role does not exist.')], ephemeral: true });

  const hasRole = interaction.member.roles.cache.has(roleId);
  const mode = selfRole.mode || 'toggle';

  if (mode === 'add-only') {
    if (hasRole) return interaction.reply({ embeds: [errorEmbed('Already Have It', `You already have **${role.name}**.`)], ephemeral: true });
    await interaction.member.roles.add(role).catch(() => {});
    return interaction.reply({ embeds: [successEmbed('Role Added', `You now have **${role.name}**.`)], ephemeral: true });
  }

  if (mode === 'single') {
    // Remove all other roles from this category first
    const catRoles = db.prepare('SELECT role_id FROM self_roles WHERE category_id = ?').all(selfRole.category_id);
    for (const cr of catRoles) {
      if (cr.role_id !== roleId && interaction.member.roles.cache.has(cr.role_id)) {
        const r = interaction.guild.roles.cache.get(cr.role_id);
        if (r) await interaction.member.roles.remove(r).catch(() => {});
      }
    }
    if (hasRole) {
      await interaction.member.roles.remove(role).catch(() => {});
      return interaction.reply({ embeds: [successEmbed('Role Removed', `Removed **${role.name}**.`)], ephemeral: true });
    }
    await interaction.member.roles.add(role).catch(() => {});
    return interaction.reply({ embeds: [successEmbed('Role Added', `You now have **${role.name}**.`)], ephemeral: true });
  }

  // Default: toggle
  if (hasRole) {
    await interaction.member.roles.remove(role).catch(() => {});
    return interaction.reply({ embeds: [successEmbed('Role Removed', `Removed **${role.name}**.`)], ephemeral: true });
  }
  await interaction.member.roles.add(role).catch(() => {});
  return interaction.reply({ embeds: [successEmbed('Role Added', `You now have **${role.name}**.`)], ephemeral: true });
};
