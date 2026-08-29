/**
 * Structured logging for Animan
 * By Blitz (@blitzlabx)
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function ts(): string {
  return new Date().toISOString();
}

function fmt(level: LogLevel, msg: string, meta?: Record<string, unknown>): string {
  const base = `[${ts()}] [Blitz] [${level.toUpperCase()}] ${msg}`;
  if (meta && Object.keys(meta).length) {
    try {
      return `${base} ${JSON.stringify(meta)}`;
    } catch {
      return base;
    }
  }
  return base;
}

export const blitzLog = {
  debug(msg: string, meta?: Record<string, unknown>) {
    if (shouldLog("debug")) console.debug(fmt("debug", msg, meta));
  },
  info(msg: string, meta?: Record<string, unknown>) {
    if (shouldLog("info")) console.info(fmt("info", msg, meta));
  },
  warn(msg: string, meta?: Record<string, unknown>) {
    if (shouldLog("warn")) console.warn(fmt("warn", msg, meta));
  },
  error(msg: string, meta?: Record<string, unknown>) {
    if (shouldLog("error")) console.error(fmt("error", msg, meta));
  },
  /** Special brand line */
  banner(msg: string) {
    console.log(`\n══════════════════════════════════════\n  Animan · ${msg}\n  by Blitz (@blitzlabx)\n══════════════════════════════════════\n`);
  },
};

/** Measure async duration */
export async function blitzTime<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    blitzLog.debug(`${label} ok`, { ms: Date.now() - start });
    return result;
  } catch (e) {
    blitzLog.error(`${label} failed`, { ms: Date.now() - start, err: String(e) });
    throw e;
  }
}
