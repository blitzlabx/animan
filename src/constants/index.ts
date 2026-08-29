/**
 * Constants & static config for Animan
 * Blitz (@blitzlabx)
 */

export const BLITZ = {
  name: "Blitz",
  handle: "blitzlabx",
  github: "https://github.com/blitzlabx",
  botName: "Animan",
  version: "1.3.0",
  tagline: "Anime & Manga at your fingertips",
} as const;

export const LIMITS = {
  searchResultsPerPage: 5,
  episodesPerPage: 8,
  maxSearchQueryLength: 80,
  maxBroadcastPerMinute: 30,
  floketMaxAttempts: 3,
  floketExpirySeconds: 300,
  sessionTtlMs: 30 * 60 * 1000,
  cacheSearchTtlMs: 3 * 60 * 1000,
  cacheUnitsTtlMs: 5 * 60 * 1000,
  userRateTokens: 15,
  userRateRefillPerSec: 0.5,
  maxFavorites: 30,
  maxHistory: 20,
} as const;

export const EMOJI = {
  anime: "🎬",
  manga: "📚",
  trending: "🔥",
  success: "✅",
  danger: "🚫",
  warn: "⚠️",
  search: "🔍",
  download: "⬇️",
  admin: "🛠️",
  floket: "🛡️",
  heart: "❤️",
  star: "⭐",
  lock: "🔒",
  unlock: "🔓",
  stats: "📊",
  broadcast: "📢",
  settings: "🔧",
  home: "🏠",
  back: "«",
  next: "▶️",
  prev: "◀️",
} as const;

export const CALLBACK = {
  menuHome: "menu:home",
  menuAnime: "menu:anime",
  menuManga: "menu:manga",
  menuTrending: "menu:trending",
  menuSeasonal: "menu:seasonal",
  menuHelp: "menu:help",
  menuDonate: "menu:donate",
  menuFavorites: "menu:favorites",
  menuHistory: "menu:history",
  floketNew: "floket:new",
  checkJoin: "check:join",
  adminStats: "admin:stats",
  adminBan: "admin:ban",
  adminUnban: "admin:unban",
  adminUserinfo: "admin:userinfo",
  adminBroadcast: "admin:broadcast",
  adminMaintenance: "admin:maintenance",
  adminSettings: "admin:settings",
  adminUsers: "admin:users",
  adminLogs: "admin:logs",
} as const;

export const HELP_TEXT_SECTIONS = [
  {
    title: "Search",
    body: "Use /anime <title> or /manga <title>, or pick a provider from the menu then type the name.",
  },
  {
    title: "Providers",
    body: "AllManga, Gogoanime, Anikoto, MegaPlay, AnimeParadise for anime. MangaDex, WeebCentral, MangaPill for manga.",
  },
  {
    title: "Languages",
    body: "SUB (subtitled), DUB (dubbed), RAW (no subs) when the provider supports them.",
  },
  {
    title: "Floket",
    body: "One-time human check. Answer the challenge to unlock the bot. Powered by Floket.",
  },
  {
    title: "Support",
    body: "Created by Blitz (@blitzlabx). Use /donate if you want to support development.",
  },
] as const;
