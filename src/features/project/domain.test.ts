import { describe, expect, it } from "vitest";
import {
  PROJECT_SCHEMA_VERSION,
  ProjectValidationError,
  createProject,
  parseProject,
  serializeProject,
  getTrackVolume,
  getTrackPan,
  getAudioEq,
  getAudioCompressor,
  getVisualEffects,
  getTextOverlay,
  getAudioFadeDurations,
} from "./domain";

describe("project domain", () => {
  it("creates a vertical project with base audio and video tracks", () => {
    const project = createProject({
      id: "project-1",
      name: "  First edit  ",
      now: new Date("2026-09-19T12:00:00.000Z"),
    });

    expect(project).toMatchObject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "project-1",
      name: "First edit",
      canvas: { width: 1080, height: 1920, frameRate: 30 },
    });
    expect(project.tracks.map((track) => track.type)).toEqual(["video", "audio"]);
  });

  it("round-trips a valid project document", () => {
    const project = createProject({ id: "project-1", now: new Date("2026-09-19T12:00:00.000Z") });

    expect(parseProject(serializeProject(project))).toEqual(project);
  });

  it("defaults missing track volume to full volume and clamps explicit values", () => {
    const project = createProject({ id: "track-volume-default" });
    const audioTrack = project.tracks.find((track) => track.type === "audio");

    expect(audioTrack?.volume).toBe(1);
    expect(getTrackVolume({
      ...audioTrack!,
      volume: undefined,
    })).toBe(1);
    expect(getTrackVolume({
      ...audioTrack!,
      volume: 2,
    })).toBe(1);
    expect(getTrackVolume({
      ...audioTrack!,
      volume: -1,
    })).toBe(0);
  });

  it("defaults missing track pan to center and clamps explicit values", () => {
    const project = createProject({ id: "track-pan-default" });
    const audioTrack = project.tracks.find((track) => track.type === "audio");

    expect(audioTrack?.pan).toBe(0);
    expect(getTrackPan({
      ...audioTrack!,
      pan: undefined,
    })).toBe(0);
    expect(getTrackPan({
      ...audioTrack!,
      pan: 2,
    })).toBe(1);
    expect(getTrackPan({
      ...audioTrack!,
      pan: -2,
    })).toBe(-1);
  });


  it("defaults audio EQ to disabled neutral gains and clamps stored values", () => {
    const project = createProject({ id: "audio-eq-default" });
    const audioClip = {
      id: "eq-clip",
      assetId: "audio",
      timelineStartMs: 0,
      sourceStartMs: 0,
      sourceEndMs: 5000,
    };

    expect(getAudioEq(audioClip)).toEqual({
      enabled: false,
      lowGainDb: 0,
      midGainDb: 0,
      highGainDb: 0,
    });

    expect(
      getAudioEq({
        ...audioClip,
        audioEq: {
          enabled: true,
          lowGainDb: 14,
          midGainDb: -20,
          highGainDb: 3.26,
        },
      }),
    ).toEqual({
      enabled: true,
      lowGainDb: 12,
      midGainDb: -12,
      highGainDb: 3.3,
    });

    expect(project.tracks.find((track) => track.type === "audio")?.pan).toBe(0);
  });

  it("defaults visual effects to neutral values and clamps stored values", () => {
    const clip = {
      id: "visual-effects-clip",
      assetId: "video",
      timelineStartMs: 0,
      sourceStartMs: 0,
      sourceEndMs: 5000,
    };

    expect(getVisualEffects(clip)).toEqual({
      brightness: 0,
      contrast: 0,
      saturation: 0,
    });

    expect(
      getVisualEffects({
        ...clip,
        visualEffects: {
          brightness: 2,
          contrast: -2,
          saturation: 0.237,
        },
      }),
    ).toEqual({
      brightness: 1,
      contrast: -1,
      saturation: 0.24,
    });
  });

  it("defaults and normalizes text overlay settings", () => {
    const clip = {
      id: "text-overlay-clip",
      assetId: "video",
      timelineStartMs: 0,
      sourceStartMs: 0,
      sourceEndMs: 5000,
    };

    expect(getTextOverlay(clip)).toBeUndefined();

    expect(
      getTextOverlay({
        ...clip,
        textOverlay: {
          text: "  Hello FrameFlow  ",
          x: 2,
          y: -1,
          fontSize: 999,
          color: "not-a-color",
          alignment: "invalid" as never,
        },
      }),
    ).toEqual({
      text: "Hello FrameFlow",
      x: 1,
      y: 0,
      fontSize: 240,
      color: "#ffffff",
      alignment: "center",
    });
  });

  it("defaults the audio compressor and clamps stored settings", () => {
    const clip = {
      id: "compressor-clip",
      assetId: "audio",
      timelineStartMs: 0,
      sourceStartMs: 0,
      sourceEndMs: 5000,
    };

    expect(getAudioCompressor(clip)).toEqual({
      enabled: false,
      thresholdDb: -24,
      ratio: 4,
      attackMs: 20,
      releaseMs: 250,
    });

    expect(
      getAudioCompressor({
        ...clip,
        audioCompressor: {
          enabled: true,
          thresholdDb: -80,
          ratio: 25,
          attackMs: 0,
          releaseMs: 10000,
        },
      }),
    ).toEqual({
      enabled: true,
      thresholdDb: -60,
      ratio: 20,
      attackMs: 0.01,
      releaseMs: 9000,
    });
  });

  it("normalizes audio fade durations against the clip duration", () => {
    const clip = {
      id: "fade-clip",
      assetId: "audio",
      timelineStartMs: 0,
      sourceStartMs: 0,
      sourceEndMs: 5000,
      audioFadeInMs: 2000.8,
      audioFadeOutMs: 4000,
    };

    expect(getAudioFadeDurations(clip)).toEqual({
      fadeInMs: 2000,
      fadeOutMs: 3000,
    });
  });

  it("round-trips a project with valid assets, tracks, and clips", () => {
    const project = createProject({
      id: "validated-project",
      now: new Date("2026-09-19T12:00:00.000Z"),
    });
    const videoAsset = {
      id: "video-asset",
      name: "Video",
      mediaType: "video" as const,
      sourcePath: "/tmp/video.mp4",
      durationMs: 8000,
    };

    const audioAsset = {
      id: "audio-asset",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.wav",
      durationMs: 6000,
    };

    const projectWithMedia = {
      ...project,
      assets: [videoAsset, audioAsset],
      tracks: project.tracks.map((track) =>
        track.type === "video"
          ? {
              ...track,
              clips: [
                {
                  id: "video-clip",
                  assetId: videoAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 500,
                  sourceEndMs: 7000,
                  audioFadeInMs: 500,
                  audioVolumeKeyframes: [{ timeMs: 1000, volume: 0.7 }],
                },
              ],
            }
          : {
              ...track,
              clips: [
                {
                  id: "audio-clip",
                  assetId: audioAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 5000,
                  audioFadeOutMs: 300,
                },
              ],
            },
      ),
    };

    expect(parseProject(serializeProject(projectWithMedia))).toEqual(
      projectWithMedia,
    );
  });

  it("rejects duplicate asset ids", () => {
    const project = createProject({ id: "duplicate-assets" });
    const asset = {
      id: "asset-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.wav",
      durationMs: 1000,
    };

    expect(() =>
      parseProject(
        serializeProject({
          ...project,
          assets: [asset, asset],
        }),
      ),
    ).toThrow("Duplicate asset id: asset-1.");
  });

  it("rejects clips that reference missing assets", () => {
    const project = createProject({ id: "missing-asset" });
    const invalidProject = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.type === "video"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-1",
                  assetId: "missing",
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 1000,
                },
              ],
            }
          : track,
      ),
    };

    expect(() => serializeProject(invalidProject)).toThrow(
      "references missing asset: missing.",
    );
  });

  it("rejects a video asset on an audio track", () => {
    const project = createProject({ id: "track-mismatch" });
    const videoAsset = {
      id: "video-1",
      name: "Video",
      mediaType: "video" as const,
      sourcePath: "/tmp/video.mp4",
      durationMs: 1000,
    };
    const invalidProject = {
      ...project,
      assets: [videoAsset],
      tracks: project.tracks.map((track) =>
        track.type === "audio"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-1",
                  assetId: videoAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 1000,
                },
              ],
            }
          : track,
      ),
    };

    expect(() => serializeProject(invalidProject)).toThrow(
      "uses media type video on a audio track.",
    );
  });

  it("rejects a clip source range beyond known asset duration", () => {
    const project = createProject({ id: "source-range" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.wav",
      durationMs: 1000,
    };
    const invalidProject = {
      ...project,
      assets: [audioAsset],
      tracks: project.tracks.map((track) =>
        track.type === "audio"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-1",
                  assetId: audioAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 1001,
                },
              ],
            }
          : track,
      ),
    };

    expect(() => serializeProject(invalidProject)).toThrow(
      "sourceEndMs cannot exceed asset duration.",
    );
  });

  it("rejects invalid track volume and pan values", () => {
    const project = createProject({ id: "track-controls" });

    expect(() =>
      serializeProject({
        ...project,
        tracks: project.tracks.map((track) => ({ ...track, volume: 2 })),
      }),
    ).toThrow("volume must be between 0 and 1.");

    expect(() =>
      serializeProject({
        ...project,
        tracks: project.tracks.map((track) => ({ ...track, pan: -2 })),
      }),
    ).toThrow("pan must be between -1 and 1.");
  });

  it("rejects duplicate clip ids", () => {
    const project = createProject({ id: "duplicate-clips" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.wav",
      durationMs: 2000,
    };
    const clip = {
      id: "clip-1",
      assetId: audioAsset.id,
      timelineStartMs: 0,
      sourceStartMs: 0,
      sourceEndMs: 1000,
    };

    const invalidProject = {
      ...project,
      assets: [audioAsset],
      tracks: project.tracks.map((track) =>
        track.type === "audio" ? { ...track, clips: [clip, clip] } : track,
      ),
    };

    expect(() => serializeProject(invalidProject)).toThrow(
      "Duplicate clip id: clip-1.",
    );
  });

  it("rejects invalid JSON and unsupported schemas", () => {
    expect(() => parseProject("not json")).toThrow(ProjectValidationError);
    expect(() => parseProject('{"schemaVersion":999}')).toThrow(
      "Project schema version is not supported.",
    );
  });
});
