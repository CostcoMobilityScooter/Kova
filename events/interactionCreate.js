const { errorEmbed } = require('../utils/embeds');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // ── Slash commands ────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`Error in /${interaction.commandName}:`, error);
        const embed = errorEmbed('Command Error', 'Something went wrong running that command.');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // ── Modal submits ─────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const [prefix, step, userId] = interaction.customId.split(':');
      if (prefix === 'rwiz' && step === 'modalsubmit') {
        const key = `${interaction.guildId}:${interaction.user.id}`;
        client.roleWizards = client.roleWizards || new Map();
        const state = client.roleWizards.get(key);
        if (!state) return interaction.reply({ content: 'Wizard expired. Run `/new-role-menu` again.', ephemeral: true });

        state.title = interaction.fields.getTextInputValue('title');
        state.description = interaction.fields.getTextInputValue('description') || null;
        const colorInput = interaction.fields.getTextInputValue('color');
        state.color = colorInput?.startsWith('#') ? colorInput : '#5865F2';
        state.step = 'roles';

        // Show role select after modal
        const { showRoleSelect } = require('../handlers/roleWizardHandler');
        const { EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('New Role Menu')
          .setDescription('Select the roles to include in this menu. You can select up to 25.');

        const row = new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(`rwiz:roles:${userId}`)
            .setPlaceholder('Select roles...')
            .setMinValues(1)
            .setMaxValues(25)
        );

        const cancelRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`rwiz:cancel:${userId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({ embeds: [embed], components: [row, cancelRow], ephemeral: true });
      }
      return;
    }

    // ── Button interactions ───────────────────────────────────
    if (interaction.isButton()) {
      const parts = interaction.customId.split(':');

      // Ticket buttons
      if (interaction.customId === 'ticket_create') {
        const { handleTicketCreate } = require('../handlers/ticketHandler');
        await handleTicketCreate(interaction);
        return;
      }
      if (interaction.customId === 'ticket_close_btn') {
        const { handleTicketCloseBtn } = require('../handlers/ticketHandler');
        await handleTicketCloseBtn(interaction);
        return;
      }

      // Blackjack buttons
      if (parts[0] === 'bj') {
        const bjHandler = require('../handlers/blackjackHandler');
        const action = parts[1]; const key = `${parts[2]}:${parts[3]}`; await bjHandler(interaction, client, [action, key]);
        return;
      }

      // Role wizard buttons
      if (parts[0] === 'rwiz') {
        const wizardHandler = require('../handlers/roleWizardHandler');
        await wizardHandler(interaction, client, parts.slice(1));
        return;
      }

      // Verify button (channel fallback)
      if (parts[0] === 'verify') {
        const { handleChannelVerifyButton } = require('../handlers/verifyHandler');
        await handleChannelVerifyButton(interaction, client);
        return;
      }

      // Verify flow buttons (DM flow)
      if (parts[0] === 'verifyflow') {
        const { handleVerifyFlow } = require('../handlers/verifyHandler');
        await handleVerifyFlow(interaction, client);
        return;
      }

      // Self-assign role buttons
      if (parts[0] === 'role') {
        const roleHandler = require('../handlers/roleButtonHandler');
        await roleHandler(interaction, client, parts.slice(1));
        return;
      }
    }

    // ── Select menu interactions ──────────────────────────────
    if (interaction.isStringSelectMenu()) {
      const parts = interaction.customId.split(':');

      // Role wizard select menus
      if (parts[0] === 'rwiz') {
        const wizardHandler = require('../handlers/roleWizardHandler');
        await wizardHandler(interaction, client, parts.slice(1));
        return;
      }

      // Self-assign role dropdowns
      if (parts[0] === 'roleselect') {
        const roleSelectHandler = require('../handlers/roleSelectHandler');
        await roleSelectHandler(interaction, client, parts.slice(1));
        return;
      }
    }

    // ── Channel/Role select menus (wizard) ────────────────────
    if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
      const parts = interaction.customId.split(':');
      if (parts[0] === 'rwiz') {
        const wizardHandler = require('../handlers/roleWizardHandler');
        await wizardHandler(interaction, client, parts.slice(1));
        return;
      }
    }
  },
};
