/**
 * Episode / chapter list algorithms
 * Animan by Blitz (@blitzlabx)
 */
import type { ContentUnitItem } from "../types";

/** Sort units ascending by number, stable for equal numbers */
export function blitzSortUnits(units: ContentUnitItem[]): ContentUnitItem[] {
  return [...units].sort((a, b) => {
    if (a.number !== b.number) return a.number - b.number;
    return a.title.localeCompare(b.title);
  });
}

/** Filter fillers / recaps */
export function blitzFilterCanon(units: ContentUnitItem[], opts?: { hideFiller?: boolean; hideRecap?: boolean }): ContentUnitItem[] {
  return units.filter((u) => {
    if (opts?.hideFiller && u.isFiller) return false;
    if (opts?.hideRecap && u.isRecap) return false;
    return true;
  });
}

/** Find unit closest to target number */
export function blitzFindUnit(units: ContentUnitItem[], target: number): ContentUnitItem | undefined {
  if (!units.length) return undefined;
  let best = units[0];
  let bestDiff = Math.abs(best.number - target);
  for (const u of units) {
    const d = Math.abs(u.number - target);
    if (d < bestDiff) {
      best = u;
      bestDiff = d;
    }
  }
  return best;
}

/** Group into ranges for compact display e.g. 1-12, 13-24 */
export function blitzEpisodeRanges(units: ContentUnitItem[], rangeSize = 12): { label: string; startIdx: number; endIdx: number }[] {
  const sorted = blitzSortUnits(units);
  const ranges: { label: string; startIdx: number; endIdx: number }[] = [];
  for (let i = 0; i < sorted.length; i += rangeSize) {
    const slice = sorted.slice(i, i + rangeSize);
    const first = slice[0].number;
    const last = slice[slice.length - 1].number;
    ranges.push({
      label: first === last ? `Ep ${first}` : `Ep ${first}–${last}`,
      startIdx: i,
      endIdx: Math.min(i + rangeSize, sorted.length),
    });
  }
  return ranges;
}

/** Detect if numbering looks like absolute (high numbers) vs seasonal */
export function blitzLooksAbsolute(units: ContentUnitItem[]): boolean {
  if (units.length < 3) return false;
  const max = Math.max(...units.map((u) => u.number));
  return max > 50;
}
