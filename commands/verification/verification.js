const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verification')
    .setDescription('Manage member verification')
    .addSubcommand(s => s.setName('check').setDescription('Check if a user is verified').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('force').setDescription('Manually verify a user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('revoke').setDescription('Revoke verification from a user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true))),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const member = interaction.options.getMember('user');
    const guildId = interaction.guildId;
    const config = db.prepare('SELECT * FROM verification WHERE guild_id = ?').get(guildId);

    if (sub === 'check') {
      const record = db.prepare('SELECT * FROM verified_members WHERE guild_id = ? AND user_id = ?').get(guildId, user.id);
      if (record) {
        return interaction.editReply({ embeds: [infoEmbed('Verified', `${user.tag} is verified.\nVerified <t:${record.verified_at}:R> by ${record.verified_by === 'self' ? 'themselves' : `<@${record.verified_by}>`}.`)] });
      } else {
        return interaction.editReply({ embeds: [errorEmbed('Not Verified', `${user.tag} is not verified.`)] });
      }
    }

    if (sub === 'force') {
      if (!member) return interaction.editReply({ embeds: [errorEmbed('Not Found', 'User not in server.')] });

      if (config?.verified_role) {
        const role = interaction.guild.roles.cache.get(config.verified_role);
        if (role) await member.roles.add(role).catch(() => {});
      }
      if (config?.unverified_role) {
        const role = interaction.guild.roles.cache.get(config.unverified_role);
        if (role) await member.roles.remove(role).catch(() => {});
      }

      db.prepare('INSERT OR REPLACE INTO verified_members (guild_id, user_id, verified_at, verified_by) VALUES (?, ?, ?, ?)').run(guildId, user.id, Math.floor(Date.now() / 1000), interaction.user.id);
      return interaction.editReply({ embeds: [successEmbed('Verified', `${user.tag} has been manually verified.`)] });
    }

    if (sub === 'revoke') {
      db.prepare('DELETE FROM verified_members WHERE guild_id = ? AND user_id = ?').run(guildId, user.id);

      if (config?.verified_role && member) {
        const role = interaction.guild.roles.cache.get(config.verified_role);
        if (role) await member.roles.remove(role).catch(() => {});
      }
      if (config?.unverified_role && member) {
        const role = interaction.guild.roles.cache.get(config.unverified_role);
        if (role) await member.roles.add(role).catch(() => {});
      }

      return interaction.editReply({ embeds: [successEmbed('Revoked', `Verification revoked from ${user.tag}.`)] });
    }
  },
};
