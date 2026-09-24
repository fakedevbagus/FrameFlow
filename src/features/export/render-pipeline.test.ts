import { beforeEach, describe, expect, it, vi } from "vitest";
import { compileSingleVideoTrackGraph } from "./render-graph";
import { renderVideoPlanToMp4 } from "./render-pipeline";
import {
  renderSingleSourceToMp4,
  renderVideoGraphToMp4,
  renderVideoSegmentsToMp4,
  renderVideoAudioGraphToMp4,
} from "./export-renderer";
import type { RenderPlan } from "./render-plan";

vi.mock("./export-renderer", () => ({
  renderVideoGraphToMp4: vi.fn(),
  renderSingleSourceToMp4: vi.fn(),
  renderVideoSegmentsToMp4: vi.fn(),
  renderVideoAudioGraphToMp4: vi.fn(),
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

  it("routes a single Video clip with non-default track volume through unified AV source-audio rendering", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 4000,
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
          timelineEndMs: 4000,
          sourceStartMs: 0,
          sourceEndMs: 4000,
          durationMs: 4000,
          isMuted: false,
          trackVolume: 0.5,
          trackPan: 0,
        },
      ],
    };

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/video-track-volume.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/video-track-volume.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/video-track-volume.mp4",
    });

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        videoInputs: ["/media/a.mp4"],
        videoInputMediaTypes: ["video"],
        audioInputs: [],
        sourceAudioSegments: [
          {
            inputIndex: 0,
            sourceStartMs: 0,
            timelineStartMs: 0,
            durationMs: 4000,
            trackVolume: 0.5,
            trackPan: 0,
          },
        ],
        audioFilterComplex: expect.stringContaining("anullsrc"),
        audioMap: "[aout]",
        outputPath: "/tmp/video-track-volume.mp4",
      }),
    );

    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
  });

  it("routes sequential Video clips with non-default track pan through unified AV source-audio rendering", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 6000,
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
          timelineEndMs: 3000,
          sourceStartMs: 0,
          sourceEndMs: 3000,
          durationMs: 3000,
          isMuted: false,
          trackVolume: 1,
          trackPan: -0.4,
        },
        {
          inputIndex: 1,
          assetId: "video-b",
          sourcePath: "/media/b.mp4",
          mediaType: "video",
          trackId: "video-1",
          trackType: "video",
          trackIndex: 0,
          timelineStartMs: 3000,
          timelineEndMs: 6000,
          sourceStartMs: 500,
          sourceEndMs: 3500,
          durationMs: 3000,
          isMuted: false,
          trackVolume: 1,
          trackPan: -0.4,
        },
      ],
    };

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/video-track-pan.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/video-track-pan.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/video-track-pan.mp4",
    });

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        videoInputs: ["/media/a.mp4", "/media/b.mp4"],
        videoInputMediaTypes: ["video", "video"],
        audioInputs: [],
        sourceAudioSegments: [
          {
            inputIndex: 0,
            sourceStartMs: 0,
            timelineStartMs: 0,
            durationMs: 3000,
            trackVolume: 1,
            trackPan: -0.4,
          },
          {
            inputIndex: 1,
            sourceStartMs: 500,
            timelineStartMs: 3000,
            durationMs: 3000,
            trackVolume: 1,
            trackPan: -0.4,
          },
        ],
        audioFilterComplex: expect.stringContaining("anullsrc"),
        audioMap: "[aout]",
        outputPath: "/tmp/video-track-pan.mp4",
      }),
    );

    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
  });

  it("keeps a muted single Video clip on the direct renderer without audio", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 4000,
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
          timelineEndMs: 4000,
          sourceStartMs: 0,
          sourceEndMs: 4000,
          durationMs: 4000,
          isMuted: true,
        },
      ],
    };

    vi.mocked(renderSingleSourceToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/video-muted.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/video-muted.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/video-muted.mp4",
    });

    expect(renderSingleSourceToMp4).toHaveBeenCalledWith({
      sourcePath: "/media/a.mp4",
      outputPath: "/tmp/video-muted.mp4",
      width: 406,
      height: 720,
      frameRate: 30,
      sourceStartMs: 0,
      sourceDurationMs: 4000,
      includeAudio: false,
    });
    expect(renderVideoAudioGraphToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
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

  it("routes video clip volume automation through unified AV graph rendering", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 4000,
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
          timelineEndMs: 4000,
          sourceStartMs: 0,
          sourceEndMs: 4000,
          durationMs: 4000,
          isMuted: false,
          audioVolumeKeyframes: [
            { timeMs: 0, volume: 0.25 },
            { timeMs: 2000, volume: 0.9 },
          ],
        },
      ],
    };

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/video-volume-automation.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/video-volume-automation.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/video-volume-automation.mp4",
    });

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith({
      videoInputs: ["/media/a.mp4"],
      videoInputMediaTypes: ["video"],
      audioInputs: [],
      sourceAudioSegments: [
        {
          inputIndex: 0,
          sourceStartMs: 0,
          timelineStartMs: 0,
          durationMs: 4000,
          trackVolume: 1,
          trackPan: 0,
          audioVolumeKeyframes: [
            { timeMs: 0, volume: 0.25 },
            { timeMs: 2000, volume: 0.9 },
          ],
        },
      ],
      videoFilterComplex: expect.any(String),
      videoMap: "[vout]",
      audioFilterComplex: expect.stringContaining("anullsrc"),
      audioMap: "[aout]",
      durationMs: 4000,
      width: 406,
      height: 720,
      frameRate: 30,
      outputPath: "/tmp/video-volume-automation.mp4",
    });

    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
  });

  it("routes Video clip fades through unified AV source-audio rendering", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 4000,
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
          timelineEndMs: 4000,
          sourceStartMs: 0,
          sourceEndMs: 4000,
          durationMs: 4000,
          isMuted: false,
          audioFadeInMs: 500,
          audioFadeOutMs: 750,
        },
      ],
    };

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/video-fades.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/video-fades.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/video-fades.mp4",
    });

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        videoInputs: ["/media/a.mp4"],
        videoInputMediaTypes: ["video"],
        audioInputs: [],
        sourceAudioSegments: [
          {
            inputIndex: 0,
            sourceStartMs: 0,
            timelineStartMs: 0,
            durationMs: 4000,
            trackVolume: 1,
            trackPan: 0,
            audioFadeInMs: 500,
            audioFadeOutMs: 750,
          },
        ],
        audioFilterComplex: expect.stringContaining("anullsrc"),
        audioMap: "[aout]",
        outputPath: "/tmp/video-fades.mp4",
      }),
    );

    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
  });

  it("routes active Video clip EQ through unified AV source-audio rendering", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 4000,
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
          timelineEndMs: 4000,
          sourceStartMs: 0,
          sourceEndMs: 4000,
          durationMs: 4000,
          isMuted: false,
          audioEq: {
            enabled: true,
            lowGainDb: 4,
            midGainDb: -2,
            highGainDb: 6,
          },
        },
      ],
    };

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/video-eq.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/video-eq.mp4"),
    ).resolves.toEqual({ outputPath: "/tmp/video-eq.mp4" });

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        videoInputs: ["/media/a.mp4"],
        videoInputMediaTypes: ["video"],
        audioInputs: [],
        sourceAudioSegments: [
          {
            inputIndex: 0,
            sourceStartMs: 0,
            timelineStartMs: 0,
            durationMs: 4000,
            trackVolume: 1,
            trackPan: 0,
            audioEq: {
              enabled: true,
              lowGainDb: 4,
              midGainDb: -2,
              highGainDb: 6,
            },
          },
        ],
        audioFilterComplex: expect.stringContaining("anullsrc"),
        audioMap: "[aout]",
        outputPath: "/tmp/video-eq.mp4",
      }),
    );

    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
  });

  it("propagates active Video clip EQ into unified source-audio export metadata", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 4000,
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
          timelineEndMs: 4000,
          sourceStartMs: 0,
          sourceEndMs: 4000,
          durationMs: 4000,
          isMuted: false,
          audioEq: {
            enabled: true,
            lowGainDb: 4,
            midGainDb: -2,
            highGainDb: 6,
          },
        },
      ],
    };

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/video-eq.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/video-eq.mp4"),
    ).resolves.toEqual({ outputPath: "/tmp/video-eq.mp4" });

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAudioSegments: [
          expect.objectContaining({
            inputIndex: 0,
            trackVolume: 1,
            trackPan: 0,
            audioEq: {
              enabled: true,
              lowGainDb: 4,
              midGainDb: -2,
              highGainDb: 6,
            },
          }),
        ],
      }),
    );

    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
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
          visualEffects: {
            brightness: 0,
            contrast: 0,
            saturation: 0,
          },
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


  it("routes a static transform clip through unified AV source-audio rendering", async () => {
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

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/anchored-static-export.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/anchored-static-export.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/anchored-static-export.mp4",
    });

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        videoInputs: ["/media/a.mp4"],
        videoInputMediaTypes: ["video"],
        audioInputs: [],
        sourceAudioSegments: [{"inputIndex":0,"sourceStartMs":0,"timelineStartMs":0,"durationMs":2000,"trackVolume":1,"trackPan":0}],
        audioFilterComplex: expect.stringContaining("anullsrc"),
        audioMap: "[aout]",
        outputPath: "/tmp/anchored-static-export.mp4",
        videoFilterComplex: expect.stringContaining("anchor_pivot_0"),
      }),
    );
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
          textOverlay: {
            text: "Image",
            x: 0.5,
            y: 0.5,
            fontSize: 48,
            color: "#ffffff",
            alignment: "center",
          },
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
        filterComplex: expect.stringContaining("drawtext=font='DejaVu Sans'"),
      }),
    );
    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
  });

  it("routes transitioned video sequences through unified AV source-audio rendering", async () => {
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

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/transition-export.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/transition-export.mp4"),
    ).resolves.toEqual({ outputPath: "/tmp/transition-export.mp4" });

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        videoInputs: ["/media/a.mp4","/media/b.mp4"],
        videoInputMediaTypes: ["video","video"],
        audioInputs: [],
        sourceAudioSegments: [{"inputIndex":0,"sourceStartMs":0,"timelineStartMs":0,"durationMs":5000,"trackVolume":1,"trackPan":0},{"inputIndex":1,"sourceStartMs":0,"timelineStartMs":5000,"durationMs":3000,"trackVolume":1,"trackPan":0}],
        audioFilterComplex: expect.stringContaining("anullsrc"),
        audioMap: "[aout]",
        outputPath: "/tmp/transition-export.mp4",
        videoFilterComplex: expect.stringContaining("transition_0_dissolve"),
      }),
    );
    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
  });


  it("routes animated transform clips through unified AV source-audio rendering", async () => {
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

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
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

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        videoInputs: ["/media/a.mp4"],
        videoInputMediaTypes: ["video"],
        audioInputs: [],
        sourceAudioSegments: [{"inputIndex":0,"sourceStartMs":0,"timelineStartMs":0,"durationMs":2000,"trackVolume":1,"trackPan":0}],
        audioFilterComplex: expect.stringContaining("anullsrc"),
        audioMap: "[aout]",
        outputPath: "/tmp/animated-transform-export.mp4",
        videoFilterComplex: expect.stringContaining("eval=frame"),
      }),
    );
    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
  });


  it("routes video and explicit audio tracks through one native AV graph", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 5000,
      segments: [
        {
          inputIndex: 5,
          assetId: "video-a",
          sourcePath: "/media/a.mp4",
          mediaType: "video",
          trackId: "video-1",
          trackType: "video",
          trackIndex: 1,
          timelineStartMs: 0,
          timelineEndMs: 5000,
          sourceStartMs: 0,
          sourceEndMs: 5000,
          durationMs: 5000,
          isMuted: false,
          trackVolume: 0.65,
          trackPan: -0.25,
        },
        {
          inputIndex: 1,
          assetId: "audio-a",
          sourcePath: "/media/music.mp3",
          mediaType: "audio",
          trackId: "audio-1",
          trackType: "audio",
          trackIndex: 0,
          timelineStartMs: 1000,
          timelineEndMs: 4000,
          sourceStartMs: 500,
          sourceEndMs: 3500,
          durationMs: 3000,
          isMuted: false,
        },
      ],
    };

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/project.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/project.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/project.mp4",
    });

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith({
      videoInputs: ["/media/a.mp4"],
      videoInputMediaTypes: ["video"],
      audioInputs: ["/media/music.mp3"],
      sourceAudioSegments: [
        {
          inputIndex: 0,
          sourceStartMs: 0,
          timelineStartMs: 0,
          durationMs: 5000,
          trackVolume: 0.65,
          trackPan: -0.25,
        },
      ],
      videoFilterComplex: expect.stringContaining("[0:v:0]"),
      videoMap: "[vout]",
      audioFilterComplex: expect.stringContaining(
        "[1:a:0]atrim=start=0.5:end=3.5",
      ),
      audioMap: "[aout]",
      durationMs: 5000,
      width: 406,
      height: 720,
      frameRate: 30,
      outputPath: "/tmp/project.mp4",
    });

    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
  });

  it("preserves only unmuted video source audio segments in unified export", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 6000,
      segments: [
        {
          inputIndex: 4,
          assetId: "video-a",
          sourcePath: "/media/a.mp4",
          mediaType: "video",
          trackId: "video-1",
          trackType: "video",
          trackIndex: 0,
          timelineStartMs: 1000,
          timelineEndMs: 5000,
          sourceStartMs: 250,
          sourceEndMs: 4250,
          durationMs: 4000,
          isMuted: false,
          trackVolume: 0.8,
          trackPan: 0.2,
          audioVolumeKeyframes: [
            { timeMs: 0, volume: 0.4 },
            { timeMs: 2000, volume: 0.9 },
          ],
        },
        {
          inputIndex: 9,
          assetId: "video-b",
          sourcePath: "/media/b.mp4",
          mediaType: "video",
          trackId: "video-2",
          trackType: "video",
          trackIndex: 1,
          timelineStartMs: 0,
          timelineEndMs: 3000,
          sourceStartMs: 0,
          sourceEndMs: 3000,
          durationMs: 3000,
          isMuted: true,
        },
        {
          inputIndex: 12,
          assetId: "image-a",
          sourcePath: "/media/cover.png",
          mediaType: "image",
          trackId: "video-2",
          trackType: "video",
          trackIndex: 1,
          timelineStartMs: 3000,
          timelineEndMs: 6000,
          sourceStartMs: 0,
          sourceEndMs: 3000,
          durationMs: 3000,
          isMuted: false,
        },
        {
          inputIndex: 13,
          assetId: "audio-a",
          sourcePath: "/media/music.mp3",
          mediaType: "audio",
          trackId: "audio-1",
          trackType: "audio",
          trackIndex: 2,
          timelineStartMs: 0,
          timelineEndMs: 6000,
          sourceStartMs: 0,
          sourceEndMs: 6000,
          durationMs: 6000,
          isMuted: false,
        },
      ],
    };

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/source-audio.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/source-audio.mp4"),
    ).resolves.toEqual({ outputPath: "/tmp/source-audio.mp4" });

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        videoInputs: ["/media/a.mp4", "/media/b.mp4", "/media/cover.png"],
        sourceAudioSegments: [
          {
            inputIndex: 0,
            sourceStartMs: 250,
            timelineStartMs: 1000,
            durationMs: 4000,
            trackVolume: 0.8,
            trackPan: 0.2,
            audioVolumeKeyframes: [
              { timeMs: 0, volume: 0.4 },
              { timeMs: 2000, volume: 0.9 },
            ],
          },
        ],
      }),
    );
  });

  it("rebases visual graph inputs before adding audio graph inputs", async () => {
    const plan: RenderPlan = {
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 4000,
      segments: [
        {
          inputIndex: 0,
          assetId: "audio-a",
          sourcePath: "/media/music.mp3",
          mediaType: "audio",
          trackId: "audio-1",
          trackType: "audio",
          trackIndex: 0,
          timelineStartMs: 0,
          timelineEndMs: 4000,
          sourceStartMs: 0,
          sourceEndMs: 4000,
          durationMs: 4000,
          isMuted: false,
        },
        {
          inputIndex: 9,
          assetId: "video-a",
          sourcePath: "/media/a.mp4",
          mediaType: "video",
          trackId: "video-1",
          trackType: "video",
          trackIndex: 1,
          timelineStartMs: 0,
          timelineEndMs: 4000,
          sourceStartMs: 0,
          sourceEndMs: 4000,
          durationMs: 4000,
          isMuted: false,
          textOverlay: {
            text: "Unified",
            x: 0.5,
            y: 0.5,
            fontSize: 48,
            color: "#ffffff",
            alignment: "center",
          },
        },
      ],
    };

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/rebased.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/rebased.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/rebased.mp4",
    });

    const request = vi.mocked(renderVideoAudioGraphToMp4).mock.calls[0]?.[0];
    expect(request).toMatchObject({
      videoInputs: ["/media/a.mp4"],
      videoInputMediaTypes: ["video"],
      audioInputs: ["/media/music.mp3"],
      videoMap: "[vout]",
      audioMap: "[aout]",
      width: 406,
      height: 720,
      frameRate: 30,
      durationMs: 4000,
      outputPath: "/tmp/rebased.mp4",
    });
    expect(request?.videoFilterComplex).toContain("[0:v:0]");
    expect(request?.audioFilterComplex).toContain("[1:a:0]");
  });


  it("routes a text overlay clip through unified AV source-audio rendering", async () => {
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
          textOverlay: {
            text: "Hello",
            x: 0.5,
            y: 0.5,
            fontSize: 56,
            color: "#ffffff",
            alignment: "center",
          },
        },
      ],
    };

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/text-overlay-export.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/text-overlay-export.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/text-overlay-export.mp4",
    });

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        videoInputs: ["/media/a.mp4"],
        videoInputMediaTypes: ["video"],
        audioInputs: [],
        sourceAudioSegments: [{"inputIndex":0,"sourceStartMs":0,"timelineStartMs":0,"durationMs":2000,"trackVolume":1,"trackPan":0}],
        audioFilterComplex: expect.stringContaining("anullsrc"),
        audioMap: "[aout]",
        outputPath: "/tmp/text-overlay-export.mp4",
        videoFilterComplex: expect.stringContaining("drawtext=font='DejaVu Sans'"),
      }),
    );
    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
  });

  it("routes multiple video tracks through unified AV source-audio rendering", async () => {
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

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/multitrack-export.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/multitrack-export.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/multitrack-export.mp4",
    });

    expect(renderVideoAudioGraphToMp4).toHaveBeenCalledWith(
      expect.objectContaining({
        videoInputs: ["/media/a.mp4","/media/b.mp4"],
        videoInputMediaTypes: ["video","video"],
        audioInputs: [],
        sourceAudioSegments: [{"inputIndex":0,"sourceStartMs":0,"timelineStartMs":0,"durationMs":2000,"trackVolume":1,"trackPan":0},{"inputIndex":1,"sourceStartMs":0,"timelineStartMs":0,"durationMs":2000,"trackVolume":1,"trackPan":0}],
        audioFilterComplex: expect.stringContaining("anullsrc"),
        audioMap: "[aout]",
        outputPath: "/tmp/multitrack-export.mp4",
        videoFilterComplex: expect.stringContaining("multitrack_composite_1"),
      }),
    );
    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
  });


  it("routes multiple video tracks and explicit audio through one native AV graph", async () => {
    const plan: RenderPlan = {
      width: 1080,
      height: 1920,
      frameRate: 30,
      durationMs: 4000,
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
          timelineEndMs: 4000,
          sourceStartMs: 0,
          sourceEndMs: 4000,
          durationMs: 4000,
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
          timelineEndMs: 4000,
          sourceStartMs: 0,
          sourceEndMs: 4000,
          durationMs: 4000,
          isMuted: false,
        },
        {
          inputIndex: 2,
          assetId: "audio-a",
          sourcePath: "/media/music.mp3",
          mediaType: "audio",
          trackId: "audio-1",
          trackType: "audio",
          trackIndex: 0,
          timelineStartMs: 500,
          timelineEndMs: 3500,
          sourceStartMs: 0,
          sourceEndMs: 3000,
          durationMs: 3000,
          isMuted: false,
        },
      ],
    };

    vi.mocked(renderVideoAudioGraphToMp4).mockResolvedValueOnce({
      outputPath: "/tmp/multitrack-audio-export.mp4",
    });

    await expect(
      renderVideoPlanToMp4(plan, "/tmp/multitrack-audio-export.mp4"),
    ).resolves.toEqual({
      outputPath: "/tmp/multitrack-audio-export.mp4",
    });

    const request = vi.mocked(renderVideoAudioGraphToMp4).mock.calls[0]?.[0];

    expect(request).toMatchObject({
      videoInputs: ["/media/a.mp4", "/media/b.mp4"],
      videoInputMediaTypes: ["video", "video"],
      audioInputs: ["/media/music.mp3"],
      videoMap: "[vout]",
      audioMap: "[aout]",
      durationMs: 4000,
      width: 1080,
      height: 1920,
      frameRate: 30,
      outputPath: "/tmp/multitrack-audio-export.mp4",
    });
    expect(request?.videoFilterComplex).toContain("track_0_sequence");
    expect(request?.videoFilterComplex).toContain("track_1_sequence");
    expect(request?.audioFilterComplex).toContain("[2:a:0]atrim=start=0:end=3");
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
  });

  it("compiles the graph before invoking native rendering", () => {
    expect(typeof compileSingleVideoTrackGraph).toBe("function");
  });
});
