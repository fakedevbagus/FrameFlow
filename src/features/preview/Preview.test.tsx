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

    expect(playMock).toHaveBeenCalled();
  });
});
