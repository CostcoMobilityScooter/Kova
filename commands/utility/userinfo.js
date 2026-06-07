const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('View information about a member')
    .addUserOption(o => o.setName('user').setDescription('User to look up')),

  async execute(interaction, client) {
    await interaction.deferReply();
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.options.getMember('user') || interaction.member;

    const roles = member?.roles.cache.filter(r => r.id !== interaction.guildId).sort((a, b) => b.position - a.position).map(r => r.toString()).slice(0, 10).join(', ') || 'None';

    const embed = new EmbedBuilder()
      .setColor(member?.displayHexColor || 0x3498db)
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: false },
        ...(member ? [
          { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: false },
          { name: 'Nickname', value: member.nickname || 'None', inline: true },
          { name: `Roles (${member.roles.cache.size - 1})`, value: roles }
        ] : [])
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
