const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed, modEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for ban'))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7)),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getMember('user');
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    if (target && !target.bannable) return interaction.editReply({ embeds: [errorEmbed('Cannot Ban', 'I cannot ban that user.')] });

    await interaction.guild.members.ban(user.id, { reason, deleteMessageDays: deleteDays });

    const embed = modEmbed('Member Banned', user, interaction.user, reason);
    await interaction.editReply({ embeds: [embed] });
    await sendLog(client, interaction.guildId, 'mod', embed);
  },
};
