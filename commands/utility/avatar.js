const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Show a member's avatar")
    .addUserOption(o => o.setName('user').setDescription('User')),

  async execute(interaction, client) {
    await interaction.deferReply();
    const user = interaction.options.getUser('user') || interaction.user;

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🖼️ ${user.tag}'s Avatar`)
      .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
