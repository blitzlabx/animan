/**
 * Search, pick, episode, stream handlers
 * Animan by Blitz (@blitzlabx)
 */
import { Bot, Context } from "grammy";
import {
  searchAnime,
  searchManga,
  searchAnimeMulti,
  getEpisodes,
  getChapters,
  resolveAnimeStream,
  resolveMangaPages,
  browseTrending,
  browseSeasonal,
} from "../services/anime";
import {
  resultsKeyboard,
  episodeKeyboard,
  languageKeyboard,
  mainMenuKeyboard,
  seasonalKeyboard,
  qualityKeyboard,
} from "../utils/keyboards";
import { MSG, escapeMd } from "../utils/messages";
import { logDownload, logSearch, pushHistory, addFavorite } from "../db/database";
import { blitzSessions, blitzRateLimiter } from "../cache/memory";
import { blitzLog } from "../logging/logger";
import type { AnimeProviderKey, MangaProviderKey, ContentLanguage, SearchResultItem } from "../types";
import { LIMITS } from "../constants";

export function registerSearchHandlers(bot: Bot) {
  // Provider selection
  bot.callbackQuery(/^provider:(anime|manga):(\w+)$/, async (ctx) => {
    if (!ctx.from) return;
    const type = ctx.match![1] as "anime" | "manga";
    const provider = ctx.match![2];
    blitzSessions.set(ctx.from.id, {
      mode: type,
      provider: provider as any,
      waitingFor: "search",
      page: 0,
    });
    await ctx.answerCallbackQuery();
    if (provider === "multi") {
      await ctx.editMessageText(
        `🔀 *Multi-provider anime search*\n\nSend the title\\. Animan will query multiple sources and rank results\\.`,
        { parse_mode: "Markdown" }
      );
    } else {
      await ctx.editMessageText(MSG.providerPicked(provider), {
        parse_mode: "Markdown",
      });
    }
  });

  // Quick commands
  bot.command("anime", async (ctx) => {
    if (!ctx.from) return;
    if (!blitzRateLimiter.tryConsume(ctx.from.id, 2)) {
      await ctx.reply(MSG.rateLimited(blitzRateLimiter.remaining(ctx.from.id)), {
        parse_mode: "Markdown",
      });
      return;
    }
    const q = ctx.match?.trim();
    if (!q) {
      await ctx.reply("Usage: `/anime <title>`", { parse_mode: "Markdown" });
      return;
    }
    if (q.length > LIMITS.maxSearchQueryLength) {
      await ctx.reply("Query too long\\.", { parse_mode: "Markdown" });
      return;
    }
    await doSearch(ctx, "anime", "allmanga", q);
  });

  bot.command("manga", async (ctx) => {
    if (!ctx.from) return;
    if (!blitzRateLimiter.tryConsume(ctx.from.id, 2)) {
      await ctx.reply(MSG.rateLimited(blitzRateLimiter.remaining(ctx.from.id)), {
        parse_mode: "Markdown",
      });
      return;
    }
    const q = ctx.match?.trim();
    if (!q) {
      await ctx.reply("Usage: `/manga <title>`", { parse_mode: "Markdown" });
      return;
    }
    await doSearch(ctx, "manga", "mangadex", q);
  });

  bot.command("trending", async (ctx) => {
    await ctx.reply(`${MSG.searching("trending")}`, { parse_mode: "Markdown" });
    try {
      const list = await browseTrending(10);
      const items = list.map((item: any) => ({
        title: item.title?.english || item.title?.romaji || item.title || "Unknown",
      }));
      await ctx.reply(MSG.trendingHeader(items), {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
    } catch {
      await ctx.reply(MSG.error, { parse_mode: "Markdown" });
    }
  });

  // Text search when waiting
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.from) return next();
    const state = blitzSessions.get(ctx.from.id);
    if (state.waitingFor !== "search" || !state.mode || !state.provider) {
      return next();
    }
    const q = ctx.message.text.trim();
    if (q.startsWith("/")) return next();
    if (!blitzRateLimiter.tryConsume(ctx.from.id, 2)) {
      await ctx.reply(MSG.rateLimited(blitzRateLimiter.remaining(ctx.from.id)), {
        parse_mode: "Markdown",
      });
      return;
    }
    blitzSessions.set(ctx.from.id, { waitingFor: null });
    await doSearch(ctx, state.mode, state.provider, q);
  });

  // Pick result
  bot.callbackQuery(/^pick:(anime|manga):(\w+):(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const type = ctx.match![1] as "anime" | "manga";
    const provider = ctx.match![2];
    const mediaId = decodeURIComponent(ctx.match![3]);
    await ctx.answerCallbackQuery({ text: "Loading…" });

    try {
      pushHistory(ctx.from.id, `${type}:${provider}:${mediaId}`);
      if (type === "anime") {
        const units = await getEpisodes(mediaId, provider as AnimeProviderKey);
        if (!units.length) {
          await ctx.editMessageText("No episodes found\\.", {
            parse_mode: "Markdown",
            reply_markup: mainMenuKeyboard(),
          });
          return;
        }
        blitzSessions.set(ctx.from.id, {
          mode: "anime",
          provider: provider as any,
          selectedMediaId: mediaId,
          lastUnits: units,
          page: 0,
        });
        await ctx.editMessageText(MSG.episodesHeader(units.length), {
          parse_mode: "Markdown",
          reply_markup: episodeKeyboard(units, provider, 0),
        });
      } else {
        const units = await getChapters(mediaId, provider as MangaProviderKey);
        if (!units.length) {
          await ctx.editMessageText("No chapters found\\.", {
            parse_mode: "Markdown",
            reply_markup: mainMenuKeyboard(),
          });
          return;
        }
        blitzSessions.set(ctx.from.id, {
          mode: "manga",
          provider: provider as any,
          selectedMediaId: mediaId,
          lastUnits: units,
          page: 0,
        });
        await ctx.editMessageText(MSG.chaptersHeader(units.length), {
          parse_mode: "Markdown",
          reply_markup: episodeKeyboard(units, provider, 0),
        });
      }
    } catch (e) {
      blitzLog.error("pick failed", { err: String(e) });
      await ctx.editMessageText(MSG.error, {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
    }
  });

  // Results pagination
  bot.callbackQuery(/^page:(anime|manga):(\w+):(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const type = ctx.match![1] as "anime" | "manga";
    const provider = ctx.match![2];
    const page = parseInt(ctx.match![3], 10);
    const state = blitzSessions.get(ctx.from.id);
    const results = state.lastResults;
    if (!results?.length) {
      await ctx.answerCallbackQuery({ text: "Session expired — search again" });
      return;
    }
    await ctx.answerCallbackQuery();
    blitzSessions.set(ctx.from.id, { page });
    const text =
      `${MSG.searching("").replace("…", "")}*Results*\n` +
      `Provider: \`${provider}\` · page ${page + 1}\n\nSelect one:`;
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: resultsKeyboard(results, type, provider, page),
    });
  });

  // Episode pagination
  bot.callbackQuery(/^eppage:(\w+):(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const provider = ctx.match![1];
    const page = parseInt(ctx.match![2], 10);
    const state = blitzSessions.get(ctx.from.id);
    const units = state.lastUnits;
    if (!units?.length) {
      await ctx.answerCallbackQuery({ text: "Session expired" });
      return;
    }
    await ctx.answerCallbackQuery();
    const header =
      state.mode === "manga"
        ? MSG.chaptersHeader(units.length)
        : MSG.episodesHeader(units.length);
    await ctx.editMessageText(header + `\n_Page ${page + 1}_`, {
      parse_mode: "Markdown",
      reply_markup: episodeKeyboard(units, provider, page),
    });
  });

  // Episode / chapter select
  bot.callbackQuery(/^ep:(\w+):(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const provider = ctx.match![1];
    const unitId = decodeURIComponent(ctx.match![2]);
    await ctx.answerCallbackQuery();

    const animeProviders = ["allmanga", "gogoanime", "anikoto", "megaplay", "animeparadise"];
    if (animeProviders.includes(provider)) {
      blitzSessions.set(ctx.from.id, { selectedUnitId: unitId });
      await ctx.editMessageText(`🎞 Choose language for this episode:`, {
        parse_mode: "Markdown",
        reply_markup: languageKeyboard(unitId, provider),
      });
    } else {
      await resolveAndSendManga(ctx, provider, unitId);
    }
  });

  // Language → stream
  bot.callbackQuery(/^lang:(\w+):(.+):(sub|dub|raw)$/, async (ctx) => {
    if (!ctx.from) return;
    const provider = ctx.match![1];
    const unitId = decodeURIComponent(ctx.match![2]);
    const lang = ctx.match![3] as ContentLanguage;
    await ctx.answerCallbackQuery({ text: "Resolving stream…" });
    await resolveAndSendAnime(ctx, provider, unitId, lang);
  });

  // Quality pick
  bot.callbackQuery(/^quality:(\w+):(.+):(sub|dub|raw):(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const provider = ctx.match![1];
    const unitId = decodeURIComponent(ctx.match![2]);
    const lang = ctx.match![3] as ContentLanguage;
    const quality = ctx.match![4];
    await ctx.answerCallbackQuery({ text: `Getting ${quality}…` });
    await resolveAndSendAnime(ctx, provider, unitId, lang, quality);
  });

  // Favorite
  bot.callbackQuery(/^fav:(anime|manga):(\w+):(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const mediaId = decodeURIComponent(ctx.match![3]);
    const ok = addFavorite(ctx.from.id, mediaId);
    await ctx.answerCallbackQuery({
      text: ok ? "Added to favorites ⭐" : "Already in favorites",
    });
  });

  // Seasonal
  bot.callbackQuery(/^seasonal:(\w+):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Loading seasonal…" });
    const season = ctx.match![1];
    const year = parseInt(ctx.match![2], 10);
    try {
      const list = await browseSeasonal(season, year, 10);
      const items = list.map((item: any) => ({
        title: item.title?.english || item.title?.romaji || item.title || "Unknown",
      }));
      let text = `📅 *${season} ${year}*\n\n`;
      items.forEach((it, i) => {
        text += `${i + 1}\\. *${escapeMd(it.title)}*\n`;
      });
      text += `\n_AniList · Animan by Blitz_`;
      await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
    } catch {
      await ctx.editMessageText(MSG.error, {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
    }
  });
}

async function doSearch(
  ctx: Context,
  type: "anime" | "manga",
  provider: string,
  query: string
) {
  if (!ctx.from) return;
  await ctx.reply(MSG.searching(query), { parse_mode: "Markdown" });
  try {
    let results: SearchResultItem[];
    if (type === "anime" && provider === "multi") {
      results = await searchAnimeMulti(query);
    } else if (type === "anime") {
      results = await searchAnime(query, provider as AnimeProviderKey);
    } else {
      results = await searchManga(query, provider as MangaProviderKey);
    }

    logSearch(ctx.from.id, query, type, provider, results.length);

    if (!results.length) {
      await ctx.reply(MSG.noResults(query), {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    blitzSessions.set(ctx.from.id, {
      mode: type,
      provider: provider as any,
      lastQuery: query,
      lastResults: results,
      page: 0,
    });

    const text =
      `🔍 *Results for* _${escapeMd(query)}_\n` +
      `Provider: \`${provider}\` · ${results.length} found\n\n` +
      `Select one:`;
    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: resultsKeyboard(results, type, provider, 0),
    });
  } catch (e) {
    blitzLog.error("search failed", { err: String(e), query, provider });
    await ctx.reply(MSG.error, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  }
}

async function resolveAndSendAnime(
  ctx: Context,
  provider: string,
  unitId: string,
  lang: ContentLanguage,
  preferredQuality?: string
) {
  try {
    const result = await resolveAnimeStream(
      unitId,
      provider as AnimeProviderKey,
      lang
    );
    if (result.type !== "video" || !result.streams.length) {
      await ctx.editMessageText("No stream found for this episode\\.", {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    let stream = result.streams[0];
    if (preferredQuality) {
      const match = result.streams.find((s) => s.quality === preferredQuality);
      if (match) stream = match;
    }

    // If multiple qualities and none preferred, offer picker once
    if (!preferredQuality && result.streams.length > 1) {
      const qualities = [...new Set(result.streams.map((s) => s.quality))];
      if (qualities.length > 1) {
        await ctx.editMessageText(
          `🎚 Multiple qualities available\\. Pick one:`,
          {
            parse_mode: "Markdown",
            reply_markup: qualityKeyboard(unitId, provider, lang, qualities),
          }
        );
        return;
      }
    }

    if (ctx.from) {
      logDownload(ctx.from.id, "anime", unitId, 0, provider);
    }

    await ctx.editMessageText(
      MSG.streamReady(
        stream.quality,
        lang,
        stream.isHLS,
        stream.sourceUrl,
        stream.subtitles
      ),
      {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
        reply_markup: mainMenuKeyboard(),
      }
    );
  } catch (e) {
    blitzLog.error("resolve anime failed", { err: String(e) });
    await ctx.editMessageText(MSG.error, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  }
}

async function resolveAndSendManga(
  ctx: Context,
  provider: string,
  unitId: string
) {
  try {
    const result = await resolveMangaPages(unitId, provider as MangaProviderKey);
    if (result.type !== "manga" || !result.pages.imageUrls.length) {
      await ctx.editMessageText("No pages found\\.", {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    const pages = result.pages.imageUrls;
    if (ctx.from) {
      logDownload(ctx.from.id, "manga", unitId, 0, provider);
    }

    await ctx.editMessageText(MSG.mangaReady(pages.length, pages.slice(0, 3)), {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
      reply_markup: mainMenuKeyboard(),
    });
  } catch (e) {
    blitzLog.error("resolve manga failed", { err: String(e) });
    await ctx.editMessageText(MSG.error, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  }
}
