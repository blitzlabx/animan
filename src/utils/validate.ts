/**
 * Input validation for Animan
 * By Blitz (@blitzlabx)
 */
import { LIMITS } from "../constants";
import { BlitzError } from "./errors";

export function blitzValidateQuery(q: string): string {
  const cleaned = q.trim().replace(/\s+/g, " ");
  if (!cleaned) throw new BlitzError("EMPTY_QUERY", "Empty query", "Please send a title to search.");
  if (cleaned.length > LIMITS.maxSearchQueryLength) {
    throw new BlitzError(
      "QUERY_TOO_LONG",
      `Query length ${cleaned.length}`,
      `Title too long (max ${LIMITS.maxSearchQueryLength} chars).`
    );
  }
  // Block obvious injection / spam patterns
  if (/https?:\/\//i.test(cleaned)) {
    throw new BlitzError("NO_URLS", "URLs not allowed in search", "Please search by title, not URL.");
  }
  return cleaned;
}

export function blitzValidateUserId(raw: string | number): number {
  const id = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
    throw new BlitzError("BAD_USER_ID", "Invalid user id", "Invalid user ID. Send a numeric Telegram ID.");
  }
  return id;
}

export function blitzValidatePage(page: number, total: number, pageSize: number): number {
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  if (page < 0) return 0;
  if (page > maxPage) return maxPage;
  return page;
}

export function blitzIsSafeCallbackData(data: string): boolean {
  if (!data || data.length > 64) return false;
  // Allow our known prefixes
  const allowed = /^(menu|provider|pick|page|ep|eppage|lang|quality|fav|admin|floket|check|seasonal|confirm|stream|openfav):/;
  return allowed.test(data) || data === "menu:home";
}
