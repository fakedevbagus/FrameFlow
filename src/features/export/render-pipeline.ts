import type { RenderPlan } from "./render-plan";
import {
  renderSingleSourceToMp4,
  renderVideoGraphToMp4,
  type NativeExportRenderResult,
} from "./export-renderer";
import { compileSingleVideoTrackGraph } from "./render-graph";

export function renderVideoPlanToMp4(
  plan: RenderPlan,
  outputPath: string,
): Promise<NativeExportRenderResult> {
  const graph = compileSingleVideoTrackGraph(plan);
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
