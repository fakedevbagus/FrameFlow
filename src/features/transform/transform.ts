import type { TransformAnchor, TransformEasing, TransformKeyframe } from "../project/domain";

export interface ClipTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export const DEFAULT_TRANSFORM_ANCHOR: TransformAnchor = {
  x: 0.5,
  y: 0.5,
};

export const DEFAULT_CLIP_TRANSFORM: ClipTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

export function getClipTransformAnchor(
  anchor: Partial<TransformAnchor> | undefined,
): TransformAnchor {
  return {
    x: clamp(finiteOrDefault(anchor?.x, DEFAULT_TRANSFORM_ANCHOR.x), 0, 1),
    y: clamp(finiteOrDefault(anchor?.y, DEFAULT_TRANSFORM_ANCHOR.y), 0, 1),
  };
}

export function normalizeTransformAnchor(
  anchor: Partial<TransformAnchor>,
): TransformAnchor {
  return getClipTransformAnchor(anchor);
}

export function getClipTransform(
  transform: Partial<ClipTransform> | undefined,
): ClipTransform {
  return {
    x: finiteOrDefault(transform?.x, DEFAULT_CLIP_TRANSFORM.x),
    y: finiteOrDefault(transform?.y, DEFAULT_CLIP_TRANSFORM.y),
    scale: finiteOrDefault(transform?.scale, DEFAULT_CLIP_TRANSFORM.scale),
    rotation: finiteOrDefault(
      transform?.rotation,
      DEFAULT_CLIP_TRANSFORM.rotation,
    ),
    opacity: finiteOrDefault(
      transform?.opacity,
      DEFAULT_CLIP_TRANSFORM.opacity,
    ),
  };
}

export function normalizeClipTransform(
  transform: Partial<ClipTransform>,
): ClipTransform {
  const current = getClipTransform(transform);

  return {
    x: clamp(current.x, -100, 100),
    y: clamp(current.y, -100, 100),
    scale: clamp(current.scale, 0.05, 10),
    rotation: wrapRotation(current.rotation),
    opacity: clamp(current.opacity, 0, 1),
  };
}

export function normalizeTransformKeyframes(
  keyframes: TransformKeyframe[] | undefined,
): TransformKeyframe[] {
  if (!keyframes?.length) {
    return [];
  }

  const sorted = keyframes
    .filter(
      (keyframe) =>
        Number.isFinite(keyframe.timeMs) &&
        keyframe.timeMs >= 0,
    )
    .map((keyframe) => ({
      timeMs: keyframe.timeMs,
      transform: normalizeClipTransform(keyframe.transform),
      easing: normalizeTransformEasing(keyframe.easing),
    }))
    .sort((a, b) => a.timeMs - b.timeMs);

  const deduplicated: TransformKeyframe[] = [];

  for (const keyframe of sorted) {
    const previous = deduplicated[deduplicated.length - 1];

    if (previous && previous.timeMs === keyframe.timeMs) {
      deduplicated[deduplicated.length - 1] = keyframe;
    } else {
      deduplicated.push(keyframe);
    }
  }

  return deduplicated;
}

export function getTransformKeyframeAtTime(
  keyframes: TransformKeyframe[] | undefined,
  timeMs: number,
): TransformKeyframe | null {
  if (!Number.isFinite(timeMs)) {
    return null;
  }

  const normalized = normalizeTransformKeyframes(keyframes);
  return (
    normalized.find((keyframe) => keyframe.timeMs === Math.max(0, timeMs)) ??
    null
  );
}

export function getClipTransformAtTime(
  baseTransform: Partial<ClipTransform> | undefined,
  keyframes: TransformKeyframe[] | undefined,
  timeMs: number,
): ClipTransform {
  const base = getClipTransform(baseTransform);
  const normalized = normalizeTransformKeyframes(keyframes);

  if (!normalized.length || !Number.isFinite(timeMs)) {
    return base;
  }

  const currentTimeMs = Math.max(0, timeMs);
  const first = normalized[0];

  if (currentTimeMs <= first.timeMs) {
    return first.transform;
  }

  const last = normalized[normalized.length - 1];

  if (currentTimeMs >= last.timeMs) {
    return last.transform;
  }

  for (let index = 1; index < normalized.length; index += 1) {
    const next = normalized[index];

    if (currentTimeMs > next.timeMs) {
      continue;
    }

    const previous = normalized[index - 1];
    const duration = next.timeMs - previous.timeMs;
    const progress = duration > 0
      ? (currentTimeMs - previous.timeMs) / duration
      : 1;

    return interpolateClipTransform(
      previous.transform,
      next.transform,
      applyTransformEasing(progress, next.easing),
    );
  }

  return base;
}

export function upsertTransformKeyframe(
  keyframes: TransformKeyframe[] | undefined,
  timeMs: number,
  transform: ClipTransform,
  easing?: TransformEasing,
): TransformKeyframe[] {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new Error("Transform keyframe time must be zero or greater.");
  }

  const normalized = normalizeTransformKeyframes(keyframes);
  const existingIndex = normalized.findIndex(
    (keyframe) => keyframe.timeMs === timeMs,
  );
  const existing = existingIndex === -1 ? undefined : normalized[existingIndex];
  const next = {
    timeMs,
    transform: normalizeClipTransform(transform),
    easing: normalizeTransformEasing(easing ?? existing?.easing),
  };

  if (existingIndex === -1) {
    normalized.push(next);
  } else {
    normalized[existingIndex] = next;
  }

  return normalized.sort((a, b) => a.timeMs - b.timeMs);
}

export function removeTransformKeyframe(
  keyframes: TransformKeyframe[] | undefined,
  timeMs: number,
): TransformKeyframe[] {
  if (!Number.isFinite(timeMs)) {
    return normalizeTransformKeyframes(keyframes);
  }

  return normalizeTransformKeyframes(keyframes).filter(
    (keyframe) => keyframe.timeMs !== Math.max(0, timeMs),
  );
}

export function normalizeTransformEasing(
  easing: TransformEasing | undefined,
): TransformEasing {
  return easing === "ease-in" ||
    easing === "ease-out" ||
    easing === "ease-in-out"
    ? easing
    : "linear";
}

function applyTransformEasing(
  progress: number,
  easing: TransformEasing | undefined,
): number {
  const t = clamp(progress, 0, 1);
  const safeEasing = normalizeTransformEasing(easing);

  switch (safeEasing) {
    case "ease-in":
      return t * t;
    case "ease-out":
      return 1 - (1 - t) * (1 - t);
    case "ease-in-out":
      return t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default:
      return t;
  }
}

function interpolateClipTransform(
  from: ClipTransform,
  to: ClipTransform,
  progress: number,
): ClipTransform {
  const clampedProgress = clamp(progress, 0, 1);
  const rotationDelta = shortestRotationDelta(from.rotation, to.rotation);

  return normalizeClipTransform({
    x: lerp(from.x, to.x, clampedProgress),
    y: lerp(from.y, to.y, clampedProgress),
    scale: lerp(from.scale, to.scale, clampedProgress),
    rotation: from.rotation + rotationDelta * clampedProgress,
    opacity: lerp(from.opacity, to.opacity, clampedProgress),
  });
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function shortestRotationDelta(from: number, to: number): number {
  return ((to - from + 180) % 360 + 360) % 360 - 180;
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapRotation(value: number): number {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}
