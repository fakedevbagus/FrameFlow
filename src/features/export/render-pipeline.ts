import type { RenderPlan } from "./render-plan";
import {
  renderVideoGraphToMp4,
  type NativeExportRenderResult,
} from "./export-renderer";
import { compileSingleVideoTrackGraph } from "./render-graph";

export function renderVideoPlanToMp4(
  plan: RenderPlan,
  outputPath: string,
): Promise<NativeExportRenderResult> {
  const graph = compileSingleVideoTrackGraph(plan);

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
