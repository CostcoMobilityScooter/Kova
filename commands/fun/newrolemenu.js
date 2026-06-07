const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('new-role-menu')
    .setDescription('Create a new role menu with a step-by-step wizard'),

  async execute(interaction, client) {
    // Store wizard state in memory keyed by user+guild
    const key = `${interaction.guildId}:${interaction.user.id}`;
    client.roleWizards = client.roleWizards || new Map();
    client.roleWizards.set(key, {
      step: 'type',
      type: null,
      channelId: null,
      title: null,
      description: null,
      color: '#5865F2',
      roles: [],
      mode: 'toggle', // toggle, single, add-only
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('New Role Menu')
      .setDescription('Welcome! Let\'s create a new role menu.\n\nWhat type of role menu do you want to create?');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rwiz:type:button:${interaction.user.id}`).setLabel('Button').setStyle(ButtonStyle.Secondary).setEmoji('🖱️'),
      new ButtonBuilder().setCustomId(`rwiz:type:dropdown:${interaction.user.id}`).setLabel('Dropdown').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
      new ButtonBuilder().setCustomId(`rwiz:cancel:${interaction.user.id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
