import { describe, expect, it } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline } from "../timeline/commands";
import {
  findActivePreviewClip,
  getActiveAudioPreviewClips,
  getActiveVisualPreviewClips,
  getClipLocalTimeMs,
} from "./preview";

describe("preview helpers", () => {
  it("finds the topmost active visual clip at the playhead", () => {
    let project = createProject({ id: "preview-project" });

    project = {
      ...project,
      assets: [
        {
          id: "video-1",
          name: "intro.mp4",
          mediaType: "video",
          sourcePath: "/media/intro.mp4",
          durationMs: 12000,
        },
        {
          id: "video-2",
          name: "overlay.mp4",
          mediaType: "video",
          sourcePath: "/media/overlay.mp4",
          durationMs: 8000,
        },
      ],
      tracks: [
        project.tracks[0],
        {
          id: "video-2-track",
          name: "Video 2",
          type: "video",
          isLocked: false,
          isMuted: false,
          clips: [],
        },
        project.tracks[1],
      ],
    };

    project = addAssetToTimeline(project, "video-1");
    const baseClip = project.tracks[0].clips[0];

    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "video-2-track"
          ? {
              ...track,
              clips: [
                {
                  ...baseClip,
                  id: "clip-video-2",
                  assetId: "video-2",
                },
              ],
            }
          : track,
      ),
    };

    const activeLayers = getActiveVisualPreviewClips(project, 2500);
    const topmost = findActivePreviewClip(project, 2500);

    expect(activeLayers).toHaveLength(2);
    expect(activeLayers[0].asset.name).toBe("intro.mp4");
    expect(activeLayers[1].asset.name).toBe("overlay.mp4");
    expect(topmost?.asset.name).toBe("overlay.mp4");
  });

  it("exposes a fade-through-black overlay during the transition", () => {
    let project = createProject({ id: "fade-preview-project" });
    project = {
      ...project,
      assets: [
        {
          id: "video-a",
          name: "a.mp4",
          mediaType: "video",
          sourcePath: "/a.mp4",
          durationMs: 4000,
        },
        {
          id: "video-b",
          name: "b.mp4",
          mediaType: "video",
          sourcePath: "/b.mp4",
          durationMs: 3000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-a");
    project = addAssetToTimeline(project, "video-b");
    project.tracks[0] = {
      ...project.tracks[0],
      clips: project.tracks[0].clips.map((clip, index) =>
        index === 0
          ? {
              ...clip,
              transitionOut: {
                type: "fade-through-black",
                durationMs: 1000,
              },
            }
          : clip,
      ),
    };

    const layers = getActiveVisualPreviewClips(project, 3500);

    expect(layers).toHaveLength(2);
    expect(layers[0].transitionOpacity).toBe(0);
    expect(layers[1].transitionOpacity).toBe(1);
    expect(layers[1].transitionOverlayOpacity).toBe(1);

    expect(
      getActiveVisualPreviewClips(project, 3250)[1].transitionOverlayOpacity,
    ).toBeCloseTo(0.5, 8);
    expect(getActiveVisualPreviewClips(project, 3999)[1].transitionOverlayOpacity).toBeCloseTo(0.002, 8);
  });

  it("falls back to an active audio clip when there is no visual clip", () => {
    let project = createProject({ id: "audio-preview-project" });

    project = {
      ...project,
      assets: [
        {
          id: "audio-1",
          name: "music.mp3",
          mediaType: "audio",
          sourcePath: "/music/music.mp3",
          durationMs: 10000,
        },
      ],
    };

    project = addAssetToTimeline(project, "audio-1");

    const active = findActivePreviewClip(project, 1000);
    const audioLayers = getActiveAudioPreviewClips(project, 1000);

    expect(active?.asset.name).toBe("music.mp3");
    expect(audioLayers).toHaveLength(1);
    expect(audioLayers[0].track.type).toBe("audio");
  });

  it("converts timeline time into source-local time", () => {
    const project = createProject({ id: "offset-project" });

    project.assets.push({
      id: "video-1",
      name: "offset.mp4",
      mediaType: "video",
      sourcePath: "/media/offset.mp4",
      durationMs: 10000,
    });

    const populated = addAssetToTimeline(project, "video-1");
    const clip = populated.tracks[0].clips[0];

    expect(
      getClipLocalTimeMs(
        {
          ...clip,
          timelineStartMs: 2000,
          sourceStartMs: 1000,
          sourceEndMs: 8000,
        },
        3500,
      ),
    ).toBe(2500);
  });

  it("does not preview muted tracks", () => {
    let project = createProject({ id: "muted-preview-project" });

    project = {
      ...project,
      assets: [
        {
          id: "video-1",
          name: "muted.mp4",
          mediaType: "video",
          sourcePath: "/media/muted.mp4",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-1");
    project.tracks[0] = { ...project.tracks[0], isMuted: true };

    expect(findActivePreviewClip(project, 1000)).toBeNull();
  });

  it("exposes outgoing and incoming visual layers during a dissolve", () => {
    let project = createProject({ id: "dissolve-preview-project" });
    project = {
      ...project,
      assets: [
        {
          id: "video-a",
          name: "a.mp4",
          mediaType: "video",
          sourcePath: "/a.mp4",
          durationMs: 4000,
        },
        {
          id: "video-b",
          name: "b.mp4",
          mediaType: "video",
          sourcePath: "/b.mp4",
          durationMs: 3000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-a");
    project = addAssetToTimeline(project, "video-b");
    project.tracks[0] = {
      ...project.tracks[0],
      clips: project.tracks[0].clips.map((clip, index) =>
        index === 0
          ? {
              ...clip,
              transitionOut: {
                type: "dissolve",
                durationMs: 1000,
              },
            }
          : clip,
      ),
    };

    const layers = getActiveVisualPreviewClips(project, 3500);

    expect(layers).toHaveLength(2);
    expect(layers[0].asset.id).toBe("video-a");
    expect(layers[1].asset.id).toBe("video-b");
    expect(layers[0].transitionOpacity).toBeCloseTo(0.5, 8);
    expect(layers[1].transitionOpacity).toBeCloseTo(0.5, 8);

    expect(getActiveVisualPreviewClips(project, 4500)).toHaveLength(1);
    expect(
      getActiveVisualPreviewClips(project, 4500)[0].asset.id,
    ).toBe("video-b");
  });

});
