/* ── Kova Dashboard — frontend JS ─────────────────────────────────────────── */

// ── Page navigation ──────────────────────────────────────────────────────────
const navLinks = document.querySelectorAll('.nav-link');
const pages    = document.querySelectorAll('.page');

navLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const target = link.dataset.page;

    navLinks.forEach(l => l.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));

    link.classList.add('active');
    document.getElementById(`page-${target}`)?.classList.add('active');

    if (target === 'status')    loadStatus();
    if (target === 'dashboard') loadDashboard();
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const token = sessionStorage.getItem('dashboardToken');
  const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
  if (token) headers['X-Dashboard-Token'] = token;

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function fmt(n) {
  return Number(n).toLocaleString();
}

// ── Status page ──────────────────────────────────────────────────────────────
async function loadStatus() {
  const indicator = document.getElementById('status-indicator');
  const title     = document.getElementById('status-title');
  const desc      = document.getElementById('status-desc');

  try {
    const data = await apiFetch('/api/status');

    // Sidebar badge
    const badge = document.getElementById('status-badge');
    badge.textContent = 'Online';
    badge.className   = 'badge badge-online';

    // Bot avatar
    if (data.avatar) {
      document.getElementById('bot-avatar').src = data.avatar;
    }

    // Ping display
    document.getElementById('ping-display').textContent = `Ping: ${data.ping}ms`;

    // Status card
    indicator.className = 'status-indicator online';
    title.textContent   = '🟢 Bot is Online';
    desc.textContent    = `Connected to Discord as ${data.tag}`;

    document.getElementById('s-tag').textContent    = data.tag;
    document.getElementById('s-id').textContent     = data.id;
    document.getElementById('s-ping').textContent   = `${data.ping} ms`;
    document.getElementById('s-uptime').textContent = data.uptimeString;
  } catch {
    const badge = document.getElementById('status-badge');
    badge.textContent = 'Offline';
    badge.className   = 'badge badge-offline';

    indicator.className = 'status-indicator offline';
    title.textContent   = '🔴 Bot is Offline';
    desc.textContent    = 'Could not reach the Discord gateway.';

    ['s-tag','s-id','s-ping','s-uptime'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
  }
}

// ── Dashboard page ───────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await apiFetch('/api/dashboard');

    // Sidebar / header
    if (data.bot.avatar) document.getElementById('bot-avatar').src = data.bot.avatar;
    document.getElementById('ping-display').textContent = `Ping: ${data.bot.ping}ms`;

    const badge = document.getElementById('status-badge');
    badge.textContent = 'Online';
    badge.className   = 'badge badge-online';

    // Stat cards
    document.getElementById('stat-servers').textContent     = fmt(data.stats.servers);
    document.getElementById('stat-members').textContent     = fmt(data.stats.members);
    document.getElementById('stat-commands').textContent    = fmt(data.stats.commands);
    document.getElementById('stat-uptime').textContent      = data.bot.uptimeString;
    document.getElementById('stat-warnings').textContent    = fmt(data.stats.warnings);
    document.getElementById('stat-giveaways').textContent   = fmt(data.stats.giveaways);
    document.getElementById('stat-levels').textContent      = fmt(data.stats.levels);
    document.getElementById('stat-confessions').textContent = fmt(data.stats.confessions);

    // Guild table
    const tbody = document.getElementById('guild-tbody');
    if (!data.guilds.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="loading">No servers found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.guilds.map(g => `
      <tr>
        <td>
          ${g.icon ? `<img class="guild-icon" src="${g.icon}" alt="" />` : ''}
          ${escHtml(g.name)}
        </td>
        <td>${fmt(g.memberCount)}</td>
        <td>${g.setupComplete ? '✅ Complete' : '⚙️ Pending'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// ── Admin panel ──────────────────────────────────────────────────────────────
let adminToken = sessionStorage.getItem('dashboardToken') ?? '';

document.getElementById('admin-login-btn').addEventListener('click', async () => {
  const input = document.getElementById('admin-token').value.trim();
  if (!input) return;

  sessionStorage.setItem('dashboardToken', input);
  adminToken = input;

  try {
    const data = await apiFetch('/api/admin/guilds');
    unlockAdmin(data.guilds);
  } catch (err) {
    showAdminError(err.message);
  }
});

function unlockAdmin(guilds) {
  document.getElementById('admin-auth-error').classList.add('hidden');
  document.getElementById('admin-content').classList.remove('hidden');

  const select = document.getElementById('guild-select');
  select.innerHTML = '<option value="">— choose a server —</option>';
  guilds.forEach(g => {
    const opt = document.createElement('option');
    opt.value       = g.guild_id;
    opt.textContent = g.guild_id;
    select.appendChild(opt);
  });
}

function showAdminError(msg) {
  const el = document.getElementById('admin-auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// Load guild settings when a guild is selected
document.getElementById('guild-select').addEventListener('change', async function () {
  const guildId = this.value;
  const wrap    = document.getElementById('guild-settings');

  if (!guildId) { wrap.classList.add('hidden'); return; }

  try {
    const data = await apiFetch(`/api/admin/guild/${guildId}`);
    populateGuildSettings(data);
    wrap.classList.remove('hidden');
  } catch (err) {
    showAdminError(err.message);
  }
});

function populateGuildSettings(data) {
  // Welcome
  const w = data.welcome ?? {};
  document.getElementById('w-enabled').checked        = !!w.enabled;
  document.getElementById('w-channel').value          = w.channel_id ?? '';
  document.getElementById('w-message').value          = w.message ?? '';
  document.getElementById('w-goodbye-channel').value  = w.goodbye_channel_id ?? '';
  document.getElementById('w-goodbye-message').value  = w.goodbye_message ?? '';

  // Levels
  const l = data.levels ?? {};
  document.getElementById('l-enabled').checked = !!l.enabled;
  document.getElementById('l-channel').value   = l.channel_id ?? '';
  document.getElementById('l-message').value   = l.message ?? '';
  document.getElementById('l-xp').value        = l.xp_per_message ?? 15;

  // Mod
  const m = data.modConfig ?? {};
  document.getElementById('m-filter').checked   = !!m.filter_enabled;
  document.getElementById('m-antispam').checked = !!m.antispam_enabled;
  document.getElementById('m-antiraid').checked = !!m.antiraid_enabled;
  document.getElementById('m-warnings').value   = m.max_warnings ?? 3;
}

// Save welcome
document.getElementById('save-welcome').addEventListener('click', async () => {
  const guildId = document.getElementById('guild-select').value;
  if (!guildId) return;

  const body = {
    enabled:            document.getElementById('w-enabled').checked,
    channel_id:         document.getElementById('w-channel').value.trim() || null,
    message:            document.getElementById('w-message').value.trim() || null,
    goodbye_channel_id: document.getElementById('w-goodbye-channel').value.trim() || null,
    goodbye_message:    document.getElementById('w-goodbye-message').value.trim() || null,
  };

  await saveSection(`/api/admin/guild/${guildId}/welcome`, body, 'save-welcome-status');
});

// Save levels
document.getElementById('save-levels').addEventListener('click', async () => {
  const guildId = document.getElementById('guild-select').value;
  if (!guildId) return;

  const body = {
    enabled:       document.getElementById('l-enabled').checked,
    channel_id:    document.getElementById('l-channel').value.trim() || null,
    message:       document.getElementById('l-message').value.trim() || null,
    xp_per_message: Number(document.getElementById('l-xp').value) || 15,
  };

  await saveSection(`/api/admin/guild/${guildId}/levels`, body, 'save-levels-status');
});

// Save mod
document.getElementById('save-mod').addEventListener('click', async () => {
  const guildId = document.getElementById('guild-select').value;
  if (!guildId) return;

  const body = {
    filter_enabled:   document.getElementById('m-filter').checked,
    antispam_enabled: document.getElementById('m-antispam').checked,
    antiraid_enabled: document.getElementById('m-antiraid').checked,
    max_warnings:     Number(document.getElementById('m-warnings').value) || 3,
  };

  await saveSection(`/api/admin/guild/${guildId}/mod`, body, 'save-mod-status');
});

async function saveSection(url, body, statusId) {
  const statusEl = document.getElementById(statusId);
  statusEl.textContent = '';
  try {
    await apiFetch(url, { method: 'PATCH', body: JSON.stringify(body) });
    statusEl.textContent = '✅ Saved';
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  } catch (err) {
    statusEl.style.color = 'var(--danger)';
    statusEl.textContent = `❌ ${err.message}`;
  }
}

// Load warnings
document.getElementById('load-warnings-btn').addEventListener('click', async () => {
  const guildId = document.getElementById('guild-select').value;
  if (!guildId) return;

  try {
    const data  = await apiFetch(`/api/admin/guild/${guildId}/warnings`);
    const tbody = document.getElementById('warnings-tbody');

    if (!data.warnings.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading">No warnings found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.warnings.map(w => `
      <tr>
        <td>${w.id}</td>
        <td><code>${w.user_id}</code></td>
        <td><code>${w.moderator_id}</code></td>
        <td>${escHtml(w.reason ?? '—')}</td>
        <td>${new Date(w.created_at * 1000).toLocaleDateString()}</td>
        <td>
          <button class="btn btn-danger" style="padding:.3rem .7rem;font-size:.8rem;"
            onclick="deleteWarning('${guildId}', ${w.id}, this)">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showAdminError(err.message);
  }
});

async function deleteWarning(guildId, warningId, btn) {
  btn.disabled = true;
  try {
    await apiFetch(`/api/admin/guild/${guildId}/warnings/${warningId}`, { method: 'DELETE' });
    btn.closest('tr').remove();
  } catch (err) {
    btn.disabled = false;
    alert(err.message);
  }
}

// ── XSS helper ───────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Auto-refresh status badge every 30 s ─────────────────────────────────────
setInterval(loadStatus, 30_000);

// ── Initial load ─────────────────────────────────────────────────────────────
loadDashboard();
loadStatus();

// If a token was saved from a previous session, try to unlock admin silently
if (adminToken) {
  apiFetch('/api/admin/guilds')
    .then(data => unlockAdmin(data.guilds))
    .catch(() => sessionStorage.removeItem('dashboardToken'));
}
