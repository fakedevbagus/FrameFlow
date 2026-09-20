import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline } from "../timeline/commands";
import { Preview } from "./Preview";

vi.mock("@tauri-apps/api/core", async () => {
  const actual = await vi.importActual<typeof import("@tauri-apps/api/core")>(
    "@tauri-apps/api/core",
  );

  return {
    ...actual,
    convertFileSrc: (path: string) => "asset://" + path,
    invoke: vi.fn(),
  };
});

const { invokeMock } = await import("@tauri-apps/api/core").then((module) => ({
  invokeMock: module.invoke as ReturnType<typeof vi.fn>,
}));

beforeEach(() => {
  vi.restoreAllMocks();
  invokeMock.mockReset();
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

  it("falls back to a compatible preview when the source video cannot be decoded", async () => {
    invokeMock.mockResolvedValueOnce(
      "/home/test/.cache/com.fakedevbagus.frameflow/previews-v4/video-preview.mp4",
    );

    let project = createProject({ id: "video-preview-fallback" });

    project = {
      ...project,
      assets: [
        {
          id: "video-fallback",
          name: "unsupported.mp4",
          mediaType: "video",
          sourcePath: "/media/unsupported.mp4",
          durationMs: 6000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-fallback");

    render(
      <Preview
        project={project}
        currentTimeMs={1000}
        isPlaying={false}
      />,
    );

    const video = screen.getByTestId("preview-video");
    await act(async () => {
      fireEvent.error(video);
    });

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("prepare_media_preview", {
        path: "/media/unsupported.mp4",
      });
      expect(video).toHaveAttribute(
        "src",
        "asset:///home/test/.cache/com.fakedevbagus.frameflow/previews-v4/video-preview.mp4",
      );
    });
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

  it("moves a selected visual directly on the canvas", async () => {
    let project = createProject({ id: "canvas-move-preview" });

    project = {
      ...project,
      assets: [
        {
          id: "video-1",
          name: "move.mp4",
          mediaType: "video",
          sourcePath: "/media/move.mp4",
          durationMs: 6000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-1");
    const clipId = project.tracks[0].clips[0].id;
    const onSelectClip = vi.fn();
    const onTransformCommit = vi.fn();

    render(
      <Preview
        project={project}
        currentTimeMs={1000}
        isPlaying={false}
        selectedClipId={clipId}
        onSelectClip={onSelectClip}
        onTransformCommit={onTransformCommit}
      />,
    );

    const hitArea = screen.getByTestId(`preview-hit-area-${clipId}`);
    Object.defineProperty(hitArea, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 400,
        height: 400,
        left: 0,
        right: 200,
        top: 0,
        width: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    fireEvent.pointerDown(hitArea, {
      button: 0,
      pointerId: 1,
      clientX: 50,
      clientY: 100,
    });
    fireEvent.pointerMove(hitArea, {
      buttons: 1,
      pointerId: 1,
      clientX: 90,
      clientY: 60,
    });
    fireEvent.pointerUp(hitArea, {
      button: 0,
      pointerId: 1,
      clientX: 90,
      clientY: 60,
    });

    await vi.waitFor(() => {
      expect(onSelectClip).toHaveBeenCalledWith(clipId);
      expect(onTransformCommit).toHaveBeenCalledWith(
        clipId,
        expect.objectContaining({
          x: 20,
          y: -10,
        }),
      );
    });
  });

  it("shows direct manipulation handles for the selected visual", () => {
    let project = createProject({ id: "canvas-handles-preview" });

    project = {
      ...project,
      assets: [
        {
          id: "video-1",
          name: "handles.mp4",
          mediaType: "video",
          sourcePath: "/media/handles.mp4",
          durationMs: 6000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-1");
    const clipId = project.tracks[0].clips[0].id;

    render(
      <Preview
        project={project}
        currentTimeMs={1000}
        isPlaying={false}
        selectedClipId={clipId}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Rotate selected visual" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Scale selected visual" }),
    ).toBeInTheDocument();
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
