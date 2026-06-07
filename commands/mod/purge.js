const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete multiple messages')
    .addIntegerOption(o => o.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user')),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');

    let messages = await interaction.channel.messages.fetch({ limit: 100 });

    if (user) messages = messages.filter(m => m.author.id === user.id);
    messages = [...messages.values()].slice(0, amount);

    // Filter out messages older than 14 days (Discord limit)
    const twoWeeks = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const deletable = messages.filter(m => m.createdTimestamp > twoWeeks);

    if (!deletable.length) return interaction.editReply({ embeds: [errorEmbed('No Messages', 'No deletable messages found (must be under 14 days old).')] });

    await interaction.channel.bulkDelete(deletable, true);
    return interaction.editReply({ embeds: [successEmbed('Purged', `Deleted **${deletable.length}** message(s).`)] });
  },
};
