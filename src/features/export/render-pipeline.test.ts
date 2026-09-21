import { beforeEach, describe, expect, it, vi } from "vitest";
import { compileSingleVideoTrackGraph } from "./render-graph";
import { renderVideoPlanToMp4 } from "./render-pipeline";
import {
  renderSingleSourceToMp4,
  renderVideoGraphToMp4,
  renderVideoSegmentsToMp4,
} from "./export-renderer";
import type { RenderPlan } from "./render-plan";

vi.mock("./export-renderer", () => ({
  renderVideoGraphToMp4: vi.fn(),
  renderSingleSourceToMp4: vi.fn(),
  renderVideoSegmentsToMp4: vi.fn(),
}));

describe("render video pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connects a multi-clip render graph to the native renderer contract", async () => {
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
        {
          inputIndex: 1,
          assetId: "video-b",
          sourcePath: "/media/b.mp4",
          mediaType: "video",
          trackId: "video-1",
          trackType: "video",
          trackIndex: 0,
          timelineStartMs: 2000,
          timelineEndMs: 4000,
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
        inputs: ["/media/a.mp4", "/media/b.mp4"],
        outputPath: "/tmp/timeline-export.mp4",
        width: 1080,
        height: 1920,
        frameRate: 30,
        videoMap: "[vout]",
      }),
    );
  });

  it("routes sequential clips on one video track through the native segment renderer", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 8000,
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
          sourceStartMs: 500,
          sourceEndMs: 2500,
          durationMs: 2000,
          isMuted: false,
        },
        {
          inputIndex: 1,
          assetId: "video-b",
          sourcePath: "/media/b.mp4",
          mediaType: "video",
          trackId: "video-1",
          trackType: "video",
          trackIndex: 0,
          timelineStartMs: 4000,
          timelineEndMs: 8000,
          sourceStartMs: 0,
          sourceEndMs: 4000,
          durationMs: 4000,
          isMuted: false,
        },
      ],
    };

    vi.mocked(renderVideoSegmentsToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/multi-export.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/multi-export.mp4"),
    ).resolves.toEqual({ outputPath: "/tmp/multi-export.mp4" });

    expect(renderVideoSegmentsToMp4).toHaveBeenCalledWith({
      segments: [
        {
          sourcePath: "/media/a.mp4",
          sourceStartMs: 500,
          durationMs: 2000,
        },
        {
          durationMs: 2000,
        },
        {
          sourcePath: "/media/b.mp4",
          sourceStartMs: 0,
          durationMs: 4000,
        },
      ],
      outputPath: "/tmp/multi-export.mp4",
      width: 406,
      height: 720,
      frameRate: 30,
    });
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
  });

  it("routes a single clip at timeline zero through the native single-source renderer", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 5038,
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
          timelineEndMs: 5038,
          sourceStartMs: 0,
          sourceEndMs: 5038,
          durationMs: 5038,
          isMuted: false,
        },
      ],
    };

    vi.mocked(renderSingleSourceToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/timeline-export.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/timeline-export.mp4"),
    ).resolves.toEqual({ outputPath: "/tmp/timeline-export.mp4" });

    expect(renderSingleSourceToMp4).toHaveBeenCalledWith({
      sourcePath: "/media/a.mp4",
      outputPath: "/tmp/timeline-export.mp4",
      width: 406,
      height: 720,
      frameRate: 30,
      sourceStartMs: 0,
      sourceDurationMs: 5038,
      includeAudio: true,
    });
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
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
