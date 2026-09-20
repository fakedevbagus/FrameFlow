import type { TransformAnchor } from "../project/domain";
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
  left?: number;
  top?: number;
}

export interface ContentBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getContainedContentPercentageBounds(
  canvasWidth: number,
  canvasHeight: number,
  mediaWidth: number,
  mediaHeight: number,
): ContentBounds {
  if (
    canvasWidth <= 0 ||
    canvasHeight <= 0 ||
    mediaWidth <= 0 ||
    mediaHeight <= 0
  ) {
    return {
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    };
  }

  const canvasAspect = canvasWidth / canvasHeight;
  const mediaAspect = mediaWidth / mediaHeight;

  if (mediaAspect > canvasAspect) {
    const height = (canvasAspect / mediaAspect) * 100;

    return {
      left: 0,
      top: (100 - height) / 2,
      width: 100,
      height,
    };
  }

  const width = (mediaAspect / canvasAspect) * 100;

  return {
    left: (100 - width) / 2,
    top: 0,
    width,
    height: 100,
  };
}

export function getContainedContentBounds(
  stage: CanvasRect,
  mediaWidth: number,
  mediaHeight: number,
): ContentBounds {
  if (
    stage.width <= 0 ||
    stage.height <= 0 ||
    mediaWidth <= 0 ||
    mediaHeight <= 0
  ) {
    return {
      left: 0,
      top: 0,
      width: Math.max(0, stage.width),
      height: Math.max(0, stage.height),
    };
  }

  const mediaAspect = mediaWidth / mediaHeight;
  const stageAspect = stage.width / stage.height;

  if (mediaAspect > stageAspect) {
    const width = stage.width;
    const height = width / mediaAspect;

    return {
      left: 0,
      top: (stage.height - height) / 2,
      width,
      height,
    };
  }

  const height = stage.height;
  const width = height * mediaAspect;

  return {
    left: (stage.width - width) / 2,
    top: 0,
    width,
    height,
  };
}

export function transformFromPointer(
  mode: CanvasManipulationMode,
  baseTransform: ClipTransform,
  startPointer: CanvasPointer,
  currentPointer: CanvasPointer,
  rect: CanvasRect,
  anchor: TransformAnchor = { x: 0.5, y: 0.5 },
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

  const pivot = {
    x: (rect.left ?? 0) + rect.width * Math.min(1, Math.max(0, anchor.x)),
    y: (rect.top ?? 0) + rect.height * Math.min(1, Math.max(0, anchor.y)),
  };

  if (mode === "scale") {
    const startDistance = distance(startPointer, pivot);
    const currentDistance = distance(currentPointer, pivot);

    if (startDistance <= 0) {
      return baseTransform;
    }

    return normalizeClipTransform({
      ...baseTransform,
      scale: baseTransform.scale * (currentDistance / startDistance),
    });
  }

  const startAngle = angleFromCenter(startPointer, pivot);
  const currentAngle = angleFromCenter(currentPointer, pivot);
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
