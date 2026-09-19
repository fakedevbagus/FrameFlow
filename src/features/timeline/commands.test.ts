import { describe, expect, it } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline } from "./commands";

describe("addAssetToTimeline", () => {
  it("adds video to the video track", () => {
    const project = createProject({ id: "project-1", now: new Date("2026-09-19T00:00:00.000Z") });
    project.assets.push({ id: "asset-1", name: "clip.mp4", mediaType: "video", sourcePath: "/clip.mp4", durationMs: 12000 });

    const updated = addAssetToTimeline(project, "asset-1", new Date("2026-09-19T01:00:00.000Z"));

    expect(updated.tracks[0].clips[0]).toMatchObject({ assetId: "asset-1", timelineStartMs: 0, sourceEndMs: 12000 });
    expect(updated.updatedAt).toBe("2026-09-19T01:00:00.000Z");
  });
});
