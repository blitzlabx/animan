/**
 * Extended string similarity — Blitz (@blitzlabx)
 */
export function blitzLevenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
export function blitzLevenshteinSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  return 1 - blitzLevenshtein(a, b) / Math.max(a.length, b.length, 1);
}
export function blitzJaro(a: string, b: string): number {
  if (a === b) return 1;
  const lenA = a.length, lenB = b.length;
  if (!lenA || !lenB) return 0;
  const matchDist = Math.floor(Math.max(lenA, lenB) / 2) - 1;
  const aMatches = new Array(lenA).fill(false);
  const bMatches = new Array(lenB).fill(false);
  let matches = 0, transpositions = 0;
  for (let i = 0; i < lenA; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, lenB);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true; bMatches[j] = true; matches++; break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  for (let i = 0; i < lenA; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  return (matches / lenA + matches / lenB + (matches - transpositions / 2) / matches) / 3;
}
export function blitzJaroWinkler(a: string, b: string, p = 0.1): number {
  const jaro = blitzJaro(a, b);
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i++) { if (a[i] === b[i]) prefix++; else break; }
  return jaro + prefix * p * (1 - jaro);
}
export function blitzNgrams(s: string, n = 3): Map<string, number> {
  const map = new Map<string, number>();
  const padded = " ".repeat(n - 1) + s + " ".repeat(n - 1);
  for (let i = 0; i < padded.length - n + 1; i++) {
    const g = padded.slice(i, i + n);
    map.set(g, (map.get(g) || 0) + 1);
  }
  return map;
}
export function blitzNgramCosine(a: string, b: string, n = 3): number {
  const A = blitzNgrams(a, n), B = blitzNgrams(b, n);
  let dot = 0, normA = 0, normB = 0;
  for (const [, v] of A) normA += v * v;
  for (const [, v] of B) normB += v * v;
  for (const [k, v] of A) if (B.has(k)) dot += v * (B.get(k) as number);
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
export function blitzHybridSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().trim(), nb = b.toLowerCase().trim();
  if (na === nb) return 1;
  return blitzJaroWinkler(na, nb) * 0.4 + blitzNgramCosine(na, nb, 3) * 0.35 + blitzLevenshteinSimilarity(na, nb) * 0.25;
}
export function blitzRankBySimilarity(query: string, candidates: string[], limit = 10) {
  return candidates.map((text) => ({ text, score: blitzHybridSimilarity(query, text) }))
    .filter((x) => x.score > 0.25).sort((a, b) => b.score - a.score).slice(0, limit);
}
export function blitzSoundex(s: string): string {
  const map: Record<string, string> = { b:"1",f:"1",p:"1",v:"1",c:"2",g:"2",j:"2",k:"2",q:"2",s:"2",x:"2",z:"2",d:"3",t:"3",l:"4",m:"5",n:"5",r:"6" };
  const clean = s.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return "0000";
  let code = clean[0].toUpperCase(), prev = map[clean[0]] || "";
  for (let i = 1; i < clean.length && code.length < 4; i++) {
    const c = map[clean[i]] || "";
    if (c && c !== prev) code += c;
    prev = c || prev;
  }
  return (code + "0000").slice(0, 4);
}
