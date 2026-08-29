/**
 * SQLite persistence layer for Animan
 * Engineered by Blitz (@blitzlabx)
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { BlitzUser, BotStats, DownloadLogEntry } from "../types";
import { blitzLog } from "../logging/logger";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "animan.db");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    language_code TEXT,
    is_banned INTEGER DEFAULT 0,
    ban_reason TEXT,
    is_verified INTEGER DEFAULT 0,
    floket_score INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    search_count INTEGER DEFAULT 0,
    is_premium INTEGER DEFAULT 0,
    favorites TEXT DEFAULT '[]',
    history TEXT DEFAULT '[]',
    notes TEXT,
    last_active INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS floket_challenges (
    user_id INTEGER PRIMARY KEY,
    challenge TEXT NOT NULL,
    answer TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS download_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    media_type TEXT,
    title TEXT,
    unit_number REAL,
    provider TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS search_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    query TEXT,
    media_type TEXT,
    provider TEXT,
    result_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS admin_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT,
    target_id INTEGER,
    detail TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_banned ON users(is_banned);
  CREATE INDEX IF NOT EXISTS idx_users_verified ON users(is_verified);
  CREATE INDEX IF NOT EXISTS idx_download_user ON download_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_search_user ON search_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_search_created ON search_log(created_at);
`);

// Migration-safe column adds for older DBs
function ensureColumn(table: string, column: string, def: string) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
      blitzLog.info(`Migrated ${table}.${column}`);
    }
  } catch (e) {
    blitzLog.warn(`Migration skip ${table}.${column}`, { err: String(e) });
  }
}
ensureColumn("users", "search_count", "INTEGER DEFAULT 0");
ensureColumn("users", "is_premium", "INTEGER DEFAULT 0");
ensureColumn("users", "favorites", "TEXT DEFAULT '[]'");
ensureColumn("users", "history", "TEXT DEFAULT '[]'");

const insertSetting = db.prepare(
  "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
);
insertSetting.run("maintenance", "0");
insertSetting.run("force_join", "1");
insertSetting.run("welcome_message", "1");
insertSetting.run("max_downloads_per_day", "50");
insertSetting.run("announce", "");

export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

export function isMaintenance(): boolean {
  return getSetting("maintenance") === "1";
}

export function setMaintenance(on: boolean): void {
  setSetting("maintenance", on ? "1" : "0");
}

export function upsertUser(user: {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
}): void {
  db.prepare(
    `INSERT INTO users (user_id, username, first_name, last_name, language_code, last_active)
     VALUES (@id, @username, @first_name, @last_name, @language_code, strftime('%s','now'))
     ON CONFLICT(user_id) DO UPDATE SET
       username = excluded.username,
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       language_code = excluded.language_code,
       last_active = strftime('%s','now')`
  ).run({
    id: user.id,
    username: user.username ?? null,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    language_code: user.language_code ?? null,
  });
}

export function getUser(userId: number): BlitzUser | undefined {
  return db.prepare("SELECT * FROM users WHERE user_id = ?").get(userId) as
    | BlitzUser
    | undefined;
}

export function banUser(userId: number, reason = "No reason provided"): void {
  db.prepare(
    "UPDATE users SET is_banned = 1, ban_reason = ? WHERE user_id = ?"
  ).run(reason, userId);
}

export function unbanUser(userId: number): void {
  db.prepare(
    "UPDATE users SET is_banned = 0, ban_reason = NULL WHERE user_id = ?"
  ).run(userId);
}

export function isBanned(userId: number): boolean {
  const u = getUser(userId);
  return !!u?.is_banned;
}

export function setVerified(userId: number, score = 100): void {
  db.prepare(
    "UPDATE users SET is_verified = 1, floket_score = ? WHERE user_id = ?"
  ).run(score, userId);
}

export function isVerified(userId: number): boolean {
  const u = getUser(userId);
  return !!u?.is_verified;
}

export function incrementDownloads(userId: number): void {
  db.prepare(
    "UPDATE users SET downloads = downloads + 1 WHERE user_id = ?"
  ).run(userId);
}

export function incrementSearchCount(userId: number): void {
  db.prepare(
    "UPDATE users SET search_count = search_count + 1 WHERE user_id = ?"
  ).run(userId);
}

export function logDownload(
  userId: number,
  mediaType: string,
  title: string,
  unitNumber: number,
  provider: string
): void {
  db.prepare(
    `INSERT INTO download_log (user_id, media_type, title, unit_number, provider)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, mediaType, title, unitNumber, provider);
  incrementDownloads(userId);
}

export function logSearch(
  userId: number,
  query: string,
  mediaType: string,
  provider: string,
  resultCount: number
): void {
  db.prepare(
    `INSERT INTO search_log (user_id, query, media_type, provider, result_count)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, query, mediaType, provider, resultCount);
  incrementSearchCount(userId);
}

export function logAdminAction(
  adminId: number,
  action: string,
  targetId: number | null,
  detail: string
): void {
  db.prepare(
    `INSERT INTO admin_audit (admin_id, action, target_id, detail) VALUES (?, ?, ?, ?)`
  ).run(adminId, action, targetId, detail);
}

export function getStats(): BotStats {
  const totalUsers = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
  const banned = (
    db.prepare("SELECT COUNT(*) as c FROM users WHERE is_banned = 1").get() as any
  ).c;
  const verified = (
    db.prepare("SELECT COUNT(*) as c FROM users WHERE is_verified = 1").get() as any
  ).c;
  const downloads = (
    db.prepare("SELECT COUNT(*) as c FROM download_log").get() as any
  ).c;
  const dayAgo = Math.floor(Date.now() / 1000) - 86400;
  const activeToday = (
    db
      .prepare("SELECT COUNT(*) as c FROM users WHERE last_active >= ?")
      .get(dayAgo) as any
  ).c;
  const searchesToday = (
    db
      .prepare("SELECT COUNT(*) as c FROM search_log WHERE created_at >= ?")
      .get(dayAgo) as any
  ).c;
  return {
    totalUsers,
    banned,
    verified,
    downloads,
    activeToday,
    searchesToday,
    maintenance: isMaintenance(),
  };
}

export function getAllUserIds(): number[] {
  return (
    db.prepare("SELECT user_id FROM users WHERE is_banned = 0").all() as any[]
  ).map((r) => r.user_id);
}

export function getRecentDownloads(limit = 20): DownloadLogEntry[] {
  return db
    .prepare(
      `SELECT * FROM download_log ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit) as DownloadLogEntry[];
}

export function getTopDownloaders(limit = 10): { user_id: number; downloads: number; username: string | null }[] {
  return db
    .prepare(
      `SELECT user_id, downloads, username FROM users WHERE downloads > 0 ORDER BY downloads DESC LIMIT ?`
    )
    .all(limit) as any[];
}

export function getFavorites(userId: number): string[] {
  const u = getUser(userId);
  if (!u?.favorites) return [];
  try {
    return JSON.parse(u.favorites);
  } catch {
    return [];
  }
}

export function addFavorite(userId: number, mediaUrn: string, max = 30): boolean {
  const favs = getFavorites(userId);
  if (favs.includes(mediaUrn)) return false;
  favs.unshift(mediaUrn);
  const trimmed = favs.slice(0, max);
  db.prepare("UPDATE users SET favorites = ? WHERE user_id = ?").run(
    JSON.stringify(trimmed),
    userId
  );
  return true;
}

export function removeFavorite(userId: number, mediaUrn: string): boolean {
  const favs = getFavorites(userId).filter((f) => f !== mediaUrn);
  db.prepare("UPDATE users SET favorites = ? WHERE user_id = ?").run(
    JSON.stringify(favs),
    userId
  );
  return true;
}

export function getHistory(userId: number): string[] {
  const u = getUser(userId);
  if (!u?.history) return [];
  try {
    return JSON.parse(u.history);
  } catch {
    return [];
  }
}

export function pushHistory(userId: number, entry: string, max = 20): void {
  const hist = getHistory(userId).filter((h) => h !== entry);
  hist.unshift(entry);
  db.prepare("UPDATE users SET history = ? WHERE user_id = ?").run(
    JSON.stringify(hist.slice(0, max)),
    userId
  );
}

export function setUserNotes(userId: number, notes: string): void {
  db.prepare("UPDATE users SET notes = ? WHERE user_id = ?").run(notes, userId);
}

export function getUserCountByDay(days = 7): { day: string; count: number }[] {
  const rows = db
    .prepare(
      `SELECT date(created_at, 'unixepoch') as day, COUNT(*) as count
       FROM users
       WHERE created_at >= strftime('%s', 'now', ?)
       GROUP BY day
       ORDER BY day DESC`
    )
    .all(`-${days} days`) as any[];
  return rows;
}

export function searchUsers(query: string, limit = 15): BlitzUser[] {
  const q = `%${query}%`;
  return db
    .prepare(
      `SELECT * FROM users
       WHERE CAST(user_id AS TEXT) LIKE ? OR username LIKE ? OR first_name LIKE ?
       ORDER BY last_active DESC LIMIT ?`
    )
    .all(q, q, q, limit) as BlitzUser[];
}

blitzLog.info("Database ready", { path: dbPath });
