const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Change a member\'s nickname')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('nickname').setDescription('New nickname (leave blank to reset)')),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getMember('user');
    const nickname = interaction.options.getString('nickname') || null;

    if (!target) return interaction.editReply({ embeds: [errorEmbed('Not Found', 'User not in server.')] });

    await target.setNickname(nickname);
    return interaction.editReply({ embeds: [successEmbed('Nickname Updated', nickname ? `Set ${target}'s nickname to **${nickname}**.` : `Reset ${target}'s nickname.`)] });
  },
};
