import type {
  ClipCrop,
  CropPosition,
  TransformAnchor,
  TransformEasing,
  TransformKeyframe,
} from "../project/domain";

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

export const DEFAULT_CLIP_CROP: ClipCrop = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export const DEFAULT_CROP_POSITION: CropPosition = {
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

export interface CropAspectRatioPreset {
  id: string;
  label: string;
  ratio: number | null;
}

export const CROP_ASPECT_RATIO_PRESETS: CropAspectRatioPreset[] = [
  { id: "original", label: "Original", ratio: null },
  { id: "16-9", label: "16:9", ratio: 16 / 9 },
  { id: "9-16", label: "9:16", ratio: 9 / 16 },
  { id: "1-1", label: "1:1", ratio: 1 },
  { id: "4-5", label: "4:5", ratio: 4 / 5 },
  { id: "4-3", label: "4:3", ratio: 4 / 3 },
];

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

export interface TransformAnchorCompensationBounds {
  widthPercent: number;
  heightPercent: number;
}

export function compensateTransformForAnchorChange(
  transform: ClipTransform,
  currentAnchor: TransformAnchor,
  nextAnchor: TransformAnchor,
  contentBounds: TransformAnchorCompensationBounds,
): ClipTransform {
  const from = getClipTransformAnchor(currentAnchor);
  const to = getClipTransformAnchor(nextAnchor);
  const widthPercent = Number.isFinite(contentBounds.widthPercent)
    ? Math.max(0, contentBounds.widthPercent)
    : 0;
  const heightPercent = Number.isFinite(contentBounds.heightPercent)
    ? Math.max(0, contentBounds.heightPercent)
    : 0;

  const deltaAnchorX = (to.x - from.x) * widthPercent;
  const deltaAnchorY = (to.y - from.y) * heightPercent;

  const safeTransform = getClipTransform(transform);
  const angle = (safeTransform.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scale = safeTransform.scale;

  const compensatedDeltaX =
    (scale * cos - 1) * deltaAnchorX -
    scale * sin * deltaAnchorY;
  const compensatedDeltaY =
    scale * sin * deltaAnchorX +
    (scale * cos - 1) * deltaAnchorY;

  return normalizeClipTransform({
    ...safeTransform,
    x: safeTransform.x + compensatedDeltaX,
    y: safeTransform.y + compensatedDeltaY,
  });
}

export function getClipCrop(
  crop: Partial<ClipCrop> | undefined,
): ClipCrop {
  return {
    top: clamp(finiteOrDefault(crop?.top, DEFAULT_CLIP_CROP.top), 0, 0.99),
    right: clamp(finiteOrDefault(crop?.right, DEFAULT_CLIP_CROP.right), 0, 0.99),
    bottom: clamp(
      finiteOrDefault(crop?.bottom, DEFAULT_CLIP_CROP.bottom),
      0,
      0.99,
    ),
    left: clamp(finiteOrDefault(crop?.left, DEFAULT_CLIP_CROP.left), 0, 0.99),
  };
}

export function normalizeClipCrop(crop: Partial<ClipCrop> | undefined): ClipCrop {
  return getClipCrop(crop);
}

export function isValidClipCrop(crop: ClipCrop): boolean {
  return crop.left + crop.right < 1 && crop.top + crop.bottom < 1;
}

export function getClipCropPosition(
  crop: Partial<ClipCrop> | undefined,
  position: Partial<CropPosition> | undefined,
): CropPosition {
  const normalizedCrop = getClipCrop(crop);
  const visibleWidth = Math.max(
    0.001,
    1 - normalizedCrop.left - normalizedCrop.right,
  );
  const visibleHeight = Math.max(
    0.001,
    1 - normalizedCrop.top - normalizedCrop.bottom,
  );

  return {
    x: clamp(
      finiteOrDefault(
        position?.x,
        normalizedCrop.left + visibleWidth / 2,
      ),
      0,
      1,
    ),
    y: clamp(
      finiteOrDefault(
        position?.y,
        normalizedCrop.top + visibleHeight / 2,
      ),
      0,
      1,
    ),
  };
}

export function normalizeClipCropPosition(
  crop: Partial<ClipCrop> | undefined,
  position: Partial<CropPosition> | undefined,
): CropPosition {
  return getClipCropPosition(crop, position);
}

export function getCropForAspectRatio(
  targetRatio: number | null,
  mediaWidth: number,
  mediaHeight: number,
  position: Partial<CropPosition> | undefined,
): { crop: ClipCrop; cropPosition?: CropPosition } {
  if (
    targetRatio === null ||
    !Number.isFinite(targetRatio) ||
    targetRatio <= 0 ||
    !Number.isFinite(mediaWidth) ||
    !Number.isFinite(mediaHeight) ||
    mediaWidth <= 0 ||
    mediaHeight <= 0
  ) {
    return {
      crop: { ...DEFAULT_CLIP_CROP },
      cropPosition: undefined,
    };
  }

  const sourceRatio = mediaWidth / mediaHeight;
  let visibleWidth = 1;
  let visibleHeight = 1;

  if (targetRatio > sourceRatio) {
    visibleHeight = sourceRatio / targetRatio;
  } else if (targetRatio < sourceRatio) {
    visibleWidth = targetRatio / sourceRatio;
  }

  visibleWidth = clamp(visibleWidth, 0.001, 1);
  visibleHeight = clamp(visibleHeight, 0.001, 1);

  const basePosition = getClipCropPosition(undefined, position);
  const minX = visibleWidth / 2;
  const maxX = 1 - visibleWidth / 2;
  const minY = visibleHeight / 2;
  const maxY = 1 - visibleHeight / 2;
  const cropPosition = {
    x: clamp(basePosition.x, minX, maxX),
    y: clamp(basePosition.y, minY, maxY),
  };

  const crop: ClipCrop = {
    left: cropPosition.x - visibleWidth / 2,
    right: 1 - cropPosition.x - visibleWidth / 2,
    top: cropPosition.y - visibleHeight / 2,
    bottom: 1 - cropPosition.y - visibleHeight / 2,
  };

  return {
    crop: normalizeClipCrop(crop),
    cropPosition,
  };
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
    scale: Math.round(clamp(current.scale, 0.05, 10) * 100) / 100,
    rotation: wrapRotation(current.rotation),
    opacity: Math.round(clamp(current.opacity, 0, 1) * 100) / 100,
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
      (keyframe) => {
        if (
          !Number.isFinite(keyframe.timeMs) ||
          keyframe.timeMs < 0
        ) {
          return false;
        }

        const normalizedTimeMs = Math.max(0, Math.round(keyframe.timeMs));
        return Number.isSafeInteger(normalizedTimeMs);
      },
    )
    .map((keyframe) => ({
      timeMs: normalizeTransformKeyframeTime(keyframe.timeMs),
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

export function normalizeTransformKeyframeTime(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Transform keyframe time must be finite.");
  }

  const normalizedTimeMs = Math.max(0, Math.round(value));

  if (!Number.isSafeInteger(normalizedTimeMs)) {
    throw new Error(
      "Transform keyframe time must round to a safe integer.",
    );
  }

  return normalizedTimeMs;
}

export function getTransformKeyframeAtTime(
  keyframes: TransformKeyframe[] | undefined,
  timeMs: number,
): TransformKeyframe | null {
  if (!Number.isFinite(timeMs)) {
    return null;
  }

  const normalized = normalizeTransformKeyframes(keyframes);
  const normalizedTimeMs = normalizeTransformKeyframeTime(timeMs);
  return (
    normalized.find((keyframe) => keyframe.timeMs === normalizedTimeMs) ?? null
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
  const normalizedTimeMs = normalizeTransformKeyframeTime(timeMs);

  if (!Number.isSafeInteger(normalizedTimeMs)) {
    throw new Error(
      "Transform keyframe time must round to a safe integer.",
    );
  }

  const existingIndex = normalized.findIndex(
    (keyframe) => keyframe.timeMs === normalizedTimeMs,
  );
  const existing = existingIndex === -1 ? undefined : normalized[existingIndex];
  const next = {
    timeMs: normalizedTimeMs,
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

  const normalizedTimeMs = normalizeTransformKeyframeTime(timeMs);
  return normalizeTransformKeyframes(keyframes).filter(
    (keyframe) => keyframe.timeMs !== normalizedTimeMs,
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