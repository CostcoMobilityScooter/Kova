const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../utils/database');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { requireAdmin } = require('../../utils/permissions');

function ensureBalance(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO user_currency (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
  return db.prepare('SELECT * FROM user_currency WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Server shop — buy items, check your inventory')
    .addSubcommand(s => s.setName('view').setDescription('Browse the shop'))
    .addSubcommand(s => s.setName('buy')
      .setDescription('Buy an item from the shop')
      .addIntegerOption(o => o.setName('item_id').setDescription('Item ID from /shop view').setRequired(true)))
    .addSubcommand(s => s.setName('inventory')
      .setDescription('View your inventory')
      .addUserOption(o => o.setName('user').setDescription('User to check (defaults to you)')))
    .addSubcommand(s => s.setName('use')
      .setDescription('Use an item from your inventory')
      .addIntegerOption(o => o.setName('item_id').setDescription('Item ID').setRequired(true)))
    // Admin subcommands
    .addSubcommand(s => s.setName('add-item')
      .setDescription('[Admin] Add an item to the shop')
      .addStringOption(o => o.setName('name').setDescription('Item name').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Price in coins').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('description').setDescription('Item description').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Item emoji').setRequired(false))
      .addRoleOption(o => o.setName('role').setDescription('Role to grant when used (optional)').setRequired(false))
      .addIntegerOption(o => o.setName('stock').setDescription('Stock limit (-1 for unlimited)').setRequired(false)))
    .addSubcommand(s => s.setName('remove-item')
      .setDescription('[Admin] Remove an item from the shop')
      .addIntegerOption(o => o.setName('item_id').setDescription('Item ID to remove').setRequired(true)))
    .addSubcommand(s => s.setName('edit-item')
      .setDescription('[Admin] Edit an item\'s price or stock')
      .addIntegerOption(o => o.setName('item_id').setDescription('Item ID').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('New price'))
      .addIntegerOption(o => o.setName('stock').setDescription('New stock (-1 for unlimited)'))),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: false });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // ── VIEW SHOP ─────────────────────────────────────────────────────────
    if (sub === 'view') {
      const items = db.prepare('SELECT * FROM shop_items WHERE guild_id = ? AND (stock = -1 OR stock > 0) ORDER BY price ASC').all(guildId);
      if (!items.length) return interaction.editReply({ embeds: [errorEmbed('Empty Shop', 'No items in the shop yet. An admin can add items with `/shop add-item`.')] });

      const data = ensureBalance(guildId, userId);
      const lines = items.map(item =>
        `**[${item.id}]** ${item.emoji || '🛒'} **${item.name}** — ${item.price} coins\n${item.description}${item.stock > 0 ? ` *(${item.stock} left)*` : ''}`
      );

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🛒 Server Shop')
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `Your balance: ${data.balance} coins • Use /shop buy <id> to purchase` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── BUY ───────────────────────────────────────────────────────────────
    if (sub === 'buy') {
      const itemId = interaction.options.getInteger('item_id');
      const item = db.prepare('SELECT * FROM shop_items WHERE id = ? AND guild_id = ?').get(itemId, guildId);
      if (!item) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No item with ID ${itemId} in this server's shop.`)] });
      if (item.stock === 0) return interaction.editReply({ embeds: [errorEmbed('Out of Stock', `**${item.name}** is sold out.`)] });

      const data = ensureBalance(guildId, userId);
      if (data.balance < item.price) return interaction.editReply({ embeds: [errorEmbed('Insufficient Funds', `**${item.name}** costs ${item.price} coins. You have ${data.balance}.`)] });

      db.prepare('UPDATE user_currency SET balance = balance - ? WHERE guild_id = ? AND user_id = ?').run(item.price, guildId, userId);
      db.prepare('INSERT INTO user_inventory (guild_id, user_id, item_id) VALUES (?, ?, ?)').run(guildId, userId, itemId);
      if (item.stock > 0) db.prepare('UPDATE shop_items SET stock = stock - 1 WHERE id = ?').run(itemId);

      return interaction.editReply({ embeds: [successEmbed('Purchase Complete', `You bought **${item.emoji || '🛒'} ${item.name}** for ${item.price} coins!\nUse \`/shop use ${itemId}\` to redeem it.`)] });
    }

    // ── INVENTORY ─────────────────────────────────────────────────────────
    if (sub === 'inventory') {
      const target = interaction.options.getUser('user') || interaction.user;
      const inv = db.prepare(`
        SELECT si.*, COUNT(*) as qty FROM user_inventory ui
        JOIN shop_items si ON si.id = ui.item_id
        WHERE ui.guild_id = ? AND ui.user_id = ? AND ui.used = 0
        GROUP BY ui.item_id
      `).all(guildId, target.id);

      if (!inv.length) return interaction.editReply({ embeds: [errorEmbed('Empty', `${target.username} has no items.`)] });

      const lines = inv.map(i => `${i.emoji || '🛒'} **${i.name}** x${i.qty} — \`/shop use ${i.id}\``);

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(`🎒 ${target.username}'s Inventory`)
        .setDescription(lines.join('\n'))
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── USE ITEM ──────────────────────────────────────────────────────────
    if (sub === 'use') {
      const itemId = interaction.options.getInteger('item_id');
      const invRow = db.prepare('SELECT * FROM user_inventory WHERE guild_id = ? AND user_id = ? AND item_id = ? AND used = 0 LIMIT 1').get(guildId, userId, itemId);
      if (!invRow) return interaction.editReply({ embeds: [errorEmbed('Not Owned', `You don't have item #${itemId} in your inventory.`)] });

      const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId);
      db.prepare('UPDATE user_inventory SET used = 1, used_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), invRow.id);

      // If item grants a role, apply it
      if (item.role_id) {
        const member = interaction.member;
        const role = interaction.guild.roles.cache.get(item.role_id);
        if (role) {
          await member.roles.add(role).catch(() => {});
          return interaction.editReply({ embeds: [successEmbed('Item Used', `You used **${item.emoji || '🛒'} ${item.name}** and received the ${role} role!`)] });
        }
      }

      return interaction.editReply({ embeds: [successEmbed('Item Used', `You used **${item.emoji || '🛒'} ${item.name}**!\n*${item.description}*`)] });
    }

    // ── ADMIN: ADD ITEM ───────────────────────────────────────────────────
    if (sub === 'add-item') {
      if (!(await requireAdmin(interaction))) return;
      const name = interaction.options.getString('name');
      const price = interaction.options.getInteger('price');
      const desc = interaction.options.getString('description');
      const emoji = interaction.options.getString('emoji') || null;
      const role = interaction.options.getRole('role');
      const stock = interaction.options.getInteger('stock') ?? -1;

      const result = db.prepare('INSERT INTO shop_items (guild_id, name, price, description, emoji, role_id, stock) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(guildId, name, price, desc, emoji, role?.id || null, stock);

      return interaction.editReply({ embeds: [successEmbed('Item Added', `**${emoji || '🛒'} ${name}** added to the shop (ID: ${result.lastInsertRowid}, Price: ${price} coins).`)] });
    }

    // ── ADMIN: REMOVE ITEM ────────────────────────────────────────────────
    if (sub === 'remove-item') {
      if (!(await requireAdmin(interaction))) return;
      const itemId = interaction.options.getInteger('item_id');
      const item = db.prepare('SELECT * FROM shop_items WHERE id = ? AND guild_id = ?').get(itemId, guildId);
      if (!item) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No item with ID ${itemId}.`)] });

      db.prepare('DELETE FROM shop_items WHERE id = ?').run(itemId);
      return interaction.editReply({ embeds: [successEmbed('Item Removed', `**${item.name}** has been removed from the shop.`)] });
    }

    // ── ADMIN: EDIT ITEM ──────────────────────────────────────────────────
    if (sub === 'edit-item') {
      if (!(await requireAdmin(interaction))) return;
      const itemId = interaction.options.getInteger('item_id');
      const item = db.prepare('SELECT * FROM shop_items WHERE id = ? AND guild_id = ?').get(itemId, guildId);
      if (!item) return interaction.editReply({ embeds: [errorEmbed('Not Found', `No item with ID ${itemId}.`)] });

      const newPrice = interaction.options.getInteger('price');
      const newStock = interaction.options.getInteger('stock');

      if (newPrice !== null) db.prepare('UPDATE shop_items SET price = ? WHERE id = ?').run(newPrice, itemId);
      if (newStock !== null) db.prepare('UPDATE shop_items SET stock = ? WHERE id = ?').run(newStock, itemId);

      const updated = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId);
      return interaction.editReply({ embeds: [successEmbed('Item Updated', `**${updated.name}** — Price: ${updated.price} coins, Stock: ${updated.stock === -1 ? 'Unlimited' : updated.stock}`)] });
    }
  },
};
