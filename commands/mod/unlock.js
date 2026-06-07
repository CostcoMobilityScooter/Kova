const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to unlock (defaults to current)')),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const everyoneRole = interaction.guild.roles.everyone;

    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
    return interaction.editReply({ embeds: [successEmbed('Channel Unlocked', `${channel} has been unlocked.`)] });
  },
};
