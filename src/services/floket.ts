/**
 * Floket — powered by Floket
 * Tight anti-bot verification by Blitz (@blitzlabx)
 *
 * Design goals:
 * - Multiple challenge types (math, word, logic)
 * - Time-limited
 * - Attempt capped
 * - Case-insensitive, trimmed answers
 * - No external APIs
 */
import { db } from "../db/database";
import { LIMITS } from "../constants";
import { blitzLog } from "../logging/logger";

interface ChallengeDef {
  q: string;
  a: string;
  type: "math" | "word" | "logic" | "brand";
}

const MATH: ChallengeDef[] = [
  { q: "What is 7 + 12?", a: "19", type: "math" },
  { q: "What is 15 - 8?", a: "7", type: "math" },
  { q: "What is 6 × 3?", a: "18", type: "math" },
  { q: "What is 20 ÷ 4?", a: "5", type: "math" },
  { q: "What is 9 + 6?", a: "15", type: "math" },
  { q: "What is 11 - 4?", a: "7", type: "math" },
  { q: "What is 5 × 5?", a: "25", type: "math" },
  { q: "What is 8 + 7?", a: "15", type: "math" },
  { q: "What is 14 - 9?", a: "5", type: "math" },
  { q: "What is 4 × 4?", a: "16", type: "math" },
  { q: "What is 30 ÷ 5?", a: "6", type: "math" },
  { q: "What is 3 + 18?", a: "21", type: "math" },
];

const WORD: ChallengeDef[] = [
  { q: "Type the word: ANIME", a: "anime", type: "word" },
  { q: "Type the word: MANGA", a: "manga", type: "word" },
  { q: "Type the word: FLOKET", a: "floket", type: "word" },
  { q: "Type the word: BLITZ", a: "blitz", type: "word" },
  { q: "Type the word: ANIMAN", a: "animan", type: "word" },
  { q: "What color is the sky on a clear day? (one word)", a: "blue", type: "word" },
  { q: "How many days in a week?", a: "7", type: "word" },
  { q: "How many legs does a cat have?", a: "4", type: "word" },
  { q: "Opposite of hot (one word)", a: "cold", type: "word" },
  { q: "Type YES if you are human", a: "yes", type: "word" },
];

const LOGIC: ChallengeDef[] = [
  { q: "If today is Monday, what day was yesterday? (one word)", a: "sunday", type: "logic" },
  { q: "What comes after 2, 4, 6? (number)", a: "8", type: "logic" },
  { q: "How many letters in the word BOT?", a: "3", type: "logic" },
  { q: "1 + 1 + 1 = ?", a: "3", type: "logic" },
];

const BRAND: ChallengeDef[] = [
  { q: "Who created Animan? (one word)", a: "blitz", type: "brand" },
  { q: "Type the creator handle without @: BLITZLABX →", a: "blitzlabx", type: "brand" },
];

const ALL: ChallengeDef[] = [...MATH, ...WORD, ...LOGIC, ...BRAND];

function pickChallenge(): ChallengeDef {
  // Weighted: more math/word, fewer brand
  const roll = Math.random();
  if (roll < 0.45) return MATH[Math.floor(Math.random() * MATH.length)];
  if (roll < 0.8) return WORD[Math.floor(Math.random() * WORD.length)];
  if (roll < 0.95) return LOGIC[Math.floor(Math.random() * LOGIC.length)];
  return BRAND[Math.floor(Math.random() * BRAND.length)];
}

function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

export function createFloketChallenge(userId: number): { question: string; type: string } {
  const challenge = pickChallenge();
  db.prepare(
    `INSERT INTO floket_challenges (user_id, challenge, answer, attempts, created_at)
     VALUES (?, ?, ?, 0, strftime('%s','now'))
     ON CONFLICT(user_id) DO UPDATE SET
       challenge = excluded.challenge,
       answer = excluded.answer,
       attempts = 0,
       created_at = strftime('%s','now')`
  ).run(userId, challenge.q, normalizeAnswer(challenge.a));
  blitzLog.debug("Floket challenge created", { userId, type: challenge.type });
  return { question: challenge.q, type: challenge.type };
}

export function verifyFloketAnswer(
  userId: number,
  answer: string
): { ok: boolean; message: string; remaining?: number } {
  const row = db
    .prepare("SELECT * FROM floket_challenges WHERE user_id = ?")
    .get(userId) as
    | { answer: string; attempts: number; created_at: number; challenge: string }
    | undefined;

  if (!row) {
    return { ok: false, message: "No active Floket challenge. Type /start again." };
  }

  const age = Math.floor(Date.now() / 1000) - row.created_at;
  if (age > LIMITS.floketExpirySeconds) {
    db.prepare("DELETE FROM floket_challenges WHERE user_id = ?").run(userId);
    return { ok: false, message: "Floket challenge expired. Type /start to try again." };
  }

  const attempts = row.attempts + 1;
  db.prepare("UPDATE floket_challenges SET attempts = ? WHERE user_id = ?").run(
    attempts,
    userId
  );

  if (attempts > LIMITS.floketMaxAttempts) {
    db.prepare("DELETE FROM floket_challenges WHERE user_id = ?").run(userId);
    blitzLog.warn("Floket locked out", { userId });
    return {
      ok: false,
      message: "Too many failed Floket attempts. Wait a moment and /start again.",
    };
  }

  const normalized = normalizeAnswer(answer);
  if (normalized === row.answer) {
    db.prepare("DELETE FROM floket_challenges WHERE user_id = ?").run(userId);
    blitzLog.info("Floket passed", { userId, attempts });
    return { ok: true, message: "Floket verification passed ✅" };
  }

  // Soft match: numeric only
  if (/^\d+$/.test(row.answer) && normalized.replace(/\s/g, "") === row.answer) {
    db.prepare("DELETE FROM floket_challenges WHERE user_id = ?").run(userId);
    return { ok: true, message: "Floket verification passed ✅" };
  }

  return {
    ok: false,
    message: `Wrong answer. Attempts left: ${LIMITS.floketMaxAttempts - attempts}`,
    remaining: LIMITS.floketMaxAttempts - attempts,
  };
}

export function hasPendingFloket(userId: number): boolean {
  const row = db
    .prepare("SELECT 1 FROM floket_challenges WHERE user_id = ?")
    .get(userId);
  return !!row;
}

export function clearFloket(userId: number): void {
  db.prepare("DELETE FROM floket_challenges WHERE user_id = ?").run(userId);
}

export function getFloketStats(): { pending: number } {
  const pending = (
    db.prepare("SELECT COUNT(*) as c FROM floket_challenges").get() as any
  ).c;
  return { pending };
}
