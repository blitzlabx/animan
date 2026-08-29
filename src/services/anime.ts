/**
 * Anime & Manga service — anime-sdk integration
 * Peak features by Blitz (@blitzlabx)
 */
import {
  HttpClient,
  AllmangaProvider,
  GogoanimeProvider,
  AnikotoProvider,
  MegaPlayProvider,
  AnimeParadiseProvider,
  MangadexProvider,
  WeebcentralProvider,
  MangapillProvider,
  AnilistMeta,
  MappingClient,
} from "anime-sdk";
import { blitzCache } from "../cache/memory";
import { blitzRankResults, blitzExtractYear, blitzDeduplicateResults } from "../algorithms/ranking";
import { blitzLog, blitzTime } from "../logging/logger";
import { LIMITS } from "../constants";
import type {
  AnimeProviderKey,
  MangaProviderKey,
  ContentLanguage,
  SearchResultItem,
  ContentUnitItem,
  StreamPayload,
  MangaPagePayload,
} from "../types";

const http = new HttpClient({ timeoutMs: 28_000 });

export const animeProviders: Record<AnimeProviderKey, any> = {
  allmanga: new AllmangaProvider(http),
  gogoanime: new GogoanimeProvider(http),
  anikoto: new AnikotoProvider(http),
  megaplay: new MegaPlayProvider(http),
  animeparadise: new AnimeParadiseProvider(http),
};

export const mangaProviders: Record<MangaProviderKey, any> = {
  mangadex: new MangadexProvider(http),
  weebcentral: new WeebcentralProvider(http),
  mangapill: new MangapillProvider(http),
};

const mapping = new MappingClient(http);
export const anilistMeta = new AnilistMeta(http, { mappingClient: mapping });

function toSearchItems(raw: any[], providerId: string): SearchResultItem[] {
  return (raw || []).map((r) => ({
    id: r.id,
    title: r.title || "Unknown",
    thumbnailUrl: r.thumbnailUrl,
    year: r.year,
    catalogType: r.catalogType,
    providerId,
    score: undefined,
  }));
}

function toUnitItems(raw: any[]): ContentUnitItem[] {
  return (raw || []).map((u) => ({
    id: u.id,
    title: u.title || `Unit ${u.number}`,
    number: typeof u.number === "number" ? u.number : parseFloat(u.number) || 0,
    availableLanguages: u.availableLanguages,
    thumbnailUrl: u.thumbnailUrl,
    isFiller: u.isFiller,
    isRecap: u.isRecap,
  }));
}

export async function searchAnime(
  query: string,
  provider: AnimeProviderKey = "allmanga"
): Promise<SearchResultItem[]> {
  const cacheKey = blitzCache.ns("search", `anime:${provider}:${query.toLowerCase()}`);
  const cached = blitzCache.get<SearchResultItem[]>(cacheKey);
  if (cached) return cached;

  return blitzTime(`searchAnime:${provider}`, async () => {
    const { cleanQuery, year } = blitzExtractYear(query);
    const p = animeProviders[provider];
    const raw = await p.search(cleanQuery);
    let items = toSearchItems(raw, provider);
    items = blitzRankResults(cleanQuery, items, { queryYear: year });
    items = blitzDeduplicateResults(items);
    blitzCache.set(cacheKey, items, LIMITS.cacheSearchTtlMs);
    blitzLog.info("Anime search", { provider, query: cleanQuery, count: items.length });
    return items;
  });
}

export async function searchManga(
  query: string,
  provider: MangaProviderKey = "mangadex"
): Promise<SearchResultItem[]> {
  const cacheKey = blitzCache.ns("search", `manga:${provider}:${query.toLowerCase()}`);
  const cached = blitzCache.get<SearchResultItem[]>(cacheKey);
  if (cached) return cached;

  return blitzTime(`searchManga:${provider}`, async () => {
    const { cleanQuery, year } = blitzExtractYear(query);
    const p = mangaProviders[provider];
    const raw = await p.search(cleanQuery);
    let items = toSearchItems(raw, provider);
    items = blitzRankResults(cleanQuery, items, { queryYear: year });
    items = blitzDeduplicateResults(items);
    blitzCache.set(cacheKey, items, LIMITS.cacheSearchTtlMs);
    blitzLog.info("Manga search", { provider, query: cleanQuery, count: items.length });
    return items;
  });
}

export async function getEpisodes(
  mediaUrn: string,
  provider: AnimeProviderKey
): Promise<ContentUnitItem[]> {
  const cacheKey = blitzCache.ns("units", `anime:${provider}:${mediaUrn}`);
  const cached = blitzCache.get<ContentUnitItem[]>(cacheKey);
  if (cached) return cached;

  return blitzTime(`getEpisodes:${provider}`, async () => {
    const p = animeProviders[provider];
    const raw = await p.fetchContentUnits(mediaUrn);
    const items = toUnitItems(raw);
    items.sort((a, b) => a.number - b.number);
    blitzCache.set(cacheKey, items, LIMITS.cacheUnitsTtlMs);
    return items;
  });
}

export async function getChapters(
  mediaUrn: string,
  provider: MangaProviderKey
): Promise<ContentUnitItem[]> {
  const cacheKey = blitzCache.ns("units", `manga:${provider}:${mediaUrn}`);
  const cached = blitzCache.get<ContentUnitItem[]>(cacheKey);
  if (cached) return cached;

  return blitzTime(`getChapters:${provider}`, async () => {
    const p = mangaProviders[provider];
    const raw = await p.fetchContentUnits(mediaUrn);
    const items = toUnitItems(raw);
    items.sort((a, b) => a.number - b.number);
    blitzCache.set(cacheKey, items, LIMITS.cacheUnitsTtlMs);
    return items;
  });
}

export async function resolveAnimeStream(
  unitUrn: string,
  provider: AnimeProviderKey,
  language: ContentLanguage = "sub"
): Promise<{ type: "video"; streams: StreamPayload[] } | { type: "empty" }> {
  return blitzTime(`resolveAnime:${provider}`, async () => {
    const p = animeProviders[provider];
    const result = await p.resolveStream(unitUrn, language);
    if (!result || result.type !== "video" || !result.streams?.length) {
      return { type: "empty" };
    }
    const streams: StreamPayload[] = result.streams.map((s: any) => ({
      sourceUrl: s.sourceUrl,
      isHLS: !!s.isHLS,
      quality: s.quality || "auto",
      language: s.language || language,
      headers: s.headers,
      subtitles: s.subtitles,
    }));
    // Prefer higher quality first
    const order = ["1080p", "720p", "480p", "360p", "auto"];
    streams.sort(
      (a, b) => order.indexOf(a.quality) - order.indexOf(b.quality)
    );
    return { type: "video", streams };
  });
}

export async function resolveMangaPages(
  unitUrn: string,
  provider: MangaProviderKey
): Promise<{ type: "manga"; pages: MangaPagePayload } | { type: "empty" }> {
  return blitzTime(`resolveManga:${provider}`, async () => {
    const p = mangaProviders[provider];
    const result = await p.resolveStream(unitUrn);
    if (!result || result.type !== "manga" || !result.pages?.imageUrls?.length) {
      return { type: "empty" };
    }
    return {
      type: "manga",
      pages: {
        imageUrls: result.pages.imageUrls,
        headers: result.pages.headers,
      },
    };
  });
}

/** Multi-provider search with merge + rank */
export async function searchAnimeMulti(
  query: string,
  providers: AnimeProviderKey[] = ["allmanga", "megaplay"]
): Promise<SearchResultItem[]> {
  const results = await Promise.allSettled(
    providers.map((p) => searchAnime(query, p))
  );
  let merged: SearchResultItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") merged = merged.concat(r.value);
  }
  const { cleanQuery, year } = blitzExtractYear(query);
  merged = blitzRankResults(cleanQuery, merged, { queryYear: year });
  return blitzDeduplicateResults(merged);
}

export async function searchViaAnilist(query: string): Promise<SearchResultItem[]> {
  const cacheKey = blitzCache.ns("search", `anilist:${query.toLowerCase()}`);
  const cached = blitzCache.get<SearchResultItem[]>(cacheKey);
  if (cached) return cached;

  return blitzTime("searchAnilist", async () => {
    const raw = await anilistMeta.search(query);
    const items = toSearchItems(raw, "anilist" as any);
    blitzCache.set(cacheKey, items, LIMITS.cacheSearchTtlMs);
    return items;
  });
}

export async function getAnilistInfo(anilistUrn: string) {
  const cacheKey = blitzCache.ns("meta", anilistUrn);
  const cached = blitzCache.get<any>(cacheKey);
  if (cached) return cached;
  const info = await anilistMeta.fetchMediaInfo(anilistUrn);
  blitzCache.set(cacheKey, info, 10 * 60 * 1000);
  return info;
}

export async function resolveViaAnilist(
  anilistUrn: string,
  episode: number,
  provider: AnimeProviderKey = "allmanga",
  language: ContentLanguage = "sub"
) {
  const content = animeProviders[provider];
  return anilistMeta.resolveStream(anilistUrn, episode, content, language);
}

export async function browseTrending(limit = 10): Promise<any[]> {
  const cacheKey = blitzCache.ns("browse", `trending:${limit}`);
  const cached = blitzCache.get<any[]>(cacheKey);
  if (cached) return cached;
  try {
    const list = await anilistMeta.browse("trending", {
      catalogType: "ANIME",
      perPage: limit,
    });
    blitzCache.set(cacheKey, list, 10 * 60 * 1000);
    return list || [];
  } catch (e) {
    blitzLog.error("browseTrending failed", { err: String(e) });
    return [];
  }
}

export async function browseSeasonal(
  season: string,
  year: number,
  limit = 10
): Promise<any[]> {
  const cacheKey = blitzCache.ns("browse", `seasonal:${season}:${year}:${limit}`);
  const cached = blitzCache.get<any[]>(cacheKey);
  if (cached) return cached;
  try {
    const list = await anilistMeta.browse("seasonal", {
      season: season as any,
      year,
      perPage: limit,
    });
    blitzCache.set(cacheKey, list, 15 * 60 * 1000);
    return list || [];
  } catch (e) {
    blitzLog.error("browseSeasonal failed", { err: String(e) });
    return [];
  }
}

export async function browseTop(limit = 10): Promise<any[]> {
  const cacheKey = blitzCache.ns("browse", `top:${limit}`);
  const cached = blitzCache.get<any[]>(cacheKey);
  if (cached) return cached;
  try {
    const list = await anilistMeta.browse("top", {
      catalogType: "ANIME",
      perPage: limit,
    });
    blitzCache.set(cacheKey, list, 15 * 60 * 1000);
    return list || [];
  } catch {
    return [];
  }
}

/** Cheap tracks if provider supports it */
export async function fetchTracks(
  unitUrn: string,
  provider: AnimeProviderKey,
  language: ContentLanguage = "sub"
) {
  const p = animeProviders[provider];
  if (typeof p.fetchUnitTracks !== "function") return null;
  try {
    return await p.fetchUnitTracks(unitUrn, language);
  } catch {
    return null;
  }
}

export function listAnimeProviders(): AnimeProviderKey[] {
  return Object.keys(animeProviders) as AnimeProviderKey[];
}

export function listMangaProviders(): MangaProviderKey[] {
  return Object.keys(mangaProviders) as MangaProviderKey[];
}
