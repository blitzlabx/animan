/**
 * Optional webhook mode for production (Render / VPS)
 * Animan by Blitz (@blitzlabx)
 *
 * Long-polling is default and works on free tier.
 * Set WEBHOOK_URL to enable webhook mode instead.
 */
import { Bot, webhookCallback } from "grammy";
import express from "express";
import { blitzLog } from "../logging/logger";

export interface WebhookOptions {
  bot: Bot;
  app: express.Express;
  path?: string;
  domain?: string; // e.g. https://animan.onrender.com
}

/**
 * Attach webhook endpoint. Call setWebhook separately with full URL.
 */
export function blitzAttachWebhook(opts: WebhookOptions): void {
  const path = opts.path || `/telegram/webhook/${process.env.TELEGRAM_BOT_TOKEN?.slice(-12) || "hook"}`;
  opts.app.use(path, express.json(), webhookCallback(opts.bot, "express"));
  blitzLog.info("Webhook route attached", { path });
}

export async function blitzSetWebhook(bot: Bot, url: string): Promise<void> {
  await bot.api.setWebhook(url, {
    drop_pending_updates: true,
    allowed_updates: [
      "message",
      "callback_query",
      "inline_query",
    ],
  });
  blitzLog.info("Webhook set", { url });
}

export async function blitzDeleteWebhook(bot: Bot): Promise<void> {
  await bot.api.deleteWebhook({ drop_pending_updates: false });
  blitzLog.info("Webhook deleted — back to polling");
}
