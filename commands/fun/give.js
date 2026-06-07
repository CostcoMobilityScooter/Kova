const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('give')
    .setDescription('Give coins to another member')
    .addUserOption(o => o.setName('user').setDescription('User to give coins to').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount to give').setRequired(true).setMinValue(1)),

  async execute(interaction, client) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (target.id === userId) return interaction.editReply({ embeds: [errorEmbed('Invalid', 'You cannot give coins to yourself.')] });
    if (target.bot) return interaction.editReply({ embeds: [errorEmbed('Invalid', 'You cannot give coins to a bot.')] });

    db.prepare('INSERT OR IGNORE INTO user_currency (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
    db.prepare('INSERT OR IGNORE INTO user_currency (guild_id, user_id) VALUES (?, ?)').run(guildId, target.id);

    const sender = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
    if (sender.balance < amount) return interaction.editReply({ embeds: [errorEmbed('Insufficient Funds', `You only have **${sender.balance} coins**.`)] });

    db.prepare('UPDATE user_currency SET balance = balance - ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, userId);
    db.prepare('UPDATE user_currency SET balance = balance + ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, target.id);

    return interaction.editReply({ embeds: [successEmbed('Coins Sent', `You gave **${amount} coins** to ${target}.`)] });
  },
};
