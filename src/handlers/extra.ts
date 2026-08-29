/**
 * Extra commands: ping, stats, quick admin shortcuts
 * Animan by Blitz (@blitzlabx)
 */
import { Bot } from "grammy";
import { config } from "../config";
import { getStats, banUser, unbanUser, getUser, setMaintenance, isMaintenance, logAdminAction } from "../db/database";
import { MSG, formatUserCard } from "../utils/messages";
import { mainMenuKeyboard } from "../utils/keyboards";
import { blitzAdminOnly } from "../middleware/guards";
import { blitzCommandHelpText } from "../commands/registry";
import { BLITZ } from "../constants";

export function registerExtraHandlers(bot: Bot) {
  bot.command("ping", async (ctx) => {
    const t0 = Date.now();
    const msg = await ctx.reply("🏓 Pong…");
    const ms = Date.now() - t0;
    await ctx.api.editMessageText(
      ctx.chat!.id,
      msg.message_id,
      `🏓 *Pong*\nLatency: \`${ms}ms\`\n_${BLITZ.botName} · @${BLITZ.handle}_`,
      { parse_mode: "Markdown" }
    );
  });

  bot.command("stats", async (ctx) => {
    try {
      const s = getStats();
      await ctx.reply(
        `📊 *${BLITZ.botName}*\n\nUsers: *${s.totalUsers}*\nDownloads: *${s.downloads}*\nActive today: *${s.activeToday}*\n\n_by ${BLITZ.name}_`,
        { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() }
      );
    } catch {
      await ctx.reply(MSG.error, { parse_mode: "Markdown" });
    }
  });

  bot.command("commands", async (ctx) => {
    const isAdmin = ctx.from?.id === config.adminId;
    await ctx.reply(blitzCommandHelpText(isAdmin), { parse_mode: "Markdown" });
  });

  // Quick admin shortcuts
  bot.command("ban", blitzAdminOnly, async (ctx) => {
    const parts = (ctx.match || "").trim().split(/\s+/);
    const id = Number(parts[0]);
    if (!id) {
      await ctx.reply("Usage: `/ban <user_id> [reason]`", { parse_mode: "Markdown" });
      return;
    }
    const reason = parts.slice(1).join(" ") || "Banned by admin";
    banUser(id, reason);
    logAdminAction(ctx.from!.id, "ban", id, reason);
    await ctx.reply(`🚫 Banned \`${id}\`\nReason: ${reason}`, { parse_mode: "Markdown" });
  });

  bot.command("unban", blitzAdminOnly, async (ctx) => {
    const id = Number((ctx.match || "").trim());
    if (!id) {
      await ctx.reply("Usage: `/unban <user_id>`", { parse_mode: "Markdown" });
      return;
    }
    unbanUser(id);
    logAdminAction(ctx.from!.id, "unban", id, "");
    await ctx.reply(`✅ Unbanned \`${id}\``, { parse_mode: "Markdown" });
  });

  bot.command("user", blitzAdminOnly, async (ctx) => {
    const id = Number((ctx.match || "").trim());
    if (!id) {
      await ctx.reply("Usage: `/user <user_id>`", { parse_mode: "Markdown" });
      return;
    }
    const u = getUser(id);
    if (!u) {
      await ctx.reply("User not found\\.", { parse_mode: "Markdown" });
      return;
    }
    await ctx.reply(formatUserCard(u), { parse_mode: "Markdown" });
  });

  bot.command("maint", blitzAdminOnly, async (ctx) => {
    const now = isMaintenance();
    setMaintenance(!now);
    logAdminAction(ctx.from!.id, !now ? "maintenance_on" : "maintenance_off", null, "");
    await ctx.reply(`Maintenance is now *${!now ? "ON 🔴" : "OFF 🟢"}*`, {
      parse_mode: "Markdown",
    });
  });
}
