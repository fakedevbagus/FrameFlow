import { describe, expect, it } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline } from "../timeline/commands";
import {
  findActivePreviewClip,
  getClipLocalTimeMs,
} from "./preview";

describe("preview helpers", () => {
  it("finds the active visual clip at the playhead", () => {
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
      ],
    };

    project = addAssetToTimeline(project, "video-1");

    const active = findActivePreviewClip(project, 2500);

    expect(active?.asset.name).toBe("intro.mp4");
    expect(active?.track.type).toBe("video");
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

    expect(active?.asset.name).toBe("music.mp3");
    expect(active?.track.type).toBe("audio");
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
});
