export interface ClipTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export const DEFAULT_CLIP_TRANSFORM: ClipTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

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
