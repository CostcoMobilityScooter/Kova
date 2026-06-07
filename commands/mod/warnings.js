const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a user')
    .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(true)),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user');
    const warnings = db.prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC').all(interaction.guildId, user.id);

    if (!warnings.length) {
      return interaction.editReply({ embeds: [successEmbed('No Warnings', `${user.tag} has no warnings.`)] });
    }

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle(`⚠️ Warnings — ${user.tag}`)
      .setDescription(warnings.map((w, i) => `**${i + 1}.** ${w.reason}\n*By <@${w.moderator_id}> — <t:${w.created_at}:R>*`).join('\n\n'))
      .setFooter({ text: `Total: ${warnings.length} warnings` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
