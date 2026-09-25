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

  it("rejects persisted project names with leading or trailing whitespace", () => {
    const project = createProject({
      id: "project-name-whitespace",
      name: "Canonical project",
    });

    expect(() =>
      parseProject(
        JSON.stringify({
          ...project,
          name: "  Canonical project  ",
        }),
      ),
    ).toThrow("Project name must be trimmed.");
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
    expect(getTrackVolume({
      ...audioTrack!,
      volume: 0.456,
    })).toBe(0.46);
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
    expect(getTrackPan({
      ...audioTrack!,
      pan: 0.456,
    })).toBe(0.46);
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

  it("rejects over-precise persisted audio EQ gains", () => {
    const project = createProject({ id: "over-precise-audio-eq" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.mp3",
      durationMs: 5000,
    };
    const makeProject = (audioEq: Record<string, unknown>) => ({
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
                  sourceEndMs: 4000,
                  audioEq,
                },
              ],
            }
          : track,
      ),
    });

    expect(() =>
      parseProject(
        JSON.stringify(
          makeProject({
            enabled: true,
            lowGainDb: 1.23,
            midGainDb: 0,
            highGainDb: 0,
          }),
        ),
      ),
    ).toThrow(
      "audioEq lowGainDb must use at most one decimal place.",
    );

    expect(() =>
      parseProject(
        JSON.stringify(
          makeProject({
            enabled: true,
            lowGainDb: 0,
            midGainDb: -2.34,
            highGainDb: 0,
          }),
        ),
      ),
    ).toThrow(
      "audioEq midGainDb must use at most one decimal place.",
    );

    expect(() =>
      parseProject(
        JSON.stringify(
          makeProject({
            enabled: true,
            lowGainDb: 0,
            midGainDb: 0,
            highGainDb: 3.45,
          }),
        ),
      ),
    ).toThrow(
      "audioEq highGainDb must use at most one decimal place.",
    );
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

  it("rejects over-precise persisted audio compressor settings", () => {
    const project = createProject({ id: "over-precise-audio-compressor" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.mp3",
      durationMs: 5000,
    };
    const makeProject = (audioCompressor: Record<string, unknown>) => ({
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
                  sourceEndMs: 4000,
                  audioCompressor,
                },
              ],
            }
          : track,
      ),
    });

    expect(() =>
      parseProject(
        JSON.stringify(
          makeProject({
            enabled: true,
            thresholdDb: -24.12,
            ratio: 4,
            attackMs: 20,
            releaseMs: 250,
          }),
        ),
      ),
    ).toThrow(
      "audioCompressor thresholdDb must use at most one decimal place.",
    );

    expect(() =>
      parseProject(
        JSON.stringify(
          makeProject({
            enabled: true,
            thresholdDb: -24,
            ratio: 4.56,
            attackMs: 20,
            releaseMs: 250,
          }),
        ),
      ),
    ).toThrow(
      "audioCompressor ratio must use at most one decimal place.",
    );

    expect(() =>
      parseProject(
        JSON.stringify(
          makeProject({
            enabled: true,
            thresholdDb: -24,
            ratio: 4,
            attackMs: 20.123,
            releaseMs: 250,
          }),
        ),
      ),
    ).toThrow(
      "audioCompressor attackMs must use at most two decimal places.",
    );

    expect(() =>
      parseProject(
        JSON.stringify(
          makeProject({
            enabled: true,
            thresholdDb: -24,
            ratio: 4,
            attackMs: 20,
            releaseMs: 250.987,
          }),
        ),
      ),
    ).toThrow(
      "audioCompressor releaseMs must use at most two decimal places.",
    );
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

  it("rejects fractional persisted asset durations", () => {
    const project = createProject({ id: "fractional-asset-duration" });
    const invalidProject = {
      ...project,
      assets: [
        {
          id: "asset-1",
          name: "Audio",
          mediaType: "audio" as const,
          sourcePath: "/tmp/audio.wav",
          durationMs: 1000.25,
        },
      ],
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "Asset 0 durationMs must be null or a non-negative integer number of milliseconds.",
    );
  });

  it("rejects fractional persisted clip timeline and source times", () => {
    const project = createProject({ id: "fractional-clip-times" });
    const videoAsset = {
      id: "video-1",
      name: "Video",
      mediaType: "video" as const,
      sourcePath: "/tmp/video.mp4",
      durationMs: 5000,
    };
    const makeProject = (changes: Record<string, unknown>) => ({
      ...project,
      assets: [videoAsset],
      tracks: project.tracks.map((track) =>
        track.type === "video"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-1",
                  assetId: videoAsset.id,
                  timelineStartMs: 1000,
                  sourceStartMs: 0,
                  sourceEndMs: 4000,
                  ...changes,
                },
              ],
            }
          : track,
      ),
    });

    expect(() =>
      parseProject(JSON.stringify(makeProject({ timelineStartMs: 1000.5 }))),
    ).toThrow(
      "Clip 0.0 timelineStartMs must be a non-negative integer number of milliseconds.",
    );

    expect(() =>
      parseProject(JSON.stringify(makeProject({ sourceStartMs: 0.5 }))),
    ).toThrow(
      "Clip 0.0 sourceStartMs must be a non-negative integer number of milliseconds.",
    );

    expect(() =>
      parseProject(JSON.stringify(makeProject({ sourceEndMs: 4000.5 }))),
    ).toThrow(
      "Clip 0.0 sourceEndMs must be a non-negative integer number of milliseconds.",
    );
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

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
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

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
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

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "sourceEndMs cannot exceed asset duration.",
    );
  });

  it("rejects invalid track volume and pan values", () => {
    const project = createProject({ id: "track-controls" });

    expect(() =>
      parseProject(
      JSON.stringify({
        ...project,
        tracks: project.tracks.map((track) => ({ ...track, volume: 2 })),
      }),
    ),
  ).toThrow("volume must be between 0 and 1.");

    expect(() =>
      parseProject(
      JSON.stringify({
        ...project,
        tracks: project.tracks.map((track) => ({ ...track, pan: -2 })),
      }),
    ),
  ).toThrow("pan must be between -1 and 1.");

    expect(() =>
      parseProject(
        JSON.stringify({
          ...project,
          tracks: project.tracks.map((track) => ({ ...track, volume: 0.123 })),
        }),
      ),
    ).toThrow("volume must use at most two decimal places.");

    expect(() =>
      parseProject(
        JSON.stringify({
          ...project,
          tracks: project.tracks.map((track) => ({ ...track, pan: -0.456 })),
        }),
      ),
    ).toThrow("pan must use at most two decimal places.");
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

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "Duplicate clip id: clip-1.",
    );
  });


  it("rejects a clip with a missing source end field", () => {
    const project = createProject({ id: "missing-source-end" });
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
                },
              ],
            }
          : track,
      ),
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "sourceEndMs must be a number or null.",
    );
  });

  it("rejects out-of-range persisted compressor settings", () => {
    const project = createProject({ id: "compressor-validation" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.wav",
      durationMs: 2000,
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
                  sourceEndMs: 1000,
                  audioCompressor: {
                    enabled: true,
                    thresholdDb: -61,
                    ratio: 4,
                    attackMs: 20,
                    releaseMs: 250,
                  },
                },
              ],
            }
          : track,
      ),
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "thresholdDb must be between -60 and 0.",
    );
  });

  it("accepts adjacent non-overlapping visual clips with a valid transition", () => {
    const project = createProject({ id: "timeline-topology-valid" });
    const videoAssetA = {
      id: "video-a",
      name: "A",
      mediaType: "video" as const,
      sourcePath: "/tmp/a.mp4",
      durationMs: 4000,
    };
    const videoAssetB = {
      id: "video-b",
      name: "B",
      mediaType: "video" as const,
      sourcePath: "/tmp/b.mp4",
      durationMs: 3000,
    };
    const invalidBase = {
      ...project,
      assets: [videoAssetA, videoAssetB],
      tracks: project.tracks.map((track) =>
        track.type === "video"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-a",
                  assetId: videoAssetA.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 4000,
                  transitionOut: {
                    type: "dissolve" as const,
                    durationMs: 300,
                  },
                },
                {
                  id: "clip-b",
                  assetId: videoAssetB.id,
                  timelineStartMs: 4000,
                  sourceStartMs: 0,
                  sourceEndMs: 3000,
                },
              ],
            }
          : track,
      ),
    };

    expect(parseProject(JSON.stringify(invalidBase))).toEqual(invalidBase);
  });

  it("rejects overlapping clips in one persisted track", () => {
    const project = createProject({ id: "timeline-overlap" });
    const audioAssetA = {
      id: "audio-a",
      name: "A",
      mediaType: "audio" as const,
      sourcePath: "/tmp/a.wav",
      durationMs: 3000,
    };
    const audioAssetB = {
      id: "audio-b",
      name: "B",
      mediaType: "audio" as const,
      sourcePath: "/tmp/b.wav",
      durationMs: 3000,
    };
    const invalidProject = {
      ...project,
      assets: [audioAssetA, audioAssetB],
      tracks: project.tracks.map((track) =>
        track.type === "audio"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-a",
                  assetId: audioAssetA.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 3000,
                },
                {
                  id: "clip-b",
                  assetId: audioAssetB.id,
                  timelineStartMs: 2000,
                  sourceStartMs: 0,
                  sourceEndMs: 3000,
                },
              ],
            }
          : track,
      ),
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "contains overlapping clips",
    );
  });

  it("rejects a transition without a following adjacent visual clip", () => {
    const project = createProject({ id: "timeline-transition-end" });
    const videoAsset = {
      id: "video-1",
      name: "Video",
      mediaType: "video" as const,
      sourcePath: "/tmp/video.mp4",
      durationMs: 4000,
    };
    const invalidProject = {
      ...project,
      assets: [videoAsset],
      tracks: project.tracks.map((track) =>
        track.type === "video"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-1",
                  assetId: videoAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 4000,
                  transitionOut: {
                    type: "dissolve" as const,
                    durationMs: 300,
                  },
                },
              ],
            }
          : track,
      ),
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "transitionOut requires a following clip.",
    );
  });

  it("rejects a transition between non-adjacent persisted clips", () => {
    const project = createProject({ id: "timeline-transition-gap" });
    const firstAsset = {
      id: "video-first",
      name: "First",
      mediaType: "video" as const,
      sourcePath: "/tmp/first.mp4",
      durationMs: 2000,
    };
    const secondAsset = {
      id: "video-second",
      name: "Second",
      mediaType: "video" as const,
      sourcePath: "/tmp/second.mp4",
      durationMs: 2000,
    };
    const invalidProject = {
      ...project,
      assets: [firstAsset, secondAsset],
      tracks: project.tracks.map((track) =>
        track.type === "video"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-1",
                  assetId: firstAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 1000,
                  transitionOut: {
                    type: "dissolve" as const,
                    durationMs: 300,
                  },
                },
                {
                  id: "clip-2",
                  assetId: secondAsset.id,
                  timelineStartMs: 1500,
                  sourceStartMs: 0,
                  sourceEndMs: 2000,
                },
              ],
            }
          : track,
      ),
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "transitionOut requires directly adjacent clips.",
    );
  });

  it("rejects a persisted transition longer than either adjacent clip", () => {
    const project = createProject({ id: "timeline-transition-duration" });
    const firstAsset = {
      id: "video-first",
      name: "First",
      mediaType: "video" as const,
      sourcePath: "/tmp/first.mp4",
      durationMs: 1000,
    };
    const secondAsset = {
      id: "video-second",
      name: "Second",
      mediaType: "video" as const,
      sourcePath: "/tmp/second.mp4",
      durationMs: 2000,
    };
    const invalidProject = {
      ...project,
      assets: [firstAsset, secondAsset],
      tracks: project.tracks.map((track) =>
        track.type === "video"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-1",
                  assetId: firstAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 1000,
                  transitionOut: {
                    type: "dissolve" as const,
                    durationMs: 2000,
                  },
                },
                {
                  id: "clip-2",
                  assetId: secondAsset.id,
                  timelineStartMs: 1000,
                  sourceStartMs: 0,
                  sourceEndMs: 2000,
                },
              ],
            }
          : track,
      ),
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "cannot exceed either adjacent clip duration",
    );
  });

  it("accepts valid persisted visual payloads", () => {
    const project = createProject({ id: "visual-payloads" });
    const videoAsset = {
      id: "video-1",
      name: "Video",
      mediaType: "video" as const,
      sourcePath: "/tmp/video.mp4",
      durationMs: 5000,
    };
    const invalidBase = {
      ...project,
      assets: [videoAsset],
      tracks: project.tracks.map((track) =>
        track.type === "video"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-1",
                  assetId: videoAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 4000,
                  transform: {
                    x: 12,
                    y: -8,
                    scale: 1.2,
                    rotation: 45,
                    opacity: 0.8,
                  },
                  transformAnchor: { x: 0.5, y: 0.5 },
                  crop: { top: 0.1, right: 0.2, bottom: 0.1, left: 0.2 },
                  cropPosition: { x: 0.45, y: 0.5 },
                  visualEffects: {
                    brightness: 0.1,
                    contrast: -0.2,
                    saturation: 0.3,
                  },
                  textOverlay: {
                    text: "FrameFlow",
                    x: 0.5,
                    y: 0.25,
                    fontSize: 48,
                    color: "#ffffff",
                    alignment: "center",
                  },
                  transitionOut: {
                    type: "dissolve",
                    durationMs: 300,
                  },
                  transformKeyframes: [
                    {
                      timeMs: 1000,
                      transform: {
                        x: 0,
                        y: 0,
                        scale: 1,
                        rotation: 0,
                        opacity: 1,
                      },
                      easing: "ease-in-out",
                    },
                  ],
                },
              ],
            }
          : track,
      ),
    };

    expect(parseProject(JSON.stringify(invalidBase))).toEqual(invalidBase);
  });

  it("rejects malformed persisted visual payloads", () => {
    const project = createProject({ id: "bad-visual" });
    const videoAsset = {
      id: "video-1",
      name: "Video",
      mediaType: "video" as const,
      sourcePath: "/tmp/video.mp4",
      durationMs: 5000,
    };
    const makeProject = (changes: Record<string, unknown>) => ({
      ...project,
      assets: [videoAsset],
      tracks: project.tracks.map((track) =>
        track.type === "video"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-1",
                  assetId: videoAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 4000,
                  ...changes,
                },
              ],
            }
          : track,
      ),
    });

    expect(() =>
      parseProject(JSON.stringify(makeProject({
        transform: { x: 101, y: 0, scale: 1, rotation: 0, opacity: 1 },
      }))),
    ).toThrow("transform x is outside the supported range.");

    expect(() =>
      parseProject(JSON.stringify(makeProject({
        transform: { x: 0, y: 0, scale: 1.234, rotation: 0, opacity: 1 },
      }))),
    ).toThrow("transform scale must use at most two decimal places.");

    expect(() =>
      parseProject(JSON.stringify(makeProject({
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.123 },
      }))),
    ).toThrow("transform opacity must use at most two decimal places.");

    expect(() =>
      parseProject(JSON.stringify(makeProject({
        transform: { x: 0, y: 0, scale: 1, rotation: 181, opacity: 1 },
      }))),
    ).toThrow("transform rotation must be between -180 and 180 degrees.");

    expect(() =>
      parseProject(JSON.stringify(makeProject({
        transform: { x: 0, y: 0, scale: 1, rotation: -181, opacity: 1 },
      }))),
    ).toThrow("transform rotation must be between -180 and 180 degrees.");

    expect(() =>
      parseProject(JSON.stringify(makeProject({
        crop: { top: 0.7, right: 0.4, bottom: 0, left: 0 },
      }))),
    ).toThrow("crop must leave a positive visible region.");

    expect(() =>
      parseProject(JSON.stringify(makeProject({
        textOverlay: {
          text: "",
          x: 0.5,
          y: 0.5,
          fontSize: 48,
          color: "#ffffff",
          alignment: "center",
        },
      }))),
    ).toThrow("textOverlay text must be non-empty.");

    expect(() =>
      parseProject(JSON.stringify(makeProject({
        transformKeyframes: [
          {
            timeMs: 5000,
            transform: {
              x: 0,
              y: 0,
              scale: 1,
              rotation: 0,
              opacity: 1,
            },
          },
        ],
      }))),
    ).toThrow("timeMs must be inside the clip duration.");

    expect(() =>
      parseProject(JSON.stringify(makeProject({
        transformKeyframes: [
          {
            timeMs: 1000,
            transform: {
              x: 0,
              y: 0,
              scale: 1,
              rotation: 0,
              opacity: 1,
            },
          },
          {
            timeMs: 500,
            transform: {
              x: 10,
              y: 0,
              scale: 1,
              rotation: 0,
              opacity: 1,
            },
          },
        ],
      }))),
    ).toThrow(
      "transformKeyframes[1] timeMs must be in strictly increasing order.",
    );

    expect(() =>
      parseProject(JSON.stringify(makeProject({
        transitionOut: { type: "dissolve", durationMs: 25 },
      }))),
    ).toThrow("durationMs must be an integer between 50 and 2000.");
  });

  it("rejects over-precise persisted visual effects", () => {
    const project = createProject({ id: "over-precise-visual-effects" });
    const videoAsset = {
      id: "video-1",
      name: "Video",
      mediaType: "video" as const,
      sourcePath: "/tmp/video.mp4",
      durationMs: 5000,
    };
    const makeProject = (visualEffects: Record<string, unknown>) => ({
      ...project,
      assets: [videoAsset],
      tracks: project.tracks.map((track) =>
        track.type === "video"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-1",
                  assetId: videoAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 4000,
                  visualEffects,
                },
              ],
            }
          : track,
      ),
    });

    expect(() =>
      parseProject(
        JSON.stringify(
          makeProject({
            brightness: 0.123,
            contrast: 0,
            saturation: 0,
          }),
        ),
      ),
    ).toThrow(
      "visualEffects brightness must use at most two decimal places.",
    );

    expect(() =>
      parseProject(
        JSON.stringify(
          makeProject({
            brightness: 0,
            contrast: -0.456,
            saturation: 0,
          }),
        ),
      ),
    ).toThrow(
      "visualEffects contrast must use at most two decimal places.",
    );

    expect(() =>
      parseProject(
        JSON.stringify(
          makeProject({
            brightness: 0,
            contrast: 0,
            saturation: 0.789,
          }),
        ),
      ),
    ).toThrow(
      "visualEffects saturation must use at most two decimal places.",
    );
  });

  it("rejects non-canonical persisted text overlays", () => {
    const project = createProject({ id: "non-canonical-text-overlay" });
    const videoAsset = {
      id: "video-1",
      name: "Video",
      mediaType: "video" as const,
      sourcePath: "/tmp/video.mp4",
      durationMs: 5000,
    };
    const makeProject = (textOverlay: Record<string, unknown>) => ({
      ...project,
      assets: [videoAsset],
      tracks: project.tracks.map((track) =>
        track.type === "video"
          ? {
              ...track,
              clips: [
                {
                  id: "clip-1",
                  assetId: videoAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 4000,
                  textOverlay,
                },
              ],
            }
          : track,
      ),
    });

    const base = {
      text: "FrameFlow",
      x: 0.5,
      y: 0.25,
      fontSize: 48,
      color: "#ffffff",
      alignment: "center",
    };

    expect(() =>
      parseProject(JSON.stringify(makeProject({ ...base, text: " FrameFlow" }))),
    ).toThrow("textOverlay text must be trimmed.");

    expect(() =>
      parseProject(JSON.stringify(makeProject({ ...base, x: 0.1234 }))),
    ).toThrow("textOverlay x must use at most three decimal places.");

    expect(() =>
      parseProject(JSON.stringify(makeProject({ ...base, y: 0.0001 }))),
    ).toThrow("textOverlay y must use at most three decimal places.");

    expect(() =>
      parseProject(JSON.stringify(makeProject({ ...base, color: "#FFFFFF" }))),
    ).toThrow("textOverlay color must be a lowercase six-digit hex color.");
  });

  it("rejects visual payloads persisted on audio clips", () => {
    const project = createProject({ id: "audio-visual-payload" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.wav",
      durationMs: 2000,
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
                  sourceEndMs: 1000,
                  transform: {
                    x: 0,
                    y: 0,
                    scale: 1,
                    rotation: 0,
                    opacity: 1,
                  },
                },
              ],
            }
          : track,
      ),
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "transform is only available for visual clips.",
    );
  });

  it("rejects persisted audio payloads on image clips", () => {
    const project = createProject({ id: "image-audio-payload" });
    const imageAsset = {
      id: "image-1",
      name: "Image",
      mediaType: "image" as const,
      sourcePath: "/tmp/image.png",
      durationMs: 5000,
    };

    for (const field of [
      "audioFadeInMs",
      "audioFadeOutMs",
      "audioEq",
      "audioCompressor",
      "audioVolumeKeyframes",
    ]) {
      const invalidProject = {
        ...project,
        assets: [imageAsset],
        tracks: project.tracks.map((track) =>
          track.type === "video"
            ? {
                ...track,
                clips: [
                  {
                    id: "image-clip",
                    assetId: imageAsset.id,
                    timelineStartMs: 0,
                    sourceStartMs: 0,
                    sourceEndMs: 5000,
                    [field]:
                      field === "audioEq"
                        ? {
                            enabled: true,
                            lowGainDb: 0,
                            midGainDb: 0,
                            highGainDb: 0,
                          }
                        : field === "audioCompressor"
                          ? {
                              enabled: true,
                              thresholdDb: -24,
                              ratio: 4,
                              attackMs: 20,
                              releaseMs: 250,
                            }
                          : field === "audioVolumeKeyframes"
                            ? [{ timeMs: 0, volume: 1 }]
                            : 0,
                  },
                ],
              }
            : track,
        ),
      };

      expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
        `Clip 0.0 ${field} is only available for audio-bearing clips.`,
      );
    }
  });

  it("rejects over-precise persisted audio volume keyframe values", () => {
    const project = createProject({ id: "over-precise-audio-volume" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.mp3",
      durationMs: 5000,
    };
    const makeProject = (volume: number) => ({
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
                  sourceEndMs: 4000,
                  audioVolumeKeyframes: [{ timeMs: 1000, volume }],
                },
              ],
            }
          : track,
      ),
    });

    expect(() =>
      parseProject(JSON.stringify(makeProject(0.1234))),
    ).toThrow(
      "audioVolumeKeyframes[0] volume must use at most three decimal places.",
    );

    expect(() =>
      parseProject(JSON.stringify(makeProject(0.9876))),
    ).toThrow(
      "audioVolumeKeyframes[0] volume must use at most three decimal places.",
    );
  });

  it("rejects persisted audio fades that exceed clip duration", () => {
    const project = createProject({ id: "fade-over-duration" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.wav",
      durationMs: 3000,
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
                  id: "audio-clip",
                  assetId: audioAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 2000,
                  audioFadeInMs: 2001,
                },
              ],
            }
          : track,
      ),
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "audio fade duration cannot exceed the clip duration.",
    );
  });

  it("rejects persisted audio fades that overlap", () => {
    const project = createProject({ id: "fade-overlap" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.wav",
      durationMs: 3000,
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
                  id: "audio-clip",
                  assetId: audioAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 2000,
                  audioFadeInMs: 1500,
                  audioFadeOutMs: 501,
                },
              ],
            }
          : track,
      ),
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "audio fade-in and fade-out cannot overlap.",
    );
  });

  it("rejects transform keyframes without a persisted transform payload", () => {
    const missingTransform = makeProject({
      transformKeyframes: [{ timeMs: 1000 } as never],
    });

    expect(() => parseProject(JSON.stringify(missingTransform))).toThrow(
      "transformKeyframes[0] transform must be an object.",
    );

    const nullTransform = makeProject({
      transformKeyframes: [{ timeMs: 1000, transform: null } as never],
    });

    expect(() => parseProject(JSON.stringify(nullTransform))).toThrow(
      "transformKeyframes[0] transform must be an object.",
    );
  });

  it("rejects fractional persisted audio volume keyframe times", () => {
    const project = createProject({ id: "audio-keyframe-fractional-time" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.wav",
      durationMs: 3000,
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
                  id: "audio-clip",
                  assetId: audioAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 3000,
                  audioVolumeKeyframes: [
                    { timeMs: 1000.25, volume: 0.8 },
                  ],
                },
              ],
            }
          : track,
      ),
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "audioVolumeKeyframes[0] timeMs must be an integer number of milliseconds.",
    );
  });

  it("rejects non-monotonic persisted audio volume keyframes", () => {
    const project = createProject({ id: "audio-keyframe-order" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.wav",
      durationMs: 3000,
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
                  id: "audio-clip",
                  assetId: audioAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 3000,
                  audioVolumeKeyframes: [
                    { timeMs: 1000, volume: 0.8 },
                    { timeMs: 500, volume: 0.4 },
                  ],
                },
              ],
            }
          : track,
      ),
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "audioVolumeKeyframes[1] timeMs must be in strictly increasing order.",
    );
  });

  it("rejects non-zero persisted fades when clip duration is unknown", () => {
    const project = createProject({ id: "fade-unknown-duration" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.wav",
      durationMs: null,
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
                  id: "audio-clip",
                  assetId: audioAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: null,
                  audioFadeInMs: 100,
                },
              ],
            }
          : track,
      ),
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "audio fade durations require a known clip duration.",
    );
  });

  it("accepts persisted audio fades that fit the clip duration", () => {
    const project = createProject({ id: "fade-valid" });
    const audioAsset = {
      id: "audio-1",
      name: "Audio",
      mediaType: "audio" as const,
      sourcePath: "/tmp/audio.wav",
      durationMs: 3000,
    };
    const validProject = {
      ...project,
      assets: [audioAsset],
      tracks: project.tracks.map((track) =>
        track.type === "audio"
          ? {
              ...track,
              clips: [
                {
                  id: "audio-clip",
                  assetId: audioAsset.id,
                  timelineStartMs: 0,
                  sourceStartMs: 0,
                  sourceEndMs: 3000,
                  audioFadeInMs: 1000,
                  audioFadeOutMs: 1000,
                },
              ],
            }
          : track,
      ),
    };

    expect(parseProject(JSON.stringify(validProject))).toEqual(validProject);
  });

  it("rejects persisted fractional canvas dimensions", () => {
    const project = createProject({ id: "fractional-canvas" });

    for (const dimension of ["width", "height"] as const) {
      const invalidProject = {
        ...project,
        canvas: {
          ...project.canvas,
          [dimension]: project.canvas[dimension] + 0.5,
        },
      };

      expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
        `Canvas ${dimension} must be a positive integer.`,
      );
    }
  });

  it("accepts supported non-integer persisted frame rates", () => {
    const project = createProject({ id: "fractional-frame-rate" });
    const validProject = {
      ...project,
      canvas: {
        ...project.canvas,
        frameRate: 29.97,
      },
    };

    expect(parseProject(JSON.stringify(validProject))).toEqual(validProject);
  });

  it("accepts canonical UTC project timestamps and equal timestamps", () => {
    const project = createProject({
      id: "timestamp-valid",
      now: new Date("2026-09-25T08:00:00.000Z"),
    });

    expect(parseProject(JSON.stringify(project))).toEqual(project);

    const sameTimestampProject = {
      ...project,
      updatedAt: project.createdAt,
    };

    expect(parseProject(JSON.stringify(sameTimestampProject))).toEqual(
      sameTimestampProject,
    );
  });

  it("rejects non-canonical persisted project timestamps", () => {
    const project = createProject({ id: "timestamp-format" });

    expect(() =>
      parseProject(
        JSON.stringify({
          ...project,
          createdAt: "September 25, 2026",
        }),
      ),
    ).toThrow("Project createdAt must be a canonical UTC ISO timestamp.");

    expect(() =>
      parseProject(
        JSON.stringify({
          ...project,
          updatedAt: "2026-09-25T15:00:00.000+07:00",
        }),
      ),
    ).toThrow("Project updatedAt must be a canonical UTC ISO timestamp.");
  });

  it("rejects a project updated before it was created", () => {
    const project = createProject({
      id: "timestamp-order",
      now: new Date("2026-09-25T08:00:00.000Z"),
    });
    const invalidProject = {
      ...project,
      createdAt: "2026-09-25T09:00:00.000Z",
      updatedAt: "2026-09-25T08:59:59.999Z",
    };

    expect(() => parseProject(JSON.stringify(invalidProject))).toThrow(
      "Project updatedAt must be the same as or later than createdAt.",
    );
  });

  it("rejects invalid JSON and unsupported schemas", () => {
    expect(() => parseProject("not json")).toThrow(ProjectValidationError);
    expect(() => parseProject('{"schemaVersion":999}')).toThrow(
      "Project schema version is not supported.",
    );
  });
});