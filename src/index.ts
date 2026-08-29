/**
 * Animan — Anime & Manga Telegram Bot
 * Created by Blitz (@blitzlabx)
 */
import express from "express";
import { Bot } from "grammy";
import { config } from "./config";
import {
  blitzUserTracker,
  blitzBanGuard,
  blitzMaintenanceGuard,
  blitzFloketGuard,
  blitzSoftRateLimit,
} from "./middleware/guards";
import { registerStartHandlers } from "./handlers/start";
import { registerMenuHandlers } from "./handlers/menu";
import { registerSearchHandlers } from "./handlers/search";
import { registerAdminHandlers } from "./handlers/admin";
import { registerExtraHandlers } from "./handlers/extra";
import { blitzSetBotCommands } from "./commands/registry";
import { blitzLog } from "./logging/logger";
import { getStats } from "./db/database";
import { BLITZ } from "./constants";
import { blitzCleanupDownloads } from "./download/video";

async function blitzMain() {
  blitzLog.banner(`v${BLITZ.version} starting`);

  const bot = new Bot(config.botToken);

  bot.use(blitzUserTracker);
  bot.use(blitzSoftRateLimit);
  bot.use(blitzBanGuard);
  bot.use(blitzMaintenanceGuard);
  bot.use(blitzFloketGuard);

  registerStartHandlers(bot);
  registerMenuHandlers(bot);
  registerSearchHandlers(bot);
  registerAdminHandlers(bot);
  registerExtraHandlers(bot);

  bot.catch((err) => {
    blitzLog.error("Bot error", {
      message: String(err.error),
      update: err.ctx?.update?.update_id,
    });
  });

  try {
    await blitzSetBotCommands(bot);
    blitzLog.info("Bot commands registered");
  } catch (e) {
    blitzLog.warn("setMyCommands failed", { err: String(e) });
  }

  // Cleanup old downloads on boot
  try {
    const n = blitzCleanupDownloads();
    if (n) blitzLog.info("Startup download cleanup", { removed: n });
  } catch { /* ignore */ }

  const app = express();
  app.use(express.json());

  app.get("/ping", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "animan",
      by: "blitzlabx",
      version: BLITZ.version,
      ts: Date.now(),
    });
  });

  app.get("/health", (_req, res) => {
    let stats = null;
    try { stats = getStats(); } catch { /* */ }
    res.status(200).json({
      status: "healthy",
      bot: "animan",
      creator: "Blitz",
      handle: "blitzlabx",
      version: BLITZ.version,
      uptime: process.uptime(),
      memoryRss: process.memoryUsage().rss,
      stats,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/", (_req, res) => {
    res.type("html").send(`<!DOCTYPE html>
<html><head><title>Animan</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:system-ui,sans-serif;background:#0f0f12;color:#e8e8ed;display:flex;
align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#1a1a22;border-radius:16px;padding:2rem 2.5rem;text-align:center;
box-shadow:0 8px 32px rgba(0,0,0,.4);max-width:420px}
h1{margin:0 0 .5rem;font-size:1.8rem;background:linear-gradient(90deg,#7c5cff,#ff6bcb);
-webkit-background-clip:text;-webkit-text-fill-color:transparent}
p{opacity:.8;line-height:1.5}
.badge{display:inline-block;margin-top:1rem;padding:.35rem .8rem;border-radius:999px;
background:#22c55e22;color:#4ade80;font-size:.85rem}
</style></head>
<body><div class="card">
<h1>Animan</h1>
<p>Anime &amp; Manga Telegram bot<br>by <b>Blitz</b> (@blitzlabx)</p>
<div class="badge">● online · v${BLITZ.version}</div>
</div></body></html>`);
  });

  app.listen(config.port, () => {
    blitzLog.info(`HTTP server listening`, { port: config.port });
  });

  await bot.start({
    onStart: (info) => {
      blitzLog.info(`Bot live`, { username: info.username, id: info.id });
    },
  });
}

blitzMain().catch((e) => {
  blitzLog.error("Fatal", { err: String(e) });
  process.exit(1);
});
