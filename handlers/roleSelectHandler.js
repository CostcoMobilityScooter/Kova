const { db } = require('../utils/database');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = async function roleSelectHandler(interaction, client, args) {
  const categoryId = args[0];
  const guildId = interaction.guildId;
  const selected = interaction.values; // array of selected role IDs

  // Get all roles in this category
  const allRoles = db.prepare('SELECT * FROM self_roles WHERE category_id = ? AND guild_id = ?').all(categoryId, guildId);

  const added = [];
  const removed = [];

  for (const selfRole of allRoles) {
    const roleId = selfRole.role_id;
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) continue;

    const hasRole = interaction.member.roles.cache.has(roleId);
    const isSelected = selected.includes(roleId);

    if (isSelected && !hasRole) {
      await interaction.member.roles.add(role).catch(() => {});
      added.push(role.name);
    } else if (!isSelected && hasRole) {
      await interaction.member.roles.remove(role).catch(() => {});
      removed.push(role.name);
    }
  }

  const lines = [];
  if (added.length) lines.push(`**Added:** ${added.join(', ')}`);
  if (removed.length) lines.push(`**Removed:** ${removed.join(', ')}`);
  if (!lines.length) lines.push('No changes made.');

  return interaction.reply({
    embeds: [successEmbed('Roles Updated', lines.join('\n'))],
    ephemeral: true,
  });
};
