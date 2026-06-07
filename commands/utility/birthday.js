const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db, ensureGuild } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Birthday system')
    .addSubcommand(s => s.setName('set').setDescription('Set your birthday')
      .addIntegerOption(o => o.setName('month').setDescription('Month (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
      .addIntegerOption(o => o.setName('day').setDescription('Day (1-31)').setRequired(true).setMinValue(1).setMaxValue(31)))
    .addSubcommand(s => s.setName('check').setDescription('Check someone\'s birthday')
      .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false)))
    .addSubcommand(s => s.setName('upcoming').setDescription('See upcoming birthdays'))
    .addSubcommand(s => s.setName('setup').setDescription('Set birthday announcement channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel for announcements').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Birthday role to give').setRequired(false)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove your birthday')),

  async execute(interaction) {
    ensureGuild(interaction.guildId);
    const sub = interaction.options.getSubcommand();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    if (sub === 'set') {
      const month = interaction.options.getInteger('month');
      const day = interaction.options.getInteger('day');
      db.prepare('INSERT OR REPLACE INTO birthdays (guild_id, user_id, month, day) VALUES (?, ?, ?, ?)').run(interaction.guildId, interaction.user.id, month, day);
      return interaction.reply({ content: `🎂 Birthday set to **${months[month - 1]} ${day}**!`, ephemeral: true });
    }

    if (sub === 'check') {
      const target = interaction.options.getUser('user') || interaction.user;
      const row = db.prepare('SELECT * FROM birthdays WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, target.id);
      if (!row) return interaction.reply({ content: `❌ ${target.username} hasn't set their birthday.`, ephemeral: true });
      const embed = new EmbedBuilder()
        .setTitle('🎂 Birthday')
        .setDescription(`${target}'s birthday is **${months[row.month - 1]} ${row.day}**!`)
        .setColor(0xff69b4)
        .setThumbnail(target.displayAvatarURL());
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'upcoming') {
      const now = new Date();
      const rows = db.prepare('SELECT * FROM birthdays WHERE guild_id = ? ORDER BY month, day').all(interaction.guildId);
      if (!rows.length) return interaction.reply({ content: '❌ No birthdays set in this server.', ephemeral: true });

      const upcoming = rows.map(r => {
        const bd = new Date(now.getFullYear(), r.month - 1, r.day);
        if (bd < now) bd.setFullYear(now.getFullYear() + 1);
        return { ...r, date: bd };
      }).sort((a, b) => a.date - b.date).slice(0, 10);

      const lines = upcoming.map(r => `<@${r.user_id}> — **${months[r.month - 1]} ${r.day}**`).join('\n');
      const embed = new EmbedBuilder().setTitle('🎂 Upcoming Birthdays').setDescription(lines).setColor(0xff69b4);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ No permission.', ephemeral: true });
      db.prepare('INSERT OR REPLACE INTO birthday_config (guild_id, channel_id, role_id) VALUES (?, ?, ?)').run(interaction.guildId, channel.id, role?.id || null);
      return interaction.reply({ content: `✅ Birthday announcements set to ${channel}${role ? ` with role ${role}` : ''}.`, ephemeral: true });
    }

    if (sub === 'remove') {
      db.prepare('DELETE FROM birthdays WHERE guild_id = ? AND user_id = ?').run(interaction.guildId, interaction.user.id);
      return interaction.reply({ content: '✅ Your birthday has been removed.', ephemeral: true });
    }
  }
};
