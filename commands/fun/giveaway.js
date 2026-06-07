const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const val = parseInt(match[1]);
  const units = { s: 1, m: 60, h: 3600, d: 86400 };
  return val * units[match[2]];
}

function canManageGiveaways(interaction) {
  const { db } = require('../../utils/database');
  if (interaction.member.permissions.has('ManageGuild')) return true;
  const config = db.prepare('SELECT required_role FROM giveaway_config WHERE guild_id = ?').get(interaction.guildId);
  if (config?.required_role && interaction.member.roles.cache.has(config.required_role)) return true;
  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand(s => s.setName('start').setDescription('Start a giveaway')
      .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 1h, 30m, 2d').setRequired(true))
      .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel (uses default if set)')))
    .addSubcommand(s => s.setName('end').setDescription('End a giveaway early').addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
    .addSubcommand(s => s.setName('reroll').setDescription('Reroll a giveaway winner').addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all active giveaways')),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'start') {
      if (!canManageGiveaways(interaction)) return interaction.editReply({ embeds: [errorEmbed('No Permission', 'You need the giveaway manager role or Manage Server.')] });

      const durationStr = interaction.options.getString('duration');
      const prize = interaction.options.getString('prize');
      const seconds = parseDuration(durationStr);
      if (!seconds) return interaction.editReply({ embeds: [errorEmbed('Invalid Duration', 'Use format like `1h`, `30m`, `2d`')] });

      const config = db.prepare('SELECT * FROM giveaway_config WHERE guild_id = ?').get(guildId);
      const channelOpt = interaction.options.getChannel('channel');
      const channel = channelOpt || (config?.channel_id ? interaction.guild.channels.cache.get(config.channel_id) : null) || interaction.channel;

      if (!channel) return interaction.editReply({ embeds: [errorEmbed('No Channel', 'Specify a channel or set a default giveaway channel.')] });

      const endsAt = Math.floor(Date.now() / 1000) + seconds;

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🎉 GIVEAWAY')
        .setDescription(`**Prize:** ${prize}\n\nReact with 🎉 to enter!\n\n**Ends:** <t:${endsAt}:R>`)
        .setFooter({ text: `Hosted by ${interaction.user.tag}` })
        .setTimestamp(endsAt * 1000);

      const msg = await channel.send({ embeds: [embed] });
      await msg.react('🎉');

      db.prepare('INSERT INTO giveaways (guild_id, channel_id, message_id, prize, ends_at, host_id) VALUES (?, ?, ?, ?, ?, ?)').run(guildId, channel.id, msg.id, prize, endsAt, interaction.user.id);
      const giveaway = db.prepare('SELECT last_insert_rowid() as id').get();

      return interaction.editReply({ embeds: [successEmbed('Giveaway Started', `Giveaway started in ${channel}! ID: **${giveaway.id}**\nEnds <t:${endsAt}:R>`)] });
    }

    if (sub === 'end') {
      if (!canManageGiveaways(interaction)) return interaction.editReply({ embeds: [errorEmbed('No Permission', 'You need the giveaway manager role.')] });

      const id = interaction.options.getInteger('id');
      const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ? AND guild_id = ?').get(id, guildId);
      if (!giveaway) return interaction.editReply({ embeds: [errorEmbed('Not Found', 'No giveaway with that ID.')] });
      if (giveaway.ended) return interaction.editReply({ embeds: [errorEmbed('Already Ended', 'That giveaway has already ended.')] });

      // Force end by setting ends_at to past
      db.prepare('UPDATE giveaways SET ends_at = 0 WHERE id = ?').run(id);
      return interaction.editReply({ embeds: [successEmbed('Giveaway Ending', 'The giveaway will end within 10 seconds.')] });
    }

    if (sub === 'reroll') {
      if (!canManageGiveaways(interaction)) return interaction.editReply({ embeds: [errorEmbed('No Permission', 'You need the giveaway manager role.')] });

      const id = interaction.options.getInteger('id');
      const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ? AND guild_id = ?').get(id, guildId);
      if (!giveaway || !giveaway.ended) return interaction.editReply({ embeds: [errorEmbed('Not Found', 'No ended giveaway with that ID.')] });

      const channel = interaction.guild.channels.cache.get(giveaway.channel_id);
      if (!channel) return interaction.editReply({ embeds: [errorEmbed('Channel Gone', 'The giveaway channel no longer exists.')] });

      const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
      if (!message) return interaction.editReply({ embeds: [errorEmbed('Message Gone', 'The giveaway message no longer exists.')] });

      const reaction = message.reactions.cache.get('🎉');
      const users = reaction ? (await reaction.users.fetch()).filter(u => !u.bot) : new Map();
      const winner = users.size > 0 ? [...users.values()][Math.floor(Math.random() * users.size)] : null;

      if (winner) {
        db.prepare('UPDATE giveaways SET winner_id = ? WHERE id = ?').run(winner.id, id);
        await channel.send(`🎉 New winner for **${giveaway.prize}**: <@${winner.id}>! Congratulations!`);
        return interaction.editReply({ embeds: [successEmbed('Rerolled', `New winner: <@${winner.id}>`)] });
      } else {
        return interaction.editReply({ embeds: [errorEmbed('No Entries', 'No valid entries to reroll from.')] });
      }
    }

    if (sub === 'list') {
      const giveaways = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND ended = 0 ORDER BY ends_at ASC').all(guildId);
      if (!giveaways.length) return interaction.editReply({ embeds: [errorEmbed('No Active Giveaways', 'There are no active giveaways.')] });

      const lines = giveaways.map(g => `**ID ${g.id}** — ${g.prize}\nEnds <t:${g.ends_at}:R> in <#${g.channel_id}>`).join('\n\n');
      const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle('🎉 Active Giveaways').setDescription(lines).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
