/**
 * Error handling & recovery utilities
 * Animan by Blitz (@blitzlabx)
 */
import { blitzLog } from "../logging/logger";

export class BlitzError extends Error {
  code: string;
  userMessage: string;
  constructor(code: string, message: string, userMessage?: string) {
    super(message);
    this.name = "BlitzError";
    this.code = code;
    this.userMessage = userMessage || "Something went wrong. Please try again.";
  }
}

export function blitzIsTimeout(err: unknown): boolean {
  const s = String(err).toLowerCase();
  return s.includes("timeout") || s.includes("aborted") || s.includes("etimedout");
}

export function blitzIsNetwork(err: unknown): boolean {
  const s = String(err).toLowerCase();
  return (
    s.includes("fetch failed") ||
    s.includes("econnrefused") ||
    s.includes("enotfound") ||
    s.includes("network") ||
    s.includes("socket")
  );
}

export function blitzUserFacingError(err: unknown): string {
  if (err instanceof BlitzError) return err.userMessage;
  if (blitzIsTimeout(err)) return "⏱️ Request timed out. Try again in a moment.";
  if (blitzIsNetwork(err)) return "🌐 Network issue reaching the provider. Try another source.";
  const s = String(err);
  if (s.includes("429") || s.includes("rate")) return "⏳ Provider rate limit. Wait a bit.";
  if (s.includes("404")) return "😕 Content not found on this provider.";
  return "⚠️ Something went wrong. Please try again.\n_Blitz is looking into it._";
}

export async function blitzRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; delayMs?: number; label?: string } = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  const delayMs = opts.delayMs ?? 600;
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      blitzLog.warn(`retry ${i + 1}/${retries}`, { label: opts.label, err: String(e) });
      if (i < retries) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw last;
}

export function blitzSafe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (e) {
    blitzLog.debug("blitzSafe caught", { err: String(e) });
    return fallback;
  }
}
