/**
 * Colored button keyboards — Bot API 9.4 styles
 * Built by Blitz (@blitzlabx)
 */
import { InlineKeyboard } from "grammy";
import { ANIME_PROVIDER_META, MANGA_PROVIDER_META, ContentUnitItem, SearchResultItem } from "../types";
import { LIMITS } from "../constants";

type Style = "primary" | "success" | "danger";

function style(s: Style): any {
  return { style: s };
}

export function mainMenuKeyboard() {
  return new InlineKeyboard()
    .text("🎬 Anime", "menu:anime", style("primary"))
    .text("📚 Manga", "menu:manga", style("primary"))
    .row()
    .text("🔥 Trending", "menu:trending", style("success"))
    .text("📅 Seasonal", "menu:seasonal")
    .row()
    .text("⭐ Favorites", "menu:favorites")
    .text("🕘 History", "menu:history")
    .row()
    .text("ℹ️ Help", "menu:help")
    .text("❤️ Support Blitz", "menu:donate", style("danger"));
}

export function animeProviderKeyboard() {
  const kb = new InlineKeyboard();
  const list = ANIME_PROVIDER_META;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const st = i === 0 ? style("primary") : i === 1 ? style("success") : undefined;
    kb.text(p.label, `provider:anime:${p.id}`, st as any);
    if ((i + 1) % 2 === 0) kb.row();
  }
  if (list.length % 2 !== 0) kb.row();
  kb.text("🔀 Multi-search", "provider:anime:multi", style("primary")).row();
  kb.text("« Back", "menu:home");
  return kb;
}

export function mangaProviderKeyboard() {
  const kb = new InlineKeyboard();
  const list = MANGA_PROVIDER_META;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const st = i === 0 ? style("primary") : undefined;
    kb.text(p.label, `provider:manga:${p.id}`, st as any);
    if ((i + 1) % 2 === 0) kb.row();
  }
  if (list.length % 2 !== 0) kb.row();
  kb.text("« Back", "menu:home");
  return kb;
}

export function languageKeyboard(unitId: string, provider: string) {
  const enc = encodeURIComponent(unitId);
  return new InlineKeyboard()
    .text("SUB", `lang:${provider}:${enc}:sub`, style("success"))
    .text("DUB", `lang:${provider}:${enc}:dub`, style("primary"))
    .text("RAW", `lang:${provider}:${enc}:raw`)
    .row()
    .text("« Back", "menu:home");
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
    kb.text(q, `quality:${provider}:${enc}:${lang}:${q}`, i === 0 ? style("success") : undefined);
    if ((i + 1) % 3 === 0) kb.row();
  }
  if (qualities.length % 3 !== 0) kb.row();
  kb.text("« Back", "menu:home");
  return kb;
}

export function confirmKeyboard(action: string, payload: string) {
  return new InlineKeyboard()
    .text("✅ Confirm", `confirm:${action}:${payload}`, style("success"))
    .text("❌ Cancel", "menu:home", style("danger"));
}

export function adminPanelKeyboard(maintenance: boolean) {
  return new InlineKeyboard()
    .text("📊 Stats", "admin:stats", style("primary"))
    .text("👤 User Info", "admin:userinfo")
    .row()
    .text("🚫 Ban User", "admin:ban", style("danger"))
    .text("✅ Unban User", "admin:unban", style("success"))
    .row()
    .text("📢 Broadcast", "admin:broadcast", style("primary"))
    .text(
      maintenance ? "🟢 Exit Maintenance" : "🔴 Enter Maintenance",
      "admin:maintenance",
      style(maintenance ? "success" : "danger")
    )
    .row()
    .text("📋 Recent Logs", "admin:logs")
    .text("🏆 Top Users", "admin:top")
    .row()
    .text("🔧 Settings", "admin:settings")
    .text("🔍 Find User", "admin:find")
    .row()
    .text("« Close", "menu:home");
}

export function floketKeyboard() {
  return new InlineKeyboard().text("🔄 New Challenge", "floket:new", style("primary"));
}

export function joinGroupKeyboard(username: string) {
  const kb = new InlineKeyboard();
  if (username) {
    kb.url("Join Group", `https://t.me/${username.replace("@", "")}`);
  }
  kb.text("✅ I Joined", "check:join", style("success"));
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
    kb.text(`${short}${score}`, `pick:${type}:${provider}:${encodeURIComponent(r.id)}`).row();
  }
  const nav: string[] = [];
  if (page > 0) kb.text("◀️ Prev", `page:${type}:${provider}:${page - 1}`);
  if ((page + 1) * pageSize < results.length)
    kb.text("Next ▶️", `page:${type}:${provider}:${page + 1}`);
  if (page > 0 || (page + 1) * pageSize < results.length) kb.row();
  kb.text("⭐ Save first", `fav:${type}:${provider}:${encodeURIComponent(results[0]?.id || "")}`).row();
  kb.text("« Menu", "menu:home");
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
    kb.text(label, `ep:${provider}:${encodeURIComponent(u.id)}`);
    if ((i + 1) % 4 === 0) kb.row();
  }
  if (slice.length % 4 !== 0) kb.row();
  if (page > 0) kb.text("◀️", `eppage:${provider}:${page - 1}`);
  if ((page + 1) * pageSize < units.length) kb.text("▶️", `eppage:${provider}:${page + 1}`);
  if (page > 0 || (page + 1) * pageSize < units.length) kb.row();
  kb.text("« Menu", "menu:home");
  return kb;
}

export function streamActionsKeyboard(sourceUrl: string, hasSubs: boolean) {
  const kb = new InlineKeyboard();
  // Telegram doesn't allow arbitrary external open in all clients; we show link in text
  kb.text("🔄 Another quality", "stream:requality");
  if (hasSubs) kb.text("📝 Subtitles", "stream:subs");
  kb.row().text("« Menu", "menu:home");
  return kb;
}

export function favoritesKeyboard(items: string[]) {
  const kb = new InlineKeyboard();
  for (const id of items.slice(0, 10)) {
    const short = id.length > 40 ? id.slice(0, 37) + "…" : id;
    kb.text(short, `openfav:${encodeURIComponent(id)}`).row();
  }
  kb.text("« Menu", "menu:home");
  return kb;
}

export function cancelKeyboard() {
  return new InlineKeyboard().text("❌ Cancel", "menu:home", style("danger"));
}

export function seasonalKeyboard() {
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const year = new Date().getFullYear();
  const kb = new InlineKeyboard();
  for (const s of seasons) {
    kb.text(s, `seasonal:${s}:${year}`);
  }
  kb.row();
  kb.text(`${year - 1}`, `seasonal:FALL:${year - 1}`).text(`${year + 1}`, `seasonal:WINTER:${year + 1}`);
  kb.row().text("« Back", "menu:home");
  return kb;
}
