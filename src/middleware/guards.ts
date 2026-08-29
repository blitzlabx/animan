/**
 * Guards & middleware by Blitz (@blitzlabx)
 */
import { Context, NextFunction } from "grammy";
import { config } from "../config";
import {
  isBanned,
  isMaintenance,
  isVerified,
  upsertUser,
} from "../db/database";
import { hasPendingFloket } from "../services/floket";
import { MSG } from "../utils/messages";
import { blitzRateLimiter } from "../cache/memory";
import { blitzLog } from "../logging/logger";

export async function blitzUserTracker(ctx: Context, next: NextFunction) {
  if (ctx.from) {
    try {
      upsertUser({
        id: ctx.from.id,
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        language_code: ctx.from.language_code,
      });
    } catch (e) {
      blitzLog.warn("upsertUser failed", { err: String(e) });
    }
  }
  await next();
}

export async function blitzBanGuard(ctx: Context, next: NextFunction) {
  if (!ctx.from) return;
  if (ctx.from.id === config.adminId) return next();
  if (isBanned(ctx.from.id)) {
    try {
      await ctx.reply(MSG.banned, { parse_mode: "Markdown" });
    } catch { /* ignore */ }
    return;
  }
  await next();
}

export async function blitzMaintenanceGuard(ctx: Context, next: NextFunction) {
  if (!ctx.from) return;
  if (ctx.from.id === config.adminId) return next();
  if (isMaintenance()) {
    try {
      await ctx.reply(MSG.maintenance, { parse_mode: "Markdown" });
    } catch { /* ignore */ }
    return;
  }
  await next();
}

export async function blitzFloketGuard(ctx: Context, next: NextFunction) {
  if (!ctx.from) return;
  if (ctx.from.id === config.adminId) return next();

  const text = ctx.message?.text?.trim() || "";
  if (text.startsWith("/start") || text.startsWith("/floket")) {
    return next();
  }
  if (ctx.callbackQuery?.data?.startsWith("floket:")) {
    return next();
  }
  if (ctx.callbackQuery?.data === "check:join") {
    return next();
  }

  if (!isVerified(ctx.from.id) || hasPendingFloket(ctx.from.id)) {
    try {
      await ctx.reply(
        "🛡️ *Floket Verification Required*\n\nYou must pass the human check first\\.\nType /start to begin\\.",
        { parse_mode: "Markdown" }
      );
    } catch { /* ignore */ }
    return;
  }
  await next();
}

export async function blitzAdminOnly(ctx: Context, next: NextFunction) {
  if (!ctx.from || ctx.from.id !== config.adminId) {
    try {
      await ctx.reply("⛔ Admin only\\.", { parse_mode: "Markdown" });
    } catch { /* ignore */ }
    return;
  }
  await next();
}

export async function blitzSoftRateLimit(ctx: Context, next: NextFunction) {
  if (!ctx.from) return next();
  if (ctx.from.id === config.adminId) return next();
  // Soft global consume for any interaction
  if (!blitzRateLimiter.tryConsume(ctx.from.id, 0.5)) {
    // Don't hard-block every message; only warn occasionally
    blitzLog.debug("soft rate limit", { userId: ctx.from.id });
  }
  await next();
}
