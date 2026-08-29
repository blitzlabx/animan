/**
 * Colored button keyboards — Bot API 9.4 styles
 * Built by Blitz (@blitzlabx)
 *
 * Note: grammy's typed .text() only accepts (text, payload).
 * We attach `style` on the raw button object after creation so Bot API 9.4
 * colored buttons still work at runtime.
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

/** Attach Bot API 9.4 style to the last button added */
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
  kb.text(text, data);
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
    const st: Style | undefined = i === 0 ? "primary" : undefined;
    btn(kb, p.label, `provider:manga:${p.id}`, st);
    if ((i + 1) % 2 === 0) kb.row();
  }
  if (list.length % 2 !== 0) kb.row();
  btn(kb, "« Back", "menu:home");
  return kb;
}

export function languageKeyboard(unitId: string, provider: string) {
  const enc = encodeURIComponent(unitId);
  const kb = new InlineKeyboard();
  btn(kb, "SUB", `lang:${provider}:${enc}:sub`, "success");
  btn(kb, "DUB", `lang:${provider}:${enc}:dub`, "primary");
  btn(kb, "RAW", `lang:${provider}:${enc}:raw`);
  kb.row();
  btn(kb, "« Back", "menu:home");
  return kb;
}

export function qualityKeyboard(
  unitId: string,
  provider: string,
  lang: string,
  qualities: string[]
) {
  const kb = new InlineKeyboard();
  const enc = encodeURIComponent(unitId);
  for (let i = 0; i < qualities.length; i++) {
    const q = qualities[i];
    btn(kb, q, `quality:${provider}:${enc}:${lang}:${q}`, i === 0 ? "success" : undefined);
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

export function resultsKeyboard(
  results: SearchResultItem[],
  type: "anime" | "manga",
  provider: string,
  page = 0,
  pageSize = LIMITS.searchResultsPerPage
) {
  const kb = new InlineKeyboard();
  const slice = results.slice(page * pageSize, (page + 1) * pageSize);
  for (const r of slice) {
    const short = r.title.length > 42 ? r.title.slice(0, 39) + "…" : r.title;
    const score = r.score != null ? ` · ${Math.round(r.score * 100)}%` : "";
    btn(kb, `${short}${score}`, `pick:${type}:${provider}:${encodeURIComponent(r.id)}`);
    kb.row();
  }
  if (page > 0) btn(kb, "◀️ Prev", `page:${type}:${provider}:${page - 1}`);
  if ((page + 1) * pageSize < results.length)
    btn(kb, "Next ▶️", `page:${type}:${provider}:${page + 1}`);
  if (page > 0 || (page + 1) * pageSize < results.length) kb.row();
  if (results[0]) {
    btn(kb, "⭐ Save first", `fav:${type}:${provider}:${encodeURIComponent(results[0].id)}`);
    kb.row();
  }
  btn(kb, "« Menu", "menu:home");
  return kb;
}

export function episodeKeyboard(
  units: ContentUnitItem[],
  provider: string,
  page = 0,
  pageSize = LIMITS.episodesPerPage
) {
  const kb = new InlineKeyboard();
  const slice = units.slice(page * pageSize, (page + 1) * pageSize);
  for (let i = 0; i < slice.length; i++) {
    const u = slice[i];
    let label = `Ep ${u.number}`;
    if (u.isFiller) label += " F";
    if (u.isRecap) label += " R";
    btn(kb, label, `ep:${provider}:${encodeURIComponent(u.id)}`);
    if ((i + 1) % 4 === 0) kb.row();
  }
  if (slice.length % 4 !== 0) kb.row();
  if (page > 0) btn(kb, "◀️", `eppage:${provider}:${page - 1}`);
  if ((page + 1) * pageSize < units.length) btn(kb, "▶️", `eppage:${provider}:${page + 1}`);
  if (page > 0 || (page + 1) * pageSize < units.length) kb.row();
  btn(kb, "« Menu", "menu:home");
  return kb;
}

export function streamActionsKeyboard(_sourceUrl: string, hasSubs: boolean) {
  const kb = new InlineKeyboard();
  btn(kb, "🔄 Another quality", "stream:requality");
  if (hasSubs) btn(kb, "📝 Subtitles", "stream:subs");
  kb.row();
  btn(kb, "« Menu", "menu:home");
  return kb;
}

export function favoritesKeyboard(items: string[]) {
  const kb = new InlineKeyboard();
  for (const id of items.slice(0, 10)) {
    const short = id.length > 40 ? id.slice(0, 37) + "…" : id;
    btn(kb, short, `openfav:${encodeURIComponent(id)}`);
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
  for (const s of seasons) {
    btn(kb, s, `seasonal:${s}:${year}`);
  }
  kb.row();
  btn(kb, `${year - 1}`, `seasonal:FALL:${year - 1}`);
  btn(kb, `${year + 1}`, `seasonal:WINTER:${year + 1}`);
  kb.row();
  btn(kb, "« Back", "menu:home");
  return kb;
}
