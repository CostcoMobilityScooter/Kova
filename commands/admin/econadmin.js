const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { requireAdmin } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('econadmin')
    .setDescription('Admin controls for the economy system')
    .addSubcommand(s => s.setName('give')
      .setDescription('Give coins to a user')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to give').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('take')
      .setDescription('Remove coins from a user')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to remove').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('set')
      .setDescription('Set a user\'s balance to a specific amount')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('New balance').setRequired(true).setMinValue(0)))
    .addSubcommand(s => s.setName('reset')
      .setDescription('Reset a user\'s balance to 0')
      .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true)))
    .addSubcommand(s => s.setName('reset-all')
      .setDescription('⚠️ Reset ALL economy data for this server'))
    .addSubcommand(s => s.setName('config')
      .setDescription('Configure economy rates')
      .addStringOption(o => o.setName('setting').setDescription('Setting to change').setRequired(true).addChoices(
        { name: 'work-min', value: 'work_min' },
        { name: 'work-max', value: 'work_max' },
        { name: 'crime-min', value: 'crime_min' },
        { name: 'crime-max', value: 'crime_max' },
        { name: 'crime-success-%', value: 'crime_success_rate' },
        { name: 'rob-success-%', value: 'rob_success_rate' },
        { name: 'daily-min', value: 'daily_min' },
        { name: 'daily-max', value: 'daily_max' },
      ))
      .addIntegerOption(o => o.setName('value').setDescription('New value').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('view-config')
      .setDescription('View current economy configuration')),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    function ensureUser(uid) {
      db.prepare('INSERT OR IGNORE INTO user_currency (guild_id, user_id) VALUES (?, ?)').run(guildId, uid);
    }
    function ensureConfig() {
      db.prepare('INSERT OR IGNORE INTO economy_config (guild_id) VALUES (?)').run(guildId);
      return db.prepare('SELECT * FROM economy_config WHERE guild_id = ?').get(guildId);
    }

    if (sub === 'give') {
      const user = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      ensureUser(user.id);
      db.prepare('UPDATE user_currency SET balance = balance + ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, user.id);
      const newBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, user.id).balance;
      return interaction.editReply({ embeds: [successEmbed('Coins Given', `Gave **${amount} coins** to ${user}. New balance: **${newBal}**`)] });
    }

    if (sub === 'take') {
      const user = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      ensureUser(user.id);
      const current = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, user.id);
      const taken = Math.min(amount, current.balance);
      db.prepare('UPDATE user_currency SET balance = MAX(0, balance - ?) WHERE guild_id = ? AND user_id = ?').run(amount, guildId, user.id);
      const newBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, user.id).balance;
      return interaction.editReply({ embeds: [successEmbed('Coins Removed', `Removed **${taken} coins** from ${user}. New balance: **${newBal}**`)] });
    }

    if (sub === 'set') {
      const user = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      ensureUser(user.id);
      db.prepare('UPDATE user_currency SET balance = ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, user.id);
      return interaction.editReply({ embeds: [successEmbed('Balance Set', `${user}'s balance set to **${amount} coins**.`)] });
    }

    if (sub === 'reset') {
      const user = interaction.options.getUser('user');
      db.prepare('UPDATE user_currency SET balance = 0, last_daily = 0 WHERE guild_id = ? AND user_id = ?').run(guildId, user.id);
      db.prepare('DELETE FROM user_economy_meta WHERE guild_id = ? AND user_id = ?').run(guildId, user.id);
      return interaction.editReply({ embeds: [successEmbed('User Reset', `${user}'s economy data has been reset.`)] });
    }

    if (sub === 'reset-all') {
      db.prepare('DELETE FROM user_currency WHERE guild_id = ?').run(guildId);
      db.prepare('DELETE FROM user_economy_meta WHERE guild_id = ?').run(guildId);
      db.prepare('DELETE FROM user_inventory WHERE guild_id = ?').run(guildId);
      return interaction.editReply({ embeds: [successEmbed('Economy Reset', 'All economy data for this server has been wiped.')] });
    }

    if (sub === 'config') {
      ensureConfig();
      const setting = interaction.options.getString('setting');
      const value = interaction.options.getInteger('value');
      db.prepare(`UPDATE economy_config SET ${setting} = ? WHERE guild_id = ?`).run(value, guildId);
      return interaction.editReply({ embeds: [successEmbed('Config Updated', `**${setting}** set to **${value}**.`)] });
    }

    if (sub === 'view-config') {
      const cfg = ensureConfig();
      return interaction.editReply({ embeds: [infoEmbed('Economy Config', [
        `**Daily reward:** ${cfg.daily_min ?? 100}–${cfg.daily_max ?? 300} coins`,
        `**Work reward:** ${cfg.work_min ?? 50}–${cfg.work_max ?? 150} coins`,
        `**Crime reward:** ${cfg.crime_min ?? 100}–${cfg.crime_max ?? 400} coins`,
        `**Crime success rate:** ${cfg.crime_success_rate ?? 55}%`,
        `**Rob success rate:** ${cfg.rob_success_rate ?? 45}%`,
      ].join('\n'))] });
    }
  },
};
