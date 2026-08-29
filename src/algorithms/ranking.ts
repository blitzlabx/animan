/**
 * Search ranking & scoring algorithms
 * Designed by Blitz (@blitzlabx) for Animan
 *
 * Multi-signal ranking:
 *  1. Fuzzy title similarity (Dice + Jaccard + prefix)
 *  2. Year proximity
 *  3. Provider priority
 *  4. Optional popularity boost
 */

import {
  SearchResultItem,
  RankingWeights,
  DEFAULT_RANKING_WEIGHTS,
  ANIME_PROVIDER_META,
  MANGA_PROVIDER_META,
} from "../types";

/** Normalize title for comparison */
export function blitzNormalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenize */
export function blitzTokenize(s: string): string[] {
  return blitzNormalizeTitle(s).split(" ").filter(Boolean);
}

/** Dice coefficient (bigrams) */
export function blitzDiceCoefficient(a: string, b: string): number {
  const na = blitzNormalizeTitle(a);
  const nb = blitzNormalizeTitle(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return na === nb ? 1 : 0;

  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) || 0) + 1);
    }
    return m;
  };

  const A = bigrams(na);
  const B = bigrams(nb);
  let intersection = 0;
  for (const [bg, count] of A) {
    intersection += Math.min(count, B.get(bg) || 0);
  }
  return (2 * intersection) / (na.length - 1 + (nb.length - 1));
}

/** Token Jaccard */
export function blitzTokenJaccard(a: string, b: string): number {
  const ta = new Set(blitzTokenize(a));
  const tb = new Set(blitzTokenize(b));
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Prefix / starts-with boost */
export function blitzPrefixScore(query: string, title: string): number {
  const nq = blitzNormalizeTitle(query);
  const nt = blitzNormalizeTitle(title);
  if (nt.startsWith(nq)) return 1;
  if (nt.includes(nq)) return 0.6;
  const tokens = blitzTokenize(title);
  if (tokens.some((t) => t.startsWith(nq))) return 0.4;
  return 0;
}

/** Composite title similarity 0..1 */
export function blitzTitleSimilarity(query: string, title: string): number {
  const dice = blitzDiceCoefficient(query, title);
  const jaccard = blitzTokenJaccard(query, title);
  const prefix = blitzPrefixScore(query, title);
  // Weighted blend
  return dice * 0.45 + jaccard * 0.35 + prefix * 0.2;
}

/** Year proximity score 0..1 */
export function blitzYearScore(queryYear: number | undefined, resultYear: number | undefined): number {
  if (!queryYear || !resultYear) return 0.5; // neutral
  const diff = Math.abs(queryYear - resultYear);
  if (diff === 0) return 1;
  if (diff === 1) return 0.85;
  if (diff <= 3) return 0.6;
  if (diff <= 5) return 0.4;
  return 0.2;
}

/** Provider preference score */
export function blitzProviderScore(providerId: string): number {
  const all = [...ANIME_PROVIDER_META, ...MANGA_PROVIDER_META];
  const meta = all.find((p) => p.id === providerId);
  if (!meta) return 0.5;
  return meta.priority / 10;
}

/**
 * Score a single search result against a query.
 * Returns 0..1 composite score.
 */
export function blitzScoreResult(
  query: string,
  result: SearchResultItem,
  opts?: {
    queryYear?: number;
    weights?: RankingWeights;
  }
): number {
  const w = opts?.weights || DEFAULT_RANKING_WEIGHTS;
  const title = blitzTitleSimilarity(query, result.title);
  const year = blitzYearScore(opts?.queryYear, result.year);
  const provider = blitzProviderScore(result.providerId);
  const popularity = result.score != null ? Math.min(1, result.score / 100) : 0.5;

  return (
    title * w.titleMatch +
    year * w.yearProximity +
    popularity * w.popularity +
    provider * w.providerPreference
  );
}

/**
 * Rank and sort results. Mutates score field and returns sorted copy.
 */
export function blitzRankResults(
  query: string,
  results: SearchResultItem[],
  opts?: { queryYear?: number; weights?: RankingWeights; limit?: number }
): SearchResultItem[] {
  const scored = results.map((r) => ({
    ...r,
    score: blitzScoreResult(query, r, opts),
  }));
  scored.sort((a, b) => (b.score || 0) - (a.score || 0));
  if (opts?.limit) return scored.slice(0, opts.limit);
  return scored;
}

/**
 * Extract possible year from query string ("Frieren 2023")
 */
export function blitzExtractYear(query: string): { cleanQuery: string; year?: number } {
  const match = query.match(/\b(19|20)\d{2}\b/);
  if (!match) return { cleanQuery: query.trim() };
  const year = parseInt(match[0], 10);
  const cleanQuery = query.replace(match[0], "").replace(/\s+/g, " ").trim();
  return { cleanQuery, year };
}

/**
 * Deduplicate results by normalized title (keep highest score)
 */
export function blitzDeduplicateResults(results: SearchResultItem[]): SearchResultItem[] {
  const map = new Map<string, SearchResultItem>();
  for (const r of results) {
    const key = blitzNormalizeTitle(r.title);
    const existing = map.get(key);
    if (!existing || (r.score || 0) > (existing.score || 0)) {
      map.set(key, r);
    }
  }
  return Array.from(map.values());
}

/**
 * Smart query suggestions (simple edit-distance neighbors from known titles)
 */
export function blitzSuggestQueries(
  query: string,
  knownTitles: string[],
  max = 5
): string[] {
  const nq = blitzNormalizeTitle(query);
  const scored = knownTitles
    .map((t) => ({ t, s: blitzTitleSimilarity(nq, t) }))
    .filter((x) => x.s > 0.35 && x.s < 0.98)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => x.t);
  return scored;
}
