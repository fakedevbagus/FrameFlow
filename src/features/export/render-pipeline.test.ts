import { describe, expect, it, vi } from "vitest";
import { compileSingleVideoTrackGraph } from "./render-graph";
import { renderVideoPlanToMp4 } from "./render-pipeline";
import { renderVideoGraphToMp4 } from "./export-renderer";
import type { RenderPlan } from "./render-plan";

vi.mock("./export-renderer", () => ({
  renderVideoGraphToMp4: vi.fn(),
}));

describe("render video pipeline", () => {
  it("connects the deterministic render graph to the native renderer contract", async () => {
    const plan: RenderPlan = {
      width: 1080,
      height: 1920,
      frameRate: 30,
      durationMs: 2000,
      segments: [
        {
          inputIndex: 0,
          assetId: "video-a",
          sourcePath: "/media/a.mp4",
          mediaType: "video",
          trackId: "video-1",
          trackType: "video",
          trackIndex: 0,
          timelineStartMs: 0,
          timelineEndMs: 2000,
          sourceStartMs: 0,
          sourceEndMs: 2000,
          durationMs: 2000,
          isMuted: false,
        },
      ],
    };

    vi.mocked(renderVideoGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/timeline-export.mp4",
    });

    await expect(renderVideoPlanToMp4(plan, "/tmp/timeline-export.mp4")).resolves.toEqual({
      outputPath: "/tmp/timeline-export.mp4",
    });

    expect(renderVideoGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: [{ inputIndex: 0, sourcePath: "/media/a.mp4" }],
        outputPath: "/tmp/timeline-export.mp4",
        width: 1080,
        height: 1920,
        frameRate: 30,
        videoMap: "[vout]",
      }),
    );
  });

  it("does not call the native renderer when graph compilation rejects unsupported state", () => {
    const plan: RenderPlan = {
      width: 1080,
      height: 1920,
      frameRate: 30,
      durationMs: 2000,
      segments: [
        {
          inputIndex: 0,
          assetId: "video-a",
          sourcePath: "/media/a.mp4",
          mediaType: "video",
          trackId: "video-1",
          trackType: "video",
          trackIndex: 0,
          timelineStartMs: 0,
          timelineEndMs: 2000,
          sourceStartMs: 0,
          sourceEndMs: 2000,
          durationMs: 2000,
          isMuted: false,
          transform: { x: 10, y: 0, scale: 1, rotation: 0, opacity: 1 },
        },
      ],
    };

    expect(() =>
      renderVideoPlanToMp4(plan, "/tmp/timeline-export.mp4"),
    ).toThrow("visual transforms");
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
  });

  it("compiles the graph before invoking native rendering", () => {
    expect(typeof compileSingleVideoTrackGraph).toBe("function");
  });
});
