const { EmbedBuilder } = require('discord.js');

const Colors = {
  success: 0x2ecc71,
  error: 0xe74c3c,
  info: 0x3498db,
  warning: 0xf39c12,
  mod: 0xe67e22,
  neutral: 0x95a5a6,
};

function successEmbed(title, description) {
  return new EmbedBuilder().setColor(Colors.success).setTitle(`✅ ${title}`).setDescription(description).setTimestamp();
}

function errorEmbed(title, description) {
  return new EmbedBuilder().setColor(Colors.error).setTitle(`❌ ${title}`).setDescription(description).setTimestamp();
}

function infoEmbed(title, description) {
  return new EmbedBuilder().setColor(Colors.info).setTitle(`ℹ️ ${title}`).setDescription(description).setTimestamp();
}

function warnEmbed(title, description) {
  return new EmbedBuilder().setColor(Colors.warning).setTitle(`⚠️ ${title}`).setDescription(description).setTimestamp();
}

function modEmbed(action, target, moderator, reason, extra = {}) {
  const embed = new EmbedBuilder()
    .setColor(Colors.mod)
    .setTitle(`🛡️ ${action}`)
    .addFields(
      { name: 'User', value: `<@${target.id}> (${target.tag || target.user?.tag})`, inline: true },
      { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided', inline: false }
    )
    .setTimestamp();
  for (const [k, v] of Object.entries(extra)) {
    embed.addFields({ name: k, value: String(v), inline: true });
  }
  return embed;
}

module.exports = { successEmbed, errorEmbed, infoEmbed, warnEmbed, modEmbed, Colors };
