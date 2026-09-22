export const M3_38_DIRECT_GRAPH_MARKER = "m3.38-direct-graph-v2";

import { buildVisualEffectsFfmpegFilters } from "../effects/visual-effects";
import { buildTextOverlayFfmpegFilter } from "../effects/text-overlay";
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

  if (videoSegments.some((segment) => segment.mediaType !== "video")) {
    throw new Error(
      "M3.36 supports video assets only; image rendering is deferred.",
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
    ...(segment.textOverlay && buildTextOverlayFfmpegFilter(segment.textOverlay)
      ? [buildTextOverlayFfmpegFilter(segment.textOverlay)]
      : []),
    ...(includeOutputNormalization
      ? [
          "fps=fps=" + formatNumber(plan.frameRate) + ":round=near",
          "setsar=1",
        ]
      : []),
  ].join(",") + "[" + label + "]";
}

function assertSupportedVisualMetadata(segment: RenderSegment): void {
  const transform = segment.transform;

  if (
    transform &&
    (transform.x !== 0 ||
      transform.y !== 0 ||
      transform.scale !== 1 ||
      transform.rotation !== 0 ||
      transform.opacity !== 1)
  ) {
    throw new Error(
      "M3.36 does not compile visual transforms yet; transform graph support is deferred.",
    );
  }

  if (
    segment.crop &&
    (segment.crop.top !== 0 ||
      segment.crop.right !== 0 ||
      segment.crop.bottom !== 0 ||
      segment.crop.left !== 0)
  ) {
    throw new Error(
      "M3.36 does not compile crop settings yet; crop graph support is deferred.",
    );
  }

  if (segment.cropPosition) {
    const centered =
      segment.cropPosition.x === 0.5 && segment.cropPosition.y === 0.5;

    if (!centered) {
      throw new Error(
        "M3.36 does not compile crop position yet; crop graph support is deferred.",
      );
    }
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
