import { describe, expect, it } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline, addAssetToTrack } from "../timeline/commands";
import { createDefaultExportSettings } from "./export";
import { createRenderPlan } from "./render-plan";

function projectWithAssets() {
  const project = createProject({ id: "render-plan" });

  project.assets = [
    {
      id: "video-a",
      name: "a.mp4",
      mediaType: "video",
      sourcePath: "/media/a.mp4",
      durationMs: 5000,
    },
    {
      id: "video-b",
      name: "b.mp4",
      mediaType: "video",
      sourcePath: "/media/b.mp4",
      durationMs: 4000,
    },
    {
      id: "audio-a",
      name: "a.wav",
      mediaType: "audio",
      sourcePath: "/media/a.wav",
      durationMs: 3000,
    },
  ];

  return project;
}

describe("render plan", () => {
  it("propagates audio compressor settings for audio segments", () => {
    const project = createProject({ id: "render-compressor" });
    const audioTrack = project.tracks.find((track) => track.type === "audio");
    if (!audioTrack) throw new Error("Expected audio track.");

    const projectWithMedia = {
      ...project,
      assets: [{
        id: "audio",
        name: "voice.mp3",
        mediaType: "audio" as const,
        sourcePath: "/voice.mp3",
        durationMs: 5000,
      }],
      tracks: project.tracks.map((track) =>
        track.id === audioTrack.id
          ? {
              ...track,
              clips: [{
                id: "compressor-clip",
                assetId: "audio",
                timelineStartMs: 1000,
                sourceStartMs: 0,
                sourceEndMs: 4000,
                audioCompressor: {
                  enabled: true,
                  thresholdDb: -18,
                  ratio: 6,
                  attackMs: 10,
                  releaseMs: 300,
                },
              }],
            }
          : track,
      ),
    };

    const plan = createRenderPlan(projectWithMedia, {
      format: "mp4",
      quality: "source",
    });

    expect(plan.segments).toContainEqual(expect.objectContaining({
      audioCompressor: {
        enabled: true,
        thresholdDb: -18,
        ratio: 6,
        attackMs: 10,
        releaseMs: 300,
      },
    }));
  });


  it("compiles timeline clips with source and timeline timing", () => {
    let project = projectWithAssets();
    project = addAssetToTimeline(project, "video-a");
    project = addAssetToTrack(project, "video-b", "video-1", 7000);
    project = addAssetToTrack(project, "audio-a", "audio-1", 2000);
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "audio-1" ? { ...track, volume: 0.35 } : track,
      ),
    };
    project.tracks[1].clips[0] = {
      ...project.tracks[1].clips[0],
      audioFadeInMs: 500,
      audioFadeOutMs: 750,
    };

    const plan = createRenderPlan(
      project,
      createDefaultExportSettings(project),
    );

    expect(plan.width).toBe(1080);
    expect(plan.height).toBe(1920);
    expect(plan.frameRate).toBe(30);
    expect(plan.durationMs).toBe(11000);
    expect(plan.segments).toHaveLength(3);

    expect(plan.segments.find((segment) => segment.trackType === "audio")?.trackVolume).toBe(0.35);
    expect(
      plan.segments.find((segment) => segment.assetId === "audio-a"),
    ).toMatchObject({
      audioFadeInMs: 500,
      audioFadeOutMs: 750,
    });

    expect(plan.segments).toEqual([
      expect.objectContaining({
        inputIndex: 0,
        assetId: "video-a",
        trackType: "video",
        timelineStartMs: 0,
        timelineEndMs: 5000,
        sourceStartMs: 0,
        sourceEndMs: 5000,
      }),
      expect.objectContaining({
        inputIndex: 1,
        assetId: "video-b",
        trackType: "video",
        timelineStartMs: 7000,
        timelineEndMs: 11000,
      }),
      expect.objectContaining({
        inputIndex: 2,
        assetId: "audio-a",
        trackType: "audio",
        timelineStartMs: 2000,
        timelineEndMs: 5000,
        isMuted: false,
      }),
    ]);
  });

  it("carries audio track pan into audio render segments", () => {
    let project = projectWithAssets();
    project = addAssetToTrack(project, "audio-a", "audio-1", 0);
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "audio-1" ? { ...track, pan: -0.55 } : track,
      ),
    };

    const plan = createRenderPlan(
      project,
      createDefaultExportSettings(project),
    );

    expect(
      plan.segments.find((segment) => segment.assetId === "audio-a")?.trackPan,
    ).toBe(-0.55);
  });

  it("carries audio EQ settings into audio render segments", () => {
    let project = projectWithAssets();
    project = addAssetToTrack(project, "audio-a", "audio-1", 0);
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "audio-1"
          ? {
              ...track,
              clips: track.clips.map((clip) => ({
                ...clip,
                audioEq: {
                  enabled: true,
                  lowGainDb: 4,
                  midGainDb: -2.5,
                  highGainDb: 6,
                },
              })),
            }
          : track,
      ),
    };

    const plan = createRenderPlan(
      project,
      createDefaultExportSettings(project),
    );

    expect(
      plan.segments.find((segment) => segment.assetId === "audio-a")?.audioEq,
    ).toEqual({
      enabled: true,
      lowGainDb: 4,
      midGainDb: -2.5,
      highGainDb: 6,
    });
  });

  it("resolves quality dimensions from the project aspect ratio", () => {
    const project = projectWithAssets();
    const settings = {
      ...createDefaultExportSettings(project),
      quality: "720p" as const,
    };

    const plan = createRenderPlan(project, settings);

    expect(plan.width).toBe(406);
    expect(plan.height).toBe(720);
  });

  it("rejects missing and empty media references", () => {
    const project = projectWithAssets();

    const missingAssetProject = {
      ...project,
      tracks: [
        {
          ...project.tracks[0],
          clips: [
            {
              id: "missing-clip",
              assetId: "does-not-exist",
              timelineStartMs: 0,
              sourceStartMs: 0,
              sourceEndMs: 1000,
              transform: undefined,
            },
          ],
        },
        ...project.tracks.slice(1),
      ],
    };

    expect(() =>
      createRenderPlan(
        missingAssetProject,
        createDefaultExportSettings(missingAssetProject),
      ),
    ).toThrow("references a missing asset");

    const emptySourceProject = {
      ...project,
      assets: project.assets.map((asset) =>
        asset.id === "video-a" ? { ...asset, sourcePath: "   " } : asset,
      ),
    };

    const invalidClipProject = addAssetToTimeline(emptySourceProject, "video-a");

    expect(() =>
      createRenderPlan(
        invalidClipProject,
        createDefaultExportSettings(invalidClipProject),
      ),
    ).toThrow("has no source path");
  });

  it("rejects overlapping clips on the same track", () => {
    let project = projectWithAssets();
    project = addAssetToTimeline(project, "video-a");

    const overlappingClip = {
      ...project.tracks[0].clips[0],
      id: "video-overlap",
      timelineStartMs: 1000,
    };

    const invalidProject = {
      ...project,
      tracks: [
        {
          ...project.tracks[0],
          clips: [...project.tracks[0].clips, overlappingClip],
        },
        ...project.tracks.slice(1),
      ],
    };

    expect(() =>
      createRenderPlan(
        invalidProject,
        createDefaultExportSettings(invalidProject),
      ),
    ).toThrow("contains overlapping clips");
  });

  it("preserves transition and mute metadata for later graph compilation", () => {
    let project = projectWithAssets();
    project = addAssetToTimeline(project, "video-a");
    project = addAssetToTrack(project, "video-b", "video-1", 5000);

    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "video-1"
          ? {
              ...track,
              isMuted: true,
              clips: track.clips.map((clip, index) =>
                index === 0
                  ? {
                      ...clip,
                      transitionOut: {
                        type: "dissolve" as const,
                        durationMs: 300,
                      },
                    }
                  : clip,
              ),
            }
          : track,
      ),
    };

    const plan = createRenderPlan(
      project,
      createDefaultExportSettings(project),
    );

    expect(plan.segments[0]).toMatchObject({
      isMuted: true,
      transitionOut: {
        type: "dissolve",
        durationMs: 300,
      },
    });
  });
});
