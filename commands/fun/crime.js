const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { errorEmbed } = require('../../utils/embeds');

const CRIMES = [
  { act: 'pickpocketing', success: ['You slipped a wallet out of someone\'s pocket.', 'Clean hands, full pockets.'], fail: ['You got caught red-handed.', 'The victim noticed and called the cops.'] },
  { act: 'art forgery', success: ['Your fake Picasso sold at auction.', 'The gallery had no idea.'], fail: ['The art expert spotted your forgery immediately.', 'You spelled Picasso wrong on the back.'] },
  { act: 'hacking', success: ['You drained a corporate account.', 'You found an unsecured database — jackpot.'], fail: ['You accidentally hacked yourself.', 'The FBI traced your IP. Rookie mistake.'] },
  { act: 'shoplifting', success: ['Security was asleep.', 'You walked out like you owned the place.'], fail: ['The alarm went off.', 'There were three security cameras you didn\'t see.'] },
  { act: 'counterfeiting', success: ['Your fake bills passed inspection.', 'The cashier didn\'t even look twice.'], fail: ['The UV light exposed you instantly.', 'You printed them in the wrong shade of green.'] },
];

function ensureBalance(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO user_currency (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
  return db.prepare('SELECT * FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crime')
    .setDescription('Commit a crime for big rewards — or pay a fine if caught (45-min cooldown)'),

  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const now = Math.floor(Date.now() / 1000);
    const cooldown = 2700; // 45 minutes

    const data = ensureBalance(guildId, userId);
    const lastCrime = db.prepare('SELECT value FROM user_economy_meta WHERE guild_id = ? AND user_id = ? AND key = ?').get(guildId, userId, 'last_crime');
    const lastTime = lastCrime ? parseInt(lastCrime.value) : 0;

    if (now - lastTime < cooldown) {
      const next = lastTime + cooldown;
      return interaction.editReply({ embeds: [errorEmbed('Lying Low', `You need to lay low until <t:${next}:R>.`)] });
    }

    const econConfig = db.prepare('SELECT * FROM economy_config WHERE guild_id = ?').get(guildId);
    const successChance = econConfig?.crime_success_rate ?? 55; // 55% default
    const minReward = econConfig?.crime_min ?? 100;
    const maxReward = econConfig?.crime_max ?? 400;
    const fineRate = econConfig?.crime_fine_rate ?? 40; // % of balance taken on failure

    db.prepare('INSERT OR REPLACE INTO user_economy_meta (guild_id, user_id, key, value) VALUES (?, ?, ?, ?)').run(guildId, userId, 'last_crime', String(now));

    const crime = CRIMES[Math.floor(Math.random() * CRIMES.length)];
    const success = Math.random() * 100 < successChance;

    if (success) {
      const earned = Math.floor(Math.random() * (maxReward - minReward + 1)) + minReward;
      db.prepare('UPDATE user_currency SET balance = balance + ? WHERE guild_id = ? AND user_id = ?').run(earned, guildId, userId);

      const totalEarned = db.prepare('SELECT value FROM user_economy_meta WHERE guild_id = ? AND user_id = ? AND key = ?').get(guildId, userId, 'total_earned');
      const newTotal = (totalEarned ? parseInt(totalEarned.value) : 0) + earned;
      db.prepare('INSERT OR REPLACE INTO user_economy_meta (guild_id, user_id, key, value) VALUES (?, ?, ?, ?)').run(guildId, userId, 'total_earned', String(newTotal));

      const newBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId).balance;
      const msg = crime.success[Math.floor(Math.random() * crime.success.length)];

      return interaction.editReply({ embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🦹 Crime Successful')
          .setDescription(`**${crime.act.charAt(0).toUpperCase() + crime.act.slice(1)}** — ${msg}\n\nYou got away with **${earned} coins**!`)
          .addFields({ name: 'New Balance', value: `${newBal} coins`, inline: true })
          .setTimestamp()
      ] });
    } else {
      const fine = Math.max(50, Math.floor((data.balance * fineRate) / 100));
      const actualFine = Math.min(fine, data.balance);
      db.prepare('UPDATE user_currency SET balance = balance - ? WHERE guild_id = ? AND user_id = ?').run(actualFine, guildId, userId);

      const newBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId).balance;
      const msg = crime.fail[Math.floor(Math.random() * crime.fail.length)];

      return interaction.editReply({ embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🚔 Caught!')
          .setDescription(`**${crime.act.charAt(0).toUpperCase() + crime.act.slice(1)}** — ${msg}\n\nYou were fined **${actualFine} coins**.`)
          .addFields({ name: 'New Balance', value: `${newBal} coins`, inline: true })
          .setTimestamp()
      ] });
    }
  },
};
