import type { RenderPlan } from "./render-plan";
import {
  renderSingleSourceToMp4,
  renderVideoGraphToMp4,
  renderVideoSegmentsToMp4,
  type NativeExportRenderResult,
} from "./export-renderer";
import { compileSingleVideoTrackGraph } from "./render-graph";

export function renderVideoPlanToMp4(
  plan: RenderPlan,
  outputPath: string,
): Promise<NativeExportRenderResult> {
  const videoSegments = plan.segments.filter(
    (segment) => segment.trackType === "video",
  );

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
    });
  }

  const audioSegments = plan.segments.filter(
    (segment) => segment.trackType === "audio" && segment.durationMs > 0,
  );
  const videoTrackIds = new Set(videoSegments.map((segment) => segment.trackId));

  if (videoSegments.length > 1 && audioSegments.length === 0 && videoTrackIds.size === 1) {
    compileSingleVideoTrackGraph(plan);

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
    });
  }

  return renderVideoGraphToMp4({
    inputs: graph.inputs.map((input) => input.sourcePath),
    outputPath,
    width: plan.width,
    height: plan.height,
    frameRate: plan.frameRate,
    filterComplex: graph.filterComplex,
    videoMap: graph.videoMap,
  });
}
