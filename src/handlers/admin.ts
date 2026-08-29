/**
 * Admin panel — ban, broadcast, stats, maintenance, logs
 * Animan by Blitz (@blitzlabx)
 */
import { Bot } from "grammy";
import { config } from "../config";
import {
  getStats,
  getUser,
  banUser,
  unbanUser,
  isMaintenance,
  setMaintenance,
  getAllUserIds,
  getSetting,
  setSetting,
  logAdminAction,
  getRecentDownloads,
  getTopDownloaders,
  searchUsers,
  setUserNotes,
} from "../db/database";
import { adminPanelKeyboard, mainMenuKeyboard, cancelKeyboard } from "../utils/keyboards";
import { MSG, formatUserCard } from "../utils/messages";
import { blitzAdminOnly } from "../middleware/guards";
import { blitzSessions } from "../cache/memory";
import { blitzLog } from "../logging/logger";
import { getFloketStats } from "../services/floket";
import { blitzCache } from "../cache/memory";

export function registerAdminHandlers(bot: Bot) {
  bot.command("admin", blitzAdminOnly, async (ctx) => {
    const maint = isMaintenance();
    await ctx.reply(
      `🛠️ *Animan Admin Panel*\n_by Blitz (@blitzlabx)_\n\n` +
        `Maintenance: ${maint ? "🔴 ON" : "🟢 OFF"}`,
      {
        parse_mode: "Markdown",
        reply_markup: adminPanelKeyboard(maint),
      }
    );
  });

  bot.callbackQuery("admin:stats", blitzAdminOnly, async (ctx) => {
    const s = getStats();
    const floket = getFloketStats();
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      MSG.stats(s) + `\nFloket pending: *${floket.pending}*\nCache entries: *${blitzCache.size()}*`,
      {
        parse_mode: "Markdown",
        reply_markup: adminPanelKeyboard(isMaintenance()),
      }
    );
  });

  bot.callbackQuery("admin:maintenance", blitzAdminOnly, async (ctx) => {
    const now = isMaintenance();
    setMaintenance(!now);
    logAdminAction(ctx.from!.id, now ? "maintenance_off" : "maintenance_on", null, "");
    await ctx.answerCallbackQuery({
      text: !now ? "Maintenance ON" : "Maintenance OFF",
    });
    await ctx.editMessageText(
      `🛠️ *Admin Panel*\n\nMaintenance is now *${!now ? "ON 🔴" : "OFF 🟢"}*`,
      {
        parse_mode: "Markdown",
        reply_markup: adminPanelKeyboard(!now),
      }
    );
  });

  bot.callbackQuery("admin:ban", blitzAdminOnly, async (ctx) => {
    blitzSessions.set(ctx.from!.id, { waitingFor: "ban" });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🚫 *Ban User*\n\nSend the user ID \\(numeric\\)\\.\nOptionally: \`ID reason here\`\n\nOr /cancel`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
  });

  bot.callbackQuery("admin:unban", blitzAdminOnly, async (ctx) => {
    blitzSessions.set(ctx.from!.id, { waitingFor: "unban" });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `✅ *Unban User*\n\nSend the user ID to unban\\.\nOr /cancel`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
  });

  bot.callbackQuery("admin:userinfo", blitzAdminOnly, async (ctx) => {
    blitzSessions.set(ctx.from!.id, { waitingFor: "userinfo" });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `👤 *User Info*\n\nSend the user ID\\.\nOr /cancel`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
  });

  bot.callbackQuery("admin:broadcast", blitzAdminOnly, async (ctx) => {
    blitzSessions.set(ctx.from!.id, { waitingFor: "broadcast" });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📢 *Broadcast*\n\nSend the message \\(text, photo, video, or document\\)\\.\nIt will be sent to all non\\-banned users\\.\n\nOr /cancel`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
  });

  bot.callbackQuery("admin:settings", blitzAdminOnly, async (ctx) => {
    await ctx.answerCallbackQuery();
    const force = getSetting("force_join") === "1";
    const maxDl = getSetting("max_downloads_per_day") || "50";
    await ctx.editMessageText(
      `🔧 *Settings*\n\n` +
        `Force join: ${force ? "ON" : "OFF"}\n` +
        `Max downloads/day: ${maxDl}\n` +
        `Donation: ${config.donationUrl}\n` +
        `Admin ID: \`${config.adminId}\`\n\n` +
        `_Toggle force join by sending: force\\_join on|off_`,
      {
        parse_mode: "Markdown",
        reply_markup: adminPanelKeyboard(isMaintenance()),
      }
    );
  });

  bot.callbackQuery("admin:logs", blitzAdminOnly, async (ctx) => {
    await ctx.answerCallbackQuery();
    const logs = getRecentDownloads(12);
    let text = `📋 *Recent downloads*\n\n`;
    if (!logs.length) text += "_No downloads yet_\\.\n";
    for (const l of logs) {
      text += `• \`${l.user_id}\` ${l.media_type} · ${l.provider}\n`;
    }
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: adminPanelKeyboard(isMaintenance()),
    });
  });

  bot.callbackQuery("admin:top", blitzAdminOnly, async (ctx) => {
    await ctx.answerCallbackQuery();
    const top = getTopDownloaders(10);
    let text = `🏆 *Top downloaders*\n\n`;
    top.forEach((u, i) => {
      text += `${i + 1}\\. \`${u.user_id}\` @${u.username || "—"} — *${u.downloads}*\n`;
    });
    if (!top.length) text += "_None yet_\\.\n";
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: adminPanelKeyboard(isMaintenance()),
    });
  });

  bot.callbackQuery("admin:find", blitzAdminOnly, async (ctx) => {
    blitzSessions.set(ctx.from!.id, { waitingFor: "userinfo" });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `🔍 *Find user*\n\nSend user ID or username fragment\\.\nOr /cancel`,
      { parse_mode: "Markdown", reply_markup: cancelKeyboard() }
    );
  });

  // Admin text / media inputs
  bot.on("message", async (ctx, next) => {
    if (!ctx.from || ctx.from.id !== config.adminId) return next();
    const state = blitzSessions.get(ctx.from.id);
    if (!state.waitingFor) return next();

    const text = ctx.message.text?.trim();
    if (text === "/cancel") {
      blitzSessions.set(ctx.from.id, { waitingFor: null });
      await ctx.reply("Cancelled\\.", {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    if (state.waitingFor === "ban" && text) {
      const parts = text.split(/\s+/);
      const id = Number(parts[0]);
      const reason = parts.slice(1).join(" ") || "Banned by admin";
      if (!id) {
        await ctx.reply("Invalid ID\\.", { parse_mode: "Markdown" });
        return;
      }
      banUser(id, reason);
      logAdminAction(ctx.from.id, "ban", id, reason);
      blitzSessions.set(ctx.from.id, { waitingFor: null });
      await ctx.reply(`🚫 User \`${id}\` banned\\.\nReason: ${reason}`, {
        parse_mode: "Markdown",
      });
      return;
    }

    if (state.waitingFor === "unban" && text) {
      const id = Number(text);
      if (!id) {
        await ctx.reply("Invalid ID\\.", { parse_mode: "Markdown" });
        return;
      }
      unbanUser(id);
      logAdminAction(ctx.from.id, "unban", id, "");
      blitzSessions.set(ctx.from.id, { waitingFor: null });
      await ctx.reply(`✅ User \`${id}\` unbanned\\.`, { parse_mode: "Markdown" });
      return;
    }

    if (state.waitingFor === "userinfo" && text) {
      blitzSessions.set(ctx.from.id, { waitingFor: null });
      const id = Number(text);
      if (id) {
        const u = getUser(id);
        if (!u) {
          await ctx.reply("User not found in DB\\.", { parse_mode: "Markdown" });
          return;
        }
        await ctx.reply(formatUserCard(u), { parse_mode: "Markdown" });
        return;
      }
      // username search
      const found = searchUsers(text.replace("@", ""), 8);
      if (!found.length) {
        await ctx.reply("No matches\\.", { parse_mode: "Markdown" });
        return;
      }
      let msg = `🔍 *Matches*\n\n`;
      for (const u of found) {
        msg += `• \`${u.user_id}\` @${u.username || "—"} ${u.first_name || ""}\n`;
      }
      await ctx.reply(msg, { parse_mode: "Markdown" });
      return;
    }

    if (state.waitingFor === "broadcast") {
      blitzSessions.set(ctx.from.id, { waitingFor: null });
      const ids = getAllUserIds();
      let ok = 0;
      let fail = 0;
      const statusMsg = await ctx.reply(`Broadcasting to ${ids.length} users…`);

      for (let i = 0; i < ids.length; i++) {
        const uid = ids[i];
        try {
          if (ctx.message.photo) {
            await ctx.api.sendPhoto(uid, ctx.message.photo.at(-1)!.file_id, {
              caption: ctx.message.caption,
            });
          } else if (ctx.message.video) {
            await ctx.api.sendVideo(uid, ctx.message.video.file_id, {
              caption: ctx.message.caption,
            });
          } else if (ctx.message.document) {
            await ctx.api.sendDocument(uid, ctx.message.document.file_id, {
              caption: ctx.message.caption,
            });
          } else if (ctx.message.animation) {
            await ctx.api.sendAnimation(uid, ctx.message.animation.file_id, {
              caption: ctx.message.caption,
            });
          } else if (ctx.message.text) {
            await ctx.api.sendMessage(uid, ctx.message.text, {
              parse_mode: "Markdown",
            });
          } else {
            await ctx.api.copyMessage(uid, ctx.chat!.id, ctx.message.message_id);
          }
          ok++;
        } catch {
          fail++;
        }
        if (i % 25 === 0 && i > 0) {
          try {
            await ctx.api.editMessageText(
              ctx.chat!.id,
              statusMsg.message_id,
              `Broadcasting… ${i}/${ids.length} \\(ok ${ok}, fail ${fail}\\)`
            );
          } catch { /* ignore */ }
        }
        await new Promise((r) => setTimeout(r, 35));
      }
      logAdminAction(ctx.from.id, "broadcast", null, `ok=${ok} fail=${fail}`);
      await ctx.reply(`📢 Done\\. Success: *${ok}* · Failed: *${fail}*`, {
        parse_mode: "Markdown",
      });
      return;
    }

    // force_join toggle shortcut
    if (text?.startsWith("force_join ")) {
      const v = text.split(/\s+/)[1];
      if (v === "on" || v === "off") {
        setSetting("force_join", v === "on" ? "1" : "0");
        await ctx.reply(`Force join set to *${v}*\\.`, { parse_mode: "Markdown" });
        return;
      }
    }

    return next();
  });
}
