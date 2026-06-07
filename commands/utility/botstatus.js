const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const { db, ensureGuild } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botstatus')
    .setDescription('Bot status rotation management')
    .addSubcommand(s => s.setName('add').setDescription('Add a status to the rotation')
      .addStringOption(o => o.setName('text').setDescription('Status text').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Activity type').setRequired(false)
        .addChoices(
          { name: 'Playing', value: 'Playing' },
          { name: 'Watching', value: 'Watching' },
          { name: 'Listening', value: 'Listening' },
          { name: 'Competing', value: 'Competing' }
        )))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a status by index').addIntegerOption(o => o.setName('index').setDescription('Status number from /botstatus list').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all statuses in rotation'))
    .addSubcommand(s => s.setName('interval').setDescription('Set rotation interval').addIntegerOption(o => o.setName('minutes').setDescription('Minutes between rotations (min 1)').setRequired(true).setMinValue(1)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    ensureGuild(interaction.guildId);
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const text = interaction.options.getString('text');
      const type = interaction.options.getString('type') || 'Playing';
      db.prepare('INSERT INTO bot_statuses (guild_id, text, type) VALUES (?, ?, ?)').run(interaction.guildId, text, type);
      return interaction.reply({ content: `✅ Added status: **${type} ${text}**`, ephemeral: true });
    }

    if (sub === 'remove') {
      const index = interaction.options.getInteger('index') - 1;
      const rows = db.prepare('SELECT * FROM bot_statuses WHERE guild_id = ? ORDER BY id').all(interaction.guildId);
      if (!rows[index]) return interaction.reply({ content: '❌ Invalid index.', ephemeral: true });
      db.prepare('DELETE FROM bot_statuses WHERE id = ?').run(rows[index].id);
      return interaction.reply({ content: `✅ Removed status #${index + 1}.`, ephemeral: true });
    }

    if (sub === 'list') {
      const rows = db.prepare('SELECT * FROM bot_statuses WHERE guild_id = ? ORDER BY id').all(interaction.guildId);
      if (!rows.length) return interaction.reply({ content: '❌ No statuses in rotation.', ephemeral: true });
      const lines = rows.map((r, i) => `**${i + 1}.** ${r.type} ${r.text}`).join('\n');
      const embed = new EmbedBuilder().setTitle('🎭 Status Rotation').setDescription(lines).setColor(0x5865f2);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'interval') {
      const mins = interaction.options.getInteger('minutes');
      db.prepare('INSERT OR REPLACE INTO bot_status_config (guild_id, interval_minutes) VALUES (?, ?)').run(interaction.guildId, mins);
      return interaction.reply({ content: `✅ Status will rotate every **${mins} minute${mins !== 1 ? 's' : ''}**.`, ephemeral: true });
    }
  }
};
