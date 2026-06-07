const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('confess')
    .setDescription('Submit an anonymous confession')
    .addStringOption(o => o.setName('message').setDescription('Your confession').setRequired(true).setMaxLength(1000)),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guildId;
    const config = db.prepare('SELECT * FROM confessions_config WHERE guild_id = ?').get(guildId);

    if (!config?.enabled || !config.channel_id) return interaction.editReply({ embeds: [errorEmbed('Not Enabled', 'Confessions are not set up on this server.')] });

    const channel = interaction.guild.channels.cache.get(config.channel_id);
    if (!channel) return interaction.editReply({ embeds: [errorEmbed('Channel Error', 'The confession channel no longer exists.')] });

    const message = interaction.options.getString('message');

    // Save to DB first to get ID
    db.prepare('INSERT INTO confessions (guild_id, user_id, message) VALUES (?, ?, ?)').run(guildId, interaction.user.id, message);
    const confession = db.prepare('SELECT last_insert_rowid() as id').get();

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`🤫 Anonymous Confession #${confession.id}`)
      .setDescription(message)
      .setTimestamp();

    const msg = await channel.send({ embeds: [embed] });
    db.prepare('UPDATE confessions SET message_id = ? WHERE rowid = ?').run(msg.id, confession.id);

    // Log if set up
    if (config.logs_channel) {
      const logCh = interaction.guild.channels.cache.get(config.logs_channel);
      if (logCh) {
        const logEmbed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`📋 Confession #${confession.id} Log`)
          .addFields(
            { name: 'Author', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
            { name: 'Content', value: message }
          )
          .setTimestamp();
        await logCh.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }

    return interaction.editReply({ embeds: [successEmbed('Confession Sent', `Your confession has been posted anonymously as #${confession.id}.`)] });
  },
};
