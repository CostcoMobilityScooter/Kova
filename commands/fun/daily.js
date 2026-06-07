const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

function ensureBalance(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO user_currency (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
  return db.prepare('SELECT * FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily server currency reward'),

  async execute(interaction, client) {
    await interaction.deferReply();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const data = ensureBalance(guildId, userId);
    const now = Math.floor(Date.now() / 1000);
    const cooldown = 86400; // 24 hours

    if (now - (data.last_daily || 0) < cooldown) {
      const next = (data.last_daily || 0) + cooldown;
      return interaction.editReply({ embeds: [errorEmbed('Already Claimed', `You can claim your next daily reward <t:${next}:R>.`)] });
    }

    const econConfig = db.prepare('SELECT * FROM economy_config WHERE guild_id = ?').get(guildId);
    const dailyMin = econConfig?.daily_min ?? 100;
    const dailyMax = econConfig?.daily_max ?? 300;
    const reward = Math.floor(Math.random() * (dailyMax - dailyMin + 1)) + dailyMin;
    db.prepare('UPDATE user_currency SET balance = balance + ?, last_daily = ? WHERE guild_id = ? AND user_id = ?').run(reward, now, guildId, userId);
    const newBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId).balance;

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('💰 Daily Reward Claimed!')
      .setDescription(`You received **${reward} coins**!\nYour new balance: **${newBal} coins**`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
