const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const trivia = [
  { q: 'What is the capital of France?', a: 'paris', choices: ['London', 'Berlin', 'Paris', 'Rome'] },
  { q: 'How many sides does a hexagon have?', a: '6', choices: ['5', '6', '7', '8'] },
  { q: 'What planet is closest to the Sun?', a: 'mercury', choices: ['Venus', 'Mercury', 'Mars', 'Earth'] },
  { q: 'What is 12 × 12?', a: '144', choices: ['124', '134', '144', '154'] },
  { q: 'Who wrote Romeo and Juliet?', a: 'shakespeare', choices: ['Dickens', 'Shakespeare', 'Hemingway', 'Tolkien'] },
  { q: 'What is the largest ocean?', a: 'pacific', choices: ['Atlantic', 'Indian', 'Arctic', 'Pacific'] },
  { q: 'How many continents are there?', a: '7', choices: ['5', '6', '7', '8'] },
  { q: 'What element has the symbol Au?', a: 'gold', choices: ['Silver', 'Gold', 'Copper', 'Iron'] },
  { q: 'What is the speed of light (approx)?', a: '300,000 km/s', choices: ['150,000 km/s', '200,000 km/s', '300,000 km/s', '400,000 km/s'] },
  { q: 'Which country invented pizza?', a: 'italy', choices: ['France', 'USA', 'Italy', 'Greece'] },
];

const hangmanWords = ['javascript', 'discord', 'programming', 'elephant', 'mystery', 'keyboard', 'universe', 'quantum', 'adventure', 'language'];
const hangmanStages = ['```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```', '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```', '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```', '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```', '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```', '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```', '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```'];

const activeHangman = new Map();
const activeTrivias = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game')
    .setDescription('Mini-games')
    .addSubcommand(s => s.setName('coinflip').setDescription('Flip a coin').addStringOption(o => o.setName('guess').setDescription('heads or tails').setRequired(true).addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })))
    .addSubcommand(s => s.setName('rps').setDescription('Rock Paper Scissors').addStringOption(o => o.setName('choice').setDescription('Your choice').setRequired(true).addChoices({ name: 'Rock', value: 'rock' }, { name: 'Paper', value: 'paper' }, { name: 'Scissors', value: 'scissors' })))
    .addSubcommand(s => s.setName('trivia').setDescription('Answer a trivia question'))
    .addSubcommand(s => s.setName('hangman').setDescription('Start a game of hangman'))
    .addSubcommand(s => s.setName('guess').setDescription('Guess a letter in hangman').addStringOption(o => o.setName('letter').setDescription('A single letter').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'coinflip') {
      const guess = interaction.options.getString('guess');
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = guess === result;
      const embed = new EmbedBuilder()
        .setTitle('🪙 Coin Flip')
        .setDescription(`The coin landed on **${result.toUpperCase()}**!\nYour guess: **${guess.toUpperCase()}**\n${won ? '✅ You got it right!' : '❌ Better luck next time!'}`)
        .setColor(won ? 0x2ecc71 : 0xe74c3c);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'rps') {
      const choices = ['rock', 'paper', 'scissors'];
      const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
      const user = interaction.options.getString('choice');
      const bot = choices[Math.floor(Math.random() * 3)];
      let result;
      if (user === bot) result = "It's a tie!";
      else if ((user === 'rock' && bot === 'scissors') || (user === 'paper' && bot === 'rock') || (user === 'scissors' && bot === 'paper')) result = '✅ You win!';
      else result = '❌ You lose!';
      const embed = new EmbedBuilder()
        .setTitle('✂️ Rock Paper Scissors')
        .setDescription(`You: ${emojis[user]} **${user}**\nBot: ${emojis[bot]} **${bot}**\n\n${result}`)
        .setColor(result.includes('win') ? 0x2ecc71 : result.includes('tie') ? 0xf1c40f : 0xe74c3c);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'trivia') {
      const key = `${interaction.guildId}-${interaction.channelId}`;
      if (activeTrivias.has(key)) return interaction.reply({ content: '❌ A trivia question is already active in this channel!', ephemeral: true });

      const q = trivia[Math.floor(Math.random() * trivia.length)];
      activeTrivias.set(key, q);

      const embed = new EmbedBuilder()
        .setTitle('🧠 Trivia Time!')
        .setDescription(`**${q.q}**\n\n${q.choices.map((c, i) => `${['🇦','🇧','🇨','🇩'][i]} ${c}`).join('\n')}`)
        .setColor(0x5865f2)
        .setFooter({ text: 'Type your answer in chat!' });

      await interaction.reply({ embeds: [embed] });

      const collector = interaction.channel.createMessageCollector({ time: 30000 });
      collector.on('collect', async msg => {
        if (msg.author.bot) return;
        if (msg.content.toLowerCase().includes(q.a.toLowerCase())) {
          activeTrivias.delete(key);
          collector.stop('answered');
          const win = new EmbedBuilder().setTitle('✅ Correct!').setDescription(`${msg.author} got it right!\nAnswer: **${q.choices.find(c => c.toLowerCase() === q.a || c.toLowerCase().includes(q.a))}**`).setColor(0x2ecc71);
          await interaction.channel.send({ embeds: [win] });
        }
      });
      collector.on('end', async (_, reason) => {
        if (reason !== 'answered') {
          activeTrivias.delete(key);
          const lose = new EmbedBuilder().setTitle('⏰ Time\'s Up!').setDescription(`Nobody got it!\nThe answer was: **${q.choices.find(c => c.toLowerCase() === q.a || c.toLowerCase().includes(q.a))}**`).setColor(0xe74c3c);
          await interaction.channel.send({ embeds: [lose] });
        }
      });
    }

    if (sub === 'hangman') {
      const key = `${interaction.guildId}-${interaction.channelId}`;
      if (activeHangman.has(key)) return interaction.reply({ content: '❌ A hangman game is already running here! Use `/game guess` to play.', ephemeral: true });

      const word = hangmanWords[Math.floor(Math.random() * hangmanWords.length)];
      activeHangman.set(key, { word, guessed: [], wrong: 0, userId: interaction.user.id });

      const display = word.split('').map(l => '_').join(' ');
      const embed = new EmbedBuilder()
        .setTitle('🎯 Hangman')
        .setDescription(`${hangmanStages[0]}\n\nWord: \`${display}\`\nGuesses: none yet\nWrong: 0/6`)
        .setColor(0x5865f2)
        .setFooter({ text: 'Use /game guess [letter] to guess!' });
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'guess') {
      const key = `${interaction.guildId}-${interaction.channelId}`;
      const game = activeHangman.get(key);
      if (!game) return interaction.reply({ content: '❌ No hangman game running! Use `/game hangman` to start one.', ephemeral: true });

      const letter = interaction.options.getString('letter').toLowerCase()[0];
      if (!letter || !/[a-z]/.test(letter)) return interaction.reply({ content: '❌ Please enter a valid letter.', ephemeral: true });
      if (game.guessed.includes(letter)) return interaction.reply({ content: `❌ You already guessed **${letter}**!`, ephemeral: true });

      game.guessed.push(letter);
      if (!game.word.includes(letter)) game.wrong++;

      const display = game.word.split('').map(l => game.guessed.includes(l) ? l : '_').join(' ');
      const won = !display.includes('_');
      const lost = game.wrong >= 6;

      if (won || lost) activeHangman.delete(key);

      const embed = new EmbedBuilder()
        .setTitle(won ? '🎉 You Won!' : lost ? '💀 Game Over!' : '🎯 Hangman')
        .setDescription(`${hangmanStages[Math.min(game.wrong, 6)]}\n\nWord: \`${won || lost ? game.word : display}\`\nGuessed: ${game.guessed.join(', ')}\nWrong: ${game.wrong}/6${lost ? `\n\nThe word was: **${game.word}**` : ''}`)
        .setColor(won ? 0x2ecc71 : lost ? 0xe74c3c : 0x5865f2);
      return interaction.reply({ embeds: [embed] });
    }
  }
};
