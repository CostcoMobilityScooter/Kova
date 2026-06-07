const express = require('express');
const path    = require('path');

const statusRouter    = require('./routes/status');
const dashboardRouter = require('./routes/dashboard');
const adminRouter     = require('./routes/admin');

/**
 * Creates and starts the Express web server.
 *
 * @param {import('discord.js').Client} client  The logged-in Discord client.
 * @returns {import('http').Server}             The running HTTP server instance.
 */
function startWebServer(client) {
  const app  = express();
  const PORT = process.env.PORT || 3000;

  // ── Middleware ─────────────────────────────────────────────────────────────
  app.use(express.json());

  // Make the Discord client available to all route handlers via app.locals.
  app.locals.client = client;

  // ── Static files ───────────────────────────────────────────────────────────
  app.use(express.static(path.join(__dirname, 'public')));

  // ── API routes ─────────────────────────────────────────────────────────────
  app.use('/api/status',    statusRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/admin',     adminRouter);

  // ── SPA fallback — serve index.html for any non-API route ─────────────────
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // ── Start listening ────────────────────────────────────────────────────────
  const server = app.listen(PORT, () => {
    console.log(`🌐 Dashboard running on http://localhost:${PORT}`);
  });

  return server;
}

module.exports = { startWebServer };
