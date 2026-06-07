const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../../utils/database');
const { errorEmbed } = require('../../utils/embeds');

function ensureBalance(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO user_currency (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
  return db.prepare('SELECT * FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function checkBet(data, amount) {
  if (amount < 1) return 'Minimum bet is 1 coin.';
  if (amount > data.balance) return `You only have **${data.balance} coins**.`;
  return null;
}

// ── SLOTS ────────────────────────────────────────────────────────────────────
const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
const SLOT_MULTIPLIERS = { '💎': 10, '7️⃣': 7, '⭐': 5, '🍇': 3, '🍊': 2.5, '🍋': 2, '🍒': 1.5 };

function spinSlots() {
  // Weighted: common symbols appear more often
  const weights = [30, 25, 20, 15, 5, 3, 2]; // sum = 100
  function pick() {
    let r = Math.random() * 100;
    for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
      r -= weights[i];
      if (r <= 0) return SLOT_SYMBOLS[i];
    }
    return SLOT_SYMBOLS[0];
  }
  return [pick(), pick(), pick()];
}

function evalSlots(reels, bet) {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    const mult = SLOT_MULTIPLIERS[a] || 1.5;
    return { win: true, payout: Math.floor(bet * mult), label: `Three ${a}!` };
  }
  if (a === b || b === c || a === c) {
    return { win: true, payout: Math.floor(bet * 0.5), label: 'Two of a kind!' };
  }
  return { win: false, payout: 0, label: 'No match.' };
}

// ── BLACKJACK ─────────────────────────────────────────────────────────────────
const BJ_SUITS = ['♠', '♥', '♦', '♣'];
const BJ_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function makeDecks(n = 2) {
  const deck = [];
  for (let d = 0; d < n; d++)
    for (const s of BJ_SUITS)
      for (const v of BJ_VALUES)
        deck.push(`${v}${s}`);
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(card) {
  const v = card.slice(0, -1);
  if (['J', 'Q', 'K'].includes(v)) return 10;
  if (v === 'A') return 11;
  return parseInt(v);
}

function handTotal(cards) {
  let total = cards.reduce((s, c) => s + cardValue(c), 0);
  let aces = cards.filter(c => c.startsWith('A')).length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function renderHand(cards, hideSecond = false) {
  if (hideSecond) return `${cards[0]} 🂠`;
  return cards.join(' ');
}

// Active BJ games stored in-memory (keyed by guildId:userId)
const bjGames = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('Gambling games')
    .addSubcommand(s => s
      .setName('slots')
      .setDescription('Spin the slot machine')
      .addIntegerOption(o => o.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s
      .setName('coinflip')
      .setDescription('Flip a coin — heads or tails')
      .addStringOption(o => o.setName('side').setDescription('heads or tails').setRequired(true).addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' }))
      .addIntegerOption(o => o.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s
      .setName('blackjack')
      .setDescription('Play a hand of blackjack')
      .addIntegerOption(o => o.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1))),

  async execute(interaction, client) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const data = ensureBalance(guildId, userId);
    const bet = interaction.options.getInteger('bet');

    const betErr = checkBet(data, bet);
    if (betErr) return interaction.editReply({ embeds: [errorEmbed('Invalid Bet', betErr)] });

    // ── SLOTS ──────────────────────────────────────────────────────────────
    if (sub === 'slots') {
      const reels = spinSlots();
      const result = evalSlots(reels, bet);

      if (result.win) {
        db.prepare('UPDATE user_currency SET balance = balance + ? WHERE guild_id = ? AND user_id = ?').run(result.payout, guildId, userId);
      } else {
        db.prepare('UPDATE user_currency SET balance = balance - ? WHERE guild_id = ? AND user_id = ?').run(bet, guildId, userId);
      }
      const newBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId).balance;

      const embed = new EmbedBuilder()
        .setColor(result.win ? 0xf1c40f : 0xe74c3c)
        .setTitle('🎰 Slot Machine')
        .setDescription(`╔══════════════╗\n║  ${reels.join('  ')}  ║\n╚══════════════╝\n\n${result.label}`)
        .addFields(
          { name: result.win ? '💰 Won' : '💸 Lost', value: result.win ? `+${result.payout} coins` : `-${bet} coins`, inline: true },
          { name: 'Balance', value: `${newBal} coins`, inline: true }
        )
        .setFooter({ text: '💎=10x  7️⃣=7x  ⭐=5x  🍇=3x  🍊=2.5x  🍋=2x  🍒=1.5x' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── COINFLIP ───────────────────────────────────────────────────────────
    if (sub === 'coinflip') {
      const choice = interaction.options.getString('side');
      const flip = Math.random() < 0.5 ? 'heads' : 'tails';
      const win = flip === choice;

      if (win) {
        db.prepare('UPDATE user_currency SET balance = balance + ? WHERE guild_id = ? AND user_id = ?').run(bet, guildId, userId);
      } else {
        db.prepare('UPDATE user_currency SET balance = balance - ? WHERE guild_id = ? AND user_id = ?').run(bet, guildId, userId);
      }
      const newBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId).balance;

      const embed = new EmbedBuilder()
        .setColor(win ? 0x2ecc71 : 0xe74c3c)
        .setTitle(`🪙 Coin Flip — ${flip === 'heads' ? '🟡 Heads' : '⚪ Tails'}`)
        .setDescription(win
          ? `You called **${choice}** and won! **+${bet} coins**`
          : `You called **${choice}** but it landed on **${flip}**. **-${bet} coins**`)
        .addFields({ name: 'Balance', value: `${newBal} coins`, inline: true })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── BLACKJACK ──────────────────────────────────────────────────────────
    if (sub === 'blackjack') {
      const key = `${guildId}:${userId}`;
      if (bjGames.has(key)) return interaction.editReply({ embeds: [errorEmbed('In Progress', 'You already have a blackjack game running. Finish it first!')] });

      db.prepare('UPDATE user_currency SET balance = balance - ? WHERE guild_id = ? AND user_id = ?').run(bet, guildId, userId);

      const deck = makeDecks(2);
      const playerHand = [deck.pop(), deck.pop()];
      const dealerHand = [deck.pop(), deck.pop()];

      const game = { deck, playerHand, dealerHand, bet, guildId, userId };
      bjGames.set(key, game);

      // Auto-cleanup after 5 min (in case player ignores)
      setTimeout(() => bjGames.delete(key), 300000);

      const playerTotal = handTotal(playerHand);
      const dealerShown = cardValue(dealerHand[0]);

      // Natural blackjack check
      if (playerTotal === 21) {
        bjGames.delete(key);
        const payout = Math.floor(bet * 1.5);
        db.prepare('UPDATE user_currency SET balance = balance + ? WHERE guild_id = ? AND user_id = ?').run(bet + payout, guildId, userId);
        const newBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId).balance;
        return interaction.editReply({ embeds: [
          new EmbedBuilder().setColor(0xf1c40f).setTitle('🃏 Blackjack — Natural 21! 🎉')
            .setDescription(`Your hand: ${renderHand(playerHand)} (21)\nDealer: ${renderHand(dealerHand)}\n\n**Blackjack! You win ${payout} coins (1.5x)!**`)
            .addFields({ name: 'Balance', value: `${newBal} coins`, inline: true }).setTimestamp()
        ] });
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🃏 Blackjack')
        .setDescription(`**Your hand:** ${renderHand(playerHand)} — **${playerTotal}**\n**Dealer:** ${renderHand(dealerHand, true)} — ${dealerShown}+?`)
        .addFields({ name: 'Bet', value: `${bet} coins`, inline: true })
        .setFooter({ text: 'Hit to draw a card. Stand to let the dealer play.' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bj:hit:${key}:${interaction.id}`).setLabel('Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bj:stand:${key}:${interaction.id}`).setLabel('Stand').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`bj:double:${key}:${interaction.id}`).setLabel('Double Down').setStyle(ButtonStyle.Danger)
      );

      // Store interaction ID to handle buttons
      game.interactionId = interaction.id;
      bjGames.set(key, game);
      client.bjGames = bjGames;

      return interaction.editReply({ embeds: [embed], components: [row] });
    }
  },
};
