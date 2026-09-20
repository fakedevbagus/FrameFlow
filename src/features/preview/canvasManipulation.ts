import type { ClipTransform } from "../transform/transform";
import { normalizeClipTransform } from "../transform/transform";

export type CanvasManipulationMode = "move" | "scale" | "rotate";

export interface CanvasPointer {
  x: number;
  y: number;
}

export interface CanvasRect {
  width: number;
  height: number;
}

export function transformFromPointer(
  mode: CanvasManipulationMode,
  baseTransform: ClipTransform,
  startPointer: CanvasPointer,
  currentPointer: CanvasPointer,
  rect: CanvasRect,
): ClipTransform {
  if (rect.width <= 0 || rect.height <= 0) {
    return baseTransform;
  }

  if (mode === "move") {
    return normalizeClipTransform({
      ...baseTransform,
      x: baseTransform.x + ((currentPointer.x - startPointer.x) / rect.width) * 100,
      y: baseTransform.y + ((currentPointer.y - startPointer.y) / rect.height) * 100,
    });
  }

  const center = {
    x: rect.width / 2,
    y: rect.height / 2,
  };

  if (mode === "scale") {
    const startDistance = distance(startPointer, center);
    const currentDistance = distance(currentPointer, center);

    if (startDistance <= 0) {
      return baseTransform;
    }

    return normalizeClipTransform({
      ...baseTransform,
      scale: baseTransform.scale * (currentDistance / startDistance),
    });
  }

  const startAngle = angleFromCenter(startPointer, center);
  const currentAngle = angleFromCenter(currentPointer, center);
  const rotationDelta = ((currentAngle - startAngle) * 180) / Math.PI;

  return normalizeClipTransform({
    ...baseTransform,
    rotation: baseTransform.rotation + rotationDelta,
  });
}

function distance(a: CanvasPointer, b: CanvasPointer): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleFromCenter(point: CanvasPointer, center: CanvasPointer): number {
  return Math.atan2(point.y - center.y, point.x - center.x);
}
