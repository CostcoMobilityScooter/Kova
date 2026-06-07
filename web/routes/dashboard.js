const { Router } = require('express');
const { db } = require('../../utils/database');

const router = Router();

/**
 * GET /api/dashboard
 * Returns aggregate bot statistics pulled from the Discord client cache
 * and the SQLite database.
 */
router.get('/', (req, res) => {
  const client = req.app.locals.client;

  if (!client || !client.isReady()) {
    return res.status(503).json({ error: 'Bot is not ready.' });
  }

  // ── Discord cache stats ──────────────────────────────────────────────────
  const guildCount   = client.guilds.cache.size;
  const memberCount  = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
  const commandCount = client.commands.size;

  // ── Uptime ───────────────────────────────────────────────────────────────
  const uptime  = Date.now() - client.startTime;
  const days    = Math.floor(uptime / 86_400_000);
  const hours   = Math.floor((uptime % 86_400_000) / 3_600_000);
  const minutes = Math.floor((uptime % 3_600_000) / 60_000);
  const seconds = Math.floor((uptime % 60_000) / 1_000);

  // ── Database stats ───────────────────────────────────────────────────────
  const totalWarnings   = safeCount('SELECT COUNT(*) AS n FROM warnings');
  const totalGiveaways  = safeCount('SELECT COUNT(*) AS n FROM giveaways');
  const totalLevels     = safeCount('SELECT COUNT(*) AS n FROM user_levels');
  const totalCurrency   = safeCount('SELECT COUNT(*) AS n FROM user_currency');
  const totalConfessions = safeCount('SELECT COUNT(*) AS n FROM confessions');
  const totalCommandsUsed = safeCount('SELECT COUNT(*) AS n FROM message_counts');

  // ── Per-guild summary (top 20 by member count) ───────────────────────────
  const guilds = client.guilds.cache
    .sort((a, b) => b.memberCount - a.memberCount)
    .first(20)
    .map(g => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL({ size: 64 }),
      memberCount: g.memberCount,
      setupComplete: !!db.prepare('SELECT setup_complete FROM guilds WHERE guild_id = ?').get(g.id)?.setup_complete,
    }));

  return res.json({
    bot: {
      tag: client.user.tag,
      id: client.user.id,
      avatar: client.user.displayAvatarURL({ size: 256 }),
      ping: client.ws.ping,
      uptime: { days, hours, minutes, seconds, ms: uptime },
      uptimeString: `${days}d ${hours}h ${minutes}m ${seconds}s`,
    },
    stats: {
      servers: guildCount,
      members: memberCount,
      commands: commandCount,
      warnings: totalWarnings,
      giveaways: totalGiveaways,
      levels: totalLevels,
      currencyUsers: totalCurrency,
      confessions: totalConfessions,
      messagesTracked: totalCommandsUsed,
    },
    guilds,
  });
});

/** Safely run a COUNT query — returns 0 if the table doesn't exist yet. */
function safeCount(sql) {
  try {
    return db.prepare(sql).get()?.n ?? 0;
  } catch {
    return 0;
  }
}

module.exports = router;
