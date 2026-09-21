import type { RenderPlan, RenderSegment } from "./render-plan";

export interface AudioRenderInput {
  inputIndex: number;
  sourcePath: string;
  sourceStartMs: number;
  sourceEndMs: number;
  timelineStartMs: number;
  durationMs: number;
}

export interface AudioRenderGraph {
  inputs: AudioRenderInput[];
  filterComplex: string;
  audioMap: string;
}

export interface AudioRenderGraphOptions {
  inputIndexOffset?: number;
}

export function compileSingleAudioTrackGraph(
  plan: RenderPlan,
  options: AudioRenderGraphOptions = {},
): AudioRenderGraph {
  const audioSegments = plan.segments.filter(
    (segment) => segment.trackType === "audio",
  );

  if (audioSegments.length === 0) {
    throw new Error("Render plan has no audio clips.");
  }

  const audioTrackIds = new Set(audioSegments.map((segment) => segment.trackId));

  if (audioTrackIds.size !== 1) {
    throw new Error(
      "M3.42 supports one audio track at a time; multi-track audio mixing is deferred.",
    );
  }

  if (audioSegments.some((segment) => segment.mediaType !== "audio")) {
    throw new Error(
      "M3.42 supports audio assets on audio tracks only; mixed media routing is deferred.",
    );
  }

  const ordered = [...audioSegments].sort(
    (left, right) => left.timelineStartMs - right.timelineStartMs,
  );
  const inputIndexOffset = Math.max(
    0,
    Math.floor(options.inputIndexOffset ?? 0),
  );

  const inputs = ordered.map((segment, index) =>
    toAudioRenderInput(segment, inputIndexOffset + index),
  );
  const graphParts: string[] = [];

  graphParts.push(
    "anullsrc=r=48000:cl=stereo,atrim=duration=" +
      formatSeconds(plan.durationMs) +
      ",asetpts=PTS-STARTPTS[silence]",
  );

  const mixLabels = ["[silence]"];

  ordered.forEach((segment, index) => {
    if (segment.isMuted) {
      return;
    }

    const label = "audio" + index;
    graphParts.push(
      buildAudioSegmentFilter(
        segment,
        label,
        inputIndexOffset + index,
      ),
    );
    mixLabels.push("[" + label + "]");
  });

  const mixInputCount = mixLabels.length;

  graphParts.push(
    mixLabels.join("") +
      "amix=inputs=" +
      mixInputCount +
      ":duration=longest:dropout_transition=0[aout]",
  );

  return {
    inputs,
    filterComplex: graphParts.join(";"),
    audioMap: "[aout]",
  };
}

function toAudioRenderInput(
  segment: RenderSegment,
  localInputIndex: number,
): AudioRenderInput {
  return {
    inputIndex: localInputIndex,
    sourcePath: segment.sourcePath,
    sourceStartMs: segment.sourceStartMs,
    sourceEndMs: segment.sourceEndMs,
    timelineStartMs: segment.timelineStartMs,
    durationMs: segment.durationMs,
  };
}

function buildAudioSegmentFilter(
  segment: RenderSegment,
  label: string,
  localInputIndex: number,
): string {
  const startSeconds = formatSeconds(segment.sourceStartMs);
  const endSeconds = formatSeconds(segment.sourceEndMs);

  return (
    "[" +
    localInputIndex +
    ":a:0]" +
    "atrim=start=" +
    startSeconds +
    ":end=" +
    endSeconds +
    ",asetpts=PTS-STARTPTS" +
    ",aformat=sample_rates=48000:channel_layouts=stereo" +
    ",adelay=" +
    Math.max(0, Math.round(segment.timelineStartMs)) +
    ":all=1[" +
    label +
    "]"
  );
}

function formatSeconds(milliseconds: number): string {
  return formatNumber(milliseconds / 1000);
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
