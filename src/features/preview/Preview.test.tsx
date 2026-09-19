import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline } from "../timeline/commands";
import { Preview } from "./Preview";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => "asset://" + path,
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Preview", () => {
  it("renders the active local video asset", () => {
    let project = createProject({ id: "video-preview" });

    project = {
      ...project,
      assets: [
        {
          id: "video-1",
          name: "intro.mp4",
          mediaType: "video",
          sourcePath: "/media/intro.mp4",
          durationMs: 6000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-1");

    render(
      <Preview
        project={project}
        currentTimeMs={1000}
        isPlaying={false}
      />,
    );

    const video = screen.getByTestId("preview-video");

    expect(video).toHaveAttribute("src", "asset:///media/intro.mp4");
  });

  it("renders multiple active visual layers in track order", () => {
    let project = createProject({ id: "multitrack-preview" });

    project = {
      ...project,
      assets: [
        {
          id: "video-1",
          name: "base.mp4",
          mediaType: "video",
          sourcePath: "/media/base.mp4",
          durationMs: 10000,
        },
        {
          id: "video-2",
          name: "overlay.mp4",
          mediaType: "video",
          sourcePath: "/media/overlay.mp4",
          durationMs: 10000,
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
    project = addAssetToTimeline(project, "video-2");

    render(
      <Preview
        project={project}
        currentTimeMs={1000}
        isPlaying={false}
      />,
    );

    const layers = screen.getAllByTestId("preview-video");

    expect(layers).toHaveLength(2);
    expect(layers[0]).toHaveStyle({ zIndex: "1" });
    expect(layers[1]).toHaveStyle({ zIndex: "2" });
  });

  it("renders an image clip as the visual preview", () => {
    let project = createProject({ id: "image-preview" });

    project = {
      ...project,
      assets: [
        {
          id: "image-1",
          name: "poster.png",
          mediaType: "image",
          sourcePath: "/pictures/poster.png",
          durationMs: 3000,
        },
      ],
    };

    project = addAssetToTimeline(project, "image-1");

    render(
      <Preview
        project={project}
        currentTimeMs={1000}
        isPlaying={false}
      />,
    );

    expect(screen.getByAltText("poster.png")).toHaveAttribute(
      "src",
      "asset:///pictures/poster.png",
    );
  });

  it("renders audio-only clips with native controls", () => {
    let project = createProject({ id: "audio-preview" });

    project = {
      ...project,
      assets: [
        {
          id: "audio-1",
          name: "music.mp3",
          mediaType: "audio",
          sourcePath: "/music/music.mp3",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "audio-1");

    render(
      <Preview
        project={project}
        currentTimeMs={1000}
        isPlaying={false}
      />,
    );

    expect(screen.getByTestId("preview-audio")).toBeInTheDocument();
    expect(screen.getByLabelText("Audio preview")).toBeInTheDocument();
    expect(screen.getByText("music.mp3")).toBeInTheDocument();
  });

  it("keeps active audio layers mounted while a visual preview is playing", () => {
    let project = createProject({ id: "mixed-preview" });

    project = {
      ...project,
      assets: [
        {
          id: "video-1",
          name: "intro.mp4",
          mediaType: "video",
          sourcePath: "/media/intro.mp4",
          durationMs: 6000,
        },
        {
          id: "audio-1",
          name: "music.mp3",
          mediaType: "audio",
          sourcePath: "/music/music.mp3",
          durationMs: 6000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-1");
    project = addAssetToTimeline(project, "audio-1");

    render(
      <Preview
        project={project}
        currentTimeMs={1000}
        isPlaying={true}
      />,
    );

    expect(screen.getByTestId("preview-video")).toBeInTheDocument();
    expect(screen.getByTestId("preview-audio")).toBeInTheDocument();
    expect(screen.getByTestId("preview-audio")).not.toHaveAttribute("controls");
  });

  it("starts media playback when transport playback is active", async () => {
    const playMock = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);

    let project = createProject({ id: "playing-preview" });

    project = {
      ...project,
      assets: [
        {
          id: "video-1",
          name: "playing.mp4",
          mediaType: "video",
          sourcePath: "/media/playing.mp4",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-1");

    render(
      <Preview
        project={project}
        currentTimeMs={500}
        isPlaying
      />,
    );

    await vi.waitFor(() => {
      expect(playMock).toHaveBeenCalled();
    });
  });
});
