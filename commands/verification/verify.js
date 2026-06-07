const { SlashCommandBuilder } = require('discord.js');
const { handleVerifyCommand } = require('../../handlers/verifyHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Start the verification process'),

  async execute(interaction, client) {
    await handleVerifyCommand(interaction, client);
  },
};
