import type { Clip, Track } from "../project/domain";

export const DISSOLVE_TRANSITION_TYPE = "dissolve" as const;
export const DEFAULT_DISSOLVE_DURATION_MS = 300;
export const MIN_DISSOLVE_DURATION_MS = 50;
export const MAX_DISSOLVE_DURATION_MS = 2000;

export interface ClipTransition {
  type: typeof DISSOLVE_TRANSITION_TYPE;
  durationMs: number;
}

export function normalizeClipTransition(
  transition: ClipTransition | null | undefined,
): ClipTransition | undefined {
  if (!transition || transition.type !== DISSOLVE_TRANSITION_TYPE) {
    return undefined;
  }

  if (!Number.isFinite(transition.durationMs)) {
    return undefined;
  }

  return {
    type: DISSOLVE_TRANSITION_TYPE,
    durationMs: Math.min(
      MAX_DISSOLVE_DURATION_MS,
      Math.max(
        MIN_DISSOLVE_DURATION_MS,
        Math.round(transition.durationMs),
      ),
    ),
  };
}

export function getClipTransition(
  transition: ClipTransition | null | undefined,
): ClipTransition | undefined {
  return normalizeClipTransition(transition);
}

export function getNextClipForTransition(
  track: Track,
  clipId: string,
): Clip | null {
  const orderedClips = [...track.clips].sort(
    (left, right) => left.timelineStartMs - right.timelineStartMs,
  );
  const index = orderedClips.findIndex((clip) => clip.id === clipId);

  return index === -1 ? null : orderedClips[index + 1] ?? null;
}

export function getClipEndMs(clip: Clip): number | null {
  if (clip.sourceEndMs === null) {
    return null;
  }

  return clip.timelineStartMs + Math.max(0, clip.sourceEndMs - clip.sourceStartMs);
}

export function isTransitionAdjacent(
  outgoingClip: Clip,
  incomingClip: Clip,
): boolean {
  const outgoingEndMs = getClipEndMs(outgoingClip);

  return outgoingEndMs !== null && outgoingEndMs === incomingClip.timelineStartMs;
}

export function getDissolveOpacities(
  timelineTimeMs: number,
  outgoingClip: Clip,
  incomingClip: Clip,
  transition: ClipTransition,
): { outgoingOpacity: number; incomingOpacity: number } | null {
  const normalized = normalizeClipTransition(transition);
  const outgoingEndMs = getClipEndMs(outgoingClip);

  if (
    !normalized ||
    outgoingEndMs === null ||
    !isTransitionAdjacent(outgoingClip, incomingClip)
  ) {
    return null;
  }

  const transitionStartMs = outgoingEndMs - normalized.durationMs;

  if (
    timelineTimeMs < transitionStartMs ||
    timelineTimeMs >= outgoingEndMs
  ) {
    return null;
  }

  const progress = Math.min(
    1,
    Math.max(
      0,
      (timelineTimeMs - transitionStartMs) / normalized.durationMs,
    ),
  );

  return {
    outgoingOpacity: 1 - progress,
    incomingOpacity: progress,
  };
}
