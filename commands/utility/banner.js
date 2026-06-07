const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription("Show a member's banner")
    .addUserOption(o => o.setName('user').setDescription('User')),

  async execute(interaction, client) {
    await interaction.deferReply();
    const user = await (interaction.options.getUser('user') || interaction.user).fetch();

    if (!user.banner) return interaction.editReply({ embeds: [errorEmbed('No Banner', `${user.tag} has no banner.`)] });

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🖼️ ${user.tag}'s Banner`)
      .setImage(user.bannerURL({ dynamic: true, size: 1024 }))
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
