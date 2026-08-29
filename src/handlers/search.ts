/**
 * Search, pick, episode, stream handlers
 * Animan by Blitz (@blitzlabx)
 *
 * Callback data uses SHORT indexes only (Telegram 64-byte limit).
 * Full IDs live in blitzSessions.
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
  qualityKeyboard,
} from "../utils/keyboards";
import { MSG, escapeMd } from "../utils/messages";
import { logDownload, logSearch, pushHistory, addFavorite } from "../db/database";
import { blitzSessions, blitzRateLimiter } from "../cache/memory";
import { blitzLog } from "../logging/logger";
import type {
  AnimeProviderKey,
  MangaProviderKey,
  ContentLanguage,
  SearchResultItem,
} from "../types";
import { LIMITS } from "../constants";
import { blitzUserFacingError } from "../utils/errors";

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
        `🔀 *Multi\\-provider anime search*\n\nSend the title\\. Animan will query multiple sources and rank results\\.`,
        { parse_mode: "Markdown" }
      );
    } else {
      await ctx.editMessageText(MSG.providerPicked(provider), {
        parse_mode: "Markdown",
      });
    }
  });

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

  // Pick result by index  r:0
  bot.callbackQuery(/^r:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const idx = parseInt(ctx.match![1], 10);
    const state = blitzSessions.get(ctx.from.id);
    const results = state.lastResults;
    if (!results?.[idx]) {
      await ctx.answerCallbackQuery({ text: "Session expired — search again", show_alert: true });
      return;
    }
    const item = results[idx];
    const type = state.mode || "anime";
    const provider = state.provider || "allmanga";
    await ctx.answerCallbackQuery({ text: "Loading…" });

    try {
      pushHistory(ctx.from.id, `${type}:${provider}:${item.id}`);
      if (type === "anime") {
        const units = await getEpisodes(item.id, provider as AnimeProviderKey);
        if (!units.length) {
          await safeEdit(ctx, "No episodes found\\.", mainMenuKeyboard());
          return;
        }
        blitzSessions.set(ctx.from.id, {
          selectedMediaId: item.id,
          lastUnits: units,
          page: 0,
        });
        await safeEdit(ctx, MSG.episodesHeader(units.length), episodeKeyboard(units, 0));
      } else {
        const units = await getChapters(item.id, provider as MangaProviderKey);
        if (!units.length) {
          await safeEdit(ctx, "No chapters found\\.", mainMenuKeyboard());
          return;
        }
        blitzSessions.set(ctx.from.id, {
          selectedMediaId: item.id,
          lastUnits: units,
          page: 0,
        });
        await safeEdit(ctx, MSG.chaptersHeader(units.length), episodeKeyboard(units, 0));
      }
    } catch (e) {
      blitzLog.error("pick failed", { err: String(e) });
      await safeEdit(ctx, blitzUserFacingError(e), mainMenuKeyboard());
    }
  });

  // Results pagination  rp:1
  bot.callbackQuery(/^rp:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const page = parseInt(ctx.match![1], 10);
    const state = blitzSessions.get(ctx.from.id);
    const results = state.lastResults;
    if (!results?.length) {
      await ctx.answerCallbackQuery({ text: "Session expired — search again" });
      return;
    }
    await ctx.answerCallbackQuery();
    blitzSessions.set(ctx.from.id, { page });
    const text =
      `🔍 *Results*\nProvider: \`${state.provider || "?"}\` · page ${page + 1}\n\nSelect one:`;
    await safeEdit(ctx, text, resultsKeyboard(results, page));
  });

  // Episode pagination  ep:1  (note: short form)
  bot.callbackQuery(/^ep:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const page = parseInt(ctx.match![1], 10);
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
    await safeEdit(ctx, header + `\n_Page ${page + 1}_`, episodeKeyboard(units, page));
  });

  // Episode/chapter select by index  e:0
  bot.callbackQuery(/^e:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const idx = parseInt(ctx.match![1], 10);
    const state = blitzSessions.get(ctx.from.id);
    const units = state.lastUnits;
    if (!units?.[idx]) {
      await ctx.answerCallbackQuery({ text: "Session expired", show_alert: true });
      return;
    }
    const unit = units[idx];
    const provider = state.provider || "allmanga";
    await ctx.answerCallbackQuery();

    const animeProviders = ["allmanga", "gogoanime", "anikoto", "megaplay", "animeparadise"];
    if (animeProviders.includes(provider)) {
      blitzSessions.set(ctx.from.id, { selectedUnitId: unit.id });
      await safeEdit(ctx, `🎞 *Ep ${unit.number}* — choose language:`, languageKeyboard());
    } else {
      blitzSessions.set(ctx.from.id, { selectedUnitId: unit.id });
      await resolveAndSendManga(ctx, provider, unit.id, unit.number);
    }
  });

  // Language  lang:sub | lang:menu
  bot.callbackQuery(/^lang:(sub|dub|raw|menu)$/, async (ctx) => {
    if (!ctx.from) return;
    const langOrMenu = ctx.match![1];
    const state = blitzSessions.get(ctx.from.id);
    if (langOrMenu === "menu") {
      await ctx.answerCallbackQuery();
      await safeEdit(ctx, `🎞 Choose language:`, languageKeyboard());
      return;
    }
    const unitId = state.selectedUnitId;
    const provider = state.provider || "allmanga";
    if (!unitId) {
      await ctx.answerCallbackQuery({ text: "Session expired", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery({ text: "Resolving stream…" });
    await resolveAndSendAnime(ctx, provider, unitId, langOrMenu as ContentLanguage);
  });

  // Quality  quality:720p
  bot.callbackQuery(/^quality:(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const quality = ctx.match![1];
    const state = blitzSessions.get(ctx.from.id);
    const unitId = state.selectedUnitId;
    const provider = state.provider || "allmanga";
    const lang = (state.language || "sub") as ContentLanguage;
    if (!unitId) {
      await ctx.answerCallbackQuery({ text: "Session expired", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery({ text: `Getting ${quality}…` });
    await resolveAndSendAnime(ctx, provider, unitId, lang, quality);
  });

  // Favorite index  fav:0
  bot.callbackQuery(/^fav:(\d+)$/, async (ctx) => {
    if (!ctx.from) return;
    const idx = parseInt(ctx.match![1], 10);
    const state = blitzSessions.get(ctx.from.id);
    const item = state.lastResults?.[idx];
    if (!item) {
      await ctx.answerCallbackQuery({ text: "Nothing to save" });
      return;
    }
    const ok = addFavorite(ctx.from.id, item.id);
    await ctx.answerCallbackQuery({
      text: ok ? "Added to favorites ⭐" : "Already in favorites",
    });
  });

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
      await safeEdit(ctx, text, mainMenuKeyboard());
    } catch {
      await safeEdit(ctx, MSG.error, mainMenuKeyboard());
    }
  });
}

async function safeEdit(ctx: Context, text: string, reply_markup?: any) {
  try {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup,
      link_preview_options: { is_disabled: false },
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("message is not modified")) return;
    // Fallback: send new message
    try {
      await ctx.reply(text, { parse_mode: "Markdown", reply_markup });
    } catch (e2) {
      blitzLog.error("safeEdit failed", { err: String(e2) });
    }
  }
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

    // Preview first result with thumbnail if available
    const top = results[0];
    const text =
      `🔍 *Results for* _${escapeMd(query)}_\n` +
      `Provider: \`${provider}\` · *${results.length}* found\n\n` +
      (top.year ? `Top: *${escapeMd(top.title)}* \\(${top.year}\\)\n\n` : `Top: *${escapeMd(top.title)}*\n\n`) +
      `Select one:`;

    if (top.thumbnailUrl) {
      try {
        await ctx.replyWithPhoto(top.thumbnailUrl, {
          caption: text,
          parse_mode: "Markdown",
          reply_markup: resultsKeyboard(results, 0),
        });
        return;
      } catch (e) {
        blitzLog.debug("thumbnail send failed, text only", { err: String(e) });
      }
    }

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: resultsKeyboard(results, 0),
    });
  } catch (e) {
    blitzLog.error("search failed", { err: String(e), query, provider });
    await ctx.reply(blitzUserFacingError(e), {
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
  if (ctx.from) {
    blitzSessions.set(ctx.from.id, { language: lang, selectedUnitId: unitId });
  }

  const tryLangs: ContentLanguage[] = [lang];
  for (const l of ["sub", "dub", "raw"] as ContentLanguage[]) {
    if (!tryLangs.includes(l)) tryLangs.push(l);
  }

  let lastErr: unknown;
  for (const tryLang of tryLangs) {
    try {
      const result = await resolveAnimeStream(
        unitId,
        provider as AnimeProviderKey,
        tryLang
      );
      if (result.type !== "video" || !result.streams.length) {
        lastErr = new Error(`No streams for ${tryLang}`);
        continue;
      }

      let stream = result.streams[0];
      if (preferredQuality) {
        const match = result.streams.find((s) => s.quality === preferredQuality);
        if (match) stream = match;
      } else if (result.streams.length > 1 && !preferredQuality) {
        const qualities = [...new Set(result.streams.map((s) => s.quality))];
        if (qualities.length > 1) {
          await safeEdit(
            ctx,
            `🎚 Multiple qualities \\(${tryLang}\\)\\. Pick one:`,
            qualityKeyboard(qualities)
          );
          return;
        }
      }

      if (ctx.from) {
        logDownload(ctx.from.id, "anime", unitId, 0, provider);
      }

      await safeEdit(
        ctx,
        MSG.streamReady(
          stream.quality,
          tryLang,
          stream.isHLS,
          stream.sourceUrl,
          stream.subtitles
        ),
        mainMenuKeyboard()
      );
      return;
    } catch (e) {
      lastErr = e;
      blitzLog.warn("stream try failed", { tryLang, err: String(e) });
    }
  }

  await safeEdit(
    ctx,
    `⚠️ Could not resolve a stream\\.\n${escapeMd(blitzUserFacingError(lastErr))}\n\nTry another episode, language, or provider\\.`,
    mainMenuKeyboard()
  );
}

async function resolveAndSendManga(
  ctx: Context,
  provider: string,
  unitId: string,
  unitNumber?: number
) {
  try {
    const result = await resolveMangaPages(unitId, provider as MangaProviderKey);
    if (result.type !== "manga" || !result.pages.imageUrls.length) {
      await safeEdit(ctx, "No pages found\\.", mainMenuKeyboard());
      return;
    }

    const pages = result.pages.imageUrls;
    if (ctx.from) {
      logDownload(ctx.from.id, "manga", unitId, unitNumber || 0, provider);
    }

    // Send first page as preview image when possible
    const caption = MSG.mangaReady(pages.length, pages.slice(0, 5));
    try {
      await ctx.replyWithPhoto(pages[0], {
        caption: `📚 *Chapter${unitNumber != null ? ` ${unitNumber}` : ""}* · ${pages.length} pages\n\n` +
          pages.slice(0, 5).map((u, i) => `${i + 1}\\. [Page ${i + 1}](${u})`).join("\n") +
          (pages.length > 5 ? `\n\n_…and ${pages.length - 5} more_` : "") +
          `\n\n_Animan by Blitz_`,
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
      // delete the "loading" message if it was an edit target
      try {
        await ctx.deleteMessage();
      } catch { /* ignore */ }
    } catch {
      await safeEdit(ctx, caption, mainMenuKeyboard());
    }
  } catch (e) {
    blitzLog.error("resolve manga failed", { err: String(e) });
    await safeEdit(ctx, blitzUserFacingError(e), mainMenuKeyboard());
  }
}
