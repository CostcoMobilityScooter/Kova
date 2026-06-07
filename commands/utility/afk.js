const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db, ensureGuild } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set your AFK status')
    .addStringOption(o => o.setName('reason').setDescription('Why you are AFK').setRequired(false)),

  async execute(interaction) {
    ensureGuild(interaction.guildId);
    const reason = interaction.options.getString('reason') || 'AFK';
    const existing = db.prepare('SELECT * FROM afk WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, interaction.user.id);

    if (existing) {
      db.prepare('DELETE FROM afk WHERE guild_id = ? AND user_id = ?').run(interaction.guildId, interaction.user.id);
      return interaction.reply({ content: '✅ Welcome back! Your AFK status has been removed.', ephemeral: true });
    }

    db.prepare('INSERT OR REPLACE INTO afk (guild_id, user_id, reason, set_at) VALUES (?, ?, ?, ?)').run(interaction.guildId, interaction.user.id, reason, Math.floor(Date.now() / 1000));

    const embed = new EmbedBuilder()
      .setTitle('💤 AFK Set')
      .setDescription(`You are now AFK: **${reason}**\nI'll let people know when they ping you.`)
      .setColor(0xf1c40f);

    await interaction.reply({ embeds: [embed] });

    // Try to add [AFK] to nickname
    try {
      const nick = interaction.member.nickname || interaction.user.username;
      if (!nick.startsWith('[AFK]')) await interaction.member.setNickname(`[AFK] ${nick}`.slice(0, 32)).catch(() => {});
    } catch {}
  }
};
