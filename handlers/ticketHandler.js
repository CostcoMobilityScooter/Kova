const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../utils/database');

async function handleTicketCreate(interaction) {
  const config = db.prepare('SELECT * FROM ticket_config WHERE guild_id = ?').get(interaction.guildId);
  if (!config) return interaction.reply({ content: '❌ Ticket system is not configured.', ephemeral: true });

  // Check if user already has an open ticket
  const existing = db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND closed = 0').get(interaction.guildId, interaction.user.id);
  if (existing) {
    return interaction.reply({ content: `❌ You already have an open ticket: <#${existing.channel_id}>`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketNum = (db.prepare('SELECT COUNT(*) as cnt FROM tickets WHERE guild_id = ?').get(interaction.guildId).cnt || 0) + 1;
  const channelName = `ticket-${String(ticketNum).padStart(4, '0')}`;

  const channel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.category_id,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: config.support_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ],
  });

  db.prepare('INSERT INTO tickets (guild_id, channel_id, user_id, ticket_number) VALUES (?, ?, ?, ?)').run(interaction.guildId, channel.id, interaction.user.id, ticketNum);

  const embed = new EmbedBuilder()
    .setTitle(`🎫 Ticket #${ticketNum}`)
    .setDescription(`Hello ${interaction.user}! Support will be with you shortly.\nDescribe your issue and a staff member will assist you.`)
    .setColor(0x5865f2)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close_btn').setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `${interaction.user} <@&${config.support_role_id}>`, embeds: [embed], components: [row] });
  await interaction.editReply({ content: `✅ Your ticket has been created: ${channel}` });
}

async function handleTicketCloseBtn(interaction) {
  const ticket = db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND channel_id = ? AND closed = 0').get(interaction.guildId, interaction.channelId);
  if (!ticket) return interaction.reply({ content: '❌ This is not an open ticket.', ephemeral: true });

  await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...' });
  db.prepare('UPDATE tickets SET closed = 1, closed_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), ticket.id);

  setTimeout(async () => {
    await interaction.channel.delete().catch(() => {});
  }, 5000);
}

module.exports = { handleTicketCreate, handleTicketCloseBtn };
