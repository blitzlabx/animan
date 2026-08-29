/**
 * Provider metadata & selection helpers
 * Animan by Blitz (@blitzlabx)
 */
import {
  ANIME_PROVIDER_META,
  MANGA_PROVIDER_META,
  AnimeProviderKey,
  MangaProviderKey,
  ProviderKey,
  ContentLanguage,
  ProviderMeta,
} from "../types";

export function blitzGetAnimeProviders(): ProviderMeta[] {
  return [...ANIME_PROVIDER_META].sort((a, b) => b.priority - a.priority);
}

export function blitzGetMangaProviders(): ProviderMeta[] {
  return [...MANGA_PROVIDER_META].sort((a, b) => b.priority - a.priority);
}

export function blitzIsAnimeProvider(id: string): id is AnimeProviderKey {
  return ANIME_PROVIDER_META.some((p) => p.id === id);
}

export function blitzIsMangaProvider(id: string): id is MangaProviderKey {
  return MANGA_PROVIDER_META.some((p) => p.id === id);
}

export function blitzProviderLabel(id: string): string {
  const all = [...ANIME_PROVIDER_META, ...MANGA_PROVIDER_META];
  return all.find((p) => p.id === id)?.label || id;
}

export function blitzProviderLanguages(id: string): ContentLanguage[] {
  const all = [...ANIME_PROVIDER_META, ...MANGA_PROVIDER_META];
  return all.find((p) => p.id === id)?.languages || ["sub"];
}

export function blitzBestAnimeProvider(): AnimeProviderKey {
  return blitzGetAnimeProviders()[0].id as AnimeProviderKey;
}

export function blitzBestMangaProvider(): MangaProviderKey {
  return blitzGetMangaProviders()[0].id as MangaProviderKey;
}

export function blitzRecommendProviders(
  type: "anime" | "manga",
  wantLang?: ContentLanguage
): ProviderKey[] {
  const list = type === "anime" ? blitzGetAnimeProviders() : blitzGetMangaProviders();
  if (!wantLang) return list.map((p) => p.id);
  return list.filter((p) => p.languages.includes(wantLang)).map((p) => p.id);
}

/** Human-readable capability blurb for a provider */
export function blitzProviderBlurb(id: string): string {
  const all = [...ANIME_PROVIDER_META, ...MANGA_PROVIDER_META];
  const p = all.find((x) => x.id === id);
  if (!p) return id;
  const langs = p.languages.join("/").toUpperCase();
  const subs = p.hasSubtitles ? " · subs" : "";
  return `${p.label} (${langs}${subs})`;
}
