const { Router } = require('express');

const router = Router();

/**
 * GET /api/status
 * Returns whether the Discord bot is online and basic identity info.
 * The `client` object is attached to the router by web/server.js.
 */
router.get('/', (req, res) => {
  const client = req.app.locals.client;

  if (!client || !client.isReady()) {
    return res.status(503).json({
      online: false,
      message: 'Bot is not connected to Discord.',
    });
  }

  const uptime = Date.now() - client.startTime;
  const days    = Math.floor(uptime / 86_400_000);
  const hours   = Math.floor((uptime % 86_400_000) / 3_600_000);
  const minutes = Math.floor((uptime % 3_600_000) / 60_000);
  const seconds = Math.floor((uptime % 60_000) / 1_000);

  return res.json({
    online: true,
    tag: client.user.tag,
    id: client.user.id,
    avatar: client.user.displayAvatarURL({ size: 256 }),
    ping: client.ws.ping,
    uptime: { days, hours, minutes, seconds, ms: uptime },
    uptimeString: `${days}d ${hours}h ${minutes}m ${seconds}s`,
  });
});

module.exports = router;
