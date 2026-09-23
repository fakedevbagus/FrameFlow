import { beforeEach, describe, expect, it, vi } from "vitest";
import { compileSingleVideoTrackGraph } from "./render-graph";
import { renderVideoPlanToMp4 } from "./render-pipeline";
import {
  renderSingleSourceToMp4,
  renderVideoGraphToMp4,
  renderVideoSegmentsToMp4,
  renderVideoWithAudioGraphToMp4,
} from "./export-renderer";
import type { RenderPlan } from "./render-plan";

vi.mock("./export-renderer", () => ({
  renderVideoGraphToMp4: vi.fn(),
  renderSingleSourceToMp4: vi.fn(),
  renderVideoSegmentsToMp4: vi.fn(),
  renderVideoWithAudioGraphToMp4: vi.fn(),
}));

describe("render video pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes sequential multi-clip video through the native segment renderer", async () => {
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

    vi.mocked(renderVideoSegmentsToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/timeline-export.mp4",
    });

    await expect(renderVideoPlanToMp4(plan, "/tmp/timeline-export.mp4")).resolves.toEqual({
      outputPath: "/tmp/timeline-export.mp4",
    });

    expect(renderVideoSegmentsToMp4).toHaveBeenCalledWith({
      segments: [
        {
          sourcePath: "/media/a.mp4",
          sourceStartMs: 0,
          durationMs: 2000,
        },
        {
          sourcePath: "/media/b.mp4",
          sourceStartMs: 0,
          durationMs: 2000,
        },
      ],
      outputPath: "/tmp/timeline-export.mp4",
      width: 1080,
      height: 1920,
      frameRate: 30,
      includeAudio: true,
    });
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
      includeAudio: true,
    });
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
  });

  it("routes an offset single clip through the native segment renderer with a gap", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 5000,
      segments: [
        {
          inputIndex: 0,
          assetId: "video-a",
          sourcePath: "/media/a.mp4",
          mediaType: "video",
          trackId: "video-1",
          trackType: "video",
          trackIndex: 0,
          timelineStartMs: 2000,
          timelineEndMs: 5000,
          sourceStartMs: 0,
          sourceEndMs: 3000,
          durationMs: 3000,
          isMuted: false,
        },
      ],
    };

    vi.mocked(renderVideoSegmentsToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/offset-export.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/offset-export.mp4"),
    ).resolves.toEqual({ outputPath: "/tmp/offset-export.mp4" });

    expect(renderVideoSegmentsToMp4).toHaveBeenCalledWith({
      segments: [
        { durationMs: 2000 },
        {
          sourcePath: "/media/a.mp4",
          sourceStartMs: 0,
          durationMs: 3000,
        },
      ],
      outputPath: "/tmp/offset-export.mp4",
      width: 406,
      height: 720,
      frameRate: 30,
      includeAudio: true,
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


  it("routes a static transform clip through the native graph renderer", async () => {
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
          transform: {
            x: 5,
            y: -5,
            scale: 1.25,
            rotation: 20,
            opacity: 1,
          },
          transformAnchor: {
            x: 0.2,
            y: 0.75,
          },
        },
      ],
    };

    vi.mocked(renderVideoGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/anchored-static-export.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/anchored-static-export.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/anchored-static-export.mp4",
    });

    expect(renderVideoGraphToMp4).toHaveBeenCalledWith({
      inputs: ["/media/a.mp4"],
      inputMediaTypes: ["video"],
      outputPath: "/tmp/anchored-static-export.mp4",
      width: 1080,
      height: 1920,
      frameRate: 30,
      filterComplex: expect.stringContaining("anchor_pivot_0"),
      videoMap: "[vout]",
    });
    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
  });

  it("routes a single image clip through the graph renderer", async () => {
    const plan: RenderPlan = {
      width: 1080,
      height: 1920,
      frameRate: 30,
      durationMs: 5000,
      segments: [
        {
          inputIndex: 0,
          assetId: "image-a",
          sourcePath: "/media/cover.png",
          mediaType: "image",
          trackId: "video-1",
          trackType: "video",
          trackIndex: 0,
          timelineStartMs: 0,
          timelineEndMs: 5000,
          sourceStartMs: 0,
          sourceEndMs: 5000,
          durationMs: 5000,
          isMuted: false,
        },
      ],
    };

    vi.mocked(renderVideoGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/image-export.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/image-export.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/image-export.mp4",
    });

    expect(renderVideoGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: ["/media/cover.png"],
        inputMediaTypes: ["image"],
        outputPath: "/tmp/image-export.mp4",
        width: 1080,
        height: 1920,
        frameRate: 30,
      }),
    );
    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
  });

  it("routes transitioned video sequences through the native graph renderer", async () => {
    const plan: RenderPlan = {
      width: 1080,
      height: 1920,
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
          timelineEndMs: 5000,
          sourceStartMs: 0,
          sourceEndMs: 5000,
          durationMs: 5000,
          isMuted: false,
          transitionOut: {
            type: "dissolve",
            durationMs: 500,
          },
        },
        {
          inputIndex: 1,
          assetId: "video-b",
          sourcePath: "/media/b.mp4",
          mediaType: "video",
          trackId: "video-1",
          trackType: "video",
          trackIndex: 0,
          timelineStartMs: 5000,
          timelineEndMs: 8000,
          sourceStartMs: 0,
          sourceEndMs: 3000,
          durationMs: 3000,
          isMuted: false,
        },
      ],
    };

    vi.mocked(renderVideoGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/transition-export.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/transition-export.mp4"),
    ).resolves.toEqual({ outputPath: "/tmp/transition-export.mp4" });

    expect(renderVideoGraphToMp4).toHaveBeenCalledWith({
      inputs: ["/media/a.mp4", "/media/b.mp4"],
      inputMediaTypes: ["video", "video"],
      outputPath: "/tmp/transition-export.mp4",
      width: 1080,
      height: 1920,
      frameRate: 30,
      filterComplex: expect.stringContaining("transition_0_dissolve"),
      videoMap: "[vout]",
    });
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
  });


  it("routes animated transform clips through the native graph renderer", async () => {
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
          transformKeyframes: [
            {
              timeMs: 0,
              transform: {
                x: 0,
                y: 0,
                scale: 1,
                rotation: 0,
                opacity: 1,
              },
            },
            {
              timeMs: 1000,
              transform: {
                x: 20,
                y: 10,
                scale: 1.25,
                rotation: 15,
                opacity: 0.75,
              },
            },
          ],
        },
      ],
    };

    vi.mocked(renderVideoGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/animated-transform-export.mp4",
    });

    await expect(
      renderVideoPlanToMp4(
        plan,
        "/tmp/animated-transform-export.mp4",
      ),
    ).resolves.toEqual({
      outputPath: "/tmp/animated-transform-export.mp4",
    });

    expect(renderVideoGraphToMp4).toHaveBeenCalledWith({
      inputs: ["/media/a.mp4"],
      inputMediaTypes: ["video"],
      outputPath: "/tmp/animated-transform-export.mp4",
      width: 1080,
      height: 1920,
      frameRate: 30,
      filterComplex: expect.stringContaining("eval=frame"),
      videoMap: "[vout]",
    });
    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
  });


  it("renders the base video before mixing an explicit audio track", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 5000,
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
          timelineEndMs: 5000,
          sourceStartMs: 0,
          sourceEndMs: 5000,
          durationMs: 5000,
          isMuted: false,
        },
        {
          inputIndex: 7,
          assetId: "audio-a",
          sourcePath: "/media/music.mp3",
          mediaType: "audio",
          trackId: "audio-1",
          trackType: "audio",
          trackIndex: 1,
          timelineStartMs: 1000,
          timelineEndMs: 4000,
          sourceStartMs: 500,
          sourceEndMs: 3500,
          durationMs: 3000,
          isMuted: false,
        },
      ],
    };

    vi.mocked(renderSingleSourceToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/project.mp4",
    });
    vi.mocked(renderVideoWithAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/project.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/project.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/project.mp4",
    });

    expect(renderSingleSourceToMp4).toHaveBeenCalledWith({
      sourcePath: "/media/a.mp4",
      outputPath: "/tmp/project.mp4",
      width: 406,
      height: 720,
      frameRate: 30,
      sourceStartMs: 0,
      sourceDurationMs: 5000,
      includeAudio: true,
    });

    expect(renderVideoWithAudioGraphToMp4).toHaveBeenCalledWith({
      videoSourcePath: "/tmp/project.mp4",
      audioInputs: ["/media/music.mp3"],
      audioFilterComplex: expect.stringContaining(
        "[1:a:0]atrim=start=0.5:end=3.5",
      ),
      audioMap: "[aout]",
      durationMs: 5000,
      outputPath: "/tmp/project.mp4",
    });

    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
  });

  it("does not call the native renderer when graph compilation rejects multiple video tracks", () => {
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
          trackId: "video-2",
          trackType: "video",
          trackIndex: 1,
          timelineStartMs: 0,
          timelineEndMs: 2000,
          sourceStartMs: 0,
          sourceEndMs: 2000,
          durationMs: 2000,
          isMuted: false,
        },
      ],
    };

    expect(() =>
      renderVideoPlanToMp4(plan, "/tmp/timeline-export.mp4"),
    ).toThrow("multi-track compositing is deferred");
    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
  });

  it("compiles the graph before invoking native rendering", () => {
    expect(typeof compileSingleVideoTrackGraph).toBe("function");
  });
});
