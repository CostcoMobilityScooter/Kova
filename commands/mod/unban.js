const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');
const { sendLog } = require('../../utils/logger');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user')
    .addStringOption(o => o.setName('user_id').setDescription('User ID to unban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.guild.members.unban(userId, reason);
      const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle('✅ User Unbanned').addFields({ name: 'User ID', value: userId }, { name: 'Moderator', value: `<@${interaction.user.id}>` }, { name: 'Reason', value: reason }).setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      await sendLog(client, interaction.guildId, 'mod', embed);
    } catch {
      return interaction.editReply({ embeds: [errorEmbed('Unban Failed', 'Could not unban that user. They may not be banned or the ID is invalid.')] });
    }
  },
};
