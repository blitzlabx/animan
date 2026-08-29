/**
 * Animan core types
 * Crafted by Blitz (@blitzlabx)
 */

export type ContentLanguage = "sub" | "dub" | "raw";
export type MediaType = "anime" | "manga";
export type AnimeProviderKey =
  | "allmanga"
  | "gogoanime"
  | "anikoto"
  | "megaplay"
  | "animeparadise";
export type MangaProviderKey = "mangadex" | "weebcentral" | "mangapill";
export type ProviderKey = AnimeProviderKey | MangaProviderKey;

export interface BlitzUser {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  is_banned: number;
  ban_reason: string | null;
  is_verified: number;
  floket_score: number;
  downloads: number;
  last_active: number | null;
  created_at: number;
  notes: string | null;
  favorites?: string;
  history?: string;
  search_count?: number;
  is_premium?: number;
}

export interface UserSession {
  mode?: MediaType;
  provider?: ProviderKey;
  lastQuery?: string;
  lastResults?: SearchResultItem[];
  lastUnits?: ContentUnitItem[];
  page?: number;
  waitingFor?: "search" | "ban" | "unban" | "userinfo" | "broadcast" | "notes" | null;
  selectedMediaId?: string;
  selectedUnitId?: string;
  language?: ContentLanguage;
  createdAt: number;
}

export interface SearchResultItem {
  id: string;
  title: string;
  thumbnailUrl?: string;
  year?: number;
  catalogType?: string;
  providerId: string;
  score?: number;
}

export interface ContentUnitItem {
  id: string;
  title: string;
  number: number;
  availableLanguages?: ContentLanguage[];
  thumbnailUrl?: string;
  isFiller?: boolean;
  isRecap?: boolean;
}

export interface StreamPayload {
  sourceUrl: string;
  isHLS: boolean;
  quality: string;
  language?: ContentLanguage;
  headers?: Record<string, string>;
  subtitles?: SubtitleTrack[];
}

export interface SubtitleTrack {
  url: string;
  language: string;
  label: string;
  format?: "vtt" | "srt" | "ass";
}

export interface MangaPagePayload {
  imageUrls: string[];
  headers?: Record<string, string>;
}

export interface DownloadLogEntry {
  id: number;
  user_id: number;
  media_type: string;
  title: string;
  unit_number: number;
  provider: string;
  created_at: number;
}

export interface BotStats {
  totalUsers: number;
  banned: number;
  verified: number;
  downloads: number;
  activeToday: number;
  searchesToday: number;
  maintenance: boolean;
}

export interface FloketChallenge {
  question: string;
  answer: string;
  attempts: number;
  created_at: number;
}

export interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

export interface BroadcastJob {
  id: string;
  adminId: number;
  total: number;
  sent: number;
  failed: number;
  status: "running" | "done" | "cancelled";
  startedAt: number;
}

export interface RankingWeights {
  titleMatch: number;
  yearProximity: number;
  popularity: number;
  providerPreference: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  titleMatch: 0.55,
  yearProximity: 0.15,
  popularity: 0.2,
  providerPreference: 0.1,
};

export interface ProviderMeta {
  id: ProviderKey;
  label: string;
  type: MediaType;
  languages: ContentLanguage[];
  hasSubtitles: boolean;
  priority: number;
}

export const ANIME_PROVIDER_META: ProviderMeta[] = [
  { id: "allmanga", label: "AllManga", type: "anime", languages: ["sub", "dub"], hasSubtitles: false, priority: 10 },
  { id: "megaplay", label: "MegaPlay", type: "anime", languages: ["sub", "dub"], hasSubtitles: true, priority: 9 },
  { id: "anikoto", label: "Anikoto", type: "anime", languages: ["sub", "dub"], hasSubtitles: true, priority: 8 },
  { id: "gogoanime", label: "Gogoanime", type: "anime", languages: ["sub"], hasSubtitles: false, priority: 7 },
  { id: "animeparadise", label: "AnimeParadise", type: "anime", languages: ["sub"], hasSubtitles: true, priority: 6 },
];

export const MANGA_PROVIDER_META: ProviderMeta[] = [
  { id: "mangadex", label: "MangaDex", type: "manga", languages: ["sub"], hasSubtitles: false, priority: 10 },
  { id: "weebcentral", label: "WeebCentral", type: "manga", languages: ["sub"], hasSubtitles: false, priority: 8 },
  { id: "mangapill", label: "MangaPill", type: "manga", languages: ["sub"], hasSubtitles: false, priority: 7 },
];
