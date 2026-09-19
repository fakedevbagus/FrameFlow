export const SNAP_GRID_MS = 500;
export const SNAP_THRESHOLD_MS = 250;

export function pixelsToMilliseconds(
  pixels: number,
  pixelsPerSecond: number,
): number {
  return pixelsPerSecond <= 0 ? 0 : pixels / pixelsPerSecond * 1000;
}

export function snapTimelineTime(
  timeMs: number,
  candidates: number[] = [],
): number {
  const safeTimeMs = Math.max(0, timeMs);
  const gridTimeMs = Math.round(safeTimeMs / SNAP_GRID_MS) * SNAP_GRID_MS;
  let bestTimeMs = gridTimeMs;
  let bestDistanceMs = Math.abs(gridTimeMs - safeTimeMs);

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate) || candidate < 0) {
      continue;
    }

    const distanceMs = Math.abs(candidate - safeTimeMs);

    if (distanceMs <= SNAP_THRESHOLD_MS && distanceMs < bestDistanceMs) {
      bestTimeMs = candidate;
      bestDistanceMs = distanceMs;
    }
  }

  return bestTimeMs;
}
