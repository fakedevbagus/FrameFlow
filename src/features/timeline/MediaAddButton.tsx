import type { MediaAsset, Project } from "../project/domain";
import { addAssetToTimeline } from "./commands";

export function addMediaToTimeline(project: Project, asset: MediaAsset): Project {
  return addAssetToTimeline(project, asset.id);
}
