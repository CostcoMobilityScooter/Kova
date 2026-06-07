const { db, ensureGuild } = require('./database');
const { errorEmbed } = require('./embeds');

function isAdmin(interaction) {
  const guild = ensureGuild(interaction.guildId);
  if (interaction.member.permissions.has('Administrator')) return true;
  if (guild.admin_role && interaction.member.roles.cache.has(guild.admin_role)) return true;
  return false;
}

function isMod(interaction) {
  if (isAdmin(interaction)) return true;
  const guild = ensureGuild(interaction.guildId);
  if (guild.mod_role && interaction.member.roles.cache.has(guild.mod_role)) return true;
  if (interaction.member.permissions.has('ModerateMembers')) return true;
  return false;
}

async function requireAdmin(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ embeds: [errorEmbed('No Permission', 'You need admin permissions to use this command.')], ephemeral: true });
    return false;
  }
  return true;
}

async function requireMod(interaction) {
  if (!isMod(interaction)) {
    await interaction.reply({ embeds: [errorEmbed('No Permission', 'You need moderator permissions to use this command.')], ephemeral: true });
    return false;
  }
  return true;
}

module.exports = { isAdmin, isMod, requireAdmin, requireMod };
