const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, modEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');
const { sendLog } = require('../../utils/logger');

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const val = parseInt(match[1]);
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * units[match[2]];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member')
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 10m, 1h, 1d').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getMember('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) return interaction.editReply({ embeds: [errorEmbed('Not Found', 'User not in server.')] });

    const ms = parseDuration(durationStr);
    if (!ms) return interaction.editReply({ embeds: [errorEmbed('Invalid Duration', 'Use format like `10m`, `1h`, `2d`')] });
    if (ms > 28 * 24 * 60 * 60 * 1000) return interaction.editReply({ embeds: [errorEmbed('Too Long', 'Max timeout is 28 days.')] });

    await target.timeout(ms, reason);

    const embed = modEmbed('Member Timed Out', target, interaction.user, reason, { Duration: durationStr });
    await interaction.editReply({ embeds: [embed] });
    await sendLog(client, interaction.guildId, 'mod', embed);
  },
};
