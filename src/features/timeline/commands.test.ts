import { describe, expect, it } from "vitest";
import { createProject } from "../project/domain";
import {
  addAssetToTimeline,
  moveClipOnTimeline,
  removeClipFromTimeline,
  splitClipAtTime,
  trimClipEnd,
  trimClipStart,
} from "./commands";

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


describe("removeClipFromTimeline", () => {
  it("removes a clip and updates the project timestamp", () => {
    const project = createProject({
      id: "project-2",
      now: new Date("2026-09-19T00:00:00.000Z"),
    });
    project.assets.push({
      id: "asset-video",
      name: "clip.mp4",
      mediaType: "video",
      sourcePath: "/clip.mp4",
      durationMs: 12000,
    });

    const populated = addAssetToTimeline(
      project,
      "asset-video",
      new Date("2026-09-19T01:00:00.000Z"),
    );
    const clipId = populated.tracks[0].clips[0].id;
    const updated = removeClipFromTimeline(
      populated,
      clipId,
      new Date("2026-09-19T01:00:01.000Z"),
    );

    expect(updated.tracks[0].clips).toHaveLength(0);
    expect(updated.assets).toHaveLength(1);
    expect(updated.updatedAt).toBe("2026-09-19T01:00:01.000Z");
  });

  it("throws when the clip does not exist", () => {
    const project = createProject({ id: "project-3" });

    expect(() => removeClipFromTimeline(project, "missing-clip")).toThrow(
      "Clip does not exist in this project.",
    );
  });
});


describe("moveClipOnTimeline", () => {
  it("moves a clip without changing its source range", () => {
    const project = createProject({ id: "move-project" });
    project.assets.push({
      id: "move-asset",
      name: "move.mp4",
      mediaType: "video",
      sourcePath: "/move.mp4",
      durationMs: 10_000,
    });

    const populated = addAssetToTimeline(project, "move-asset");
    const clipId = populated.tracks[0].clips[0].id;
    const updated = moveClipOnTimeline(
      populated,
      clipId,
      4_000,
      new Date("2026-09-20T01:00:00.000Z"),
    );

    expect(updated.tracks[0].clips[0]).toMatchObject({
      id: clipId,
      timelineStartMs: 4_000,
      sourceStartMs: 0,
      sourceEndMs: 10_000,
    });
    expect(updated.updatedAt).toBe("2026-09-20T01:00:00.000Z");
  });

  it("rejects moving a clip before the timeline origin", () => {
    const project = createProject({ id: "move-project-2" });

    expect(() =>
      moveClipOnTimeline(project, "missing-clip", -1),
    ).toThrow("Clip does not exist in this project.");
  });
});

describe("trimClipStart", () => {
  it("trims the source start and shifts the clip on the timeline", () => {
    const project = createProject({ id: "trim-start-project" });
    project.assets.push({
      id: "trim-start-asset",
      name: "trim-start.mp4",
      mediaType: "video",
      sourcePath: "/trim-start.mp4",
      durationMs: 10_000,
    });

    const populated = addAssetToTimeline(project, "trim-start-asset");
    const clipId = populated.tracks[0].clips[0].id;
    const updated = trimClipStart(
      populated,
      clipId,
      2_000,
      new Date("2026-09-20T01:01:00.000Z"),
    );

    expect(updated.tracks[0].clips[0]).toMatchObject({
      timelineStartMs: 2_000,
      sourceStartMs: 2_000,
      sourceEndMs: 10_000,
    });
  });

  it("rejects a start trim that empties the clip", () => {
    const project = createProject({ id: "trim-start-project-2" });
    project.assets.push({
      id: "trim-start-asset-2",
      name: "trim-start-2.mp4",
      mediaType: "video",
      sourcePath: "/trim-start-2.mp4",
      durationMs: 10_000,
    });

    const populated = addAssetToTimeline(project, "trim-start-asset-2");
    const clipId = populated.tracks[0].clips[0].id;

    expect(() => trimClipStart(populated, clipId, 10_000)).toThrow(
      "Clip start trim would create an invalid source range.",
    );
  });
});

describe("trimClipEnd", () => {
  it("trims the source end without shifting the timeline start", () => {
    const project = createProject({ id: "trim-end-project" });
    project.assets.push({
      id: "trim-end-asset",
      name: "trim-end.mp4",
      mediaType: "video",
      sourcePath: "/trim-end.mp4",
      durationMs: 10_000,
    });

    const populated = addAssetToTimeline(project, "trim-end-asset");
    const clipId = populated.tracks[0].clips[0].id;
    const updated = trimClipEnd(
      populated,
      clipId,
      6_000,
      new Date("2026-09-20T01:02:00.000Z"),
    );

    expect(updated.tracks[0].clips[0]).toMatchObject({
      timelineStartMs: 0,
      sourceStartMs: 0,
      sourceEndMs: 6_000,
    });
    expect(updated.updatedAt).toBe("2026-09-20T01:02:00.000Z");
  });

  it("rejects extending past the source duration", () => {
    const project = createProject({ id: "trim-end-project-2" });
    project.assets.push({
      id: "trim-end-asset-2",
      name: "trim-end-2.mp4",
      mediaType: "video",
      sourcePath: "/trim-end-2.mp4",
      durationMs: 10_000,
    });

    const populated = addAssetToTimeline(project, "trim-end-asset-2");
    const clipId = populated.tracks[0].clips[0].id;

    expect(() => trimClipEnd(populated, clipId, 11_000)).toThrow(
      "Clip end cannot exceed the source media duration.",
    );
  });
});

describe("splitClipAtTime", () => {
  it("splits a clip into two adjacent source ranges", () => {
    const project = createProject({ id: "split-project" });
    project.assets.push({
      id: "split-asset",
      name: "split.mp4",
      mediaType: "video",
      sourcePath: "/split.mp4",
      durationMs: 10_000,
    });

    const populated = addAssetToTimeline(project, "split-asset");
    const clipId = populated.tracks[0].clips[0].id;
    const updated = splitClipAtTime(
      populated,
      clipId,
      4_000,
      new Date("2026-09-20T01:03:00.000Z"),
    );

    expect(updated.tracks[0].clips).toHaveLength(2);
    expect(updated.tracks[0].clips[0]).toMatchObject({
      id: clipId,
      timelineStartMs: 0,
      sourceStartMs: 0,
      sourceEndMs: 4_000,
    });
    expect(updated.tracks[0].clips[1]).toMatchObject({
      timelineStartMs: 4_000,
      sourceStartMs: 4_000,
      sourceEndMs: 10_000,
    });
    expect(updated.updatedAt).toBe("2026-09-20T01:03:00.000Z");
  });

  it("rejects a split at the clip boundary", () => {
    const project = createProject({ id: "split-project-2" });
    project.assets.push({
      id: "split-asset-2",
      name: "split-2.mp4",
      mediaType: "video",
      sourcePath: "/split-2.mp4",
      durationMs: 10_000,
    });

    const populated = addAssetToTimeline(project, "split-asset-2");
    const clipId = populated.tracks[0].clips[0].id;

    expect(() => splitClipAtTime(populated, clipId, 0)).toThrow(
      "Split time must be inside the selected clip.",
    );
  });
});
