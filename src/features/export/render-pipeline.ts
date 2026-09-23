import type { RenderPlan } from "./render-plan";
import {
  renderSingleSourceToMp4,
  renderVideoGraphToMp4,
  renderVideoSegmentsToMp4,
  renderVideoWithAudioGraphToMp4,
  type NativeExportRenderResult,
} from "./export-renderer";
import { compileAudioTracksGraph } from "./audio-render-graph";
import { compileSingleVideoTrackGraph } from "./render-graph";

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

  const videoPlan: RenderPlan = {
    ...plan,
    segments: videoSegments,
  };

  if (audioSegments.length === 0) {
    return renderVideoOnlyPlanToMp4(videoPlan, outputPath, jobId);
  }

  const audioGraph = compileAudioTracksGraph(plan, {
    inputIndexOffset: 1,
  });

  return renderVideoOnlyPlanToMp4(videoPlan, outputPath, jobId).then(() => {
    const request = {
      videoSourcePath: outputPath,
      audioInputs: audioGraph.inputs
        .sort((left, right) => left.inputIndex - right.inputIndex)
        .map((input) => input.sourcePath),
      audioFilterComplex: audioGraph.filterComplex,
      audioMap: audioGraph.audioMap,
      durationMs: plan.durationMs,
      outputPath,
    };

    return jobId
      ? renderVideoWithAudioGraphToMp4(request, jobId)
      : renderVideoWithAudioGraphToMp4(request);
  });
}

function orderedMediaTypes(
  segments: RenderPlan["segments"],
): RenderPlan["segments"][number]["mediaType"][] {
  return [...segments]
    .sort((left, right) => left.timelineStartMs - right.timelineStartMs)
    .map((segment) => segment.mediaType);
}

function renderVideoOnlyPlanToMp4(
  plan: RenderPlan,
  outputPath: string,
  jobId?: string,
): Promise<NativeExportRenderResult> {
  const videoSegments = plan.segments.filter(
    (segment) => segment.trackType === "video",
  );
  const graph = compileSingleVideoTrackGraph(plan);

  if (
    videoSegments.length === 1 &&
    videoSegments[0].timelineStartMs === 0 &&
    videoSegments[0].mediaType === "video"
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
      includeAudio: true,
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
    !hasVisualTransitions
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
      includeAudio: true,
    };

    return jobId
      ? renderVideoSegmentsToMp4(request, jobId)
      : renderVideoSegmentsToMp4(request);
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
