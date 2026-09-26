import type { Clip, ClipTransition, Track } from "../project/domain";

export type { ClipTransition } from "../project/domain";

export const DISSOLVE_TRANSITION_TYPE = "dissolve" as const;
export const FADE_THROUGH_BLACK_TRANSITION_TYPE = "fade-through-black" as const;
export const DEFAULT_DISSOLVE_DURATION_MS = 300;
export const DEFAULT_FADE_THROUGH_BLACK_DURATION_MS = 300;
export const MIN_DISSOLVE_DURATION_MS = 50;
export const MAX_DISSOLVE_DURATION_MS = 2000;

export function normalizeClipTransition(
  transition: ClipTransition | null | undefined,
): ClipTransition | undefined {
  if (
    !transition ||
    (transition.type !== DISSOLVE_TRANSITION_TYPE &&
      transition.type !== FADE_THROUGH_BLACK_TRANSITION_TYPE)
  ) {
    return undefined;
  }

  if (!Number.isFinite(transition.durationMs)) {
    return undefined;
  }

  return {
    type: transition.type,
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

export function getTransitionLabel(transition: ClipTransition): string {
  switch (transition.type) {
    case DISSOLVE_TRANSITION_TYPE:
      return "Dissolve";
    case FADE_THROUGH_BLACK_TRANSITION_TYPE:
      return "Fade through black";
  }
}

export function getClipDurationMs(clip: Clip): number {
  if (clip.sourceEndMs === null) {
    return 0;
  }

  return Math.max(0, clip.sourceEndMs - clip.sourceStartMs);
}

export function normalizeTransitionForAdjacentClips(
  outgoingClip: Clip,
  incomingClip: Clip,
  transition: ClipTransition | null | undefined,
): ClipTransition | undefined {
  const normalized = normalizeClipTransition(transition);

  if (!normalized || !isTransitionAdjacent(outgoingClip, incomingClip)) {
    return undefined;
  }

  const maxDurationMs = Math.min(
    MAX_DISSOLVE_DURATION_MS,
    getClipDurationMs(outgoingClip),
    getClipDurationMs(incomingClip),
  );

  if (maxDurationMs < MIN_DISSOLVE_DURATION_MS) {
    return undefined;
  }

  return {
    type: normalized.type,
    durationMs: Math.min(normalized.durationMs, maxDurationMs),
  };
}

export function sanitizeTrackTransitions(
  track: Track,
  isVisualClip: (clip: Clip) => boolean,
): Track {
  const orderedClips = [...track.clips].sort(
    (left, right) => left.timelineStartMs - right.timelineStartMs,
  );

  const nextByClipId = new Map<string, Clip | null>();
  for (let index = 0; index < orderedClips.length; index += 1) {
    nextByClipId.set(
      orderedClips[index].id,
      orderedClips[index + 1] ?? null,
    );
  }

  return {
    ...track,
    clips: track.clips.map((clip) => {
      const nextClip = nextByClipId.get(clip.id) ?? null;

      if (!nextClip || !isVisualClip(clip) || !isVisualClip(nextClip)) {
        return clip.transitionOut === undefined
          ? clip
          : { ...clip, transitionOut: undefined };
      }

      const normalized = normalizeTransitionForAdjacentClips(
        clip,
        nextClip,
        clip.transitionOut,
      );

      const existingTransition = clip.transitionOut;

      if (
        (normalized === undefined && existingTransition === undefined) ||
        (normalized !== undefined &&
          existingTransition !== undefined &&
          normalized.type === existingTransition.type &&
          normalized.durationMs === existingTransition.durationMs)
      ) {
        return clip;
      }

      return {
        ...clip,
        transitionOut: normalized,
      };
    }),
  };
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

  const durationMs = Math.max(
    0,
    clip.sourceEndMs - clip.sourceStartMs,
  );

  return addSafeTimelineMilliseconds(
    clip.timelineStartMs,
    durationMs,
    `Clip ${clip.id} end`,
  );
}

function addSafeTimelineMilliseconds(
  startMs: number,
  durationMs: number,
  context: string,
): number {
  if (
    !Number.isSafeInteger(startMs) ||
    !Number.isSafeInteger(durationMs)
  ) {
    throw new Error(`${context} contains an unsafe millisecond value.`);
  }

  const endMs = startMs + durationMs;

  if (!Number.isSafeInteger(endMs) || endMs < 0) {
    throw new Error(
      `${context} exceeds the supported safe millisecond range.`,
    );
  }

  return endMs;
}

export function isTransitionAdjacent(
  outgoingClip: Clip,
  incomingClip: Clip,
): boolean {
  const outgoingEndMs = getClipEndMs(outgoingClip);

  return outgoingEndMs !== null && outgoingEndMs === incomingClip.timelineStartMs;
}

export interface TransitionVisualState {
  outgoingOpacity: number;
  incomingOpacity: number;
  overlayOpacity: number;
}

export function getTransitionVisualState(
  timelineTimeMs: number,
  outgoingClip: Clip,
  incomingClip: Clip,
  transition: ClipTransition,
): TransitionVisualState | null {
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

  if (normalized.type === DISSOLVE_TRANSITION_TYPE) {
    return {
      outgoingOpacity: 1 - progress,
      incomingOpacity: progress,
      overlayOpacity: 0,
    };
  }

  if (progress < 0.5) {
    return {
      outgoingOpacity: 1,
      incomingOpacity: 0,
      overlayOpacity: progress * 2,
    };
  }

  return {
    outgoingOpacity: 0,
    incomingOpacity: 1,
    overlayOpacity: (1 - progress) * 2,
  };
}

export function getDissolveOpacities(
  timelineTimeMs: number,
  outgoingClip: Clip,
  incomingClip: Clip,
  transition: ClipTransition,
): { outgoingOpacity: number; incomingOpacity: number } | null {
  if (transition.type !== DISSOLVE_TRANSITION_TYPE) {
    return null;
  }

  const visualState = getTransitionVisualState(
    timelineTimeMs,
    outgoingClip,
    incomingClip,
    transition,
  );

  if (!visualState) {
    return null;
  }

  return {
    outgoingOpacity: visualState.outgoingOpacity,
    incomingOpacity: visualState.incomingOpacity,
  };
}

export function getFadeThroughBlackOpacity(
  timelineTimeMs: number,
  outgoingClip: Clip,
  incomingClip: Clip,
  transition: ClipTransition,
): number | null {
  if (transition.type !== FADE_THROUGH_BLACK_TRANSITION_TYPE) {
    return null;
  }

  return (
    getTransitionVisualState(
      timelineTimeMs,
      outgoingClip,
      incomingClip,
      transition,
    )?.overlayOpacity ?? null
  );
}
