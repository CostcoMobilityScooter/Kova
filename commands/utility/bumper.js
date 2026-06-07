const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db, ensureGuild } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bumper')
    .setDescription('Bump reminder configuration')
    .addSubcommand(s => s.setName('setup').setDescription('Set up bump reminders')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send reminders').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to ping when it is time to bump').setRequired(false)))
    .addSubcommand(s => s.setName('disable').setDescription('Disable bump reminders'))
    .addSubcommand(s => s.setName('status').setDescription('Check bump reminder status'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    ensureGuild(interaction.guildId);
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      db.prepare('INSERT OR REPLACE INTO bump_config (guild_id, channel_id, role_id, enabled) VALUES (?, ?, ?, 1)').run(interaction.guildId, channel.id, role?.id || null);
      const embed = new EmbedBuilder()
        .setTitle('⏰ Bump Reminders Enabled')
        .setDescription(`Reminders will be sent to ${channel}${role ? ` pinging ${role}` : ''} every 2 hours after a bump.`)
        .setColor(0x2ecc71);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'disable') {
      db.prepare('UPDATE bump_config SET enabled = 0 WHERE guild_id = ?').run(interaction.guildId);
      return interaction.reply({ content: '✅ Bump reminders disabled.', ephemeral: true });
    }

    if (sub === 'status') {
      const config = db.prepare('SELECT * FROM bump_config WHERE guild_id = ?').get(interaction.guildId);
      if (!config || !config.enabled) return interaction.reply({ content: '❌ Bump reminders are not set up.', ephemeral: true });
      const next = config.last_bump ? `<t:${config.last_bump + 7200}:R>` : 'Not bumped yet';
      const embed = new EmbedBuilder()
        .setTitle('⏰ Bump Reminder Status')
        .addFields(
          { name: 'Channel', value: `<#${config.channel_id}>`, inline: true },
          { name: 'Role', value: config.role_id ? `<@&${config.role_id}>` : 'None', inline: true },
          { name: 'Next Reminder', value: next, inline: true }
        )
        .setColor(0x5865f2);
      return interaction.reply({ embeds: [embed] });
    }
  }
};
