import { describe, expect, it } from "vitest";
import { createProject } from "../project/domain";
import {
  addAssetToTimeline,
  addAssetToTrack,
  addTrack,
  addTransformKeyframe,
  moveTransformKeyframe,
  updateTransformKeyframeEasing,
  removeTrack,
  removeTransformKeyframe,
  resetClipTransform,
  toggleTrackMute,
  updateTrackVolume,
  updateTrackPan,
  updateAudioClipFades,
  updateAudioClipEq,
  updateAudioClipCompressor,
  updateAudioClipVolumeAtTime,
  removeAudioClipVolumeKeyframe,
  updateClipTransform,
  updateClipTransformAtTime,
  moveClipOnTimeline,
  removeClipFromTimeline,
  splitClipAtTime,
  trimClipEnd,
  trimClipStart,
  updateClipTransformAnchor,
  updateClipTransformAnchorWithCompensation,
  updateClipCrop,
  updateClipCropPosition,
  updateClipCropWithPosition,
  updateCanvasDimensions,
  updateClipTransition,
} from "./commands";

describe("canvas settings", () => {
  it("updates canvas dimensions without changing frame rate", () => {
    const project = createProject({ id: "canvas-dimensions" });

    const updated = updateCanvasDimensions(
      project,
      1920,
      1080,
      new Date("2026-09-21T02:00:00.000Z"),
    );

    expect(updated.canvas).toEqual({
      width: 1920,
      height: 1080,
      frameRate: 30,
    });
    expect(updated.updatedAt).toBe("2026-09-21T02:00:00.000Z");
    expect(updated.tracks).toEqual(project.tracks);
  });

  it("rejects invalid canvas dimensions", () => {
    const project = createProject({ id: "canvas-dimensions-invalid" });

    expect(() => updateCanvasDimensions(project, 1920.5, 1080)).toThrow(
      "Canvas dimensions must be positive integers.",
    );
    expect(() => updateCanvasDimensions(project, 0, 1080)).toThrow(
      "Canvas dimensions must be positive integers.",
    );
  });
});

describe("track management", () => {
  it("adds a track with the next type-specific name", () => {
    const project = createProject({ id: "track-add" });

    const updated = addTrack(
      addTrack(project, "video", new Date("2026-09-20T00:00:01.000Z")),
      "video",
      new Date("2026-09-20T00:00:02.000Z"),
    );

    expect(updated.tracks.map((track) => track.name)).toEqual([
      "Video 1",
      "Video 2",
      "Video 3",
      "Audio 1",
    ]);
    expect(updated.tracks[3].clips).toHaveLength(0);
  });

  it("removes only empty tracks and keeps the last track of a type", () => {
    const project = addTrack(createProject({ id: "track-remove" }), "video");

    const removableId = project.tracks[1].id;
    const updated = removeTrack(
      project,
      removableId,
      new Date("2026-09-20T00:00:03.000Z"),
    );

    expect(updated.tracks).toHaveLength(2);
    expect(updated.tracks.map((track) => track.name)).toEqual([
      "Video 1",
      "Audio 1",
    ]);

    expect(() =>
      removeTrack(
        createProject({ id: "track-last" }),
        "video-1",
      ),
    ).toThrow("The last track of this type cannot be removed.");
  });

  it("routes compatible media to a chosen track at a requested position", () => {
    let project = createProject({ id: "track-routing" });

    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "overlay.mp4",
          mediaType: "video",
          sourcePath: "/overlay.mp4",
          durationMs: 4000,
        },
        {
          id: "image",
          name: "poster.png",
          mediaType: "image",
          sourcePath: "/poster.png",
          durationMs: null,
        },
        {
          id: "audio",
          name: "music.mp3",
          mediaType: "audio",
          sourcePath: "/music.mp3",
          durationMs: 5000,
        },
      ],
    };

    project = addTrack(project, "video");
    project = addAssetToTrack(project, "video", project.tracks[1].id, 6000);
    project = addAssetToTrack(project, "image", project.tracks[1].id, 12000);
    project = addAssetToTrack(project, "audio", project.tracks[2].id, 3000);

    expect(project.tracks[1].clips.map((clip) => clip.timelineStartMs)).toEqual([
      6000,
      12000,
    ]);
    expect(project.tracks[2].clips[0].timelineStartMs).toBe(3000);
  });

  it("rejects incompatible media, locked tracks, and overlapping drops", () => {
    let project = createProject({ id: "track-routing-errors" });

    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "clip.mp4",
          mediaType: "video",
          sourcePath: "/clip.mp4",
          durationMs: 4000,
        },
        {
          id: "audio",
          name: "music.mp3",
          mediaType: "audio",
          sourcePath: "/music.mp3",
          durationMs: 4000,
        },
      ],
    };

    expect(() =>
      addAssetToTrack(project, "audio", "video-1"),
    ).toThrow("Cannot add audio media to a video track.");

    const lockedProject = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "video-1" ? { ...track, isLocked: true } : track,
      ),
    };

    expect(() =>
      addAssetToTrack(lockedProject, "video", "video-1"),
    ).toThrow("Track is locked.");

    const populated = addAssetToTrack(project, "video", "video-1", 0);
    expect(() =>
      addAssetToTrack(populated, "video", "video-1", 2000),
    ).toThrow("Media cannot overlap another clip on the same track.");
  });
});

describe("clip transforms", () => {
  it("updates and clamps a visual clip transform anchor", () => {
    let project = createProject({ id: "transform-anchor-command" });

    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "clip.mp4",
          mediaType: "video",
          sourcePath: "/clip.mp4",
          durationMs: 4000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    const updated = updateClipTransformAnchor(
      project,
      clipId,
      { x: 2, y: -1 },
      new Date("2026-09-20T02:10:00.000Z"),
    );

    expect(updated.tracks[0].clips[0].transformAnchor).toEqual({
      x: 1,
      y: 0,
    });
    expect(updated.updatedAt).toBe("2026-09-20T02:10:00.000Z");
  });

  it("compensates the visual transform when changing its anchor", () => {
    let project = createProject({ id: "transform-anchor-compensated" });

    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "clip.mp4",
          mediaType: "video",
          sourcePath: "/clip.mp4",
          durationMs: 4000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    project = updateClipTransformAtTime(project, clipId, 0, {
      scale: 2,
    });

    const updated = updateClipTransformAnchorWithCompensation(
      project,
      clipId,
      { x: 0, y: 0 },
      { widthPercent: 100, heightPercent: 100 },
      new Date("2026-09-21T03:00:00.000Z"),
    );

    expect(updated.tracks[0].clips[0].transformAnchor).toEqual({
      x: 0,
      y: 0,
    });
    expect(updated.tracks[0].clips[0].transform).toEqual({
      x: -50,
      y: -50,
      scale: 2,
      rotation: 0,
      opacity: 1,
    });
    expect(updated.updatedAt).toBe("2026-09-21T03:00:00.000Z");
  });

  it("resets a visual clip transform anchor with the transform reset", () => {
    let project = createProject({ id: "transform-anchor-reset" });

    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "clip.mp4",
          mediaType: "video",
          sourcePath: "/clip.mp4",
          durationMs: 4000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    project = updateClipTransformAnchor(project, clipId, {
      x: 0,
      y: 1,
    });

    const reset = resetClipTransform(project, clipId);

    expect(reset.tracks[0].clips[0].transformAnchor).toBeUndefined();
  });

  it("compensates every transform keyframe when the anchor changes", () => {
    let project = createProject({ id: "transform-anchor-keyframes" });

    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "clip.mp4",
          mediaType: "video",
          sourcePath: "/clip.mp4",
          durationMs: 4000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(project, clipId, 0);
    project = updateClipTransformAtTime(project, clipId, 0, { scale: 2 });
    project = addTransformKeyframe(project, clipId, 2000);
    project = updateClipTransformAtTime(project, clipId, 2000, {
      scale: 1.5,
      rotation: 90,
    });

    const updated = updateClipTransformAnchorWithCompensation(
      project,
      clipId,
      { x: 0, y: 0 },
      { widthPercent: 100, heightPercent: 100 },
    );

    expect(updated.tracks[0].clips[0].transformKeyframes).toHaveLength(2);

    const keyframes = updated.tracks[0].clips[0].transformKeyframes ?? [];

    expect(keyframes[0]).toMatchObject({
      timeMs: 0,
      easing: "linear",
      transform: {
        x: -50,
        y: -50,
        scale: 2,
        rotation: 0,
        opacity: 1,
      },
    });

    expect(keyframes[1]).toMatchObject({
      timeMs: 2000,
      easing: "linear",
      transform: {
        scale: 1.5,
        rotation: 90,
        opacity: 1,
      },
    });
    expect(keyframes[1].transform.x).toBeCloseTo(100, 10);
    expect(keyframes[1].transform.y).toBeCloseTo(-25, 10);
  });

  it("updates and clamps visual clip transforms", () => {
    let project = createProject({ id: "transform-command" });

    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "clip.mp4",
          mediaType: "video",
          sourcePath: "/clip.mp4",
          durationMs: 4000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    const updated = updateClipTransform(project, clipId, {
      x: 25,
      y: -10,
      scale: 1.5,
      rotation: 45,
      opacity: 0.7,
    });

    expect(updated.tracks[0].clips[0].transform).toEqual({
      x: 25,
      y: -10,
      scale: 1.5,
      rotation: 45,
      opacity: 0.7,
    });

    const reset = resetClipTransform(updated, clipId);

    expect(reset.tracks[0].clips[0].transform).toEqual({
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
    });
  });

  it("updates crop and content position atomically", () => {
    let project = createProject({ id: "crop-aspect-command" });

    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "aspect.mp4",
          mediaType: "video",
          sourcePath: "/aspect.mp4",
          durationMs: 4000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    const updated = updateClipCropWithPosition(
      project,
      clipId,
      {
        top: 0,
        right: 0.2,
        bottom: 0,
        left: 0.2,
      },
      { x: 0.6, y: 0.5 },
      new Date("2026-09-21T01:00:00.000Z"),
    );

    expect(updated.tracks[0].clips[0].crop).toEqual({
      top: 0,
      right: 0.2,
      bottom: 0,
      left: 0.2,
    });
    expect(updated.tracks[0].clips[0].cropPosition).toEqual({
      x: 0.6,
      y: 0.5,
    });
    expect(updated.updatedAt).toBe("2026-09-21T01:00:00.000Z");

    const reset = updateClipCropWithPosition(
      updated,
      clipId,
      { top: 0, right: 0, bottom: 0, left: 0 },
      { x: 0.7, y: 0.3 },
    );

    expect(reset.tracks[0].clips[0].cropPosition).toBeUndefined();
  });

  it("updates and clamps crop content position", () => {
    let project = createProject({ id: "crop-position-command" });

    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "clip.mp4",
          mediaType: "video",
          sourcePath: "/clip.mp4",
          durationMs: 4000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    project = updateClipCrop(
      project,
      clipId,
      { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
    );

    const updated = updateClipCropPosition(
      project,
      clipId,
      { x: 2, y: -1 },
      new Date("2026-09-20T02:30:00.000Z"),
    );

    expect(updated.tracks[0].clips[0].cropPosition).toEqual({
      x: 1,
      y: 0,
    });
    expect(updated.updatedAt).toBe("2026-09-20T02:30:00.000Z");
  });

  it("clears crop position when crop is fully reset", () => {
    let project = createProject({ id: "crop-position-reset" });

    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "clip.mp4",
          mediaType: "video",
          sourcePath: "/clip.mp4",
          durationMs: 4000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    project = updateClipCrop(project, clipId, {
      top: 0.1,
      right: 0.1,
      bottom: 0.1,
      left: 0.1,
    });
    project = updateClipCropPosition(project, clipId, { x: 0.2, y: 0.8 });

    const reset = updateClipCrop(project, clipId, {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });

    expect(reset.tracks[0].clips[0].cropPosition).toBeUndefined();
  });

  it("rejects transform updates for audio clips", () => {
    let project = createProject({ id: "audio-transform-command" });

    project = {
      ...project,
      assets: [
        {
          id: "audio",
          name: "music.mp3",
          mediaType: "audio",
          sourcePath: "/music.mp3",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "audio");

    expect(() =>
      updateClipTransform(project, project.tracks[1].clips[0].id, {
        scale: 2,
      }),
    ).toThrow("Transform controls are only available for visual media.");
  });
});

describe("updateAudioClipCompressor", () => {
  it("updates compressor settings for an audio clip", () => {
    let project = createProject({ id: "compressor-command" });
    project = {
      ...project,
      assets: [{
        id: "audio",
        name: "voice.mp3",
        mediaType: "audio",
        sourcePath: "/voice.mp3",
        durationMs: 5000,
      }],
    };
    project = addAssetToTimeline(project, "audio");
    const clipId = project.tracks[1].clips[0].id;

    const updated = updateAudioClipCompressor(
      project,
      clipId,
      {
        enabled: true,
        thresholdDb: -18.25,
        ratio: 6.4,
        attackMs: 8.126,
        releaseMs: 320.557,
      },
      new Date("2026-09-21T04:00:00.000Z"),
    );

    expect(updated.tracks[1].clips[0].audioCompressor).toEqual({
      enabled: true,
      thresholdDb: -18.3,
      ratio: 6.4,
      attackMs: 8.13,
      releaseMs: 320.56,
    });
    expect(updated.updatedAt).toBe("2026-09-21T04:00:00.000Z");
  });

  it("clears the compressor when disabled at defaults", () => {
    let project = createProject({ id: "compressor-clear" });
    project = {
      ...project,
      assets: [{
        id: "audio",
        name: "voice.mp3",
        mediaType: "audio",
        sourcePath: "/voice.mp3",
        durationMs: 5000,
      }],
    };
    project = addAssetToTimeline(project, "audio");
    const clipId = project.tracks[1].clips[0].id;

    project = updateAudioClipCompressor(project, clipId, {
      enabled: true,
      thresholdDb: -18,
      ratio: 6,
      attackMs: 10,
      releaseMs: 300,
    });

    const cleared = updateAudioClipCompressor(project, clipId, {
      enabled: false,
      thresholdDb: -24,
      ratio: 4,
      attackMs: 20,
      releaseMs: 250,
    });

    expect(cleared.tracks[1].clips[0].audioCompressor).toBeUndefined();
  });

  it("rejects compressor settings outside the supported range", () => {
    let project = createProject({ id: "compressor-errors" });
    project = {
      ...project,
      assets: [{
        id: "audio",
        name: "voice.mp3",
        mediaType: "audio",
        sourcePath: "/voice.mp3",
        durationMs: 5000,
      }],
    };
    project = addAssetToTimeline(project, "audio");
    const clipId = project.tracks[1].clips[0].id;

    expect(() => updateAudioClipCompressor(project, clipId, {
      enabled: true,
      thresholdDb: -61,
      ratio: 4,
      attackMs: 20,
      releaseMs: 250,
    })).toThrow("outside the supported range");

    expect(() => updateAudioClipCompressor(project, clipId, {
      enabled: true,
      thresholdDb: -24,
      ratio: 20.1,
      attackMs: 20,
      releaseMs: 250,
    })).toThrow("outside the supported range");

    expect(() => updateAudioClipCompressor(project, clipId, {
      enabled: true,
      thresholdDb: -24,
      ratio: 4,
      attackMs: 0,
      releaseMs: 250,
    })).toThrow("outside the supported range");
  });

  it("rejects compression for visual clips and locked audio tracks", () => {
    let project = createProject({ id: "compressor-routing-errors" });
    project = {
      ...project,
      assets: [{
        id: "video", name: "clip.mp4", mediaType: "video", sourcePath: "/clip.mp4", durationMs: 5000,
      }, {
        id: "audio", name: "voice.mp3", mediaType: "audio", sourcePath: "/voice.mp3", durationMs: 5000,
      }],
    };
    project = addAssetToTimeline(project, "video");
    const visualId = project.tracks[0].clips[0].id;
    expect(() => updateAudioClipCompressor(project, visualId, {
      enabled: true, thresholdDb: -24, ratio: 4, attackMs: 20, releaseMs: 250,
    })).toThrow("Audio compression is only available for audio clips.");

    project = addAssetToTimeline(project, "audio");
    const audioId = project.tracks[1].clips[0].id;
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "audio-1" ? { ...track, isLocked: true } : track,
      ),
    };
    expect(() => updateAudioClipCompressor(project, audioId, {
      enabled: true, thresholdDb: -24, ratio: 4, attackMs: 20, releaseMs: 250,
    })).toThrow("Track is locked.");
  });
});

describe("audio volume automation", () => {
  it("adds, updates, and removes an audio volume keyframe", () => {
    let project = createProject({ id: "audio-volume-automation-command" });
    project = {
      ...project,
      assets: [{
        id: "audio",
        name: "voice.mp3",
        mediaType: "audio",
        sourcePath: "/voice.mp3",
        durationMs: 5000,
      }],
    };
    project = addAssetToTimeline(project, "audio");
    const clipId = project.tracks[1].clips[0].id;

    project = updateAudioClipVolumeAtTime(
      project,
      clipId,
      1000,
      0.4,
      new Date("2026-09-21T05:00:00.000Z"),
    );

    expect(project.tracks[1].clips[0].audioVolumeKeyframes).toEqual([
      { timeMs: 1000, volume: 0.4 },
    ]);
    expect(project.updatedAt).toBe("2026-09-21T05:00:00.000Z");

    project = updateAudioClipVolumeAtTime(project, clipId, 1000.4, 0.7);
    expect(project.tracks[1].clips[0].audioVolumeKeyframes).toEqual([
      { timeMs: 1000, volume: 0.7 },
    ]);

    project = removeAudioClipVolumeKeyframe(project, clipId, 1000);
    expect(project.tracks[1].clips[0].audioVolumeKeyframes).toBeUndefined();
  });

  it("rejects invalid audio volume automation routing and values", () => {
    let project = createProject({ id: "audio-volume-automation-errors" });
    project = {
      ...project,
      assets: [{
        id: "video",
        name: "clip.mp4",
        mediaType: "video",
        sourcePath: "/clip.mp4",
        durationMs: 5000,
      }, {
        id: "audio",
        name: "voice.mp3",
        mediaType: "audio",
        sourcePath: "/voice.mp3",
        durationMs: 5000,
      }],
    };
    project = addAssetToTimeline(project, "video");
    const visualId = project.tracks[0].clips[0].id;
    expect(() =>
      updateAudioClipVolumeAtTime(project, visualId, 0, 0.5),
    ).toThrow("Audio automation is only available for audio clips.");

    project = addAssetToTimeline(project, "audio");
    const audioId = project.tracks[1].clips[0].id;

    expect(() =>
      updateAudioClipVolumeAtTime(project, audioId, 5001, 0.5),
    ).toThrow("Audio volume keyframe time must be inside the clip.");
    expect(() =>
      updateAudioClipVolumeAtTime(project, audioId, 0, 1.1),
    ).toThrow("Audio volume must be between 0 and 1.");
  });
});

describe("audio volume automation split preservation", () => {
  it("carries the automation state across an audio clip split", () => {
    let project = createProject({ id: "audio-volume-split" });
    project = {
      ...project,
      assets: [{
        id: "audio",
        name: "voice.mp3",
        mediaType: "audio",
        sourcePath: "/voice.mp3",
        durationMs: 6000,
      }],
    };
    project = addAssetToTimeline(project, "audio");
    const clipId = project.tracks[1].clips[0].id;

    project = updateAudioClipVolumeAtTime(project, clipId, 0, 0.2);
    project = updateAudioClipVolumeAtTime(project, clipId, 4000, 1);

    const updated = splitClipAtTime(project, clipId, 2000);
    const clips = updated.tracks[1].clips.sort(
      (left, right) => left.timelineStartMs - right.timelineStartMs,
    );

    expect(clips).toHaveLength(2);
    expect(clips[0].audioVolumeKeyframes).toEqual([
      { timeMs: 0, volume: 0.2 },
      { timeMs: 2000, volume: 0.6 },
    ]);
    expect(clips[1].audioVolumeKeyframes).toEqual([
      { timeMs: 0, volume: 0.6 },
      { timeMs: 2000, volume: 1 },
    ]);
  });
});

describe("updateTrackPan", () => {
  it("updates the track pan and project timestamp", () => {
    const project = createProject({
      id: "pan-command",
      now: new Date("2026-09-20T00:00:00.000Z"),
    });

    const updated = updateTrackPan(
      project,
      "audio-1",
      -0.65,
      new Date("2026-09-20T00:00:01.000Z"),
    );

    expect(updated.tracks.find((track) => track.id === "audio-1")?.pan).toBe(-0.65);
    expect(updated.updatedAt).toBe("2026-09-20T00:00:01.000Z");
  });

  it("rejects invalid pan values and non-audio tracks", () => {
    const project = createProject({ id: "pan-command-errors" });

    expect(() => updateTrackPan(project, "audio-1", -1.01)).toThrow(
      "Track pan must be between -1 and 1.",
    );
    expect(() => updateTrackPan(project, "audio-1", 1.01)).toThrow(
      "Track pan must be between -1 and 1.",
    );
    expect(() => updateTrackPan(project, "missing-track", 0)).toThrow(
      "Track does not exist in this project.",
    );
    expect(() => updateTrackPan(project, "video-1", 0.5)).toThrow(
      "Track pan is only available for audio tracks.",
    );
  });

});

describe("updateTrackVolume", () => {
  it("updates the track volume and project timestamp", () => {
    const project = createProject({
      id: "volume-command",
      now: new Date("2026-09-20T00:00:00.000Z"),
    });

    const updated = updateTrackVolume(
      project,
      "audio-1",
      0.35,
      new Date("2026-09-20T00:00:01.000Z"),
    );

    expect(updated.tracks.find((track) => track.id === "audio-1")?.volume).toBe(0.35);
    expect(updated.updatedAt).toBe("2026-09-20T00:00:01.000Z");
  });

  it("rejects invalid volume values and unknown tracks", () => {
    const project = createProject({ id: "volume-command-errors" });

    expect(() => updateTrackVolume(project, "audio-1", -0.01)).toThrow(
      "Track volume must be between 0 and 1.",
    );
    expect(() => updateTrackVolume(project, "audio-1", 1.01)).toThrow(
      "Track volume must be between 0 and 1.",
    );
    expect(() => updateTrackVolume(project, "missing-track", 0.5)).toThrow(
      "Track does not exist in this project.",
    );
  });
});

describe("updateAudioClipFades", () => {
  it("updates audio clip fades and project timestamp", () => {
    const project = createProject({
      id: "audio-fades",
      now: new Date("2026-09-20T00:00:00.000Z"),
    });
    project.assets.push({
      id: "audio",
      name: "music.mp3",
      mediaType: "audio",
      sourcePath: "/music.mp3",
      durationMs: 5000,
    });

    const populated = addAssetToTimeline(project, "audio");
    const clipId = populated.tracks[1].clips[0].id;

    const updated = updateAudioClipFades(
      populated,
      clipId,
      1000,
      1500,
      new Date("2026-09-20T00:00:01.000Z"),
    );

    expect(updated.tracks[1].clips[0]).toMatchObject({
      id: clipId,
      audioFadeInMs: 1000,
      audioFadeOutMs: 1500,
    });
    expect(updated.updatedAt).toBe("2026-09-20T00:00:01.000Z");
  });

  it("rejects invalid audio fade values and overlapping fades", () => {
    const project = createProject({ id: "audio-fade-errors" });
    project.assets.push({
      id: "audio",
      name: "music.mp3",
      mediaType: "audio",
      sourcePath: "/music.mp3",
      durationMs: 5000,
    });
    const populated = addAssetToTimeline(project, "audio");
    const clipId = populated.tracks[1].clips[0].id;

    expect(() =>
      updateAudioClipFades(populated, clipId, -1, 0),
    ).toThrow("non-negative integers");
    expect(() =>
      updateAudioClipFades(populated, clipId, 3000, 2500),
    ).toThrow("cannot overlap");
  });

  it("rejects audio fades on visual clips", () => {
    const project = createProject({ id: "visual-fade-error" });
    project.assets.push({
      id: "video",
      name: "clip.mp4",
      mediaType: "video",
      sourcePath: "/clip.mp4",
      durationMs: 5000,
    });
    const populated = addAssetToTimeline(project, "video");
    const clipId = populated.tracks[0].clips[0].id;

    expect(() =>
      updateAudioClipFades(populated, clipId, 500, 500),
    ).toThrow("only available for audio clips");
  });
});

describe("updateAudioClipEq", () => {
  function createAudioProject() {
    const project = createProject({
      id: "audio-eq-command",
      now: new Date("2026-09-20T00:00:00.000Z"),
    });
    project.assets.push({
      id: "audio",
      name: "music.mp3",
      mediaType: "audio",
      sourcePath: "/music.mp3",
      durationMs: 5000,
    });
    return addAssetToTimeline(project, "audio");
  }

  it("updates audio clip EQ settings and timestamp", () => {
    const project = createAudioProject();
    const clipId = project.tracks[1].clips[0].id;

    const updated = updateAudioClipEq(
      project,
      clipId,
      {
        enabled: true,
        lowGainDb: 4.5,
        midGainDb: -2,
        highGainDb: 7,
      },
      new Date("2026-09-20T00:00:01.000Z"),
    );

    expect(updated.tracks[1].clips[0].audioEq).toEqual({
      enabled: true,
      lowGainDb: 4.5,
      midGainDb: -2,
      highGainDb: 7,
    });
    expect(updated.updatedAt).toBe("2026-09-20T00:00:01.000Z");
  });

  it("clears neutral disabled EQ and rejects invalid ranges", () => {
    const project = createAudioProject();
    const clipId = project.tracks[1].clips[0].id;
    const enabled = updateAudioClipEq(project, clipId, {
      enabled: true,
      lowGainDb: 3,
      midGainDb: 0,
      highGainDb: 0,
    });

    const cleared = updateAudioClipEq(enabled, clipId, {
      enabled: false,
      lowGainDb: 0,
      midGainDb: 0,
      highGainDb: 0,
    });

    expect(cleared.tracks[1].clips[0].audioEq).toBeUndefined();

    expect(() =>
      updateAudioClipEq(project, clipId, {
        enabled: true,
        lowGainDb: 12.1,
        midGainDb: 0,
        highGainDb: 0,
      }),
    ).toThrow("between -12 and 12 dB.");
  });

  it("rejects EQ on visual clips and locked audio tracks", () => {
    const project = createProject({ id: "audio-eq-errors" });
    project.assets.push({
      id: "video",
      name: "clip.mp4",
      mediaType: "video",
      sourcePath: "/clip.mp4",
      durationMs: 5000,
    });

    const videoProject = addAssetToTimeline(project, "video");
    expect(() =>
      updateAudioClipEq(videoProject, videoProject.tracks[0].clips[0].id, {
        enabled: true,
        lowGainDb: 1,
        midGainDb: 0,
        highGainDb: 0,
      }),
    ).toThrow("only available for audio clips");

    const audioProject = createAudioProject();
    const lockedProject = {
      ...audioProject,
      tracks: audioProject.tracks.map((track) =>
        track.id === "audio-1" ? { ...track, isLocked: true } : track,
      ),
    };

    expect(() =>
      updateAudioClipEq(lockedProject, lockedProject.tracks[1].clips[0].id, {
        enabled: true,
        lowGainDb: 1,
        midGainDb: 0,
        highGainDb: 0,
      }),
    ).toThrow("Track is locked.");
  });
});

describe("toggleTrackMute", () => {
  it("toggles a track mute state", () => {
    const project = createProject({
      id: "mute-command",
      now: new Date("2026-09-20T00:00:00.000Z"),
    });

    const muted = toggleTrackMute(
      project,
      "video-1",
      new Date("2026-09-20T00:00:01.000Z"),
    );

    expect(muted.tracks.find((track) => track.id === "video-1")?.isMuted).toBe(true);
    expect(muted.updatedAt).toBe("2026-09-20T00:00:01.000Z");

    const unmuted = toggleTrackMute(
      muted,
      "video-1",
      new Date("2026-09-20T00:00:02.000Z"),
    );

    expect(unmuted.tracks.find((track) => track.id === "video-1")?.isMuted).toBe(false);
  });

  it("throws for an unknown track", () => {
    const project = createProject({ id: "mute-missing" });

    expect(() => toggleTrackMute(project, "missing-track")).toThrow(
      "Track does not exist in this project.",
    );
  });
});

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

  it("rejects moving a clip into another clip on the same track", () => {
    const project = createProject({ id: "move-overlap-project" });
    project.assets.push(
      {
        id: "move-overlap-a",
        name: "a.mp4",
        mediaType: "video",
        sourcePath: "/a.mp4",
        durationMs: 5000,
      },
      {
        id: "move-overlap-b",
        name: "b.mp4",
        mediaType: "video",
        sourcePath: "/b.mp4",
        durationMs: 5000,
      },
    );

    const withFirst = addAssetToTimeline(project, "move-overlap-a");
    const populated = addAssetToTimeline(withFirst, "move-overlap-b");
    const firstClipId = populated.tracks[0].clips[0].id;

    expect(() => moveClipOnTimeline(populated, firstClipId, 1000)).toThrow(
      "Clip cannot overlap another clip on the same track.",
    );
  });

  it("rejects moving a clip before the timeline origin", () => {
    const project = createProject({ id: "move-project-2" });
    project.assets.push({
      id: "move-asset-2",
      name: "move-2.mp4",
      mediaType: "video",
      sourcePath: "/move-2.mp4",
      durationMs: 5000,
    });

    const populated = addAssetToTimeline(project, "move-asset-2");
    const clipId = populated.tracks[0].clips[0].id;

    expect(() => moveClipOnTimeline(populated, clipId, -1)).toThrow(
      "Clip timeline position must be zero or greater.",
    );
  });

  it("rejects editing a locked track", () => {
    const project = createProject({ id: "locked-project" });
    project.assets.push({
      id: "locked-asset",
      name: "locked.mp4",
      mediaType: "video",
      sourcePath: "/locked.mp4",
      durationMs: 5000,
    });

    const populated = addAssetToTimeline(project, "locked-asset");
    const clipId = populated.tracks[0].clips[0].id;
    populated.tracks[0].isLocked = true;

    expect(() => moveClipOnTimeline(populated, clipId, 1000)).toThrow(
      "Track is locked.",
    );
    expect(() => trimClipStart(populated, clipId, 1000)).toThrow(
      "Track is locked.",
    );
    expect(() => trimClipEnd(populated, clipId, 4000)).toThrow(
      "Track is locked.",
    );
    expect(() => splitClipAtTime(populated, clipId, 1000)).toThrow(
      "Track is locked.",
    );
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

describe("audio fade preservation through timeline edits", () => {
  it("clamps fades when an audio clip is trimmed", () => {
    let project = createProject({ id: "audio-fade-trim" });
    project.assets.push({
      id: "audio",
      name: "music.mp3",
      mediaType: "audio",
      sourcePath: "/music.mp3",
      durationMs: 5000,
    });

    project = addAssetToTimeline(project, "audio");
    const clipId = project.tracks[1].clips[0].id;
    project = updateAudioClipFades(project, clipId, 1500, 1500);

    const trimmed = trimClipEnd(project, clipId, 2000);
    expect(trimmed.tracks[1].clips[0]).toMatchObject({
      audioFadeInMs: 1500,
      audioFadeOutMs: 500,
    });
  });

  it("keeps audio fade-in on the first split clip and fade-out on the second", () => {
    let project = createProject({ id: "audio-fade-split" });
    project.assets.push({
      id: "audio",
      name: "split.mp3",
      mediaType: "audio",
      sourcePath: "/split.mp3",
      durationMs: 5000,
    });

    project = addAssetToTimeline(project, "audio");
    const clipId = project.tracks[1].clips[0].id;
    project = updateAudioClipFades(project, clipId, 500, 700);

    const split = splitClipAtTime(project, clipId, 2000);
    const clips = [...split.tracks[1].clips].sort(
      (left, right) => left.timelineStartMs - right.timelineStartMs,
    );

    expect(clips).toHaveLength(2);
    expect(clips[0].audioFadeInMs).toBe(500);
    expect(clips[0].audioFadeOutMs).toBeUndefined();
    expect(clips[1].audioFadeInMs).toBeUndefined();
    expect(clips[1].audioFadeOutMs).toBe(700);
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

  it("rejects a split at the clip start boundary", () => {
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

  it("rejects a split at the clip end boundary", () => {
    const project = createProject({ id: "split-project-3" });
    project.assets.push({
      id: "split-asset-3",
      name: "split-3.mp4",
      mediaType: "video",
      sourcePath: "/split-3.mp4",
      durationMs: 10_000,
    });

    const populated = addAssetToTimeline(project, "split-asset-3");
    const clipId = populated.tracks[0].clips[0].id;

    expect(() => splitClipAtTime(populated, clipId, 10_000)).toThrow(
      "Split time must be inside the selected clip.",
    );
  });
});


describe("transform keyframe commands", () => {
  it("adds keyframes and edits the keyed transform at the current time", () => {
    let project = createProject({ id: "keyframe-command" });
    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "keyframe.mp4",
          mediaType: "video",
          sourcePath: "/keyframe.mp4",
          durationMs: 4000,
        },
      ],
    };
    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(
      project,
      clipId,
      0,
      new Date("2026-09-20T02:00:00.000Z"),
    );
    project = updateClipTransformAtTime(
      project,
      clipId,
      2000,
      { x: 40, scale: 2, opacity: 0.5 },
      new Date("2026-09-20T02:00:01.000Z"),
    );

    expect(project.tracks[0].clips[0].transformKeyframes).toEqual([
      {
        timeMs: 0,
        transform: {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
        },
        easing: "linear",
      },
      {
        timeMs: 2000,
        transform: {
          x: 40,
          y: 0,
          scale: 2,
          rotation: 0,
          opacity: 0.5,
        },
        easing: "linear",
      },
    ]);
  });

  it("moves a transform keyframe and preserves its transform", () => {
    let project = createProject({ id: "keyframe-move-command" });
    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "keyframe-move.mp4",
          mediaType: "video",
          sourcePath: "/keyframe-move.mp4",
          durationMs: 5000,
        },
      ],
    };
    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(project, clipId, 1000);
    project = updateClipTransformAtTime(project, clipId, 1000, {
      x: 25,
      rotation: 15,
    });

    project = moveTransformKeyframe(project, clipId, 1000, 2500);

    expect(project.tracks[0].clips[0].transformKeyframes).toEqual([
      {
        timeMs: 2500,
        transform: {
          x: 25,
          y: 0,
          scale: 1,
          rotation: 15,
          opacity: 1,
        },
        easing: "linear",
      },
    ]);
  });

  it("rejects moving a keyframe onto an occupied time", () => {
    let project = createProject({ id: "keyframe-collision-command" });
    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "keyframe-collision.mp4",
          mediaType: "video",
          sourcePath: "/keyframe-collision.mp4",
          durationMs: 5000,
        },
      ],
    };
    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(project, clipId, 1000);
    project = addTransformKeyframe(project, clipId, 2000);

    expect(() =>
      moveTransformKeyframe(project, clipId, 1000, 2000),
    ).toThrow("already exists");
  });

  it("updates the easing on an existing transform keyframe", () => {
    let project = createProject({ id: "keyframe-easing-command" });
    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "keyframe-easing.mp4",
          mediaType: "video",
          sourcePath: "/keyframe-easing.mp4",
          durationMs: 4000,
        },
      ],
    };
    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(project, clipId, 1000);
    project = updateTransformKeyframeEasing(
      project,
      clipId,
      1000,
      "ease-in-out",
    );

    expect(project.tracks[0].clips[0].transformKeyframes?.[0].easing).toBe(
      "ease-in-out",
    );
  });

  it("removes the active keyframe and preserves the remaining animation", () => {
    let project = createProject({ id: "keyframe-remove-command" });
    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "keyframe-remove.mp4",
          mediaType: "video",
          sourcePath: "/keyframe-remove.mp4",
          durationMs: 4000,
        },
      ],
    };
    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(project, clipId, 0);
    project = addTransformKeyframe(project, clipId, 2000);
    project = updateClipTransformAtTime(project, clipId, 2000, { x: 30 });

    const updated = removeTransformKeyframe(project, clipId, 2000);

    expect(updated.tracks[0].clips[0].transformKeyframes).toHaveLength(1);
    expect(updated.tracks[0].clips[0].transformKeyframes?.[0].timeMs).toBe(0);
  });

  it("carries keyed animation across a split", () => {
    let project = createProject({ id: "keyframe-split-command" });
    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "keyframe-split.mp4",
          mediaType: "video",
          sourcePath: "/keyframe-split.mp4",
          durationMs: 6000,
        },
      ],
    };
    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(project, clipId, 0);
    project = updateClipTransformAtTime(project, clipId, 3000, {
      x: 60,
      scale: 2,
    });
    project = addTransformKeyframe(project, clipId, 6000);

    const split = splitClipAtTime(project, clipId, 3000);
    const first = split.tracks[0].clips[0];
    const second = split.tracks[0].clips[1];

    expect(first.transformKeyframes?.map((keyframe) => keyframe.timeMs)).toEqual([
      0,
      3000,
    ]);
    expect(second.transformKeyframes?.map((keyframe) => keyframe.timeMs)).toEqual([
      0,
      3000,
    ]);
    expect(second.transformKeyframes?.[0].transform.x).toBe(60);
  });

  it("updates and clamps a visual clip crop", () => {
    let project = createProject({ id: "crop-command" });
    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "crop.mp4",
          mediaType: "video",
          sourcePath: "/crop.mp4",
          durationMs: 5000,
        },
      ],
    };
    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;

    const updated = updateClipCrop(
      project,
      clipId,
      {
        top: -0.2,
        right: 0.1,
        bottom: 0.2,
        left: 0.3,
      },
      new Date("2026-09-20T03:00:00.000Z"),
    );

    expect(updated.tracks[0].clips[0].crop).toEqual({
      top: 0,
      right: 0.1,
      bottom: 0.2,
      left: 0.3,
    });
  });

  it("rejects a crop that removes the entire visual content", () => {
    let project = createProject({ id: "crop-invalid-command" });
    project = {
      ...project,
      assets: [
        {
          id: "image",
          name: "crop.png",
          mediaType: "image",
          sourcePath: "/crop.png",
          durationMs: 3000,
        },
      ],
    };
    project = addAssetToTimeline(project, "image");
    const clipId = project.tracks[0].clips[0].id;

    expect(() =>
      updateClipCrop(project, clipId, {
        top: 0.5,
        right: 0,
        bottom: 0.5,
        left: 0,
      }),
    ).toThrow("Crop cannot remove the entire visual content.");
  });

  it("preserves crop settings when splitting a visual clip", () => {
    let project = createProject({ id: "crop-split-command" });
    project = {
      ...project,
      assets: [
        {
          id: "video",
          name: "crop-split.mp4",
          mediaType: "video",
          sourcePath: "/crop-split.mp4",
          durationMs: 6000,
        },
      ],
    };
    project = addAssetToTimeline(project, "video");
    const clipId = project.tracks[0].clips[0].id;
    project = updateClipCrop(project, clipId, {
      top: 0.1,
      right: 0.2,
      bottom: 0.15,
      left: 0.05,
    });

    const split = splitClipAtTime(project, clipId, 3000);
    expect(split.tracks[0].clips[0].crop).toEqual({
      top: 0.1,
      right: 0.2,
      bottom: 0.15,
      left: 0.05,
    });
    expect(split.tracks[0].clips[1].crop).toEqual({
      top: 0.1,
      right: 0.2,
      bottom: 0.15,
      left: 0.05,
    });
  });

});


describe("clip transitions", () => {
  it("sets a fade-through-black transition between adjacent visual clips", () => {
    const project = createProject({ id: "fade-transition-command" });
    project.assets.push(
      {
        id: "fade-a",
        name: "a.mp4",
        mediaType: "video",
        sourcePath: "/a.mp4",
        durationMs: 4000,
      },
      {
        id: "fade-b",
        name: "b.mp4",
        mediaType: "video",
        sourcePath: "/b.mp4",
        durationMs: 3000,
      },
    );

    const populated = addAssetToTimeline(
      addAssetToTimeline(project, "fade-a"),
      "fade-b",
    );
    const firstClipId = populated.tracks[0].clips[0].id;

    const updated = updateClipTransition(
      populated,
      firstClipId,
      { type: "fade-through-black", durationMs: 900 },
    );

    expect(updated.tracks[0].clips[0].transitionOut).toEqual({
      type: "fade-through-black",
      durationMs: 900,
    });
  });

  it("sets a dissolve transition only between directly adjacent visual clips", () => {
    const project = createProject({ id: "transition-command" });
    project.assets.push(
      {
        id: "transition-a",
        name: "a.mp4",
        mediaType: "video",
        sourcePath: "/a.mp4",
        durationMs: 4000,
      },
      {
        id: "transition-b",
        name: "b.mp4",
        mediaType: "video",
        sourcePath: "/b.mp4",
        durationMs: 3000,
      },
    );

    const populated = addAssetToTimeline(
      addAssetToTimeline(project, "transition-a"),
      "transition-b",
    );
    const firstClipId = populated.tracks[0].clips[0].id;

    const updated = updateClipTransition(
      populated,
      firstClipId,
      { type: "dissolve", durationMs: 450 },
      new Date("2026-09-21T03:00:00.000Z"),
    );

    expect(updated.tracks[0].clips[0].transitionOut).toEqual({
      type: "dissolve",
      durationMs: 450,
    });
    expect(updated.updatedAt).toBe("2026-09-21T03:00:00.000Z");
  });

  it("rejects transitions without an adjacent visual clip or with excessive duration", () => {
    const project = createProject({ id: "transition-command-errors" });
    project.assets.push({
      id: "transition-only",
      name: "only.mp4",
      mediaType: "video",
      sourcePath: "/only.mp4",
      durationMs: 1000,
    });

    const onlyClipProject = addAssetToTimeline(project, "transition-only");
    const onlyClipId = onlyClipProject.tracks[0].clips[0].id;

    expect(() =>
      updateClipTransition(
        onlyClipProject,
        onlyClipId,
        { type: "dissolve", durationMs: 300 },
      ),
    ).toThrow("Transition requires an adjacent visual clip.");

    project.assets.push({
      id: "transition-second",
      name: "second.mp4",
      mediaType: "video",
      sourcePath: "/second.mp4",
      durationMs: 800,
    });

    const adjacent = addAssetToTimeline(
      onlyClipProject,
      "transition-second",
    );

    expect(() =>
      updateClipTransition(
        adjacent,
        adjacent.tracks[0].clips[0].id,
        { type: "dissolve", durationMs: 1100 },
      ),
    ).toThrow("Transition duration cannot exceed either clip duration.");
  });

  it("clears a previous transition when trimming the incoming clip start breaks adjacency", () => {
    const project = createProject({ id: "transition-trim-start-clear" });
    project.assets.push(
      {
        id: "transition-trim-start-a",
        name: "a.mp4",
        mediaType: "video",
        sourcePath: "/a.mp4",
        durationMs: 3000,
      },
      {
        id: "transition-trim-start-b",
        name: "b.mp4",
        mediaType: "video",
        sourcePath: "/b.mp4",
        durationMs: 3000,
      },
    );

    let populated = addAssetToTimeline(project, "transition-trim-start-a");
    populated = addAssetToTimeline(populated, "transition-trim-start-b");
    const firstClipId = populated.tracks[0].clips[0].id;
    const secondClipId = populated.tracks[0].clips[1].id;

    populated = updateClipTransition(
      populated,
      firstClipId,
      { type: "dissolve", durationMs: 500 },
    );

    const trimmed = trimClipStart(populated, secondClipId, 500);

    expect(trimmed.tracks[0].clips[0].transitionOut).toBeUndefined();
  });

  it("clears a transition when moving the outgoing or incoming clip breaks adjacency", () => {
    const project = createProject({ id: "transition-move-clear" });
    project.assets.push(
      {
        id: "transition-move-a",
        name: "a.mp4",
        mediaType: "video",
        sourcePath: "/a.mp4",
        durationMs: 3000,
      },
      {
        id: "transition-move-b",
        name: "b.mp4",
        mediaType: "video",
        sourcePath: "/b.mp4",
        durationMs: 3000,
      },
    );

    let populated = addAssetToTimeline(project, "transition-move-a");
    populated = addAssetToTimeline(populated, "transition-move-b");
    const firstClipId = populated.tracks[0].clips[0].id;
    const secondClipId = populated.tracks[0].clips[1].id;

    populated = updateClipTransition(
      populated,
      firstClipId,
      { type: "dissolve", durationMs: 500 },
    );

    const movedIncoming = moveClipOnTimeline(
      populated,
      secondClipId,
      5000,
    );

    expect(movedIncoming.tracks[0].clips[0].transitionOut).toBeUndefined();

    const restored = moveClipOnTimeline(
      movedIncoming,
      secondClipId,
      3000,
    );
    const movedOutgoing = moveClipOnTimeline(
      updateClipTransition(
        restored,
        firstClipId,
        { type: "dissolve", durationMs: 500 },
      ),
      firstClipId,
      6000,
    );

    expect(movedOutgoing.tracks[0].clips[0].transitionOut).toBeUndefined();
  });

  it("clears a previous transition when the incoming clip is deleted", () => {
    const project = createProject({ id: "transition-delete-clear" });
    project.assets.push(
      {
        id: "transition-delete-a",
        name: "a.mp4",
        mediaType: "video",
        sourcePath: "/a.mp4",
        durationMs: 3000,
      },
      {
        id: "transition-delete-b",
        name: "b.mp4",
        mediaType: "video",
        sourcePath: "/b.mp4",
        durationMs: 3000,
      },
    );

    let populated = addAssetToTimeline(project, "transition-delete-a");
    populated = addAssetToTimeline(populated, "transition-delete-b");
    const firstClipId = populated.tracks[0].clips[0].id;
    const secondClipId = populated.tracks[0].clips[1].id;

    populated = updateClipTransition(
      populated,
      firstClipId,
      { type: "dissolve", durationMs: 500 },
    );

    const deleted = removeClipFromTimeline(populated, secondClipId);

    expect(deleted.tracks[0].clips[0].transitionOut).toBeUndefined();
  });

  it("keeps a transition on the second half when splitting an outgoing clip", () => {
    const project = createProject({ id: "transition-split" });
    project.assets.push(
      {
        id: "transition-split-a",
        name: "a.mp4",
        mediaType: "video",
        sourcePath: "/a.mp4",
        durationMs: 6000,
      },
      {
        id: "transition-split-b",
        name: "b.mp4",
        mediaType: "video",
        sourcePath: "/b.mp4",
        durationMs: 3000,
      },
    );

    let populated = addAssetToTimeline(project, "transition-split-a");
    populated = addAssetToTimeline(populated, "transition-split-b");
    const firstClipId = populated.tracks[0].clips[0].id;

    populated = updateClipTransition(
      populated,
      firstClipId,
      { type: "dissolve", durationMs: 500 },
    );

    const split = splitClipAtTime(populated, firstClipId, 3000);
    const first = split.tracks[0].clips[0];
    const second = split.tracks[0].clips[1];

    expect(first.transitionOut).toBeUndefined();
    expect(second.transitionOut).toEqual({
      type: "dissolve",
      durationMs: 500,
    });
  });

  it("clamps a transition when trimming an adjacent clip shorter", () => {
    const project = createProject({ id: "transition-trim-clamp" });
    project.assets.push(
      {
        id: "transition-trim-a",
        name: "a.mp4",
        mediaType: "video",
        sourcePath: "/a.mp4",
        durationMs: 3000,
      },
      {
        id: "transition-trim-b",
        name: "b.mp4",
        mediaType: "video",
        sourcePath: "/b.mp4",
        durationMs: 3000,
      },
    );

    let populated = addAssetToTimeline(project, "transition-trim-a");
    populated = addAssetToTimeline(populated, "transition-trim-b");
    const firstClipId = populated.tracks[0].clips[0].id;

    populated = updateClipTransition(
      populated,
      firstClipId,
      { type: "dissolve", durationMs: 800 },
    );

    const secondClipId = populated.tracks[0].clips[1].id;
    const trimmed = trimClipEnd(populated, secondClipId, 400);

    expect(trimmed.tracks[0].clips[0].transitionOut).toEqual({
      type: "dissolve",
      durationMs: 400,
    });
  });

  it("clears an existing transition", () => {
    const project = createProject({ id: "transition-clear" });
    project.assets.push(
      {
        id: "transition-clear-a",
        name: "a.mp4",
        mediaType: "video",
        sourcePath: "/a.mp4",
        durationMs: 3000,
      },
      {
        id: "transition-clear-b",
        name: "b.mp4",
        mediaType: "video",
        sourcePath: "/b.mp4",
        durationMs: 3000,
      },
    );

    let populated = addAssetToTimeline(project, "transition-clear-a");
    populated = addAssetToTimeline(populated, "transition-clear-b");
    const clipId = populated.tracks[0].clips[0].id;

    populated = updateClipTransition(
      populated,
      clipId,
      { type: "dissolve", durationMs: 500 },
    );
    const cleared = updateClipTransition(populated, clipId, undefined);

    expect(cleared.tracks[0].clips[0].transitionOut).toBeUndefined();
  });
});
