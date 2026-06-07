const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { db, ensureGuild } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system management')
    .addSubcommand(s => s.setName('setup').setDescription('Set up the ticket system')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send the ticket panel').setRequired(true))
      .addChannelOption(o => o.setName('category').setDescription('Category to create tickets in').setRequired(true))
      .addRoleOption(o => o.setName('support_role').setDescription('Role that can see tickets').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Panel message').setRequired(false)))
    .addSubcommand(s => s.setName('close').setDescription('Close the current ticket'))
    .addSubcommand(s => s.setName('add').setDescription('Add a user to the ticket')
      .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a user from the ticket')
      .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(s => s.setName('transcript').setDescription('Save a transcript of the ticket'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    ensureGuild(interaction.guildId);
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const category = interaction.options.getChannel('category');
      const supportRole = interaction.options.getRole('support_role');
      const message = interaction.options.getString('message') || 'Click the button below to open a support ticket.';

      db.prepare(`INSERT OR REPLACE INTO ticket_config (guild_id, channel_id, category_id, support_role_id, panel_message)
        VALUES (?, ?, ?, ?, ?)`).run(interaction.guildId, channel.id, category.id, supportRole.id, message);

      const embed = new EmbedBuilder()
        .setTitle('🎫 Support Tickets')
        .setDescription(message)
        .setColor(0x5865f2)
        .setFooter({ text: 'Click the button below to create a ticket' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_create').setLabel('Open Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary)
      );

      await channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ Ticket panel sent to ${channel}!`, ephemeral: true });
    }

    else if (sub === 'close') {
      const ticket = db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND channel_id = ? AND closed = 0').get(interaction.guildId, interaction.channelId);
      if (!ticket) return interaction.reply({ content: '❌ This is not an open ticket channel.', ephemeral: true });

      await interaction.reply({ content: '🔒 Closing ticket in 5 seconds...' });
      db.prepare('UPDATE tickets SET closed = 1, closed_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), ticket.id);

      setTimeout(async () => {
        await interaction.channel.delete().catch(() => {});
      }, 5000);
    }

    else if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const ticket = db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND channel_id = ? AND closed = 0').get(interaction.guildId, interaction.channelId);
      if (!ticket) return interaction.reply({ content: '❌ This is not an open ticket channel.', ephemeral: true });

      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
      await interaction.reply({ content: `✅ Added ${user} to the ticket.` });
    }

    else if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      const ticket = db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND channel_id = ? AND closed = 0').get(interaction.guildId, interaction.channelId);
      if (!ticket) return interaction.reply({ content: '❌ This is not an open ticket channel.', ephemeral: true });

      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
      await interaction.reply({ content: `✅ Removed ${user} from the ticket.` });
    }

    else if (sub === 'transcript') {
      const ticket = db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND channel_id = ? AND closed = 0').get(interaction.guildId, interaction.channelId);
      if (!ticket) return interaction.reply({ content: '❌ This is not an open ticket channel.', ephemeral: true });

      await interaction.deferReply({ ephemeral: true });
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const sorted = [...messages.values()].reverse();

      let transcript = `Ticket Transcript — #${interaction.channel.name}\n`;
      transcript += `Server: ${interaction.guild.name} | Generated: ${new Date().toUTCString()}\n`;
      transcript += '='.repeat(60) + '\n\n';

      for (const msg of sorted) {
        if (msg.author.bot) continue;
        transcript += `[${msg.createdAt.toUTCString()}] ${msg.author.tag}: ${msg.content || '[attachment/embed]'}\n`;
      }

      const buf = Buffer.from(transcript, 'utf-8');
      await interaction.editReply({ content: '📄 Transcript saved!', files: [{ attachment: buf, name: `transcript-${interaction.channel.name}.txt` }] });
    }
  }
};
