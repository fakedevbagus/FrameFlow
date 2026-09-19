export interface PlaybackStep {
  timeMs: number;
  reachedEnd: boolean;
}

export function frameDurationMs(frameRate: number): number {
  if (!Number.isFinite(frameRate) || frameRate <= 0) {
    return 1000 / 30;
  }

  return 1000 / frameRate;
}

export function stepPlaybackTime(
  currentTimeMs: number,
  deltaMs: number,
  durationMs: number,
): PlaybackStep {
  const safeDurationMs = Math.max(0, durationMs);
  const safeTimeMs = Math.min(Math.max(0, currentTimeMs), safeDurationMs);
  const safeDeltaMs = Math.max(0, deltaMs);
  const nextTimeMs = Math.min(safeDurationMs, safeTimeMs + safeDeltaMs);

  return {
    timeMs: nextTimeMs,
    reachedEnd: nextTimeMs >= safeDurationMs,
  };
}

export function stepFrame(
  currentTimeMs: number,
  frameRate: number,
  durationMs: number,
  direction: -1 | 1,
): number {
  const deltaMs = frameDurationMs(frameRate) * direction;
  const nextTimeMs = currentTimeMs + deltaMs;

  return Math.min(
    Math.max(0, nextTimeMs),
    Math.max(0, durationMs),
  );
}
