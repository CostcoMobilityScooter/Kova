const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('View information about a role')
    .addRoleOption(o => o.setName('role').setDescription('Role to look up').setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply();
    const role = interaction.options.getRole('role');

    const embed = new EmbedBuilder()
      .setColor(role.color || 0x3498db)
      .setTitle(`🎭 ${role.name}`)
      .addFields(
        { name: 'ID', value: role.id, inline: true },
        { name: 'Color', value: role.hexColor, inline: true },
        { name: 'Position', value: `${role.position}`, inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
        { name: 'Managed', value: role.managed ? 'Yes' : 'No', inline: true },
        { name: 'Created', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: false },
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
