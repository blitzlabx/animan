/**
 * Runtime configuration — Animan by Blitz (@blitzlabx)
 */
import "dotenv/config";
import { BLITZ } from "./constants";

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`[Blitz] Missing required env: ${key}`);
  return v;
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] || fallback;
}

export const config = {
  botToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  adminId: Number(requireEnv("ADMIN_ID")),
  donationUrl: optionalEnv("DONATION_URL", "https://t.me/blitzlabx"),
  forceJoinChatId: process.env.FORCE_JOIN_CHAT_ID
    ? Number(process.env.FORCE_JOIN_CHAT_ID)
    : null,
  forceJoinUsername: optionalEnv("FORCE_JOIN_CHAT_USERNAME"),
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",
  brand: {
    name: BLITZ.botName,
    creator: BLITZ.name,
    handle: BLITZ.handle,
    tagline: BLITZ.tagline,
    version: BLITZ.version,
  },
} as const;

export type Config = typeof config;
