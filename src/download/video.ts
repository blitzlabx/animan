/**
 * Video / manga download helpers for Animan
 * By Blitz (@blitzlabx)
 *
 * Uses anime-sdk download utilities when available, with fallbacks
 * for direct URL streaming and progress reporting.
 */
import fs from "fs";
import path from "path";
import { blitzLog } from "../logging/logger";
import { blitzFormatBytes, blitzSleep } from "../utils/text";
import type { StreamPayload, MangaPagePayload } from "../types";

export interface DownloadProgress {
  phase: string;
  detail?: string;
  percent?: number;
  downloaded?: number;
  total?: number;
}

export type ProgressCallback = (p: DownloadProgress) => void;

const DOWNLOAD_DIR = path.join(process.cwd(), "data", "downloads");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Attempt to download a video stream to disk.
 * Prefers anime-sdk downloadVideo if present; otherwise fetches direct MP4.
 */
export async function blitzDownloadVideo(
  streams: StreamPayload[],
  outputName: string,
  onProgress?: ProgressCallback
): Promise<{ outputPath: string; fileSize: number; quality: string }> {
  ensureDir(DOWNLOAD_DIR);
  const safeName = outputName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const outputPath = path.join(DOWNLOAD_DIR, safeName.endsWith(".mp4") ? safeName : `${safeName}.mp4`);

  // Try anime-sdk built-in if available
  try {
    const sdk = await import("anime-sdk");
    if (typeof (sdk as any).downloadVideo === "function") {
      onProgress?.({ phase: "sdk", detail: "Using anime-sdk downloadVideo" });
      const result = await (sdk as any).downloadVideo(streams, outputPath, {
        onProgress: (p: any) => onProgress?.(p),
      });
      return {
        outputPath: result.outputPath || outputPath,
        fileSize: result.fileSize || (fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0),
        quality: streams[0]?.quality || "auto",
      };
    }
  } catch (e) {
    blitzLog.debug("sdk downloadVideo unavailable, using fallback", { err: String(e) });
  }

  // Fallback: pick best non-HLS direct URL, or first stream
  const direct = streams.find((s) => !s.isHLS) || streams[0];
  if (!direct) throw new Error("No streams available");

  if (direct.isHLS) {
    // For HLS without ffmpeg pipeline we return the URL for client-side play
    onProgress?.({ phase: "hls", detail: "HLS stream — returning URL only" });
    return { outputPath: direct.sourceUrl, fileSize: 0, quality: direct.quality };
  }

  onProgress?.({ phase: "fetch", detail: `Downloading ${direct.quality}` });
  const headers: Record<string, string> = { ...(direct.headers || {}) };
  if (!headers["User-Agent"]) {
    headers["User-Agent"] = "Mozilla/5.0 (compatible; Animan/1.2; +blitzlabx)";
  }

  const res = await fetch(direct.sourceUrl, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching stream`);

  const total = Number(res.headers.get("content-length") || 0);
  const reader = (res.body as any)?.getReader?.();
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outputPath, buf);
    onProgress?.({ phase: "done", percent: 100, downloaded: buf.length, total: buf.length });
    return { outputPath, fileSize: buf.length, quality: direct.quality };
  }

  const chunks: Buffer[] = [];
  let downloaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    chunks.push(chunk);
    downloaded += chunk.length;
    if (total > 0) {
      onProgress?.({
        phase: "download",
        percent: Math.min(99, Math.round((downloaded / total) * 100)),
        downloaded,
        total,
        detail: `${blitzFormatBytes(downloaded)} / ${blitzFormatBytes(total)}`,
      });
    }
  }
  const buf = Buffer.concat(chunks);
  fs.writeFileSync(outputPath, buf);
  onProgress?.({ phase: "done", percent: 100, downloaded: buf.length, total: buf.length });
  blitzLog.info("Video downloaded", { path: outputPath, size: buf.length });
  return { outputPath, fileSize: buf.length, quality: direct.quality };
}

/**
 * Download manga pages into a simple ordered list / optional zip-like folder
 */
export async function blitzDownloadMangaPages(
  pages: MangaPagePayload,
  chapterName: string,
  onProgress?: ProgressCallback
): Promise<{ dir: string; pageCount: number; files: string[] }> {
  ensureDir(DOWNLOAD_DIR);
  const safe = chapterName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  const dir = path.join(DOWNLOAD_DIR, `manga_${safe}_${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });

  const files: string[] = [];
  const total = pages.imageUrls.length;
  const headers = pages.headers || {
    "User-Agent": "Mozilla/5.0 (compatible; Animan/1.2; +blitzlabx)",
  };

  for (let i = 0; i < pages.imageUrls.length; i++) {
    const url = pages.imageUrls[i];
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const ext = url.includes(".png") ? "png" : url.includes(".webp") ? "webp" : "jpg";
      const filePath = path.join(dir, `page_${String(i + 1).padStart(3, "0")}.${ext}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filePath, buf);
      files.push(filePath);
      onProgress?.({
        phase: "page",
        downloaded: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
        detail: `Page ${i + 1}/${total}`,
      });
    } catch (e) {
      blitzLog.warn("page download failed", { i, err: String(e) });
    }
    await blitzSleep(50);
  }

  return { dir, pageCount: files.length, files };
}

export function blitzCleanupDownloads(maxAgeMs = 24 * 60 * 60 * 1000): number {
  if (!fs.existsSync(DOWNLOAD_DIR)) return 0;
  let removed = 0;
  const now = Date.now();
  for (const name of fs.readdirSync(DOWNLOAD_DIR)) {
    const full = path.join(DOWNLOAD_DIR, name);
    try {
      const st = fs.statSync(full);
      if (now - st.mtimeMs > maxAgeMs) {
        if (st.isDirectory()) fs.rmSync(full, { recursive: true, force: true });
        else fs.unlinkSync(full);
        removed++;
      }
    } catch { /* ignore */ }
  }
  return removed;
}

// Periodic cleanup every hour
setInterval(() => {
  const n = blitzCleanupDownloads();
  if (n > 0) blitzLog.info("Cleaned downloads", { removed: n });
}, 60 * 60 * 1000).unref?.();
