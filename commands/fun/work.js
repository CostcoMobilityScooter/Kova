const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { errorEmbed } = require('../../utils/embeds');

const JOBS = [
  { title: 'Programmer', msgs: ['You fixed a nasty bug and got paid.', 'You shipped a feature on time. Rare.', 'You survived a 3-hour meeting and invoiced for it.'] },
  { title: 'Chef', msgs: ['You made a perfect soufflé.', 'You survived the dinner rush.', 'Gordon Ramsay said your dish was acceptable.'] },
  { title: 'Delivery Driver', msgs: ['You delivered 47 packages without getting lost.', 'You found a shortcut and got a tip.', 'The dog didn\'t get you today.'] },
  { title: 'Streamer', msgs: ['Your viewers donated during your stream.', 'You hit a new sub record.', 'A clip of you went mildly viral.'] },
  { title: 'Artist', msgs: ['You sold a commission.', 'Someone bought a print.', 'Your NFT sold. (Weird, but okay.)'] },
  { title: 'Security Guard', msgs: ['You guarded the place all night.', 'You caught a shoplifter.', 'Nothing happened. You still got paid.'] },
  { title: 'Teacher', msgs: ['You somehow got the class to pay attention.', 'One student actually did their homework.', 'You graded 30 papers and kept your sanity.'] },
];

function ensureBalance(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO user_currency (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
  return db.prepare('SELECT * FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work to earn coins (1-hour cooldown)'),

  async execute(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const now = Math.floor(Date.now() / 1000);
    const cooldown = 3600; // 1 hour

    const data = ensureBalance(guildId, userId);
    const lastWork = db.prepare('SELECT value FROM user_economy_meta WHERE guild_id = ? AND user_id = ? AND key = ?').get(guildId, userId, 'last_work');
    const lastTime = lastWork ? parseInt(lastWork.value) : 0;

    if (now - lastTime < cooldown) {
      const next = lastTime + cooldown;
      return interaction.editReply({ embeds: [errorEmbed('Still Working', `You can work again <t:${next}:R>.`)] });
    }

    const econConfig = db.prepare('SELECT * FROM economy_config WHERE guild_id = ?').get(guildId);
    const minPay = econConfig?.work_min ?? 50;
    const maxPay = econConfig?.work_max ?? 150;
    const earned = Math.floor(Math.random() * (maxPay - minPay + 1)) + minPay;

    db.prepare('UPDATE user_currency SET balance = balance + ? WHERE guild_id = ? AND user_id = ?').run(earned, guildId, userId);
    db.prepare('INSERT OR REPLACE INTO user_economy_meta (guild_id, user_id, key, value) VALUES (?, ?, ?, ?)').run(guildId, userId, 'last_work', String(now));

    // Track total earned for stats
    const totalEarned = db.prepare('SELECT value FROM user_economy_meta WHERE guild_id = ? AND user_id = ? AND key = ?').get(guildId, userId, 'total_earned');
    const newTotal = (totalEarned ? parseInt(totalEarned.value) : 0) + earned;
    db.prepare('INSERT OR REPLACE INTO user_economy_meta (guild_id, user_id, key, value) VALUES (?, ?, ?, ?)').run(guildId, userId, 'total_earned', String(newTotal));

    const job = JOBS[Math.floor(Math.random() * JOBS.length)];
    const msg = job.msgs[Math.floor(Math.random() * job.msgs.length)];
    const newBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId).balance;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`💼 ${job.title}`)
      .setDescription(`${msg}\n\nYou earned **${earned} coins**!`)
      .addFields({ name: 'New Balance', value: `${newBal} coins`, inline: true })
      .setFooter({ text: 'Come back in 1 hour to work again' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
