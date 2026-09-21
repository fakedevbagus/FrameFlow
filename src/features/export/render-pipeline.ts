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

  return renderVideoOnlyPlanToMp4(videoPlan, outputPath, jobId).then(() =>
    renderVideoWithAudioGraphToMp4({
      videoSourcePath: outputPath,
      audioInputs: audioGraph.inputs
        .sort((left, right) => left.inputIndex - right.inputIndex)
        .map((input) => input.sourcePath),
      audioFilterComplex: audioGraph.filterComplex,
      audioMap: audioGraph.audioMap,
      durationMs: plan.durationMs,
      outputPath,
    }, ...(jobId ? [jobId] : [])),
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
  const graph = compileSingleVideoTrackGraph(plan);

  if (
    videoSegments.length === 1 &&
    videoSegments[0].timelineStartMs === 0
  ) {
    const segment = videoSegments[0];

    return renderSingleSourceToMp4({
      sourcePath: segment.sourcePath,
      outputPath,
      width: plan.width,
      height: plan.height,
      frameRate: plan.frameRate,
      sourceStartMs: segment.sourceStartMs,
      sourceDurationMs: segment.durationMs,
      includeAudio: true,
    }, ...(jobId ? [jobId] : []));
  }

  const videoTrackIds = new Set(videoSegments.map((segment) => segment.trackId));

  if (videoSegments.length > 0 && videoTrackIds.size === 1) {
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

    return renderVideoSegmentsToMp4({
      segments,
      outputPath,
      width: plan.width,
      height: plan.height,
      frameRate: plan.frameRate,
      includeAudio: true,
    }, ...(jobId ? [jobId] : []));
  }

  return renderVideoGraphToMp4({
    inputs: graph.inputs.map((input) => input.sourcePath),
    outputPath,
    width: plan.width,
    height: plan.height,
    frameRate: plan.frameRate,
    filterComplex: graph.filterComplex,
    videoMap: graph.videoMap,
  }, ...(jobId ? [jobId, plan.durationMs] : []));
}
