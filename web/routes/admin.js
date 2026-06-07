const { Router } = require('express');
const { db } = require('../../utils/database');

const router = Router();

// ── Auth middleware ──────────────────────────────────────────────────────────
// Reads DASHBOARD_TOKEN from the environment. If the env var is not set the
// admin panel is disabled entirely so the bot still starts safely.
function requireAuth(req, res, next) {
  const token = process.env.DASHBOARD_TOKEN;
  if (!token) {
    return res.status(503).json({ error: 'Admin panel is disabled. Set DASHBOARD_TOKEN to enable it.' });
  }

  const provided = req.headers['x-dashboard-token'] || req.query.token;
  if (provided !== token) {
    return res.status(401).json({ error: 'Unauthorized. Provide a valid X-Dashboard-Token header.' });
  }

  next();
}

// Apply auth to every admin route.
router.use(requireAuth);

// ── GET /api/admin/guilds ────────────────────────────────────────────────────
// Returns a list of all guilds the bot knows about (from the DB).
router.get('/guilds', (req, res) => {
  const guilds = db.prepare('SELECT * FROM guilds').all();
  return res.json({ guilds });
});

// ── GET /api/admin/guild/:guildId ────────────────────────────────────────────
// Returns full settings for a single guild.
router.get('/guild/:guildId', (req, res) => {
  const { guildId } = req.params;

  const guild       = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId);
  if (!guild) return res.status(404).json({ error: 'Guild not found in database.' });

  const welcome     = db.prepare('SELECT * FROM welcome WHERE guild_id = ?').get(guildId) ?? null;
  const verify      = db.prepare('SELECT * FROM verification WHERE guild_id = ?').get(guildId) ?? null;
  const levels      = db.prepare('SELECT * FROM levels_config WHERE guild_id = ?').get(guildId) ?? null;
  const modConfig   = db.prepare('SELECT * FROM mod_config WHERE guild_id = ?').get(guildId) ?? null;
  const logsConfig  = db.prepare('SELECT * FROM logs_config WHERE guild_id = ?').get(guildId) ?? null;
  const giveaway    = db.prepare('SELECT * FROM giveaway_config WHERE guild_id = ?').get(guildId) ?? null;
  const confessions = db.prepare('SELECT * FROM confessions_config WHERE guild_id = ?').get(guildId) ?? null;
  const economy     = db.prepare('SELECT * FROM economy_config WHERE guild_id = ?').get(guildId) ?? null;
  const autoroles   = db.prepare('SELECT role_id FROM autoroles WHERE guild_id = ?').all(guildId);
  const levelRoles  = db.prepare('SELECT * FROM level_roles WHERE guild_id = ?').all(guildId);

  return res.json({
    guild,
    welcome,
    verify,
    levels,
    modConfig,
    logsConfig,
    giveaway,
    confessions,
    economy,
    autoroles: autoroles.map(r => r.role_id),
    levelRoles,
  });
});

// ── PATCH /api/admin/guild/:guildId/welcome ──────────────────────────────────
// Update welcome settings. Body: { enabled, channel_id, message, goodbye_channel_id, goodbye_message }
router.patch('/guild/:guildId/welcome', (req, res) => {
  const { guildId } = req.params;
  const { enabled, channel_id, message, goodbye_channel_id, goodbye_message } = req.body ?? {};

  db.prepare('INSERT OR IGNORE INTO welcome (guild_id) VALUES (?)').run(guildId);

  if (enabled !== undefined)            db.prepare('UPDATE welcome SET enabled = ? WHERE guild_id = ?').run(enabled ? 1 : 0, guildId);
  if (channel_id !== undefined)         db.prepare('UPDATE welcome SET channel_id = ? WHERE guild_id = ?').run(channel_id, guildId);
  if (message !== undefined)            db.prepare('UPDATE welcome SET message = ? WHERE guild_id = ?').run(message, guildId);
  if (goodbye_channel_id !== undefined) db.prepare('UPDATE welcome SET goodbye_channel_id = ? WHERE guild_id = ?').run(goodbye_channel_id, guildId);
  if (goodbye_message !== undefined)    db.prepare('UPDATE welcome SET goodbye_message = ? WHERE guild_id = ?').run(goodbye_message, guildId);

  return res.json({ ok: true, welcome: db.prepare('SELECT * FROM welcome WHERE guild_id = ?').get(guildId) });
});

// ── PATCH /api/admin/guild/:guildId/levels ───────────────────────────────────
// Update leveling settings. Body: { enabled, channel_id, message, xp_per_message }
router.patch('/guild/:guildId/levels', (req, res) => {
  const { guildId } = req.params;
  const { enabled, channel_id, message, xp_per_message } = req.body ?? {};

  db.prepare('INSERT OR IGNORE INTO levels_config (guild_id) VALUES (?)').run(guildId);

  if (enabled !== undefined)        db.prepare('UPDATE levels_config SET enabled = ? WHERE guild_id = ?').run(enabled ? 1 : 0, guildId);
  if (channel_id !== undefined)     db.prepare('UPDATE levels_config SET channel_id = ? WHERE guild_id = ?').run(channel_id, guildId);
  if (message !== undefined)        db.prepare('UPDATE levels_config SET message = ? WHERE guild_id = ?').run(message, guildId);
  if (xp_per_message !== undefined) db.prepare('UPDATE levels_config SET xp_per_message = ? WHERE guild_id = ?').run(Number(xp_per_message), guildId);

  return res.json({ ok: true, levels: db.prepare('SELECT * FROM levels_config WHERE guild_id = ?').get(guildId) });
});

// ── PATCH /api/admin/guild/:guildId/mod ──────────────────────────────────────
// Update moderation settings. Body: { filter_enabled, antispam_enabled, antiraid_enabled, max_warnings }
router.patch('/guild/:guildId/mod', (req, res) => {
  const { guildId } = req.params;
  const { filter_enabled, antispam_enabled, antiraid_enabled, max_warnings } = req.body ?? {};

  db.prepare('INSERT OR IGNORE INTO mod_config (guild_id) VALUES (?)').run(guildId);

  if (filter_enabled !== undefined)   db.prepare('UPDATE mod_config SET filter_enabled = ? WHERE guild_id = ?').run(filter_enabled ? 1 : 0, guildId);
  if (antispam_enabled !== undefined) db.prepare('UPDATE mod_config SET antispam_enabled = ? WHERE guild_id = ?').run(antispam_enabled ? 1 : 0, guildId);
  if (antiraid_enabled !== undefined) db.prepare('UPDATE mod_config SET antiraid_enabled = ? WHERE guild_id = ?').run(antiraid_enabled ? 1 : 0, guildId);
  if (max_warnings !== undefined)     db.prepare('UPDATE mod_config SET max_warnings = ? WHERE guild_id = ?').run(Number(max_warnings), guildId);

  return res.json({ ok: true, modConfig: db.prepare('SELECT * FROM mod_config WHERE guild_id = ?').get(guildId) });
});

// ── GET /api/admin/guild/:guildId/warnings ───────────────────────────────────
// Returns all warnings for a guild.
router.get('/guild/:guildId/warnings', (req, res) => {
  const { guildId } = req.params;
  const warnings = db.prepare('SELECT * FROM warnings WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
  return res.json({ warnings });
});

// ── DELETE /api/admin/guild/:guildId/warnings/:warningId ─────────────────────
// Delete a specific warning.
router.delete('/guild/:guildId/warnings/:warningId', (req, res) => {
  const { guildId, warningId } = req.params;
  const info = db.prepare('DELETE FROM warnings WHERE id = ? AND guild_id = ?').run(warningId, guildId);
  if (info.changes === 0) return res.status(404).json({ error: 'Warning not found.' });
  return res.json({ ok: true });
});

// ── GET /api/admin/guild/:guildId/economy ────────────────────────────────────
// Returns economy leaderboard (top 25 by balance).
router.get('/guild/:guildId/economy', (req, res) => {
  const { guildId } = req.params;
  const leaderboard = db.prepare(
    'SELECT user_id, balance FROM user_currency WHERE guild_id = ? ORDER BY balance DESC LIMIT 25'
  ).all(guildId);
  return res.json({ leaderboard });
});

// ── GET /api/admin/guild/:guildId/levels/leaderboard ─────────────────────────
// Returns XP leaderboard (top 25 by XP).
router.get('/guild/:guildId/levels/leaderboard', (req, res) => {
  const { guildId } = req.params;
  const leaderboard = db.prepare(
    'SELECT user_id, xp, level FROM user_levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 25'
  ).all(guildId);
  return res.json({ leaderboard });
});

module.exports = router;
