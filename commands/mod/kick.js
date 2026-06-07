const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db, ensureGuild } = require('../../utils/database');
const { successEmbed, errorEmbed, modEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for kick')),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) return interaction.editReply({ embeds: [errorEmbed('User Not Found', 'That user is not in this server.')] });
    if (!target.kickable) return interaction.editReply({ embeds: [errorEmbed('Cannot Kick', 'I cannot kick that user. They may have a higher role than me.')] });
    if (target.id === interaction.user.id) return interaction.editReply({ embeds: [errorEmbed('Invalid', 'You cannot kick yourself.')] });

    await target.kick(reason);

    const embed = modEmbed('Member Kicked', target, interaction.user, reason);
    await interaction.editReply({ embeds: [embed] });
    await sendLog(client, interaction.guildId, 'mod', embed);
  },
};
