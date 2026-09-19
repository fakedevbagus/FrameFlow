import { describe, expect, it } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline } from "./commands";

describe("addAssetToTimeline", () => {
  it("adds video and image assets to the video track", () => {
    const project = createProject({ id: "project-1", now: new Date("2026-09-19T00:00:00.000Z") });
    project.assets.push(
      { id: "asset-video", name: "clip.mp4", mediaType: "video", sourcePath: "/clip.mp4", durationMs: 12000 },
      { id: "asset-image", name: "logo.png", mediaType: "image", sourcePath: "/logo.png", durationMs: null },
      { id: "asset-audio", name: "music.mp3", mediaType: "audio", sourcePath: "/music.mp3", durationMs: 5000 },
    );

    const afterVideo = addAssetToTimeline(project, "asset-video", new Date("2026-09-19T01:00:00.000Z"));
    const afterImage = addAssetToTimeline(afterVideo, "asset-image", new Date("2026-09-19T01:00:01.000Z"));
    const updated = addAssetToTimeline(afterImage, "asset-audio", new Date("2026-09-19T01:00:02.000Z"));

    expect(updated.tracks[0].clips).toHaveLength(2);
    expect(updated.tracks[0].clips[0]).toMatchObject({ assetId: "asset-video", timelineStartMs: 0, sourceEndMs: 12000 });
    expect(updated.tracks[0].clips[1]).toMatchObject({ assetId: "asset-image", timelineStartMs: 12000, sourceEndMs: 3000 });
    expect(updated.tracks[1].clips[0]).toMatchObject({ assetId: "asset-audio", timelineStartMs: 0, sourceEndMs: 5000 });
    expect(updated.updatedAt).toBe("2026-09-19T01:00:02.000Z");
  });
});
