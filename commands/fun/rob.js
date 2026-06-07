const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { errorEmbed } = require('../../utils/embeds');

function ensureBalance(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO user_currency (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
  return db.prepare('SELECT * FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob another member\'s coins')
    .addUserOption(o => o.setName('user').setDescription('Who to rob').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const target = interaction.options.getUser('user');
    const now = Math.floor(Date.now() / 1000);
    const cooldown = 3600; // 1 hour

    if (target.id === userId) return interaction.editReply({ embeds: [errorEmbed('Really?', 'You can\'t rob yourself.')] });
    if (target.bot) return interaction.editReply({ embeds: [errorEmbed('Invalid', 'You can\'t rob a bot.')] });

    // Check rob cooldown
    const lastRob = db.prepare('SELECT value FROM user_economy_meta WHERE guild_id = ? AND user_id = ? AND key = ?').get(guildId, userId, 'last_rob');
    const lastTime = lastRob ? parseInt(lastRob.value) : 0;
    if (now - lastTime < cooldown) {
      const next = lastTime + cooldown;
      return interaction.editReply({ embeds: [errorEmbed('Too Hot', `You need to wait until <t:${next}:R> before robbing again.`)] });
    }

    const robberData = ensureBalance(guildId, userId);
    const victimData = ensureBalance(guildId, target.id);

    // Victim needs at least 100 coins to be robbable
    const minVictimBal = 100;
    if (victimData.balance < minVictimBal) {
      return interaction.editReply({ embeds: [errorEmbed('Not Worth It', `${target.username} doesn\'t have enough coins to rob (minimum ${minVictimBal}).`)] });
    }

    const econConfig = db.prepare('SELECT * FROM economy_config WHERE guild_id = ?').get(guildId);
    const successChance = econConfig?.rob_success_rate ?? 45; // 45% default — harder than crime

    db.prepare('INSERT OR REPLACE INTO user_economy_meta (guild_id, user_id, key, value) VALUES (?, ?, ?, ?)').run(guildId, userId, 'last_rob', String(now));

    const success = Math.random() * 100 < successChance;

    if (success) {
      // Steal 10–40% of victim's balance
      const stealPct = Math.floor(Math.random() * 31) + 10;
      const stolen = Math.max(1, Math.floor((victimData.balance * stealPct) / 100));

      db.prepare('UPDATE user_currency SET balance = balance - ? WHERE guild_id = ? AND user_id = ?').run(stolen, guildId, target.id);
      db.prepare('UPDATE user_currency SET balance = balance + ? WHERE guild_id = ? AND user_id = ?').run(stolen, guildId, userId);

      const newBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId).balance;

      return interaction.editReply({ embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('🥷 Successful Robbery!')
          .setDescription(`You snuck into ${target}'s pockets and made off with **${stolen} coins** (${stealPct}% of their balance)!`)
          .addFields({ name: 'Your New Balance', value: `${newBal} coins`, inline: true })
          .setTimestamp()
      ] });
    } else {
      // Failed: pay a fine
      const fine = Math.max(50, Math.floor(robberData.balance * 0.20));
      const actualFine = Math.min(fine, robberData.balance);
      db.prepare('UPDATE user_currency SET balance = balance - ? WHERE guild_id = ? AND user_id = ?').run(actualFine, guildId, userId);

      const newBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId).balance;

      const failMsgs = [
        `${target.username} caught you and called the police.`,
        `${target.username} had a guard dog. You ran, but dropped your wallet.`,
        `${target.username} was already watching you. Big mistake.`,
        `You tripped on the way out. Classic.`,
      ];

      return interaction.editReply({ embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🚨 Robbery Failed!')
          .setDescription(`${failMsgs[Math.floor(Math.random() * failMsgs.length)]}\n\nYou were fined **${actualFine} coins**.`)
          .addFields({ name: 'Your New Balance', value: `${newBal} coins`, inline: true })
          .setTimestamp()
      ] });
    }
  },
};
