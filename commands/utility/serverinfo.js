const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('View server information'),

  async execute(interaction, client) {
    await interaction.deferReply();
    const g = interaction.guild;
    await g.fetch();

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`📋 ${g.name}`)
      .setThumbnail(g.iconURL({ dynamic: true }))
      .addFields(
        { name: 'Owner', value: `<@${g.ownerId}>`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Members', value: `${g.memberCount}`, inline: true },
        { name: 'Roles', value: `${g.roles.cache.size}`, inline: true },
        { name: 'Channels', value: `${g.channels.cache.size}`, inline: true },
        { name: 'Emojis', value: `${g.emojis.cache.size}`, inline: true },
        { name: 'Boost Level', value: `Level ${g.premiumTier}`, inline: true },
        { name: 'Boosts', value: `${g.premiumSubscriptionCount}`, inline: true },
        { name: 'Verification', value: g.verificationLevel.toString(), inline: true },
      )
      .setImage(g.bannerURL({ size: 1024 }))
      .setFooter({ text: `ID: ${g.id}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
