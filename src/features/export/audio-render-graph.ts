import type { AudioCompressor, AudioEq } from "../project/domain";
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

export function compileAudioTracksGraph(
  plan: RenderPlan,
  options: AudioRenderGraphOptions = {},
): AudioRenderGraph {
  const audioSegments = plan.segments.filter(
    (segment) => segment.trackType === "audio",
  );

  if (audioSegments.length === 0) {
    throw new Error("Render plan has no audio clips.");
  }


  if (audioSegments.some((segment) => segment.mediaType !== "audio")) {
    throw new Error(
      "M3.42 supports audio assets on audio tracks only; mixed media routing is deferred.",
    );
  }

  const ordered = [...audioSegments].sort(
    (left, right) =>
      left.trackIndex - right.trackIndex ||
      left.timelineStartMs - right.timelineStartMs,
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

/**
 * Backward-compatible alias for callers that still use the single-track name.
 * The compiler now accepts independent Audio tracks and mixes them together.
 */
export const compileSingleAudioTrackGraph = compileAudioTracksGraph;

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
  const volume = Math.min(1, Math.max(0, segment.trackVolume ?? 1));
  const pan = Math.min(1, Math.max(-1, segment.trackPan ?? 0));

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
    ",volume=" +
    formatNumber(volume) +
    buildAudioPanFilter(pan) +
    buildAudioEqFilters(segment.audioEq) +
    buildAudioCompressorFilter(segment.audioCompressor) +
    buildAudioFadeFilters(segment) +
    ",adelay=" +
    Math.max(0, Math.round(segment.timelineStartMs)) +
    ":all=1[" +
    label +
    "]"
  );
}

function buildAudioPanFilter(pan: number): string {
  if (Math.abs(pan) < 0.000001) {
    return "";
  }

  const normalized = (pan + 1) * Math.PI / 4;
  const leftGain = Math.cos(normalized);
  const rightGain = Math.sin(normalized);

  return (
    ",pan=stereo|c0=" +
    formatNumber(leftGain) +
    "*c0|c1=" +
    formatNumber(rightGain) +
    "*c1"
  );
}

function buildAudioEqFilters(eq: AudioEq | undefined): string {
  if (!eq?.enabled) {
    return "";
  }

  const filters: string[] = [];
  const bands: Array<{ frequency: number; q: number; gainDb: number }> = [
    { frequency: 120, q: 0.8, gainDb: eq.lowGainDb },
    { frequency: 1000, q: 1, gainDb: eq.midGainDb },
    { frequency: 8000, q: 0.8, gainDb: eq.highGainDb },
  ];

  bands.forEach(({ frequency, q, gainDb }) => {
    if (Math.abs(gainDb) < 0.000001) {
      return;
    }

    filters.push(
      "equalizer=f=" +
        frequency +
        ":t=q:w=" +
        formatNumber(q) +
        ":g=" +
        formatNumber(gainDb),
    );
  });

  return filters.length ? "," + filters.join(",") : "";
}

function buildAudioCompressorFilter(compressor: AudioCompressor | undefined): string {
  if (!compressor?.enabled) {
    return "";
  }

  const thresholdDb = Math.min(0, Math.max(-60, compressor.thresholdDb));
  const threshold = Math.pow(10, thresholdDb / 20);
  const ratio = Math.min(20, Math.max(1, compressor.ratio));
  const attackMs = Math.min(2000, Math.max(0.01, compressor.attackMs));
  const releaseMs = Math.min(9000, Math.max(0.01, compressor.releaseMs));

  return (
    ",acompressor=threshold=" +
    formatNumber(threshold) +
    ":ratio=" +
    formatNumber(ratio) +
    ":attack=" +
    formatNumber(attackMs) +
    ":release=" +
    formatNumber(releaseMs)
  );
}

function buildAudioFadeFilters(segment: RenderSegment): string {
  const durationMs = Math.max(0, segment.durationMs);
  const fadeInMs = Math.min(
    durationMs,
    Math.max(0, Math.floor(segment.audioFadeInMs ?? 0)),
  );
  const fadeOutMs = Math.min(
    Math.max(0, durationMs - fadeInMs),
    Math.max(0, Math.floor(segment.audioFadeOutMs ?? 0)),
  );
  const filters: string[] = [];

  if (fadeInMs > 0) {
    filters.push(
      "afade=t=in:st=0:d=" + formatSeconds(fadeInMs),
    );
  }

  if (fadeOutMs > 0) {
    filters.push(
      "afade=t=out:st=" +
        formatSeconds(durationMs - fadeOutMs) +
        ":d=" +
        formatSeconds(fadeOutMs),
    );
  }

  return filters.length ? "," + filters.join(",") : "";
}

function formatSeconds(milliseconds: number): string {
  return formatNumber(milliseconds / 1000);
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
