import { describe, expect, it } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline } from "./commands";
import { getClipDurationMs, getTimelineDurationMs } from "./metrics";

describe("timeline metrics", () => {
  it("calculates clip duration from the source range", () => {
    expect(
      getClipDurationMs({
        id: "clip-1",
        assetId: "asset-1",
        timelineStartMs: 2_000,
        sourceStartMs: 1_000,
        sourceEndMs: 8_000,
      }),
    ).toBe(7_000);
  });

  it("uses the latest clip end while keeping a minimum timeline duration", () => {
    const project = createProject({ id: "metrics-project" });
    project.assets.push({
      id: "asset-1",
      name: "clip.mp4",
      mediaType: "video",
      sourcePath: "/clip.mp4",
      durationMs: 15_000,
    });

    const populated = addAssetToTimeline(project, "asset-1");

    expect(getTimelineDurationMs(populated)).toBe(20_000);

    const movedProject = {
      ...populated,
      tracks: populated.tracks.map((track) =>
        track.type === "video"
          ? {
              ...track,
              clips: track.clips.map((clip) => ({
                ...clip,
                timelineStartMs: 10_000,
              })),
            }
          : track,
      ),
    };

    expect(getTimelineDurationMs(movedProject)).toBe(25_000);
  });
});
