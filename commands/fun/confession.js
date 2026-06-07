const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');
const { requireMod } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('confession')
    .setDescription('Manage confessions')
    .addSubcommand(s => s.setName('delete').setDescription('Delete a confession').addIntegerOption(o => o.setName('id').setDescription('Confession ID').setRequired(true)))
    .addSubcommand(s => s.setName('reveal').setDescription('Reveal who sent a confession').addIntegerOption(o => o.setName('id').setDescription('Confession ID').setRequired(true))),

  async execute(interaction, client) {
    if (!(await requireMod(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const id = interaction.options.getInteger('id');
    const guildId = interaction.guildId;

    const confession = db.prepare('SELECT * FROM confessions WHERE id = ? AND guild_id = ?').get(id, guildId);
    if (!confession) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No confession #${id} found.`)] });

    if (sub === 'delete') {
      // Delete the message from the confession channel
      if (confession.message_id) {
        const config = db.prepare('SELECT * FROM confessions_config WHERE guild_id = ?').get(guildId);
        if (config?.channel_id) {
          const channel = interaction.guild.channels.cache.get(config.channel_id);
          if (channel) {
            const msg = await channel.messages.fetch(confession.message_id).catch(() => null);
            if (msg) await msg.delete().catch(() => {});
          }
        }
      }
      db.prepare('DELETE FROM confessions WHERE id = ?').run(id);
      return interaction.editReply({ embeds: [successEmbed('Confession Deleted', `Confession #${id} has been deleted.`)] });
    }

    if (sub === 'reveal') {
      const user = await client.users.fetch(confession.user_id).catch(() => null);
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`🔍 Confession #${id} — Reveal`)
        .addFields(
          { name: 'Author', value: user ? `${user.tag} (<@${user.id}>)` : `Unknown (${confession.user_id})` },
          { name: 'Content', value: confession.message },
          { name: 'Submitted', value: `<t:${confession.created_at}:f>` }
        )
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
