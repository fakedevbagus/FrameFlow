export const M3_38_DIRECT_GRAPH_MARKER = "m3.38-direct-graph-v2";

import { buildVisualEffectsFfmpegFilters } from "../effects/visual-effects";
import {
  getClipCrop,
  getClipCropPosition,
  getClipTransform,
  normalizeClipTransform,
} from "../transform/transform";
import type { ClipTransform } from "../transform/transform";
import type { RenderPlan, RenderSegment } from "./render-plan";

export interface VideoRenderInput {
  inputIndex: number;
  sourcePath: string;
}

export interface VideoRenderGraph {
  inputs: VideoRenderInput[];
  filterComplex: string;
  videoMap: string;
}

export function compileSingleVideoTrackGraph(
  plan: RenderPlan,
): VideoRenderGraph {
  const videoSegments = plan.segments.filter(
    (segment) => segment.trackType === "video",
  );

  if (videoSegments.length === 0) {
    throw new Error("Render plan has no video clips.");
  }

  const videoTrackIds = new Set(videoSegments.map((segment) => segment.trackId));

  if (videoTrackIds.size !== 1) {
    throw new Error(
      "M3.36 supports one video track at a time; multi-track compositing is deferred.",
    );
  }

  if (
    videoSegments.some(
      (segment) =>
        segment.mediaType !== "video" && segment.mediaType !== "image",
    )
  ) {
    throw new Error(
      "Video render graph supports video and image visual assets only.",
    );
  }

  if (
    plan.segments.some(
      (segment) => segment.trackType === "audio" && segment.durationMs > 0,
    )
  ) {
    throw new Error(
      "M3.36 video graph compilation does not include audio mixing yet.",
    );
  }

  for (const segment of videoSegments) {
    assertSupportedVisualMetadata(segment);
  }

  const ordered = [...videoSegments].sort(
    (left, right) => left.timelineStartMs - right.timelineStartMs,
  );
  const inputs = ordered.map((segment) => ({
    inputIndex: segment.inputIndex,
    sourcePath: segment.sourcePath,
  }));

  const graphParts: string[] = [];
  const concatInputs: string[] = [];
  let previousEndMs = 0;
  let gapIndex = 0;

  for (let index = 0; index < ordered.length; index += 1) {
    const segment = ordered[index];

    if (segment.timelineStartMs > previousEndMs) {
      const gapDurationMs = segment.timelineStartMs - previousEndMs;
      const gapLabel = "gap" + gapIndex;
      graphParts.push(
        "color=c=black:s=" +
          plan.width +
          "x" +
          plan.height +
          ":r=" +
          formatNumber(plan.frameRate) +
          ":d=" +
          formatSeconds(gapDurationMs) +
          ",setsar=1[" +
          gapLabel +
          "]",
      );
      concatInputs.push("[" + gapLabel + "]");
      gapIndex += 1;
    }

    const isDirectSingleClip =
      ordered.length === 1 && segment.timelineStartMs === 0;
    const videoLabel = isDirectSingleClip ? "vout" : "clip" + index;

    graphParts.push(
      buildSegmentFilter(segment, plan, videoLabel, !isDirectSingleClip),
    );

    if (!isDirectSingleClip) {
      concatInputs.push("[" + videoLabel + "]");
    }
    previousEndMs = segment.timelineEndMs;
  }

  const canRenderDirectlyToOutput =
    ordered.length === 1 && ordered[0].timelineStartMs === 0;

  if (!canRenderDirectlyToOutput) {
    const concatCount = concatInputs.length;
    graphParts.push(
      concatInputs.join("") +
        "concat=n=" +
        concatCount +
        ":v=1:a=0,format=yuv420p[vout]",
    );
  }

  return {
    inputs,
    filterComplex: graphParts.join(";"),
    videoMap: "[vout]",
  };
}

function buildSegmentFilter(
  segment: RenderSegment,
  plan: RenderPlan,
  label: string,
  includeOutputNormalization: boolean,
): string {
  const transform = getClipTransform(segment.transform);
  const crop = getClipCrop(segment.crop);
  const cropPosition = getClipCropPosition(crop, segment.cropPosition);
  const staticTransformRequired = !isDefaultTransform(transform);
  const staticCropRequired = !isDefaultCrop(crop);

  if (staticTransformRequired || staticCropRequired) {
    return buildCompositedSegmentFilter(
      segment,
      plan,
      label,
      includeOutputNormalization,
      transform,
      crop,
      cropPosition,
    );
  }

  return [
    "[" + segment.inputIndex + ":v:0]" +
      "trim=start=" +
      formatSeconds(segment.sourceStartMs) +
      ":end=" +
      formatSeconds(segment.sourceEndMs),
    "setpts=PTS-STARTPTS",
    "scale=w=" +
      plan.width +
      ":h=" +
      plan.height +
      ":force_original_aspect_ratio=decrease",
    "pad=w=" +
      plan.width +
      ":h=" +
      plan.height +
      ":x=(ow-iw)/2:y=(oh-ih)/2",
    ...(segment.visualEffects &&
    buildVisualEffectsFfmpegFilters(segment.visualEffects)
      ? [buildVisualEffectsFfmpegFilters(segment.visualEffects)]
      : []),
    ...(includeOutputNormalization
      ? [
          "fps=fps=" + formatNumber(plan.frameRate) + ":round=near",
          "setsar=1",
        ]
      : []),
  ].join(",") + "[" + label + "]";
}

function buildCompositedSegmentFilter(
  segment: RenderSegment,
  plan: RenderPlan,
  label: string,
  includeOutputNormalization: boolean,
  transform: ClipTransform,
  crop: ReturnType<typeof getClipCrop>,
  cropPosition: ReturnType<typeof getClipCropPosition>,
): string {
  const anchor = segment.transformAnchor ?? { x: 0.5, y: 0.5 };

  if (anchor.x !== 0.5 || anchor.y !== 0.5) {
    throw new Error(
      "M3.63 does not compile non-centered transform anchors yet; anchor export is deferred.",
    );
  }

  const foregroundLabel = "transform_fg_" + segment.inputIndex;
  const backgroundLabel = "transform_bg_" + segment.inputIndex;
  const translationX = formatNumber((transform.x / 100) * plan.width);
  const translationY = formatNumber((transform.y / 100) * plan.height);
  const rotationRadians = formatNumber(
    (transform.rotation * Math.PI) / 180,
  );
  const visibleWidth = Math.max(
    0.001,
    1 - crop.left - crop.right,
  );
  const visibleHeight = Math.max(
    0.001,
    1 - crop.top - crop.bottom,
  );

  const cropFilters = isDefaultCrop(crop)
    ? []
    : [
        "format=rgba",
        "crop=w=trunc(iw*" +
          formatNumber(visibleWidth) +
          "):h=trunc(ih*" +
          formatNumber(visibleHeight) +
          "):x=trunc(iw*(" +
          formatNumber(cropPosition.x) +
          "-" +
          formatNumber(visibleWidth / 2) +
          ")):y=trunc(ih*(" +
          formatNumber(cropPosition.y) +
          "-" +
          formatNumber(visibleHeight / 2) +
          "))",
        "pad=w=iw/" +
          formatNumber(visibleWidth) +
          ":h=ih/" +
          formatNumber(visibleHeight) +
          ":x=(iw/" +
          formatNumber(visibleWidth) +
          ")*" +
          formatNumber(crop.left) +
          ":y=(ih/" +
          formatNumber(visibleHeight) +
          ")*" +
          formatNumber(crop.top) +
          ":color=black@0",
      ];

  const foregroundFilters = [
    "[" +
      segment.inputIndex +
      ":v:0]trim=start=" +
      formatSeconds(segment.sourceStartMs) +
      ":end=" +
      formatSeconds(segment.sourceEndMs),
    "setpts=PTS-STARTPTS",
    "scale=w=" +
      plan.width +
      ":h=" +
      plan.height +
      ":force_original_aspect_ratio=decrease",
    ...(segment.visualEffects &&
    buildVisualEffectsFfmpegFilters(segment.visualEffects)
      ? [buildVisualEffectsFfmpegFilters(segment.visualEffects)]
      : []),
    ...cropFilters,
    transform.scale !== 1
      ? "scale=w=iw*" +
        formatNumber(transform.scale) +
        ":h=ih*" +
        formatNumber(transform.scale)
      : null,
    transform.rotation !== 0
      ? [
          "format=rgba",
          "rotate=" +
            rotationRadians +
            ":c=none:ow=rotw(" +
            rotationRadians +
            "):oh=roth(" +
            rotationRadians +
            ")",
        ]
      : null,
    transform.opacity !== 1 ? "format=rgba" : null,
    transform.opacity !== 1
      ? "colorchannelmixer=aa=" + formatNumber(transform.opacity)
      : null,
  ]
    .flat()
    .filter((value): value is string => value !== null);

  const backgroundFilter =
    "color=c=black@0.0:s=" +
    plan.width +
    "x" +
    plan.height +
    ":r=" +
    formatNumber(plan.frameRate) +
    ":d=" +
    formatSeconds(segment.durationMs) +
    ",format=rgba[" +
    backgroundLabel +
    "]";

  const overlayFilter =
    "[" +
    backgroundLabel +
    "][" +
    foregroundLabel +
    "]overlay=x=(W-w)/2+" +
    translationX +
    ":y=(H-h)/2+" +
    translationY +
    ":shortest=1";

  const normalization = includeOutputNormalization
    ? ",fps=fps=" +
      formatNumber(plan.frameRate) +
      ":round=near,setsar=1"
    : "";

  return (
    foregroundFilters.join(",") +
    "[" +
    foregroundLabel +
    "];" +
    backgroundFilter +
    ";" +
    overlayFilter +
    ",format=yuv420p" +
    normalization +
    "[" +
    label +
    "]"
  );
}

function isDefaultTransform(transform: ClipTransform): boolean {
  const normalized = normalizeClipTransform(transform);

  return (
    normalized.x === 0 &&
    normalized.y === 0 &&
    normalized.scale === 1 &&
    normalized.rotation === 0 &&
    normalized.opacity === 1
  );
}

function isDefaultCrop(
  crop: ReturnType<typeof getClipCrop>,
): boolean {
  return (
    crop.top === 0 &&
    crop.right === 0 &&
    crop.bottom === 0 &&
    crop.left === 0
  );
}

function assertSupportedVisualMetadata(segment: RenderSegment): void {
  if (segment.transformKeyframes && segment.transformKeyframes.length > 0) {
    throw new Error(
      "M3.63 does not compile transform keyframes yet; animated transform export is deferred.",
    );
  }

  if (segment.transformKeyframes && segment.transformKeyframes.length > 0) {
    throw new Error(
      "M3.36 does not compile transform keyframes yet; animated filter support is deferred.",
    );
  }

  if (segment.transitionOut) {
    throw new Error(
      "M3.36 does not compile transitions yet; transition graph support is deferred.",
    );
  }

  if (segment.isMuted) {
    throw new Error(
      "M3.36 does not compile track mute state yet; audio/video graph policy is deferred.",
    );
  }
}

function formatSeconds(milliseconds: number): string {
  return formatNumber(milliseconds / 1000);
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
