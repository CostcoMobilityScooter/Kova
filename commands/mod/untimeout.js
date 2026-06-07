const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, modEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a timeout from a member')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getMember('user');
    if (!target) return interaction.editReply({ embeds: [errorEmbed('Not Found', 'User not in server.')] });

    await target.timeout(null);

    const embed = modEmbed('Timeout Removed', target, interaction.user, 'Timeout removed');
    await interaction.editReply({ embeds: [embed] });
    await sendLog(client, interaction.guildId, 'mod', embed);
  },
};
