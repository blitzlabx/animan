/** Text helpers — Blitz (@blitzlabx) */
export function blitzEscapeMarkdownV1(text: string): string {
  return String(text).replace(/([_*`\[\]])/g, "\\$1");
}
export function blitzEscapeMarkdownV2(text: string): string {
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
export function blitzEscapeHtml(text: string): string {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
export function blitzTruncate(text: string, max = 60, suffix = "…"): string {
  if (text.length <= max) return text;
  return text.slice(0, max - suffix.length) + suffix;
}
export function blitzTitleCase(text: string): string {
  return text.toLowerCase().split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : "")).join(" ");
}
export function blitzSlugify(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export function blitzParseCommandArgs(text: string): { command: string; args: string } {
  const m = text.match(/^\/([a-zA-Z0-9_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/);
  if (!m) return { command: "", args: text };
  return { command: m[1].toLowerCase(), args: (m[2] || "").trim() };
}
export function blitzFormatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
export function blitzFormatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
export function blitzSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
export function blitzChunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
export function blitzUnique<T>(arr: T[], keyFn?: (x: T) => string): T[] {
  if (!keyFn) return [...new Set(arr)];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
export function blitzPickRandom<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}
export function blitzClamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
export function blitzSafeJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
