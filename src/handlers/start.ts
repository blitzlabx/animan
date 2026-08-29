/**
 * /start + Floket verification handlers
 * Animan by Blitz (@blitzlabx)
 */
import { Bot } from "grammy";
import { config } from "../config";
import { isVerified, setVerified, isBanned, getFavorites, getHistory } from "../db/database";
import {
  createFloketChallenge,
  verifyFloketAnswer,
  hasPendingFloket,
} from "../services/floket";
import {
  mainMenuKeyboard,
  floketKeyboard,
  joinGroupKeyboard,
  favoritesKeyboard,
} from "../utils/keyboards";
import { MSG } from "../utils/messages";
import { blitzLog } from "../logging/logger";

export function registerStartHandlers(bot: Bot) {
  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    if (isBanned(ctx.from.id)) {
      await ctx.reply(MSG.banned, { parse_mode: "Markdown" });
      return;
    }

    const name = ctx.from.first_name || "friend";
    blitzLog.info("start", { userId: ctx.from.id, username: ctx.from.username });

    if (isVerified(ctx.from.id) && !hasPendingFloket(ctx.from.id)) {
      if (config.forceJoinChatId) {
        try {
          const member = await ctx.api.getChatMember(
            config.forceJoinChatId,
            ctx.from.id
          );
          if (["left", "kicked"].includes(member.status)) {
            await ctx.reply(
              `📢 *Join our community first*\n\nPlease join the group to use Animan fully\\.`,
              {
                parse_mode: "Markdown",
                reply_markup: joinGroupKeyboard(config.forceJoinUsername),
              }
            );
            return;
          }
        } catch {
          // bot may not be admin — skip force join
        }
      }

      await ctx.reply(MSG.mainMenu, {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    const { question } = createFloketChallenge(ctx.from.id);
    await ctx.reply(MSG.welcome(name), { parse_mode: "Markdown" });
    await ctx.reply(MSG.floketPrompt(question), {
      parse_mode: "Markdown",
      reply_markup: floketKeyboard(),
    });
  });

  // Floket answers
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.from) return next();
    if (!hasPendingFloket(ctx.from.id)) return next();

    const answer = ctx.message.text.trim();
    if (answer.startsWith("/")) return next();

    const result = verifyFloketAnswer(ctx.from.id, answer);
    if (result.ok) {
      setVerified(ctx.from.id, 100);
      await ctx.reply(MSG.floketSuccess, { parse_mode: "Markdown" });
      await ctx.reply(MSG.mainMenu, {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
    } else {
      await ctx.reply(`❌ ${result.message}`, { parse_mode: "Markdown" });
    }
  });

  bot.callbackQuery("floket:new", async (ctx) => {
    if (!ctx.from) return;
    const { question } = createFloketChallenge(ctx.from.id);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(MSG.floketPrompt(question), {
      parse_mode: "Markdown",
      reply_markup: floketKeyboard(),
    });
  });

  bot.callbackQuery("check:join", async (ctx) => {
    if (!ctx.from || !config.forceJoinChatId) return;
    try {
      const member = await ctx.api.getChatMember(
        config.forceJoinChatId,
        ctx.from.id
      );
      if (["left", "kicked"].includes(member.status)) {
        await ctx.answerCallbackQuery({
          text: "You haven't joined yet!",
          show_alert: true,
        });
        return;
      }
      await ctx.answerCallbackQuery({ text: "Welcome!" });
      await ctx.editMessageText(MSG.mainMenu, {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
    } catch {
      await ctx.answerCallbackQuery({ text: "Could not verify. Try /start" });
    }
  });

  bot.command("favorites", async (ctx) => {
    if (!ctx.from) return;
    const favs = getFavorites(ctx.from.id);
    if (!favs.length) {
      await ctx.reply("No favorites yet\\. Star a result to save it\\.", {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }
    await ctx.reply(`⭐ *Your favorites* \\(${favs.length}\\)`, {
      parse_mode: "Markdown",
      reply_markup: favoritesKeyboard(favs),
    });
  });

  bot.command("history", async (ctx) => {
    if (!ctx.from) return;
    const hist = getHistory(ctx.from.id);
    if (!hist.length) {
      await ctx.reply("History is empty\\.", {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }
    let text = `🕘 *Recent*\n\n`;
    hist.slice(0, 15).forEach((h, i) => {
      text += `${i + 1}\\. \`${h}\`\n`;
    });
    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  });
}
