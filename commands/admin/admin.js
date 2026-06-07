const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { requireAdmin } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin tools')
    .addSubcommand(s => s.setName('announce')
      .setDescription('Send an announcement through the bot')
      .addStringOption(o => o.setName('message').setDescription('Announcement text').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send to').setRequired(true)))
    .addSubcommand(s => s.setName('embed')
      .setDescription('Send a custom embed message')
      .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Embed description').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send to').setRequired(true))
      .addStringOption(o => o.setName('color').setDescription('Hex color e.g. #3498db')))
    .addSubcommand(s => s.setName('dm')
      .setDescription('DM a member from the bot')
      .addUserOption(o => o.setName('user').setDescription('User to DM').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Message to send').setRequired(true)))
    .addSubcommand(s => s.setName('stats').setDescription('View bot usage stats for this server')),

  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'announce') {
      const message = interaction.options.getString('message');
      const channel = interaction.options.getChannel('channel');

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('📢 Announcement')
        .setDescription(message)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      return interaction.editReply({ embeds: [successEmbed('Announced', `Message sent to ${channel}.`)] });
    }

    if (sub === 'embed') {
      const title = interaction.options.getString('title');
      const message = interaction.options.getString('message');
      const channel = interaction.options.getChannel('channel');
      const colorStr = interaction.options.getString('color') || '#3498db';
      const color = parseInt(colorStr.replace('#', ''), 16) || 0x3498db;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(message)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      return interaction.editReply({ embeds: [successEmbed('Sent', `Embed sent to ${channel}.`)] });
    }

    if (sub === 'dm') {
      const user = interaction.options.getUser('user');
      const message = interaction.options.getString('message');

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`Message from ${interaction.guild.name}`)
        .setDescription(message)
        .setThumbnail(interaction.guild.iconURL())
        .setTimestamp();

      try {
        await user.send({ embeds: [embed] });
        return interaction.editReply({ embeds: [successEmbed('DM Sent', `Message sent to ${user.tag}.`)] });
      } catch {
        return interaction.editReply({ embeds: [errorEmbed('DM Failed', `Could not DM ${user.tag}. They may have DMs disabled.`)] });
      }
    }

    if (sub === 'stats') {
      const warnings = db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id = ?').get(guildId).c;
      const verified = db.prepare('SELECT COUNT(*) as c FROM verified_members WHERE guild_id = ?').get(guildId).c;
      const giveaways = db.prepare('SELECT COUNT(*) as c FROM giveaways WHERE guild_id = ?').get(guildId).c;
      const confessions = db.prepare('SELECT COUNT(*) as c FROM confessions WHERE guild_id = ?').get(guildId).c;
      const topXp = db.prepare('SELECT COUNT(*) as c FROM user_levels WHERE guild_id = ?').get(guildId).c;
      const currencies = db.prepare('SELECT COUNT(*) as c FROM user_currency WHERE guild_id = ?').get(guildId).c;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Server Bot Stats')
        .addFields(
          { name: 'Total Warnings Issued', value: `${warnings}`, inline: true },
          { name: 'Verified Members', value: `${verified}`, inline: true },
          { name: 'Giveaways Run', value: `${giveaways}`, inline: true },
          { name: 'Confessions Posted', value: `${confessions}`, inline: true },
          { name: 'Members with XP', value: `${topXp}`, inline: true },
          { name: 'Members with Currency', value: `${currencies}`, inline: true },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
