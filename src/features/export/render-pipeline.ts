import type { RenderPlan } from "./render-plan";
import {
  renderSingleSourceToMp4,
  renderVideoGraphToMp4,
  renderVideoSegmentsToMp4,
  renderVideoAudioGraphToMp4,
  type NativeExportRenderResult,
} from "./export-renderer";
import { compileAudioTracksGraph } from "./audio-render-graph";
import { compileVideoTracksGraph } from "./render-graph";
import { getClipTransform } from "../transform/transform";

export function renderVideoPlanToMp4(
  plan: RenderPlan,
  outputPath: string,
  jobId?: string,
): Promise<NativeExportRenderResult> {
  const videoSegments = plan.segments.filter(
    (segment) => segment.trackType === "video",
  );
  const audioSegments = plan.segments.filter(
    (segment) => segment.trackType === "audio" && segment.durationMs > 0,
  );

  if (videoSegments.length === 0) {
    throw new Error("Render plan has no video clips.");
  }

  const videoPlan = rebaseVideoPlanInputIndexes(plan, videoSegments);

  if (audioSegments.length === 0) {
    return renderVideoOnlyPlanToMp4(videoPlan, outputPath, jobId);
  }

  const videoGraph = compileVideoTracksGraph(videoPlan);
  const audioGraph = compileAudioTracksGraph(plan, {
    inputIndexOffset: videoGraph.inputs.length,
  });

  const request = {
    videoInputs: videoGraph.inputs
      .sort((left, right) => left.inputIndex - right.inputIndex)
      .map((input) => input.sourcePath),
    videoInputMediaTypes: videoGraph.inputs
      .sort((left, right) => left.inputIndex - right.inputIndex)
      .map((input) => {
        const segment = videoPlan.segments.find(
          (candidate) => candidate.inputIndex === input.inputIndex,
        );
        return segment?.mediaType ?? "video";
      }),
    audioInputs: audioGraph.inputs
      .sort((left, right) => left.inputIndex - right.inputIndex)
      .map((input) => input.sourcePath),
    sourceAudioSegments: videoPlan.segments
      .filter(
        (segment) =>
          segment.mediaType === "video" &&
          !segment.isMuted &&
          segment.durationMs > 0,
      )
      .map((segment) => ({
        inputIndex: segment.inputIndex,
        sourceStartMs: segment.sourceStartMs,
        timelineStartMs: segment.timelineStartMs,
        durationMs: segment.durationMs,
        trackVolume: segment.trackVolume ?? 1,
        trackPan: segment.trackPan ?? 0,
        ...(segment.audioVolumeKeyframes?.length
          ? { audioVolumeKeyframes: segment.audioVolumeKeyframes }
          : {}),
        ...(segment.audioFadeInMs && segment.audioFadeInMs > 0
          ? { audioFadeInMs: Math.max(0, Math.floor(segment.audioFadeInMs)) }
          : {}),
        ...(segment.audioFadeOutMs && segment.audioFadeOutMs > 0
          ? { audioFadeOutMs: Math.max(0, Math.floor(segment.audioFadeOutMs)) }
          : {}),
        ...(hasVideoSourceAudioEqProcessing(segment)
          ? { audioEq: segment.audioEq }
          : {}),
      })),
    videoFilterComplex: videoGraph.filterComplex,
    videoMap: videoGraph.videoMap,
    audioFilterComplex: audioGraph.filterComplex,
    audioMap: audioGraph.audioMap,
    durationMs: plan.durationMs,
    width: plan.width,
    height: plan.height,
    frameRate: plan.frameRate,
    outputPath,
  };

  return jobId
    ? renderVideoAudioGraphToMp4(request, jobId)
    : renderVideoAudioGraphToMp4(request);
}

function rebaseVideoPlanInputIndexes(
  plan: RenderPlan,
  videoSegments: RenderPlan["segments"],
): RenderPlan {
  const ordered = [...videoSegments].sort(
    (left, right) => left.inputIndex - right.inputIndex,
  );

  const segments = ordered.map((segment, inputIndex) => ({
    ...segment,
    inputIndex,
  }));

  return {
    ...plan,
    segments,
  };
}

function orderedMediaTypes(
  segments: RenderPlan["segments"],
): RenderPlan["segments"][number]["mediaType"][] {
  return [...segments]
    .sort((left, right) => left.inputIndex - right.inputIndex)
    .map((segment) => segment.mediaType);
}

function hasVideoSourceAudioTrackProcessing(
  segment: RenderPlan["segments"][number],
): boolean {
  if (segment.mediaType !== "video" || segment.isMuted) {
    return false;
  }

  const volume = segment.trackVolume ?? 1;
  const pan = segment.trackPan ?? 0;

  return (
    Math.abs(volume - 1) > 0.000001 ||
    Math.abs(pan) > 0.000001
  );
}
function hasVideoSourceAudioEqProcessing(
  segment: RenderPlan["segments"][number],
): boolean {
  if (segment.mediaType !== "video" || segment.isMuted) {
    return false;
  }

  const eq = segment.audioEq;

  return Boolean(
    eq?.enabled &&
      (Math.abs(eq.lowGainDb) > 0.000001 ||
        Math.abs(eq.midGainDb) > 0.000001 ||
        Math.abs(eq.highGainDb) > 0.000001),
  );
}


function renderVideoOnlyPlanToMp4(
  plan: RenderPlan,
  outputPath: string,
  jobId?: string,
): Promise<NativeExportRenderResult> {
  const videoSegments = plan.segments.filter(
    (segment) => segment.trackType === "video",
  );
  const graph = compileVideoTracksGraph(plan);
  const requiresVideoGraph = videoSegments.some((segment) => {
    const transform = getClipTransform(segment.transform);

    return (
      segment.mediaType !== "video" ||
      Boolean(segment.transitionOut) ||
      Boolean(segment.transformKeyframes?.length) ||
      Boolean(segment.crop) ||
      Boolean(
        segment.visualEffects &&
          (segment.visualEffects.brightness !== 0 ||
            segment.visualEffects.contrast !== 0 ||
            segment.visualEffects.saturation !== 0),
      ) ||
      Boolean(segment.textOverlay) ||
      Boolean(segment.audioVolumeKeyframes?.length) ||
      Boolean(
        segment.mediaType === "video" &&
          !segment.isMuted &&
          ((segment.audioFadeInMs ?? 0) > 0 ||
            (segment.audioFadeOutMs ?? 0) > 0),
      ) ||
      hasVideoSourceAudioTrackProcessing(segment) ||
      hasVideoSourceAudioEqProcessing(segment) ||
      transform.x !== 0 ||
      transform.y !== 0 ||
      transform.scale !== 1 ||
      transform.rotation !== 0 ||
      transform.opacity !== 1
    );
  });

  if (
    videoSegments.length === 1 &&
    videoSegments[0].timelineStartMs === 0 &&
    videoSegments[0].mediaType === "video" &&
    !requiresVideoGraph
  ) {
    const segment = videoSegments[0];

    const request = {
      sourcePath: segment.sourcePath,
      outputPath,
      width: plan.width,
      height: plan.height,
      frameRate: plan.frameRate,
      sourceStartMs: segment.sourceStartMs,
      sourceDurationMs: segment.durationMs,
      includeAudio: !segment.isMuted,
    };

    return jobId
      ? renderSingleSourceToMp4(request, jobId)
      : renderSingleSourceToMp4(request);
  }

  const videoTrackIds = new Set(videoSegments.map((segment) => segment.trackId));

  const hasVisualTransitions = videoSegments.some(
    (segment) => Boolean(segment.transitionOut),
  );

  if (
    videoSegments.length > 0 &&
    videoTrackIds.size === 1 &&
    videoSegments.every((segment) => segment.mediaType === "video") &&
    !hasVisualTransitions &&
    !requiresVideoGraph
  ) {
    const ordered = [...videoSegments].sort(
      (left, right) => left.timelineStartMs - right.timelineStartMs,
    );
    const segments: Array<{
      sourcePath?: string;
      sourceStartMs?: number;
      durationMs: number;
    }> = [];
    let previousEndMs = 0;

    for (const segment of ordered) {
      if (segment.timelineStartMs > previousEndMs) {
        segments.push({
          durationMs: segment.timelineStartMs - previousEndMs,
        });
      }

      segments.push({
        sourcePath: segment.sourcePath,
        sourceStartMs: segment.sourceStartMs,
        durationMs: segment.durationMs,
      });
      previousEndMs = segment.timelineEndMs;
    }

    const request = {
      segments,
      outputPath,
      width: plan.width,
      height: plan.height,
      frameRate: plan.frameRate,
      includeAudio: !videoSegments.every((segment) => segment.isMuted),
    };

    return jobId
      ? renderVideoSegmentsToMp4(request, jobId)
      : renderVideoSegmentsToMp4(request);
  }

  const sourceAudioSegments = videoSegments
    .filter(
      (segment) =>
        segment.mediaType === "video" &&
        !segment.isMuted &&
        segment.durationMs > 0,
    )
    .map((segment) => ({
      inputIndex: segment.inputIndex,
      sourceStartMs: segment.sourceStartMs,
      timelineStartMs: segment.timelineStartMs,
      durationMs: segment.durationMs,
      trackVolume: segment.trackVolume ?? 1,
      trackPan: segment.trackPan ?? 0,
      ...(segment.audioVolumeKeyframes?.length
        ? { audioVolumeKeyframes: segment.audioVolumeKeyframes }
        : {}),
      ...(segment.audioFadeInMs && segment.audioFadeInMs > 0
        ? { audioFadeInMs: Math.max(0, Math.floor(segment.audioFadeInMs)) }
        : {}),
      ...(segment.audioFadeOutMs && segment.audioFadeOutMs > 0
        ? { audioFadeOutMs: Math.max(0, Math.floor(segment.audioFadeOutMs)) }
        : {}),
    }));

  if (sourceAudioSegments.length > 0) {
    const durationSeconds = plan.durationMs / 1000;
    const request = {
      videoInputs: graph.inputs
        .sort((left, right) => left.inputIndex - right.inputIndex)
        .map((input) => input.sourcePath),
      videoInputMediaTypes: graph.inputs
        .sort((left, right) => left.inputIndex - right.inputIndex)
        .map((input) => {
          const segment = videoSegments.find(
            (candidate) => candidate.inputIndex === input.inputIndex,
          );
          return segment?.mediaType ?? "video";
        }),
      audioInputs: [],
      sourceAudioSegments,
      videoFilterComplex: graph.filterComplex,
      videoMap: graph.videoMap,
      audioFilterComplex:
        "anullsrc=r=48000:cl=stereo,atrim=duration=" +
        durationSeconds +
        ",asetpts=PTS-STARTPTS[aout]",
      audioMap: "[aout]",
      durationMs: plan.durationMs,
      width: plan.width,
      height: plan.height,
      frameRate: plan.frameRate,
      outputPath,
    };

    return jobId
      ? renderVideoAudioGraphToMp4(request, jobId)
      : renderVideoAudioGraphToMp4(request);
  }

  const request = {
    inputs: graph.inputs.map((input) => input.sourcePath),
    inputMediaTypes: orderedMediaTypes(videoSegments),
    outputPath,
    width: plan.width,
    height: plan.height,
    frameRate: plan.frameRate,
    filterComplex: graph.filterComplex,
    videoMap: graph.videoMap,
  };

  return jobId
    ? renderVideoGraphToMp4(request, jobId, plan.durationMs)
    : renderVideoGraphToMp4(request);
}
