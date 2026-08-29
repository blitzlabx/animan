/**
 * Main menu & navigation callbacks
 * Animan by Blitz (@blitzlabx)
 */
import { Bot } from "grammy";
import {
  mainMenuKeyboard,
  animeProviderKeyboard,
  mangaProviderKeyboard,
  seasonalKeyboard,
  favoritesKeyboard,
} from "../utils/keyboards";
import { MSG } from "../utils/messages";
import { browseTrending } from "../services/anime";
import { getFavorites, getHistory } from "../db/database";
import { escapeMd } from "../utils/messages";

export function registerMenuHandlers(bot: Bot) {
  bot.callbackQuery("menu:home", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(MSG.mainMenu, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  });

  bot.callbackQuery("menu:anime", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🎬 *Anime Search*\n\nChoose a provider, then send the title\\.\n\n_Or use_ \`/anime <title>\``,
      { parse_mode: "Markdown", reply_markup: animeProviderKeyboard() }
    );
  });

  bot.callbackQuery("menu:manga", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📚 *Manga Search*\n\nChoose a provider, then send the title\\.\n\n_Or use_ \`/manga <title>\``,
      { parse_mode: "Markdown", reply_markup: mangaProviderKeyboard() }
    );
  });

  bot.callbackQuery("menu:trending", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Loading trending…" });
    try {
      const list = await browseTrending(10);
      const items = list.map((item: any) => ({
        title: item.title?.english || item.title?.romaji || item.title || "Unknown",
      }));
      await ctx.editMessageText(MSG.trendingHeader(items), {
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

  bot.callbackQuery("menu:seasonal", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📅 *Seasonal anime*\n\nPick a season:`,
      { parse_mode: "Markdown", reply_markup: seasonalKeyboard() }
    );
  });

  bot.callbackQuery("menu:help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(MSG.help, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  });

  bot.callbackQuery("menu:donate", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(MSG.donate, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  });

  bot.callbackQuery("menu:favorites", async (ctx) => {
    if (!ctx.from) return;
    await ctx.answerCallbackQuery();
    const favs = getFavorites(ctx.from.id);
    if (!favs.length) {
      await ctx.editMessageText("No favorites yet\\. Star a result to save it\\.", {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }
    await ctx.editMessageText(`⭐ *Favorites* \\(${favs.length}\\)`, {
      parse_mode: "Markdown",
      reply_markup: favoritesKeyboard(favs),
    });
  });

  bot.callbackQuery("menu:history", async (ctx) => {
    if (!ctx.from) return;
    await ctx.answerCallbackQuery();
    const hist = getHistory(ctx.from.id);
    if (!hist.length) {
      await ctx.editMessageText("History is empty\\.", {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }
    let text = `🕘 *Recent*\n\n`;
    hist.slice(0, 12).forEach((h, i) => {
      text += `${i + 1}\\. \`${h}\`\n`;
    });
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(MSG.help, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  });

  bot.command("donate", async (ctx) => {
    await ctx.reply(MSG.donate, { parse_mode: "Markdown" });
  });
}
