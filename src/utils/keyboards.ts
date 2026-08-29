/**
 * Colored button keyboards — Bot API 9.4 styles
 * Built by Blitz (@blitzlabx)
 *
 * CRITICAL: Telegram callback_data max is 64 BYTES.
 * We never put full media URNs in callbacks — only short indexes
 * that resolve via blitzSessions.
 */
import { InlineKeyboard } from "grammy";
import {
  ANIME_PROVIDER_META,
  MANGA_PROVIDER_META,
  ContentUnitItem,
  SearchResultItem,
} from "../types";
import { LIMITS } from "../constants";

type Style = "primary" | "success" | "danger";

function withStyle(kb: InlineKeyboard, style?: Style): InlineKeyboard {
  if (!style) return kb;
  const rows = (kb as any).inline_keyboard as any[][];
  if (!rows?.length) return kb;
  const lastRow = rows[rows.length - 1];
  if (!lastRow?.length) return kb;
  lastRow[lastRow.length - 1].style = style;
  return kb;
}

function btn(kb: InlineKeyboard, text: string, data: string, style?: Style): InlineKeyboard {
  // Hard safety: truncate callback_data to 64 bytes
  const safe = Buffer.byteLength(data, "utf8") > 64 ? data.slice(0, 40) : data;
  kb.text(text, safe);
  return withStyle(kb, style);
}

export function mainMenuKeyboard() {
  const kb = new InlineKeyboard();
  btn(kb, "🎬 Anime", "menu:anime", "primary");
  btn(kb, "📚 Manga", "menu:manga", "primary");
  kb.row();
  btn(kb, "🔥 Trending", "menu:trending", "success");
  btn(kb, "📅 Seasonal", "menu:seasonal");
  kb.row();
  btn(kb, "⭐ Favorites", "menu:favorites");
  btn(kb, "🕘 History", "menu:history");
  kb.row();
  btn(kb, "ℹ️ Help", "menu:help");
  btn(kb, "❤️ Support Blitz", "menu:donate", "danger");
  return kb;
}

export function animeProviderKeyboard() {
  const kb = new InlineKeyboard();
  const list = ANIME_PROVIDER_META;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const st: Style | undefined = i === 0 ? "primary" : i === 1 ? "success" : undefined;
    btn(kb, p.label, `provider:anime:${p.id}`, st);
    if ((i + 1) % 2 === 0) kb.row();
  }
  if (list.length % 2 !== 0) kb.row();
  btn(kb, "🔀 Multi-search", "provider:anime:multi", "primary");
  kb.row();
  btn(kb, "« Back", "menu:home");
  return kb;
}

export function mangaProviderKeyboard() {
  const kb = new InlineKeyboard();
  const list = MANGA_PROVIDER_META;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    btn(kb, p.label, `provider:manga:${p.id}`, i === 0 ? "primary" : undefined);
    if ((i + 1) % 2 === 0) kb.row();
  }
  if (list.length % 2 !== 0) kb.row();
  btn(kb, "« Back", "menu:home");
  return kb;
}

/** Language picker — unit is already in session */
export function languageKeyboard() {
  const kb = new InlineKeyboard();
  btn(kb, "SUB", "lang:sub", "success");
  btn(kb, "DUB", "lang:dub", "primary");
  btn(kb, "RAW", "lang:raw");
  kb.row();
  btn(kb, "« Back", "menu:home");
  return kb;
}

/** Quality picker — qualities short labels only */
export function qualityKeyboard(qualities: string[]) {
  const kb = new InlineKeyboard();
  for (let i = 0; i < qualities.length; i++) {
    const q = qualities[i];
    btn(kb, q, `quality:${q}`, i === 0 ? "success" : undefined);
    if ((i + 1) % 3 === 0) kb.row();
  }
  if (qualities.length % 3 !== 0) kb.row();
  btn(kb, "« Back", "menu:home");
  return kb;
}

export function confirmKeyboard(action: string, payload: string) {
  const kb = new InlineKeyboard();
  btn(kb, "✅ Confirm", `confirm:${action}:${payload}`, "success");
  btn(kb, "❌ Cancel", "menu:home", "danger");
  return kb;
}

export function adminPanelKeyboard(maintenance: boolean) {
  const kb = new InlineKeyboard();
  btn(kb, "📊 Stats", "admin:stats", "primary");
  btn(kb, "👤 User Info", "admin:userinfo");
  kb.row();
  btn(kb, "🚫 Ban User", "admin:ban", "danger");
  btn(kb, "✅ Unban User", "admin:unban", "success");
  kb.row();
  btn(kb, "📢 Broadcast", "admin:broadcast", "primary");
  btn(
    kb,
    maintenance ? "🟢 Exit Maintenance" : "🔴 Enter Maintenance",
    "admin:maintenance",
    maintenance ? "success" : "danger"
  );
  kb.row();
  btn(kb, "📋 Recent Logs", "admin:logs");
  btn(kb, "🏆 Top Users", "admin:top");
  kb.row();
  btn(kb, "🔧 Settings", "admin:settings");
  btn(kb, "🔍 Find User", "admin:find");
  kb.row();
  btn(kb, "« Close", "menu:home");
  return kb;
}

export function floketKeyboard() {
  const kb = new InlineKeyboard();
  btn(kb, "🔄 New Challenge", "floket:new", "primary");
  return kb;
}

export function joinGroupKeyboard(username: string) {
  const kb = new InlineKeyboard();
  if (username) {
    kb.url("Join Group", `https://t.me/${username.replace("@", "")}`);
  }
  btn(kb, "✅ I Joined", "check:join", "success");
  return kb;
}

/**
 * Results keyboard — INDEX based (r:0, r:1, …)
 * Full IDs live in session.lastResults
 */
export function resultsKeyboard(
  results: SearchResultItem[],
  page = 0,
  pageSize = LIMITS.searchResultsPerPage
) {
  const kb = new InlineKeyboard();
  const slice = results.slice(page * pageSize, (page + 1) * pageSize);
  for (let i = 0; i < slice.length; i++) {
    const globalIdx = page * pageSize + i;
    const r = slice[i];
    const short = r.title.length > 42 ? r.title.slice(0, 39) + "…" : r.title;
    const score = r.score != null ? ` · ${Math.round(r.score * 100)}%` : "";
    btn(kb, `${short}${score}`, `r:${globalIdx}`);
    kb.row();
  }
  if (page > 0) btn(kb, "◀️ Prev", `rp:${page - 1}`);
  if ((page + 1) * pageSize < results.length) btn(kb, "Next ▶️", `rp:${page + 1}`);
  if (page > 0 || (page + 1) * pageSize < results.length) kb.row();
  if (results.length) {
    btn(kb, "⭐ Save #1", "fav:0");
    kb.row();
  }
  btn(kb, "« Menu", "menu:home");
  return kb;
}

/**
 * Episode/chapter keyboard — INDEX based (e:0, e:1, …)
 */
export function episodeKeyboard(
  units: ContentUnitItem[],
  page = 0,
  pageSize = LIMITS.episodesPerPage
) {
  const kb = new InlineKeyboard();
  const slice = units.slice(page * pageSize, (page + 1) * pageSize);
  for (let i = 0; i < slice.length; i++) {
    const globalIdx = page * pageSize + i;
    const u = slice[i];
    let label = `Ep ${u.number}`;
    if (u.isFiller) label += " F";
    if (u.isRecap) label += " R";
    btn(kb, label, `e:${globalIdx}`);
    if ((i + 1) % 4 === 0) kb.row();
  }
  if (slice.length % 4 !== 0) kb.row();
  if (page > 0) btn(kb, "◀️", `ep:${page - 1}`);
  if ((page + 1) * pageSize < units.length) btn(kb, "▶️", `ep:${page + 1}`);
  if (page > 0 || (page + 1) * pageSize < units.length) kb.row();
  btn(kb, "« Menu", "menu:home");
  return kb;
}

export function streamActionsKeyboard(hasSubs: boolean) {
  const kb = new InlineKeyboard();
  btn(kb, "🔄 Re-pick language", "lang:menu");
  if (hasSubs) btn(kb, "📝 Subtitles listed above", "menu:home");
  kb.row();
  btn(kb, "« Menu", "menu:home");
  return kb;
}

export function favoritesKeyboard(items: string[]) {
  const kb = new InlineKeyboard();
  // Favorites store short labels; open by index
  for (let i = 0; i < Math.min(items.length, 10); i++) {
    const id = items[i];
    const short = id.length > 40 ? id.slice(0, 37) + "…" : id;
    btn(kb, short, `ofi:${i}`);
    kb.row();
  }
  btn(kb, "« Menu", "menu:home");
  return kb;
}

export function cancelKeyboard() {
  const kb = new InlineKeyboard();
  btn(kb, "❌ Cancel", "menu:home", "danger");
  return kb;
}

export function seasonalKeyboard() {
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const year = new Date().getFullYear();
  const kb = new InlineKeyboard();
  for (const s of seasons) btn(kb, s, `seasonal:${s}:${year}`);
  kb.row();
  btn(kb, `${year - 1}`, `seasonal:FALL:${year - 1}`);
  btn(kb, `${year + 1}`, `seasonal:WINTER:${year + 1}`);
  kb.row();
  btn(kb, "« Back", "menu:home");
  return kb;
}
