const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { errorEmbed, modEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');
const { sendLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason');
    const guildId = interaction.guildId;

    if (!target) return interaction.editReply({ embeds: [errorEmbed('Not Found', 'User not in server.')] });

    db.prepare('INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)').run(guildId, target.id, interaction.user.id, reason);
    const warnCount = db.prepare('SELECT COUNT(*) as count FROM warnings WHERE guild_id = ? AND user_id = ?').get(guildId, target.id).count;

    const embed = modEmbed('Member Warned', target, interaction.user, reason, { 'Total Warnings': warnCount });
    await interaction.editReply({ embeds: [embed] });
    await sendLog(client, guildId, 'mod', embed);

    // DM the user
    await target.user.send({ embeds: [embed] }).catch(() => {});

    // Auto-ban check
    const modConfig = db.prepare('SELECT * FROM mod_config WHERE guild_id = ?').get(guildId);
    if (modConfig?.max_warnings && warnCount >= modConfig.max_warnings) {
      if (target.bannable) {
        await target.ban({ reason: `Auto-ban: reached ${warnCount} warnings` });
        const banEmbed = modEmbed('Auto-Banned', target, client.user, `Reached ${warnCount} warnings`);
        await interaction.followUp({ embeds: [banEmbed], ephemeral: true });
        await sendLog(client, guildId, 'mod', banEmbed);
      }
    }
  },
};
