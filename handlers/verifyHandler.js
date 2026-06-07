const { db } = require('../utils/database');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Start the verification DM flow when someone joins
async function startVerificationDM(member, config) {
  try {
    const guild = member.guild;
    const welcomeMsg = (config.welcome_dm || 'Welcome to **{server}**! Please complete verification to get access.')
      .replace('{user}', member.user.toString())
      .replace('{server}', guild.name);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`Welcome to ${guild.name}!`)
      .setDescription(welcomeMsg)
      .setThumbnail(guild.iconURL());

    if (config.rules) {
      embed.addFields({ name: '📋 Server Rules', value: config.rules });
    }

    embed.addFields({ name: '\u200b', value: 'Please read the rules above and click **I Agree** to continue.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`verifyflow:agree:${guild.id}:${member.id}`)
        .setLabel('I Agree & Continue')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`verifyflow:decline:${guild.id}:${member.id}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger)
    );

    await member.user.send({ embeds: [embed], components: [row] });
  } catch (e) {
    // DMs closed — fall back to channel verify
  }
}

// Handle all verify flow button interactions
async function handleVerifyFlow(interaction, client) {
  const parts = interaction.customId.split(':');
  const step = parts[1];
  const guildId = parts[2];
  const userId = parts[3];

  if (interaction.user.id !== userId) {
    return interaction.reply({ content: 'This verification is not for you.', ephemeral: true });
  }

  const config = db.prepare('SELECT * FROM verification WHERE guild_id = ?').get(guildId);
  const guild = client.guilds.cache.get(guildId);
  if (!config || !guild) return interaction.reply({ content: 'Server not found.', ephemeral: true });

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return interaction.reply({ content: 'Could not find you in the server.', ephemeral: true });

  // ── AGREE ─────────────────────────────────────────────────
  if (step === 'agree') {
    if (config.age_check_enabled) {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Age Verification')
        .setDescription('Are you 13 years of age or older?\n\nYou must be at least 13 to use Discord per their Terms of Service.');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`verifyflow:age_yes:${guildId}:${userId}`).setLabel('Yes, I am 13 or older').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`verifyflow:age_no:${guildId}:${userId}`).setLabel('No, I am under 13').setStyle(ButtonStyle.Danger)
      );

      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (config.captcha_enabled) {
      return sendCaptcha(interaction, guildId, userId);
    }

    return completeVerification(interaction, member, config, guild);
  }

  // ── DECLINE ───────────────────────────────────────────────
  if (step === 'decline') {
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('You have declined the rules. You can run `/verify` in the server to try again.')],
      components: []
    });
  }

  // ── AGE YES ───────────────────────────────────────────────
  if (step === 'age_yes') {
    if (config.captcha_enabled) {
      return sendCaptcha(interaction, guildId, userId);
    }
    return completeVerification(interaction, member, config, guild);
  }

  // ── AGE NO ────────────────────────────────────────────────
  if (step === 'age_no') {
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('Unable to Verify').setDescription('You must be 13 or older to access this server per Discord\'s Terms of Service.')],
      components: []
    });
  }

  // ── CAPTCHA ANSWER ────────────────────────────────────────
  if (step === 'captcha') {
    const answer = parseInt(parts[4]);
    const correct = parseInt(parts[5]);

    if (answer === correct) {
      return completeVerification(interaction, member, config, guild);
    } else {
      // Wrong answer — send new captcha
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription('❌ Wrong answer! Try this one:');

      return sendCaptcha(interaction, guildId, userId, embed);
    }
  }
}

// Send a math captcha
async function sendCaptcha(interaction, guildId, userId, extraEmbed = null) {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const correct = a + b;

  // Generate 4 wrong answers
  const options = new Set([correct]);
  while (options.size < 4) {
    options.add(Math.floor(Math.random() * 20) + 1);
  }
  const shuffled = [...options].sort(() => Math.random() - 0.5);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🔐 Captcha')
    .setDescription(`To verify you are human, solve this:\n\n## ${a} + ${b} = ?`);

  const row = new ActionRowBuilder().addComponents(
    shuffled.map(n =>
      new ButtonBuilder()
        .setCustomId(`verifyflow:captcha:${guildId}:${userId}:${n}:${correct}`)
        .setLabel(String(n))
        .setStyle(n === correct ? ButtonStyle.Secondary : ButtonStyle.Secondary)
    )
  );

  return interaction.update({ embeds: [embed], components: [row] });
}

// Complete verification — assign roles, log, DM success
async function completeVerification(interaction, member, config, guild) {
  const already = db.prepare('SELECT * FROM verified_members WHERE guild_id = ? AND user_id = ?').get(guild.id, member.id);
  if (already) {
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0xf39c12).setDescription('You are already verified!')],
      components: []
    });
  }

  if (config.verified_role) {
    const role = guild.roles.cache.get(config.verified_role);
    if (role) await member.roles.add(role).catch(() => {});
  }
  if (config.unverified_role) {
    const role = guild.roles.cache.get(config.unverified_role);
    if (role) await member.roles.remove(role).catch(() => {});
  }

  db.prepare('INSERT OR REPLACE INTO verified_members (guild_id, user_id, verified_at, verified_by) VALUES (?, ?, ?, ?)').run(guild.id, member.id, Math.floor(Date.now() / 1000), 'self');

  // Log
  if (config.logs_channel) {
    const logCh = guild.channels.cache.get(config.logs_channel);
    if (logCh) {
      const logEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Member Verified')
        .addFields(
          { name: 'User', value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: 'Method', value: 'DM Verification', inline: true }
        )
        .setTimestamp();
      await logCh.send({ embeds: [logEmbed] }).catch(() => {});
    }
  }

  return interaction.update({
    embeds: [new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Verified!')
      .setDescription(`You have been verified in **${guild.name}**! You now have access to the server.`)
    ],
    components: []
  });
}

// Handle the /verify slash command (channel button fallback)
async function handleVerifyCommand(interaction, client) {
  const guildId = interaction.guildId;
  const config = db.prepare('SELECT * FROM verification WHERE guild_id = ?').get(guildId);

  if (!config?.enabled) return interaction.reply({ embeds: [errorEmbed('Not Enabled', 'Verification is not set up on this server.')], ephemeral: true });

  const already = db.prepare('SELECT * FROM verified_members WHERE guild_id = ? AND user_id = ?').get(guildId, interaction.user.id);
  if (already) return interaction.reply({ embeds: [successEmbed('Already Verified', 'You are already verified!')], ephemeral: true });

  // Try to DM them the full flow
  try {
    await startVerificationDM(interaction.member, config);
    return interaction.reply({ embeds: [successEmbed('Check Your DMs', 'I\'ve sent you a DM to complete verification!')], ephemeral: true });
  } catch {
    // DMs closed, fall back to button in channel
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Verification')
      .setDescription('Click the button below to verify. Make sure your DMs are open for the full verification flow.');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify').setLabel('Verify Me').setStyle(ButtonStyle.Success).setEmoji('✅')
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
}

// Simple channel button verify (fallback)
async function handleChannelVerifyButton(interaction, client) {
  const guildId = interaction.guildId;
  const config = db.prepare('SELECT * FROM verification WHERE guild_id = ?').get(guildId);

  if (!config?.enabled) return interaction.reply({ embeds: [errorEmbed('Disabled', 'Verification is not enabled.')], ephemeral: true });

  const already = db.prepare('SELECT * FROM verified_members WHERE guild_id = ? AND user_id = ?').get(guildId, interaction.user.id);
  if (already) return interaction.reply({ embeds: [errorEmbed('Already Verified', 'You are already verified.')], ephemeral: true });

  const member = interaction.member;
  if (config.verified_role) {
    const role = interaction.guild.roles.cache.get(config.verified_role);
    if (role) await member.roles.add(role).catch(() => {});
  }
  if (config.unverified_role) {
    const role = interaction.guild.roles.cache.get(config.unverified_role);
    if (role) await member.roles.remove(role).catch(() => {});
  }

  db.prepare('INSERT OR REPLACE INTO verified_members (guild_id, user_id, verified_at, verified_by) VALUES (?, ?, ?, ?)').run(guildId, interaction.user.id, Math.floor(Date.now() / 1000), 'self');

  return interaction.reply({ embeds: [successEmbed('Verified!', 'You have been verified. Welcome!')], ephemeral: true });
}

module.exports = { startVerificationDM, handleVerifyFlow, handleVerifyCommand, handleChannelVerifyButton };
