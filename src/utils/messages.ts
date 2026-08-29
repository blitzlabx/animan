/**
 * Beautiful message templates — Animan by Blitz (@blitzlabx)
 */
import { config } from "../config";
import { BLITZ, HELP_TEXT_SECTIONS, EMOJI } from "../constants";
import { BotStats } from "../types";

export function escapeMd(text: string): string {
  return String(text).replace(/([_*`\[\]()])/g, "\\$1");
}

export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const MSG = {
  welcome: (name: string) =>
    `✨ *Welcome to ${BLITZ.botName}*, ${escapeMd(name)}!\n\n` +
    `${BLITZ.tagline}\n\n` +
    `Powered by anime-sdk · Crafted by *${BLITZ.name}* (@${BLITZ.handle})\n\n` +
    `${EMOJI.floket} First, pass *Floket* verification to prove you're human.`,

  floketPrompt: (question: string) =>
    `${EMOJI.floket} *Floket Verification*\n_Powered by Floket_\n\n` +
    `Answer this to continue:\n\n` +
    `❓ *${escapeMd(question)}*\n\n` +
    `_Reply with the answer only\\. You have limited attempts\\._`,

  floketSuccess:
    `${EMOJI.success} *Floket passed!*\n\nYou're verified\\. Enjoy ${BLITZ.botName}\\.\n— ${BLITZ.name}`,

  mainMenu:
    `${EMOJI.home} *${BLITZ.botName} Main Menu*\n\n` +
    `Choose what you want to explore:\n\n` +
    `${EMOJI.anime} Anime streams & downloads\n` +
    `${EMOJI.manga} Manga chapters\n` +
    `${EMOJI.trending} Trending titles\n` +
    `⭐ Favorites & history\n\n` +
    `_Made with ${EMOJI.heart} by ${BLITZ.name} (@${BLITZ.handle})_`,

  help: (() => {
    let t = `📖 *${BLITZ.botName} Help*\n\n`;
    for (const s of HELP_TEXT_SECTIONS) {
      t += `*${s.title}*\n${s.body}\n\n`;
    }
    t += `*Commands*\n` +
      `/start — Restart / verify\n` +
      `/anime <title> — Quick anime search\n` +
      `/manga <title> — Quick manga search\n` +
      `/trending — Hot titles\n` +
      `/favorites — Your saved titles\n` +
      `/donate — Support ${BLITZ.name}\n` +
      `/admin — Admin panel \\(owner only\\)\n\n` +
      `_${BLITZ.botName} by ${BLITZ.name} · @${BLITZ.handle}_`;
    return t;
  })(),

  maintenance:
    `🔧 *Maintenance Mode*\n\n${BLITZ.botName} is temporarily offline for upgrades\\.\nTry again later\\.\n— ${BLITZ.name}`,

  banned:
    `${EMOJI.danger} *Access Denied*\n\nYou have been banned from ${BLITZ.botName}\\.\nContact @${BLITZ.handle} if this is an error\\.`,

  noResults: (q: string) =>
    `😕 No results for *${escapeMd(q)}*\\.\n\nTry a different title or provider\\.`,

  searching: (q: string) => `${EMOJI.search} Searching for *${escapeMd(q)}*…`,

  error: `${EMOJI.warn} Something went wrong\\. Please try again\\.\n_${BLITZ.name} is looking into it\\._`,

  rateLimited: (remaining: number) =>
    `⏳ Slow down a bit\\.\nTry again in a few seconds\\.\n_Tokens left soon: ~${remaining}_`,

  streamReady: (quality: string, lang: string, isHls: boolean, url: string, subs?: { label: string; url: string }[]) => {
    let t =
      `${EMOJI.success} *Stream ready*\n\n` +
      `Quality: \`${quality}\`\n` +
      `Language: \`${lang}\`\n` +
      `Type: ${isHls ? "HLS" : "MP4"}\n\n` +
      `🔗 [Open Stream](${url})\n\n`;
    if (subs?.length) {
      t += `*Subtitles:*\n`;
      for (const s of subs.slice(0, 6)) {
        t += `• [${escapeMd(s.label)}](${s.url})\n`;
      }
      t += `\n`;
    }
    t += `_${BLITZ.botName} by ${BLITZ.name} (@${BLITZ.handle})_`;
    return t;
  },

  mangaReady: (pageCount: number, previewUrls: string[]) => {
    let t =
      `${EMOJI.manga} *Chapter ready*\n\n` +
      `${pageCount} pages\n\n` +
      `Preview:\n`;
    previewUrls.forEach((url, i) => {
      t += `${i + 1}\\. [Page ${i + 1}](${url})\n`;
    });
    if (pageCount > previewUrls.length) {
      t += `\n_…and ${pageCount - previewUrls.length} more_\n`;
    }
    t += `\n_${BLITZ.botName} by ${BLITZ.name} (@${BLITZ.handle})_`;
    return t;
  },

  stats: (s: BotStats) =>
    `${EMOJI.stats} *${BLITZ.botName} Stats*\n\n` +
    `👥 Users: *${s.totalUsers}*\n` +
    `${EMOJI.success} Verified: *${s.verified}*\n` +
    `${EMOJI.danger} Banned: *${s.banned}*\n` +
    `${EMOJI.download} Downloads: *${s.downloads}*\n` +
    `🟢 Active today: *${s.activeToday}*\n` +
    `${EMOJI.search} Searches today: *${s.searchesToday}*\n` +
    `Maintenance: ${s.maintenance ? "🔴 ON" : "🟢 OFF"}\n\n` +
    `_${BLITZ.name} monitoring_`,

  donate:
    `${EMOJI.heart} *Support ${BLITZ.name}*\n\n` +
    `If ${BLITZ.botName} helps you, consider supporting the creator\\.\n\n` +
    `→ ${config.donationUrl}\n\n` +
    `Thank you\\!\n— @${BLITZ.handle}`,

  providerPicked: (provider: string) =>
    `${EMOJI.success} Provider set to *${escapeMd(provider)}*\n\nNow send the *title* you want to search\\.`,

  episodesHeader: (count: number) =>
    `${EMOJI.anime} *Episodes* \\(${count}\\)\n\nSelect an episode:`,

  chaptersHeader: (count: number) =>
    `${EMOJI.manga} *Chapters* \\(${count}\\)\n\nSelect a chapter:`,

  trendingHeader: (items: { title: string }[]) => {
    let t = `${EMOJI.trending} *Trending Anime*\n\n`;
    items.forEach((item, i) => {
      t += `${i + 1}\\. *${escapeMd(item.title)}*\n`;
    });
    t += `\n_Data via AniList · ${BLITZ.botName} by ${BLITZ.name}_`;
    return t;
  },
};

export function formatUserCard(u: Record<string, any>): string {
  return (
    `👤 *User ${u.user_id}*\n\n` +
    `Username: @${u.username || "—"}\n` +
    `Name: ${escapeMd((u.first_name || "") + " " + (u.last_name || ""))}\n` +
    `Banned: ${u.is_banned ? "Yes" : "No"}${u.ban_reason ? ` (${escapeMd(u.ban_reason)})` : ""}\n` +
    `Verified: ${u.is_verified ? "Yes" : "No"}\n` +
    `Downloads: ${u.downloads || 0}\n` +
    `Searches: ${u.search_count || 0}\n` +
    `Joined: ${u.created_at ? new Date(u.created_at * 1000).toISOString() : "—"}\n` +
    `Last active: ${u.last_active ? new Date(u.last_active * 1000).toISOString() : "—"}\n` +
    `Notes: ${u.notes ? escapeMd(u.notes) : "—"}`
  );
}
