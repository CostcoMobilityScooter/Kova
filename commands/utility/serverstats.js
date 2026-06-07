const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { requireAdmin } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverstats')
    .setDescription('Auto-updating server stat channels')
    .addSubcommand(s => s.setName('setup').setDescription('Create stat channels (updates every 10 min)'))
    .addSubcommand(s => s.setName('toggle').setDescription('Enable or disable stat updates'))
    .addSubcommand(s => s.setName('remove').setDescription('Delete stat channels and disable')),

  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const guild = interaction.guild;

    // ── SETUP ─────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const existing = db.prepare('SELECT * FROM serverstats WHERE guild_id = ?').get(guildId);
      if (existing) return interaction.editReply({ embeds: [errorEmbed('Already Set Up', 'Stat channels already exist. Use `/serverstats remove` first to reset.')] });

      // Create category
      const category = await guild.channels.create({
        name: '📊 Server Stats',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.Connect] },
        ],
      });

      const members = await guild.members.fetch();
      const total = members.size;
      const bots = members.filter(m => m.user.bot).size;
      const humans = total - bots;
      const online = members.filter(m => m.presence?.status && m.presence.status !== 'offline').size;

      // Create the 4 stat voice channels
      const totalCh = await guild.channels.create({ name: `👥 Total: ${total}`, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionFlagsBits.Connect] }] });
      const humansCh = await guild.channels.create({ name: `🧑 Humans: ${humans}`, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionFlagsBits.Connect] }] });
      const botsCh = await guild.channels.create({ name: `🤖 Bots: ${bots}`, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionFlagsBits.Connect] }] });
      const onlineCh = await guild.channels.create({ name: `🟢 Online: ${online}`, type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionFlagsBits.Connect] }] });

      db.prepare(`INSERT INTO serverstats (guild_id, enabled, category_id, total_ch, humans_ch, bots_ch, online_ch)
        VALUES (?, 1, ?, ?, ?, ?, ?)`).run(guildId, category.id, totalCh.id, humansCh.id, botsCh.id, onlineCh.id);

      return interaction.editReply({ embeds: [successEmbed('Stats Created', 'Stat channels are live and will update every 10 minutes.')] });
    }

    // ── TOGGLE ────────────────────────────────────────────────────────────
    if (sub === 'toggle') {
      const row = db.prepare('SELECT * FROM serverstats WHERE guild_id = ?').get(guildId);
      if (!row) return interaction.editReply({ embeds: [errorEmbed('Not Set Up', 'Run `/serverstats setup` first.')] });

      const newState = row.enabled ? 0 : 1;
      db.prepare('UPDATE serverstats SET enabled = ? WHERE guild_id = ?').run(newState, guildId);
      return interaction.editReply({ embeds: [successEmbed('Toggled', `Stat channel updates are now **${newState ? 'enabled' : 'disabled'}**.`)] });
    }

    // ── REMOVE ────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const row = db.prepare('SELECT * FROM serverstats WHERE guild_id = ?').get(guildId);
      if (!row) return interaction.editReply({ embeds: [errorEmbed('Not Set Up', 'Nothing to remove.')] });

      for (const id of [row.total_ch, row.humans_ch, row.bots_ch, row.online_ch, row.category_id]) {
        const ch = guild.channels.cache.get(id);
        if (ch) await ch.delete().catch(() => {});
      }

      db.prepare('DELETE FROM serverstats WHERE guild_id = ?').run(guildId);
      return interaction.editReply({ embeds: [successEmbed('Removed', 'Stat channels deleted.')] });
    }
  },
};
