const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../data/bot.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- Guild settings
  CREATE TABLE IF NOT EXISTS guilds (
    guild_id TEXT PRIMARY KEY,
    prefix TEXT DEFAULT '!',
    admin_role TEXT,
    mod_role TEXT,
    language TEXT DEFAULT 'en',
    setup_complete INTEGER DEFAULT 0
  );

  -- Welcome/goodbye
  CREATE TABLE IF NOT EXISTS welcome (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    channel_id TEXT,
    message TEXT DEFAULT 'Welcome {user} to {server}!',
    goodbye_channel_id TEXT,
    goodbye_message TEXT DEFAULT 'Goodbye {user}, we will miss you!'
  );

  -- Verification
  CREATE TABLE IF NOT EXISTS verification (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    channel_id TEXT,
    verified_role TEXT,
    unverified_role TEXT,
    logs_channel TEXT,
    rules TEXT,
    welcome_dm TEXT,
    captcha_enabled INTEGER DEFAULT 0,
    age_check_enabled INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS verified_members (
    guild_id TEXT,
    user_id TEXT,
    verified_at INTEGER,
    verified_by TEXT,
    PRIMARY KEY (guild_id, user_id)
  );

  -- Self-assign roles
  CREATE TABLE IF NOT EXISTS role_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    name TEXT,
    description TEXT,
    channel_id TEXT,
    color TEXT,
    mode TEXT DEFAULT 'toggle'
  );

  CREATE TABLE IF NOT EXISTS self_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    role_id TEXT,
    category_id INTEGER,
    FOREIGN KEY (category_id) REFERENCES role_categories(id)
  );

  CREATE TABLE IF NOT EXISTS roles_config (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    channel_id TEXT,
    message_id TEXT
  );

  -- Moderation
  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    user_id TEXT,
    moderator_id TEXT,
    reason TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS mod_config (
    guild_id TEXT PRIMARY KEY,
    filter_enabled INTEGER DEFAULT 0,
    antispam_enabled INTEGER DEFAULT 0,
    antiraid_enabled INTEGER DEFAULT 0,
    max_warnings INTEGER DEFAULT 3,
    logs_channel TEXT
  );

  CREATE TABLE IF NOT EXISTS filtered_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    word TEXT
  );

  -- Logging
  CREATE TABLE IF NOT EXISTS logs_config (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT,
    log_deleted INTEGER DEFAULT 1,
    log_edited INTEGER DEFAULT 1,
    log_joins INTEGER DEFAULT 1,
    log_roles INTEGER DEFAULT 1,
    log_mod INTEGER DEFAULT 1
  );

  -- Levels & XP
  CREATE TABLE IF NOT EXISTS levels_config (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    channel_id TEXT,
    message TEXT DEFAULT 'GG {user}, you just leveled up to level {level}!',
    xp_per_message INTEGER DEFAULT 15
  );

  CREATE TABLE IF NOT EXISTS user_levels (
    guild_id TEXT,
    user_id TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    last_message INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS level_roles (
    guild_id TEXT,
    role_id TEXT,
    level_required INTEGER,
    PRIMARY KEY (guild_id, role_id)
  );

  -- Currency
  CREATE TABLE IF NOT EXISTS user_currency (
    guild_id TEXT,
    user_id TEXT,
    balance INTEGER DEFAULT 0,
    last_daily INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  -- Giveaways
  CREATE TABLE IF NOT EXISTS giveaway_config (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    channel_id TEXT,
    required_role TEXT
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    channel_id TEXT,
    message_id TEXT,
    prize TEXT,
    ends_at INTEGER,
    ended INTEGER DEFAULT 0,
    winner_id TEXT,
    host_id TEXT
  );

  -- Confessions
  CREATE TABLE IF NOT EXISTS confessions_config (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    channel_id TEXT,
    logs_channel TEXT
  );

  CREATE TABLE IF NOT EXISTS confessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    user_id TEXT,
    message TEXT,
    message_id TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- Auto roles on join
  CREATE TABLE IF NOT EXISTS autoroles (
    guild_id TEXT,
    role_id TEXT,
    PRIMARY KEY (guild_id, role_id)
  );

  -- Sticky messages
  CREATE TABLE IF NOT EXISTS sticky_messages (
    guild_id TEXT,
    channel_id TEXT,
    content TEXT,
    last_message_id TEXT,
    PRIMARY KEY (guild_id, channel_id)
  );

  -- Reaction roles
  CREATE TABLE IF NOT EXISTS reaction_roles (
    guild_id TEXT,
    channel_id TEXT,
    message_id TEXT,
    emoji TEXT,
    role_id TEXT,
    PRIMARY KEY (guild_id, message_id, emoji)
  );

  -- Starboard config
  CREATE TABLE IF NOT EXISTS starboard_config (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT,
    threshold INTEGER DEFAULT 3,
    enabled INTEGER DEFAULT 1
  );

  -- Starboard entries (tracks which messages have been posted)
  CREATE TABLE IF NOT EXISTS starboard_entries (
    guild_id TEXT,
    original_message_id TEXT,
    starboard_message_id TEXT,
    PRIMARY KEY (guild_id, original_message_id)
  );

  -- Server stat channels
  CREATE TABLE IF NOT EXISTS serverstats (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 1,
    category_id TEXT,
    total_ch TEXT,
    humans_ch TEXT,
    bots_ch TEXT,
    online_ch TEXT
  );

  -- Economy config (per-guild rates)
  CREATE TABLE IF NOT EXISTS economy_config (
    guild_id TEXT PRIMARY KEY,
    daily_min INTEGER DEFAULT 100,
    daily_max INTEGER DEFAULT 300,
    work_min INTEGER DEFAULT 50,
    work_max INTEGER DEFAULT 150,
    crime_min INTEGER DEFAULT 100,
    crime_max INTEGER DEFAULT 400,
    crime_success_rate INTEGER DEFAULT 55,
    crime_fine_rate INTEGER DEFAULT 40,
    rob_success_rate INTEGER DEFAULT 45
  );

  -- Economy meta (cooldowns, lifetime stats per user)
  CREATE TABLE IF NOT EXISTS user_economy_meta (
    guild_id TEXT,
    user_id TEXT,
    key TEXT,
    value TEXT,
    PRIMARY KEY (guild_id, user_id, key)
  );

  -- Shop items
  CREATE TABLE IF NOT EXISTS shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    name TEXT,
    price INTEGER,
    description TEXT,
    emoji TEXT,
    role_id TEXT,
    stock INTEGER DEFAULT -1
  );

  -- User inventory
  CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    user_id TEXT,
    item_id INTEGER,
    used INTEGER DEFAULT 0,
    used_at INTEGER,
    purchased_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (item_id) REFERENCES shop_items(id)
  );
  -- User message counts
  CREATE TABLE IF NOT EXISTS message_counts (
    guild_id TEXT,
    user_id TEXT,
    count INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  -- AFK system
  CREATE TABLE IF NOT EXISTS afk (
    guild_id TEXT,
    user_id TEXT,
    reason TEXT DEFAULT 'AFK',
    set_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, user_id)
  );

  -- Tickets
  CREATE TABLE IF NOT EXISTS ticket_config (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT,
    category_id TEXT,
    support_role_id TEXT,
    panel_message TEXT DEFAULT 'Click below to open a support ticket.'
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    channel_id TEXT,
    user_id TEXT,
    ticket_number INTEGER,
    closed INTEGER DEFAULT 0,
    closed_at INTEGER
  );

  -- Birthdays
  CREATE TABLE IF NOT EXISTS birthdays (
    guild_id TEXT,
    user_id TEXT,
    month INTEGER,
    day INTEGER,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS birthday_config (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT,
    role_id TEXT
  );

  -- Invite tracking
  CREATE TABLE IF NOT EXISTS invite_tracking (
    guild_id TEXT,
    user_id TEXT,
    total INTEGER DEFAULT 0,
    left INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS invite_joins (
    guild_id TEXT,
    user_id TEXT,
    inviter_id TEXT,
    invite_code TEXT,
    PRIMARY KEY (guild_id, user_id)
  );

  -- Temp VCs
  CREATE TABLE IF NOT EXISTS tempvc_config (
    guild_id TEXT PRIMARY KEY,
    trigger_channel_id TEXT,
    name_template TEXT DEFAULT '{user}''s Channel'
  );

  CREATE TABLE IF NOT EXISTS temp_vcs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    channel_id TEXT,
    owner_id TEXT
  );

  -- Auto-reactions
  CREATE TABLE IF NOT EXISTS auto_reactions (
    guild_id TEXT,
    channel_id TEXT,
    emoji TEXT,
    PRIMARY KEY (guild_id, channel_id, emoji)
  );

  -- Bump reminders
  CREATE TABLE IF NOT EXISTS bump_config (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT,
    role_id TEXT,
    enabled INTEGER DEFAULT 0,
    last_bump INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bump_reminders (
    guild_id TEXT PRIMARY KEY,
    remind_at INTEGER
  );

  -- Bot status rotation
  CREATE TABLE IF NOT EXISTS bot_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    text TEXT,
    type TEXT DEFAULT 'Playing'
  );

  CREATE TABLE IF NOT EXISTS bot_status_config (
    guild_id TEXT PRIMARY KEY,
    interval_minutes INTEGER DEFAULT 5
  );
`);

// Helpers
const getGuild = db.prepare('SELECT * FROM guilds WHERE guild_id = ?');
const insertGuild = db.prepare('INSERT OR IGNORE INTO guilds (guild_id) VALUES (?)');

function ensureGuild(guildId) {
  insertGuild.run(guildId);
  return getGuild.get(guildId);
}

// Migrations — safely add columns that may not exist in older databases
const migrations = [
  `ALTER TABLE role_categories ADD COLUMN description TEXT`,
  `ALTER TABLE role_categories ADD COLUMN channel_id TEXT`,
  `ALTER TABLE role_categories ADD COLUMN color TEXT`,
  `ALTER TABLE role_categories ADD COLUMN mode TEXT DEFAULT 'toggle'`,
  `ALTER TABLE verification ADD COLUMN rules TEXT`,
  `ALTER TABLE verification ADD COLUMN welcome_dm TEXT`,
  `ALTER TABLE verification ADD COLUMN captcha_enabled INTEGER DEFAULT 0`,
  `ALTER TABLE verification ADD COLUMN age_check_enabled INTEGER DEFAULT 0`,
];

for (const migration of migrations) {
  try {
    db.prepare(migration).run();
  } catch (e) {
    // Column already exists — ignore
  }
}

module.exports = { db, ensureGuild };
