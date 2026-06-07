const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { db, ensureGuild } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempvc')
    .setDescription('Temporary voice channel system')
    .addSubcommand(s => s.setName('setup').setDescription('Set up temp VCs')
      .addChannelOption(o => o.setName('channel').setDescription('The "Join to Create" voice channel').setRequired(true))
      .addStringOption(o => o.setName('name').setDescription('Name template — use {user} for username').setRequired(false)))
    .addSubcommand(s => s.setName('disable').setDescription('Disable temp VCs'))
    .addSubcommand(s => s.setName('rename').setDescription('Rename your temp VC').addStringOption(o => o.setName('name').setDescription('New name').setRequired(true)))
    .addSubcommand(s => s.setName('limit').setDescription('Set user limit for your temp VC').addIntegerOption(o => o.setName('limit').setDescription('Max users (0 = unlimited)').setRequired(true).setMinValue(0).setMaxValue(99)))
    .addSubcommand(s => s.setName('lock').setDescription('Lock your temp VC'))
    .addSubcommand(s => s.setName('unlock').setDescription('Unlock your temp VC'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    ensureGuild(interaction.guildId);
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      if (channel.type !== ChannelType.GuildVoice) return interaction.reply({ content: '❌ Please select a voice channel.', ephemeral: true });
      const nameTemplate = interaction.options.getString('name') || '{user}\'s Channel';
      db.prepare('INSERT OR REPLACE INTO tempvc_config (guild_id, trigger_channel_id, name_template) VALUES (?, ?, ?)').run(interaction.guildId, channel.id, nameTemplate);
      const embed = new EmbedBuilder()
        .setTitle('🔊 Temp VCs Enabled')
        .setDescription(`When a user joins ${channel}, a temporary VC will be created for them.\nName template: \`${nameTemplate}\``)
        .setColor(0x2ecc71);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'disable') {
      db.prepare('DELETE FROM tempvc_config WHERE guild_id = ?').run(interaction.guildId);
      return interaction.reply({ content: '✅ Temp VCs disabled.', ephemeral: true });
    }

    // User-facing commands — find their owned temp VC
    const owned = db.prepare('SELECT * FROM temp_vcs WHERE guild_id = ? AND owner_id = ?').get(interaction.guildId, interaction.user.id);
    if (!owned) return interaction.reply({ content: '❌ You don\'t own a temp VC right now.', ephemeral: true });

    const channel = interaction.guild.channels.cache.get(owned.channel_id);
    if (!channel) {
      db.prepare('DELETE FROM temp_vcs WHERE id = ?').run(owned.id);
      return interaction.reply({ content: '❌ Your temp VC no longer exists.', ephemeral: true });
    }

    if (sub === 'rename') {
      const name = interaction.options.getString('name');
      await channel.setName(name);
      return interaction.reply({ content: `✅ Renamed to **${name}**.`, ephemeral: true });
    }

    if (sub === 'limit') {
      const limit = interaction.options.getInteger('limit');
      await channel.setUserLimit(limit);
      return interaction.reply({ content: `✅ User limit set to **${limit || 'unlimited'}**.`, ephemeral: true });
    }

    if (sub === 'lock') {
      await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
      return interaction.reply({ content: '🔒 Your VC is now locked.', ephemeral: true });
    }

    if (sub === 'unlock') {
      await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
      return interaction.reply({ content: '🔓 Your VC is now unlocked.', ephemeral: true });
    }
  }
};
