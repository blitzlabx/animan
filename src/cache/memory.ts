/**
 * In-memory TTL cache + rate limiter
 * Blitz (@blitzlabx) — Animan
 */

import { CacheEntry, RateLimitBucket } from "../types";

export class BlitzCache {
  private store = new Map<string, CacheEntry>();
  private maxEntries: number;

  constructor(maxEntries = 2000) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = 5 * 60 * 1000): void {
    if (this.store.size >= this.maxEntries) {
      // Evict oldest ~10%
      const keys = Array.from(this.store.keys()).slice(0, Math.ceil(this.maxEntries * 0.1));
      for (const k of keys) this.store.delete(k);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  /** Namespace helper */
  ns(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }
}

export const blitzCache = new BlitzCache(2500);

/**
 * Token-bucket rate limiter per user
 */
export class BlitzRateLimiter {
  private buckets = new Map<number, RateLimitBucket>();
  private maxTokens: number;
  private refillPerSecond: number;

  constructor(maxTokens = 12, refillPerSecond = 0.4) {
    this.maxTokens = maxTokens;
    this.refillPerSecond = refillPerSecond;
  }

  private refill(bucket: RateLimitBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      this.maxTokens,
      bucket.tokens + elapsed * this.refillPerSecond
    );
    bucket.lastRefill = now;
  }

  /** Returns true if allowed */
  tryConsume(userId: number, cost = 1): boolean {
    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: Date.now() };
      this.buckets.set(userId, bucket);
    }
    this.refill(bucket);
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return true;
    }
    return false;
  }

  remaining(userId: number): number {
    let bucket = this.buckets.get(userId);
    if (!bucket) return this.maxTokens;
    this.refill(bucket);
    return Math.floor(bucket.tokens);
  }

  reset(userId: number): void {
    this.buckets.delete(userId);
  }

  /** Cleanup idle buckets (call periodically) */
  cleanup(maxAgeMs = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, b] of this.buckets) {
      if (now - b.lastRefill > maxAgeMs) this.buckets.delete(id);
    }
  }
}

export const blitzRateLimiter = new BlitzRateLimiter(15, 0.5);

/**
 * Session store (in-memory, per-user)
 */
import { UserSession } from "../types";

export class BlitzSessionStore {
  private sessions = new Map<number, UserSession>();
  private ttlMs: number;

  constructor(ttlMs = 30 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  get(userId: number): UserSession {
    let s = this.sessions.get(userId);
    if (!s || Date.now() - s.createdAt > this.ttlMs) {
      s = { createdAt: Date.now() };
      this.sessions.set(userId, s);
    }
    return s;
  }

  set(userId: number, patch: Partial<UserSession>): UserSession {
    const s = this.get(userId);
    Object.assign(s, patch, { createdAt: Date.now() });
    this.sessions.set(userId, s);
    return s;
  }

  clear(userId: number): void {
    this.sessions.delete(userId);
  }

  clearWaiting(userId: number): void {
    const s = this.get(userId);
    s.waitingFor = null;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (now - s.createdAt > this.ttlMs) this.sessions.delete(id);
    }
  }

  size(): number {
    return this.sessions.size;
  }
}

export const blitzSessions = new BlitzSessionStore();

// Periodic cleanup every 5 minutes
setInterval(() => {
  blitzSessions.cleanup();
  blitzRateLimiter.cleanup();
}, 5 * 60 * 1000).unref?.();
