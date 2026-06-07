const { SlashCommandBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');
const { db, ensureGuild } = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { requireAdmin } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the bot for your server')
    .addSubcommand(s => s.setName('start').setDescription('Initialize all bot systems'))
    .addSubcommand(s => s.setName('status').setDescription('View current setup status'))
    .addSubcommand(s => s.setName('reset').setDescription('Reset all bot settings for this server'))
    .addSubcommand(s => s.setName('prefix').setDescription('Set command prefix').addStringOption(o => o.setName('prefix').setDescription('Prefix').setRequired(true)))
    .addSubcommand(s => s.setName('admin-role').setDescription('Set admin role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('language').setDescription('Set language').addStringOption(o => o.setName('language').setDescription('Language code').setRequired(true)))
    .addSubcommandGroup(g => g.setName('welcome').setDescription('Welcome/goodbye settings')
      .addSubcommand(s => s.setName('channel').setDescription('Set welcome channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
      .addSubcommand(s => s.setName('message').setDescription('Set welcome message').addStringOption(o => o.setName('message').setDescription('Use {user}, {server}, {membercount}').setRequired(true)))
      .addSubcommand(s => s.setName('goodbye').setDescription('Set goodbye channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
      .addSubcommand(s => s.setName('toggle').setDescription('Toggle welcome system')))
    .addSubcommandGroup(g => g.setName('verify').setDescription('Verification settings')
      .addSubcommand(s => s.setName('channel').setDescription('Set verify channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
      .addSubcommand(s => s.setName('role').setDescription('Set verified role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
      .addSubcommand(s => s.setName('unverified-role').setDescription('Set unverified role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
      .addSubcommand(s => s.setName('logs').setDescription('Set verify logs channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
      .addSubcommand(s => s.setName('toggle').setDescription('Toggle verification'))
      .addSubcommand(s => s.setName('rules').setDescription('Set the rules shown in the verification DM').addStringOption(o => o.setName('rules').setDescription('Rules text (use \\n for new lines)').setRequired(true)))
      .addSubcommand(s => s.setName('welcome-dm').setDescription('Set the welcome DM message sent when someone joins').addStringOption(o => o.setName('message').setDescription('Welcome DM message. Use {user}, {server}').setRequired(true)))
      .addSubcommand(s => s.setName('captcha').setDescription('Toggle math captcha during verification'))
      .addSubcommand(s => s.setName('age-check').setDescription('Toggle 13+ age check during verification'))
      .addSubcommand(s => s.setName('preview').setDescription('Preview the current verification DM')))
    .addSubcommandGroup(g => g.setName('mod').setDescription('Moderation settings')
      .addSubcommand(s => s.setName('logs').setDescription('Set mod logs channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
      .addSubcommand(s => s.setName('filter').setDescription('Word filter').addStringOption(o => o.setName('action').setDescription('add/remove').setRequired(true).addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' })).addStringOption(o => o.setName('word').setDescription('Word').setRequired(true)))
      .addSubcommand(s => s.setName('filter-toggle').setDescription('Toggle word filter'))
      .addSubcommand(s => s.setName('antispam').setDescription('Toggle anti-spam'))
      .addSubcommand(s => s.setName('antiraid').setDescription('Toggle anti-raid'))
      .addSubcommand(s => s.setName('warnings').setDescription('Set auto-ban warning threshold').addIntegerOption(o => o.setName('number').setDescription('Number of warnings before ban').setRequired(true).setMinValue(1).setMaxValue(20)))
      .addSubcommand(s => s.setName('role').setDescription('Set mod role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))))
    .addSubcommandGroup(g => g.setName('logs').setDescription('Logging settings')
      .addSubcommand(s => s.setName('channel').setDescription('Set log channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
      .addSubcommand(s => s.setName('deleted').setDescription('Toggle deleted message logging'))
      .addSubcommand(s => s.setName('edited').setDescription('Toggle edited message logging'))
      .addSubcommand(s => s.setName('joins').setDescription('Toggle join/leave logging'))
      .addSubcommand(s => s.setName('roles').setDescription('Toggle role change logging'))
      .addSubcommand(s => s.setName('mod').setDescription('Toggle mod action logging')))
    .addSubcommandGroup(g => g.setName('levels').setDescription('Leveling settings')
      .addSubcommand(s => s.setName('toggle').setDescription('Toggle leveling system'))
      .addSubcommand(s => s.setName('channel').setDescription('Set level-up channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
      .addSubcommand(s => s.setName('message').setDescription('Set level-up message').addStringOption(o => o.setName('message').setDescription('Use {user}, {level}').setRequired(true)))
      .addSubcommand(s => s.setName('add-role').setDescription('Add a level role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)).addIntegerOption(o => o.setName('level').setDescription('Level required').setRequired(true)))
      .addSubcommand(s => s.setName('remove-role').setDescription('Remove a level role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
      .addSubcommand(s => s.setName('xp').setDescription('Set XP per message').addIntegerOption(o => o.setName('amount').setDescription('Max XP per message').setRequired(true).setMinValue(1).setMaxValue(100))))
    .addSubcommandGroup(g => g.setName('giveaway').setDescription('Giveaway settings')
      .addSubcommand(s => s.setName('channel').setDescription('Set default giveaway channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
      .addSubcommand(s => s.setName('role').setDescription('Set giveaway manager role').addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
      .addSubcommand(s => s.setName('toggle').setDescription('Toggle giveaway system')))
    .addSubcommandGroup(g => g.setName('confessions').setDescription('Confession settings')
      .addSubcommand(s => s.setName('channel').setDescription('Set confession channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
      .addSubcommand(s => s.setName('logs').setDescription('Set confession logs channel').addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true)))
      .addSubcommand(s => s.setName('toggle').setDescription('Toggle confession system')))
    .addSubcommandGroup(g => g.setName('commands').setDescription('Slash command management')
      .addSubcommand(s => s.setName('refresh').setDescription('Clear and redeploy all slash commands'))
      .addSubcommand(s => s.setName('clear-guild').setDescription('Clear guild-specific commands from this server'))),

  async execute(interaction, client) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    ensureGuild(guildId);

    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    // ── TOP LEVEL ─────────────────────────────────────────────
    if (!group) {
      if (sub === 'start') {
        const tables = ['welcome','verification','mod_config','logs_config','levels_config','giveaway_config','confessions_config','roles_config'];
        for (const t of tables) db.prepare(`INSERT OR IGNORE INTO ${t} (guild_id) VALUES (?)`).run(guildId);
        db.prepare('UPDATE guilds SET setup_complete = 1 WHERE guild_id = ?').run(guildId);
        return interaction.editReply({ embeds: [successEmbed('Setup Complete', 'All systems initialized. Use `/setup status` to see what\'s enabled.')] });
      }
      if (sub === 'status') {
        const welcome = db.prepare('SELECT * FROM welcome WHERE guild_id = ?').get(guildId);
        const verify = db.prepare('SELECT * FROM verification WHERE guild_id = ?').get(guildId);
        const levels = db.prepare('SELECT * FROM levels_config WHERE guild_id = ?').get(guildId);
        const giveaway = db.prepare('SELECT * FROM giveaway_config WHERE guild_id = ?').get(guildId);
        const confessions = db.prepare('SELECT * FROM confessions_config WHERE guild_id = ?').get(guildId);
        const modcfg = db.prepare('SELECT * FROM mod_config WHERE guild_id = ?').get(guildId);
        const on = v => v ? '✅' : '❌';
        return interaction.editReply({ embeds: [{ color: 0x3498db, title: '⚙️ Kova Status', fields: [
          { name: 'Welcome', value: on(welcome?.enabled), inline: true },
          { name: 'Verification', value: on(verify?.enabled), inline: true },
          { name: 'Levels', value: on(levels?.enabled), inline: true },
          { name: 'Giveaways', value: on(giveaway?.enabled), inline: true },
          { name: 'Confessions', value: on(confessions?.enabled), inline: true },
          { name: 'Word Filter', value: on(modcfg?.filter_enabled), inline: true },
          { name: 'Anti-Spam', value: on(modcfg?.antispam_enabled), inline: true },
          { name: 'Anti-Raid', value: on(modcfg?.antiraid_enabled), inline: true },
        ], timestamp: new Date().toISOString() }] });
      }
      if (sub === 'reset') {
        const tables = ['welcome','verification','mod_config','logs_config','levels_config','giveaway_config','confessions_config','roles_config','role_categories','self_roles','level_roles','filtered_words'];
        for (const t of tables) db.prepare(`DELETE FROM ${t} WHERE guild_id = ?`).run(guildId);
        db.prepare('UPDATE guilds SET setup_complete = 0, admin_role = NULL, mod_role = NULL WHERE guild_id = ?').run(guildId);
        return interaction.editReply({ embeds: [successEmbed('Reset', 'All bot settings cleared.')] });
      }
      if (sub === 'prefix') {
        db.prepare('UPDATE guilds SET prefix = ? WHERE guild_id = ?').run(interaction.options.getString('prefix'), guildId);
        return interaction.editReply({ embeds: [successEmbed('Prefix Updated', `\`${interaction.options.getString('prefix')}\``)] });
      }
      if (sub === 'admin-role') {
        db.prepare('UPDATE guilds SET admin_role = ? WHERE guild_id = ?').run(interaction.options.getRole('role').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Admin Role Set', `${interaction.options.getRole('role')}`)] });
      }
      if (sub === 'language') {
        db.prepare('UPDATE guilds SET language = ? WHERE guild_id = ?').run(interaction.options.getString('language'), guildId);
        return interaction.editReply({ embeds: [successEmbed('Language Set', `\`${interaction.options.getString('language')}\``)] });
      }
    }

    // ── WELCOME ───────────────────────────────────────────────
    if (group === 'welcome') {
      db.prepare('INSERT OR IGNORE INTO welcome (guild_id) VALUES (?)').run(guildId);
      if (sub === 'channel') {
        db.prepare('UPDATE welcome SET channel_id = ? WHERE guild_id = ?').run(interaction.options.getChannel('channel').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Welcome Channel Set', `${interaction.options.getChannel('channel')}`)] });
      }
      if (sub === 'message') {
        db.prepare('UPDATE welcome SET message = ? WHERE guild_id = ?').run(interaction.options.getString('message'), guildId);
        return interaction.editReply({ embeds: [successEmbed('Welcome Message Set', interaction.options.getString('message'))] });
      }
      if (sub === 'goodbye') {
        db.prepare('UPDATE welcome SET goodbye_channel_id = ? WHERE guild_id = ?').run(interaction.options.getChannel('channel').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Goodbye Channel Set', `${interaction.options.getChannel('channel')}`)] });
      }
      if (sub === 'toggle') {
        const c = db.prepare('SELECT enabled FROM welcome WHERE guild_id = ?').get(guildId);
        const nv = c ? (c.enabled ? 0 : 1) : 1;
        db.prepare('UPDATE welcome SET enabled = ? WHERE guild_id = ?').run(nv, guildId);
        return interaction.editReply({ embeds: [successEmbed('Welcome Toggled', `Welcome: **${nv ? 'on' : 'off'}**`)] });
      }
    }

    // ── VERIFY ────────────────────────────────────────────────
    if (group === 'verify') {
      db.prepare('INSERT OR IGNORE INTO verification (guild_id) VALUES (?)').run(guildId);
      if (sub === 'channel') {
        db.prepare('UPDATE verification SET channel_id = ? WHERE guild_id = ?').run(interaction.options.getChannel('channel').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Verify Channel Set', `${interaction.options.getChannel('channel')}`)] });
      }
      if (sub === 'role') {
        db.prepare('UPDATE verification SET verified_role = ? WHERE guild_id = ?').run(interaction.options.getRole('role').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Verified Role Set', `${interaction.options.getRole('role')}`)] });
      }
      if (sub === 'unverified-role') {
        db.prepare('UPDATE verification SET unverified_role = ? WHERE guild_id = ?').run(interaction.options.getRole('role').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Unverified Role Set', `${interaction.options.getRole('role')}`)] });
      }
      if (sub === 'logs') {
        db.prepare('UPDATE verification SET logs_channel = ? WHERE guild_id = ?').run(interaction.options.getChannel('channel').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Verify Logs Set', `${interaction.options.getChannel('channel')}`)] });
      }
      if (sub === 'toggle') {
        const c = db.prepare('SELECT enabled FROM verification WHERE guild_id = ?').get(guildId);
        const nv = c ? (c.enabled ? 0 : 1) : 1;
        db.prepare('UPDATE verification SET enabled = ? WHERE guild_id = ?').run(nv, guildId);
        return interaction.editReply({ embeds: [successEmbed('Verification Toggled', `Verification: **${nv ? 'on' : 'off'}**`)] });
      }
      if (sub === 'rules') {
        const rules = interaction.options.getString('rules').replace(/\\n/g, '\n');
        db.prepare('UPDATE verification SET rules = ? WHERE guild_id = ?').run(rules, guildId);
        return interaction.editReply({ embeds: [successEmbed('Rules Set', `Rules saved. Users will see these during DM verification.`)] });
      }
      if (sub === 'welcome-dm') {
        const message = interaction.options.getString('message');
        db.prepare('UPDATE verification SET welcome_dm = ? WHERE guild_id = ?').run(message, guildId);
        return interaction.editReply({ embeds: [successEmbed('Welcome DM Set', `DM message saved. Use {user} and {server} as placeholders.`)] });
      }
      if (sub === 'captcha') {
        const c = db.prepare('SELECT captcha_enabled FROM verification WHERE guild_id = ?').get(guildId);
        const nv = c ? (c.captcha_enabled ? 0 : 1) : 1;
        db.prepare('UPDATE verification SET captcha_enabled = ? WHERE guild_id = ?').run(nv, guildId);
        return interaction.editReply({ embeds: [successEmbed('Captcha Toggled', `Math captcha: **${nv ? 'on' : 'off'}**`)] });
      }
      if (sub === 'age-check') {
        const c = db.prepare('SELECT age_check_enabled FROM verification WHERE guild_id = ?').get(guildId);
        const nv = c ? (c.age_check_enabled ? 0 : 1) : 1;
        db.prepare('UPDATE verification SET age_check_enabled = ? WHERE guild_id = ?').run(nv, guildId);
        return interaction.editReply({ embeds: [successEmbed('Age Check Toggled', `13+ age check: **${nv ? 'on' : 'off'}**`)] });
      }
      if (sub === 'preview') {
        const config = db.prepare('SELECT * FROM verification WHERE guild_id = ?').get(guildId);
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`Welcome to ${interaction.guild.name}!`)
          .setDescription(
            (config?.welcome_dm || 'Welcome! Please complete verification to access the server.').replace('{user}', interaction.user.toString()).replace('{server}', interaction.guild.name)
          )
          .setThumbnail(interaction.guild.iconURL())
          .addFields(
            { name: '📋 Rules', value: config?.rules || '*No rules set — use `/setup verify rules`*' },
            { name: '🔞 Age Check', value: config?.age_check_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: '🔐 Captcha', value: config?.captcha_enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
          )
          .setFooter({ text: 'This is a preview of the verification DM' });
        return interaction.editReply({ embeds: [embed] });
      }
    }

    // ── ROLES ─────────────────────────────────────────────────
    if (group === 'roles') {
      db.prepare('INSERT OR IGNORE INTO roles_config (guild_id) VALUES (?)').run(guildId);

      if (sub === 'create') {
        const catName = interaction.options.getString('category');
        const rolesStr = interaction.options.getString('roles');
        const channel = interaction.options.getChannel('channel');
        const description = interaction.options.getString('description') || `Click a button below to toggle your ${catName.toLowerCase()} role!`;
        const colorStr = interaction.options.getString('color') || '#5865F2';
        const color = parseInt(colorStr.replace('#', ''), 16) || 0x5865F2;

        const roleIds = [...rolesStr.matchAll(/<@&(\d+)>/g)].map(m => m[1]);
        if (!roleIds.length) return interaction.editReply({ embeds: [errorEmbed('No Roles Found', 'Mention roles like @Red @Blue @Green')] });
        if (roleIds.length > 25) return interaction.editReply({ embeds: [errorEmbed('Too Many Roles', 'Maximum 25 roles per category.')] });

        // Delete existing category with same name if exists
        const existing = db.prepare('SELECT * FROM role_categories WHERE guild_id = ? AND name = ?').get(guildId, catName);
        if (existing) {
          db.prepare('DELETE FROM self_roles WHERE category_id = ?').run(existing.id);
          db.prepare('DELETE FROM role_categories WHERE id = ?').run(existing.id);
        }

        // Create category
        db.prepare('INSERT INTO role_categories (guild_id, name, description, channel_id, color) VALUES (?, ?, ?, ?, ?)').run(guildId, catName, description, channel.id, colorStr);
        const cat = db.prepare('SELECT * FROM role_categories WHERE guild_id = ? AND name = ?').get(guildId, catName);

        // Add roles
        for (const roleId of roleIds) {
          if (interaction.guild.roles.cache.get(roleId)) {
            db.prepare('INSERT OR IGNORE INTO self_roles (guild_id, role_id, category_id) VALUES (?, ?, ?)').run(guildId, roleId, cat.id);
          }
        }

        // Post the embed with buttons to the channel
        await postCategoryMessage(interaction.guild, cat, client);

        return interaction.editReply({ embeds: [successEmbed('Category Created', `**${catName}** posted in ${channel} with ${roleIds.length} roles.`)] });
      }

      if (sub === 'delete') {
        const catName = interaction.options.getString('category');
        const cat = db.prepare('SELECT * FROM role_categories WHERE guild_id = ? AND name = ?').get(guildId, catName);
        if (!cat) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No category named "${catName}"`)] });
        db.prepare('DELETE FROM self_roles WHERE category_id = ?').run(cat.id);
        db.prepare('DELETE FROM role_categories WHERE id = ?').run(cat.id);
        return interaction.editReply({ embeds: [successEmbed('Deleted', `**${catName}** removed.`)] });
      }

      if (sub === 'list') {
        const categories = db.prepare('SELECT * FROM role_categories WHERE guild_id = ?').all(guildId);
        if (!categories.length) return interaction.editReply({ embeds: [errorEmbed('No Categories', 'No role categories set up yet.')] });
        const lines = categories.map(cat => {
          const roles = db.prepare('SELECT * FROM self_roles WHERE category_id = ?').all(cat.id);
          return `**${cat.name}** → <#${cat.channel_id}>\n${roles.map(r => `<@&${r.role_id}>`).join(', ')}`;
        });
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('🎭 Role Categories').setDescription(lines.join('\n\n')).setTimestamp()] });
      }

      if (sub === 'refresh') {
        const categories = db.prepare('SELECT * FROM role_categories WHERE guild_id = ?').all(guildId);
        if (!categories.length) return interaction.editReply({ embeds: [errorEmbed('No Categories', 'No categories to refresh.')] });
        let count = 0;
        for (const cat of categories) {
          await postCategoryMessage(interaction.guild, cat, client);
          count++;
        }
        return interaction.editReply({ embeds: [successEmbed('Refreshed', `Reposted **${count}** categories.`)] });
      }
    }

    // ── MOD ───────────────────────────────────────────────────
    if (group === 'mod') {
      db.prepare('INSERT OR IGNORE INTO mod_config (guild_id) VALUES (?)').run(guildId);
      if (sub === 'logs') {
        db.prepare('UPDATE mod_config SET logs_channel = ? WHERE guild_id = ?').run(interaction.options.getChannel('channel').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Mod Logs Set', `${interaction.options.getChannel('channel')}`)] });
      }
      if (sub === 'filter') {
        const action = interaction.options.getString('action');
        const word = interaction.options.getString('word').toLowerCase();
        if (action === 'add') db.prepare('INSERT INTO filtered_words (guild_id, word) VALUES (?, ?)').run(guildId, word);
        else db.prepare('DELETE FROM filtered_words WHERE guild_id = ? AND word = ?').run(guildId, word);
        return interaction.editReply({ embeds: [successEmbed(`Word ${action === 'add' ? 'Added' : 'Removed'}`, `"${word}"`)] });
      }
      if (sub === 'filter-toggle') {
        const c = db.prepare('SELECT filter_enabled FROM mod_config WHERE guild_id = ?').get(guildId);
        const nv = c ? (c.filter_enabled ? 0 : 1) : 1;
        db.prepare('UPDATE mod_config SET filter_enabled = ? WHERE guild_id = ?').run(nv, guildId);
        return interaction.editReply({ embeds: [successEmbed('Filter Toggled', `Word filter: **${nv ? 'on' : 'off'}**`)] });
      }
      if (sub === 'antispam') {
        const c = db.prepare('SELECT antispam_enabled FROM mod_config WHERE guild_id = ?').get(guildId);
        const nv = c ? (c.antispam_enabled ? 0 : 1) : 1;
        db.prepare('UPDATE mod_config SET antispam_enabled = ? WHERE guild_id = ?').run(nv, guildId);
        return interaction.editReply({ embeds: [successEmbed('Anti-Spam Toggled', `Anti-spam: **${nv ? 'on' : 'off'}**`)] });
      }
      if (sub === 'antiraid') {
        const c = db.prepare('SELECT antiraid_enabled FROM mod_config WHERE guild_id = ?').get(guildId);
        const nv = c ? (c.antiraid_enabled ? 0 : 1) : 1;
        db.prepare('UPDATE mod_config SET antiraid_enabled = ? WHERE guild_id = ?').run(nv, guildId);
        return interaction.editReply({ embeds: [successEmbed('Anti-Raid Toggled', `Anti-raid: **${nv ? 'on' : 'off'}**`)] });
      }
      if (sub === 'warnings') {
        db.prepare('UPDATE mod_config SET max_warnings = ? WHERE guild_id = ?').run(interaction.options.getInteger('number'), guildId);
        return interaction.editReply({ embeds: [successEmbed('Warnings Set', `Auto-ban after **${interaction.options.getInteger('number')}** warnings.`)] });
      }
      if (sub === 'role') {
        db.prepare('UPDATE guilds SET mod_role = ? WHERE guild_id = ?').run(interaction.options.getRole('role').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Mod Role Set', `${interaction.options.getRole('role')}`)] });
      }
    }

    // ── LOGS ──────────────────────────────────────────────────
    if (group === 'logs') {
      db.prepare('INSERT OR IGNORE INTO logs_config (guild_id) VALUES (?)').run(guildId);
      if (sub === 'channel') {
        db.prepare('UPDATE logs_config SET channel_id = ? WHERE guild_id = ?').run(interaction.options.getChannel('channel').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Log Channel Set', `${interaction.options.getChannel('channel')}`)] });
      }
      const toggleMap = { deleted: 'log_deleted', edited: 'log_edited', joins: 'log_joins', roles: 'log_roles', mod: 'log_mod' };
      if (toggleMap[sub]) {
        const col = toggleMap[sub];
        const c = db.prepare(`SELECT ${col} FROM logs_config WHERE guild_id = ?`).get(guildId);
        const nv = c ? (c[col] ? 0 : 1) : 1;
        db.prepare(`UPDATE logs_config SET ${col} = ? WHERE guild_id = ?`).run(nv, guildId);
        return interaction.editReply({ embeds: [successEmbed('Log Toggle', `${sub} logging: **${nv ? 'on' : 'off'}**`)] });
      }
    }

    // ── LEVELS ────────────────────────────────────────────────
    if (group === 'levels') {
      db.prepare('INSERT OR IGNORE INTO levels_config (guild_id) VALUES (?)').run(guildId);
      if (sub === 'toggle') {
        const c = db.prepare('SELECT enabled FROM levels_config WHERE guild_id = ?').get(guildId);
        const nv = c ? (c.enabled ? 0 : 1) : 1;
        db.prepare('UPDATE levels_config SET enabled = ? WHERE guild_id = ?').run(nv, guildId);
        return interaction.editReply({ embeds: [successEmbed('Levels Toggled', `Leveling: **${nv ? 'on' : 'off'}**`)] });
      }
      if (sub === 'channel') {
        db.prepare('UPDATE levels_config SET channel_id = ? WHERE guild_id = ?').run(interaction.options.getChannel('channel').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Level Channel Set', `${interaction.options.getChannel('channel')}`)] });
      }
      if (sub === 'message') {
        db.prepare('UPDATE levels_config SET message = ? WHERE guild_id = ?').run(interaction.options.getString('message'), guildId);
        return interaction.editReply({ embeds: [successEmbed('Level Message Set', interaction.options.getString('message'))] });
      }
      if (sub === 'add-role') {
        db.prepare('INSERT OR REPLACE INTO level_roles (guild_id, role_id, level_required) VALUES (?, ?, ?)').run(guildId, interaction.options.getRole('role').id, interaction.options.getInteger('level'));
        return interaction.editReply({ embeds: [successEmbed('Level Role Added', `${interaction.options.getRole('role')} at level ${interaction.options.getInteger('level')}.`)] });
      }
      if (sub === 'remove-role') {
        db.prepare('DELETE FROM level_roles WHERE guild_id = ? AND role_id = ?').run(guildId, interaction.options.getRole('role').id);
        return interaction.editReply({ embeds: [successEmbed('Level Role Removed', `${interaction.options.getRole('role')}`)] });
      }
      if (sub === 'xp') {
        db.prepare('UPDATE levels_config SET xp_per_message = ? WHERE guild_id = ?').run(interaction.options.getInteger('amount'), guildId);
        return interaction.editReply({ embeds: [successEmbed('XP Set', `XP per message: **${interaction.options.getInteger('amount')}**`)] });
      }
    }

    // ── GIVEAWAY ──────────────────────────────────────────────
    if (group === 'giveaway') {
      db.prepare('INSERT OR IGNORE INTO giveaway_config (guild_id) VALUES (?)').run(guildId);
      if (sub === 'channel') {
        db.prepare('UPDATE giveaway_config SET channel_id = ? WHERE guild_id = ?').run(interaction.options.getChannel('channel').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Giveaway Channel Set', `${interaction.options.getChannel('channel')}`)] });
      }
      if (sub === 'role') {
        db.prepare('UPDATE giveaway_config SET required_role = ? WHERE guild_id = ?').run(interaction.options.getRole('role').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Giveaway Role Set', `${interaction.options.getRole('role')}`)] });
      }
      if (sub === 'toggle') {
        const c = db.prepare('SELECT enabled FROM giveaway_config WHERE guild_id = ?').get(guildId);
        const nv = c ? (c.enabled ? 0 : 1) : 1;
        db.prepare('UPDATE giveaway_config SET enabled = ? WHERE guild_id = ?').run(nv, guildId);
        return interaction.editReply({ embeds: [successEmbed('Giveaway Toggled', `Giveaways: **${nv ? 'on' : 'off'}**`)] });
      }
    }

    // ── CONFESSIONS ───────────────────────────────────────────
    if (group === 'confessions') {
      db.prepare('INSERT OR IGNORE INTO confessions_config (guild_id) VALUES (?)').run(guildId);
      if (sub === 'channel') {
        db.prepare('UPDATE confessions_config SET channel_id = ? WHERE guild_id = ?').run(interaction.options.getChannel('channel').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Confessions Channel Set', `${interaction.options.getChannel('channel')}`)] });
      }
      if (sub === 'logs') {
        db.prepare('UPDATE confessions_config SET logs_channel = ? WHERE guild_id = ?').run(interaction.options.getChannel('channel').id, guildId);
        return interaction.editReply({ embeds: [successEmbed('Confession Logs Set', `${interaction.options.getChannel('channel')}`)] });
      }
      if (sub === 'toggle') {
        const c = db.prepare('SELECT enabled FROM confessions_config WHERE guild_id = ?').get(guildId);
        const nv = c ? (c.enabled ? 0 : 1) : 1;
        db.prepare('UPDATE confessions_config SET enabled = ? WHERE guild_id = ?').run(nv, guildId);
        return interaction.editReply({ embeds: [successEmbed('Confessions Toggled', `Confessions: **${nv ? 'on' : 'off'}**`)] });
      }
    }

    // ── COMMANDS ──────────────────────────────────────────────
    if (group === 'commands') {
      if (sub === 'refresh') {
        const { REST, Routes } = require('discord.js');
        const fs = require('fs');
        const path = require('path');
        const commands = [];
        function loadCmds(dir) {
          const files = fs.readdirSync(dir, { withFileTypes: true });
          for (const file of files) {
            const full = path.join(dir, file.name);
            if (file.isDirectory()) loadCmds(full);
            else if (file.name.endsWith('.js')) {
              const cmd = require(full);
              if (cmd.data) commands.push(cmd.data.toJSON());
            }
          }
        }
        loadCmds(path.join(__dirname, '../../commands'));
        const rest = new REST().setToken(process.env.TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        return interaction.editReply({ embeds: [successEmbed('Commands Refreshed', `Deployed **${commands.length}** commands.`)] });
      }
      if (sub === 'clear-guild') {
        const { REST, Routes } = require('discord.js');
        const rest = new REST().setToken(process.env.TOKEN);
        await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [] });
        return interaction.editReply({ embeds: [successEmbed('Guild Commands Cleared', 'All guild-specific commands removed.')] });
      }
    }

    return interaction.editReply({ embeds: [errorEmbed('Unknown Command', 'Subcommand not recognized.')] });
  },
};

// Helper to post a category embed with buttons to its channel
async function postCategoryMessage(guild, cat, client) {
  try {
    const channel = guild.channels.cache.get(cat.channel_id);
    if (!channel) return;

    // Delete old messages from this category
    const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    if (messages) {
      const old = messages.filter(m => m.author.id === client.user.id && m.components.length > 0 && m.embeds[0]?.title === cat.name);
      for (const msg of old.values()) await msg.delete().catch(() => {});
    }

    const roles = require('../../utils/database').db.prepare('SELECT * FROM self_roles WHERE category_id = ?').all(cat.id);
    if (!roles.length) return;

    const color = parseInt((cat.color || '#5865F2').replace('#', ''), 16) || 0x5865F2;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(cat.name)
      .setDescription(cat.description || `Click a button below to toggle your ${cat.name.toLowerCase()} role!`);

    // Build button rows (max 5 buttons per row, max 5 rows = 25 buttons)
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    for (const r of roles) {
      const role = guild.roles.cache.get(r.role_id);
      if (!role) continue;

      if (buttonCount > 0 && buttonCount % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }

      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`role:${r.role_id}`)
          .setLabel(role.name)
          .setStyle(ButtonStyle.Secondary)
      );
      buttonCount++;
    }

    if (buttonCount % 5 !== 0 || buttonCount === 0) rows.push(currentRow);

    await channel.send({ embeds: [embed], components: rows.slice(0, 5) });
  } catch (e) {
    console.error('Error posting category:', e);
  }
}
