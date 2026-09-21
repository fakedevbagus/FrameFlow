export interface PlaybackStep {
  timeMs: number;
  reachedEnd: boolean;
}

export const PLAYBACK_UI_UPDATE_INTERVAL_MS = 33;

export function shouldPublishPlaybackTime(
  currentTimestampMs: number,
  lastPublishedTimestampMs: number | null,
  intervalMs = PLAYBACK_UI_UPDATE_INTERVAL_MS,
): boolean {
  if (!Number.isFinite(currentTimestampMs)) {
    return false;
  }

  if (
    lastPublishedTimestampMs === null ||
    !Number.isFinite(lastPublishedTimestampMs)
  ) {
    return true;
  }

  const safeIntervalMs = Number.isFinite(intervalMs)
    ? Math.max(0, intervalMs)
    : PLAYBACK_UI_UPDATE_INTERVAL_MS;

  return currentTimestampMs - lastPublishedTimestampMs >= safeIntervalMs;
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
