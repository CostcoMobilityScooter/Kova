const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const { db } = require('../utils/database');

module.exports = async function roleWizardHandler(interaction, client, args) {
  const userId = args[args.length - 1];
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: 'This wizard is not for you.', ephemeral: true });
  }

  const key = `${interaction.guildId}:${interaction.user.id}`;
  client.roleWizards = client.roleWizards || new Map();
  const state = client.roleWizards.get(key);

  if (!state) {
    return interaction.reply({ content: 'Wizard expired. Run `/new-role-menu` again.', ephemeral: true });
  }

  const step = args[0];

  // ── CANCEL ────────────────────────────────────────────────
  if (step === 'cancel') {
    client.roleWizards.delete(key);
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('❌ Setup cancelled.')],
      components: []
    });
  }

  // ── STEP 1: TYPE ──────────────────────────────────────────
  if (step === 'type') {
    state.type = args[1]; // button or dropdown
    state.step = 'mode';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('New Role Menu')
      .setDescription('What mode should this role menu use?');

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`rwiz:mode:${userId}`)
        .setPlaceholder('Select a mode...')
        .addOptions([
          { label: 'Toggle', description: 'Clicking adds the role, clicking again removes it', value: 'toggle', emoji: '🔄' },
          { label: 'Single Role', description: 'User can only have one role from this menu at a time', value: 'single', emoji: '☝️' },
          { label: 'Add Only', description: 'Users can only get roles, not remove them', value: 'add-only', emoji: '➕' },
        ])
    );

    const cancelRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rwiz:cancel:${userId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    return interaction.update({ embeds: [embed], components: [row, cancelRow] });
  }

  // ── STEP 2: MODE ──────────────────────────────────────────
  if (step === 'mode') {
    state.mode = interaction.values[0];
    state.step = 'channel';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('New Role Menu')
      .setDescription('Which channel should the role menu be posted in?');

    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`rwiz:channel:${userId}`)
        .setPlaceholder('Select a channel...')
        .addChannelTypes(ChannelType.GuildText)
    );

    const cancelRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rwiz:cancel:${userId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    return interaction.update({ embeds: [embed], components: [row, cancelRow] });
  }

  // ── STEP 3: CHANNEL ───────────────────────────────────────
  if (step === 'channel') {
    state.channelId = interaction.values[0];
    state.step = 'info';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('New Role Menu')
      .setDescription('Click **Open Modal** to set the title, description, and color for your role menu.');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rwiz:openmodal:${userId}`).setLabel('Open Modal').setStyle(ButtonStyle.Primary).setEmoji('📝'),
      new ButtonBuilder().setCustomId(`rwiz:cancel:${userId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  // ── STEP 4: OPEN MODAL ────────────────────────────────────
  if (step === 'openmodal') {
    const modal = new ModalBuilder()
      .setCustomId(`rwiz:modalsubmit:${userId}`)
      .setTitle('Role Menu Details');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setPlaceholder('e.g. Color Roles').setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setPlaceholder('e.g. Click a button below to get a color role!').setRequired(false).setMaxLength(300)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('color').setLabel('Embed Color (hex)').setStyle(TextInputStyle.Short).setPlaceholder('#5865F2').setRequired(false).setMaxLength(7)
      ),
    );

    return interaction.showModal(modal);
  }

  // ── STEP 5: ROLES ─────────────────────────────────────────
  if (step === 'roles') {
    state.roles = interaction.values;
    state.step = 'confirm';

    const roleList = state.roles.map(r => `<@&${r}>`).join(', ');

    const embed = new EmbedBuilder()
      .setColor(parseInt((state.color || '#5865F2').replace('#', ''), 16) || 0x5865F2)
      .setTitle(state.title)
      .setDescription(state.description || 'Select a role below.')
      .addFields(
        { name: 'Type', value: state.type === 'button' ? '🖱️ Buttons' : '📋 Dropdown', inline: true },
        { name: 'Mode', value: state.mode, inline: true },
        { name: 'Channel', value: `<#${state.channelId}>`, inline: true },
        { name: 'Roles', value: roleList }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rwiz:confirm:${userId}`).setLabel('Post It').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId(`rwiz:redoroles:${userId}`).setLabel('Redo Roles').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`rwiz:cancel:${userId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  // ── REDO ROLES ────────────────────────────────────────────
  if (step === 'redoroles') {
    state.roles = [];
    state.step = 'roles';
    return showRoleSelect(interaction, userId);
  }

  // ── CONFIRM: POST ─────────────────────────────────────────
  if (step === 'confirm') {
    const guild = interaction.guild;
    const channel = guild.channels.cache.get(state.channelId);
    if (!channel) {
      return interaction.update({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('❌ Channel not found.')], components: [] });
    }

    const color = parseInt((state.color || '#5865F2').replace('#', ''), 16) || 0x5865F2;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(state.title)
      .setDescription(state.description || 'Select a role below.');

    // Save to DB
    db.prepare('INSERT OR IGNORE INTO roles_config (guild_id) VALUES (?)').run(guild.id);
    db.prepare('INSERT INTO role_categories (guild_id, name, description, channel_id, color, mode) VALUES (?, ?, ?, ?, ?, ?)').run(
      guild.id, state.title, state.description || '', state.channelId, state.color || '#5865F2', state.mode
    );
    const cat = db.prepare('SELECT * FROM role_categories WHERE guild_id = ? AND name = ? ORDER BY id DESC LIMIT 1').get(guild.id, state.title);
    for (const roleId of state.roles) {
      db.prepare('INSERT OR IGNORE INTO self_roles (guild_id, role_id, category_id) VALUES (?, ?, ?)').run(guild.id, roleId, cat.id);
    }

    let components = [];

    if (state.type === 'button') {
      const { ActionRowBuilder: AR, ButtonBuilder: BB, ButtonStyle: BS } = require('discord.js');
      const rows = [];
      let row = new AR();
      let count = 0;
      for (const roleId of state.roles) {
        const role = guild.roles.cache.get(roleId);
        if (!role) continue;
        if (count > 0 && count % 5 === 0) { rows.push(row); row = new AR(); }
        row.addComponents(new BB().setCustomId(`role:${roleId}`).setLabel(role.name).setStyle(BS.Secondary));
        count++;
      }
      if (count % 5 !== 0 || count === 0) rows.push(row);
      components = rows.slice(0, 5);
    } else {
      const { ActionRowBuilder: AR, StringSelectMenuBuilder: SSM, StringSelectMenuOptionBuilder: SSOB } = require('discord.js');
      const options = state.roles.map(roleId => {
        const role = guild.roles.cache.get(roleId);
        return new SSOB().setLabel(role?.name || roleId).setValue(roleId);
      });
      const maxValues = state.mode === 'single' ? 1 : options.length;
      const menu = new SSM()
        .setCustomId(`roleselect:${cat.id}`)
        .setPlaceholder('Select a role...')
        .setMinValues(0)
        .setMaxValues(maxValues)
        .addOptions(options);
      components = [new AR().addComponents(menu)];
    }

    await channel.send({ embeds: [embed], components });
    client.roleWizards.delete(key);

    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('✅ Role Menu Created').setDescription(`Your role menu has been posted in ${channel}!`)],
      components: []
    });
  }
};

async function showRoleSelect(interaction, userId) {
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

  return interaction.update({ embeds: [embed], components: [row, cancelRow] });
}

module.exports.showRoleSelect = showRoleSelect;
