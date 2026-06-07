const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../utils/database');

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

function renderHand(cards) {
  return cards.join(' ');
}

function disabledRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj_done_hit').setLabel('Hit').setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId('bj_done_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('bj_done_double').setLabel('Double Down').setStyle(ButtonStyle.Danger).setDisabled(true),
  );
}

async function endGame(interaction, game, playerHand, dealerHand, reason) {
  const { guildId, userId, bet } = game;
  const playerTotal = handTotal(playerHand);
  let dealerTotal = handTotal(dealerHand);

  // Dealer draws to 17
  while (dealerTotal < 17) {
    dealerHand.push(game.deck.pop());
    dealerTotal = handTotal(dealerHand);
  }

  let result, payout = 0, color;

  if (reason === 'bust') {
    result = `You busted (${playerTotal}). Dealer wins.`;
    color = 0xe74c3c;
  } else if (dealerTotal > 21) {
    result = `Dealer busted (${dealerTotal}). You win! **+${bet} coins**`;
    payout = bet * 2;
    color = 0x2ecc71;
  } else if (playerTotal > dealerTotal) {
    result = `You win ${playerTotal} vs ${dealerTotal}! **+${bet} coins**`;
    payout = bet * 2;
    color = 0x2ecc71;
  } else if (playerTotal === dealerTotal) {
    result = `Push! ${playerTotal} vs ${dealerTotal}. Bet returned.`;
    payout = bet;
    color = 0xf39c12;
  } else {
    result = `Dealer wins ${dealerTotal} vs ${playerTotal}.`;
    color = 0xe74c3c;
  }

  if (payout > 0) {
    db.prepare('UPDATE user_currency SET balance = balance + ? WHERE guild_id = ? AND user_id = ?').run(payout, guildId, userId);
  }

  const newBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId).balance;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🃏 Blackjack — Game Over')
    .setDescription(`**Your hand:** ${renderHand(playerHand)} — **${playerTotal}**\n**Dealer:** ${renderHand(dealerHand)} — **${dealerTotal}**\n\n${result}`)
    .addFields({ name: 'Balance', value: `${newBal} coins`, inline: true })
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [disabledRow()] });
}

module.exports = async function blackjackHandler(interaction, client, parts) {
  // parts: [action, guildId:userId, interactionId]
  const action = parts[0];
  const key = parts[1]; // guildId:userId
  const [guildId, userId] = key.split(':');

  if (interaction.user.id !== userId) {
    return interaction.reply({ content: 'This isn\'t your game!', ephemeral: true });
  }

  const games = client.bjGames;
  if (!games || !games.has(key)) {
    return interaction.reply({ content: 'No active blackjack game found. It may have expired.', ephemeral: true });
  }

  const game = games.get(key);
  const { playerHand, dealerHand, deck, bet } = game;

  if (action === 'hit') {
    playerHand.push(deck.pop());
    const total = handTotal(playerHand);

    if (total > 21) {
      games.delete(key);
      return endGame(interaction, game, playerHand, dealerHand, 'bust');
    }

    if (total === 21) {
      games.delete(key);
      return endGame(interaction, game, playerHand, dealerHand, 'stand');
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🃏 Blackjack')
      .setDescription(`**Your hand:** ${renderHand(playerHand)} — **${total}**\n**Dealer:** ${dealerHand[0]} 🂠`)
      .addFields({ name: 'Bet', value: `${bet} coins`, inline: true })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`bj:hit:${key}:${Date.now()}`).setLabel('Hit').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`bj:stand:${key}:${Date.now()}`).setLabel('Stand').setStyle(ButtonStyle.Secondary),
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  if (action === 'stand') {
    games.delete(key);
    return endGame(interaction, game, playerHand, dealerHand, 'stand');
  }

  if (action === 'double') {
    // Double down: must have enough balance for the extra bet
    const currentBal = db.prepare('SELECT balance FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
    if (!currentBal || currentBal.balance < bet) {
      return interaction.reply({ content: `You need **${bet} more coins** to double down.`, ephemeral: true });
    }

    db.prepare('UPDATE user_currency SET balance = balance - ? WHERE guild_id = ? AND user_id = ?').run(bet, guildId, userId);
    game.bet = bet * 2;
    playerHand.push(deck.pop());
    const total = handTotal(playerHand);

    games.delete(key);
    return endGame(interaction, game, playerHand, dealerHand, total > 21 ? 'bust' : 'stand');
  }
};
