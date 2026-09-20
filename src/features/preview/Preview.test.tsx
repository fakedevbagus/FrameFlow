import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
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

async function flushPreviewEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  invokeMock.mockReset();
  invokeMock.mockImplementation((command: string) => {
    if (command === "prepare_media_preview") {
      return Promise.resolve(
        "/home/test/.cache/com.fakedevbagus.frameflow/previews-v4/default.mp4",
      );
    }

    if (command === "get_media_http_url") {
      return Promise.resolve(
        "http://127.0.0.1:43123/media?path=%2Fhome%2Ftest%2F.cache%2Fcom.fakedevbagus.frameflow%2Fpreviews-v4%2Fdefault.mp4",
      );
    }

    return Promise.resolve(undefined);
  });
});

describe("Preview", () => {
  it("renders the active local video asset", async () => {
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

    await flushPreviewEffects();
    const video = screen.getByTestId("preview-video");

    await vi.waitFor(() =>
      expect(video).toHaveAttribute(
        "src",
        "http://127.0.0.1:43123/media?path=%2Fhome%2Ftest%2F.cache%2Fcom.fakedevbagus.frameflow%2Fpreviews-v4%2Fdefault.mp4",
      ),
    );
  });

  it("prepares a compatible preview for the video layer", async () => {
    invokeMock
      .mockResolvedValueOnce(
        "/home/test/.cache/com.fakedevbagus.frameflow/previews-v4/video-preview.mp4",
      )
      .mockResolvedValueOnce(
        "http://127.0.0.1:43123/media?path=%2Fhome%2Ftest%2F.cache%2Fcom.fakedevbagus.frameflow%2Fpreviews-v4%2Fvideo-preview.mp4",
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

    await flushPreviewEffects();
    const video = screen.getByTestId("preview-video");

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("prepare_media_preview", {
        path: "/media/unsupported.mp4",
      });
      expect(invokeMock).toHaveBeenCalledWith("get_media_http_url", {
        path: "/home/test/.cache/com.fakedevbagus.frameflow/previews-v4/video-preview.mp4",
      });
      expect(video).toHaveAttribute(
        "src",
        "http://127.0.0.1:43123/media?path=%2Fhome%2Ftest%2F.cache%2Fcom.fakedevbagus.frameflow%2Fpreviews-v4%2Fvideo-preview.mp4",
      );
    });
  });

  it("renders multiple active visual layers in track order", async () => {
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

    await flushPreviewEffects();
    const layers = await screen.findAllByTestId("preview-video");

    expect(layers).toHaveLength(2);
    expect(layers[0]).toHaveStyle({ zIndex: "1" });
    expect(layers[1]).toHaveStyle({ zIndex: "2" });
  });

  it("applies the clip transform anchor to the preview transform origin", async () => {
    let project = createProject({ id: "anchor-preview" });

    project = {
      ...project,
      assets: [
        {
          id: "video-anchor",
          name: "anchor.mp4",
          mediaType: "video",
          sourcePath: "/media/anchor.mp4",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-anchor");
    const clipId = project.tracks[0].clips[0].id;

    project = {
      ...project,
      tracks: project.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) =>
          clip.id === clipId
            ? { ...clip, transformAnchor: { x: 0, y: 1 } }
            : clip,
        ),
      })),
    };

    render(
      <Preview
        project={project}
        currentTimeMs={1000}
        isPlaying={false}
      />,
    );

    await flushPreviewEffects();

    const video = screen.getByTestId("preview-video");
    expect(video.parentElement).toHaveStyle({
      transformOrigin: "0% 100%",
    });
  });

  it("applies the clip crop to the visual media", async () => {
    let project = createProject({ id: "crop-preview" });

    project = {
      ...project,
      assets: [
        {
          id: "video-crop",
          name: "crop.mp4",
          mediaType: "video",
          sourcePath: "/media/crop.mp4",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-crop");
    const clipId = project.tracks[0].clips[0].id;

    project = {
      ...project,
      tracks: project.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) =>
          clip.id === clipId
            ? {
                ...clip,
                crop: {
                  top: 0.1,
                  right: 0.2,
                  bottom: 0.3,
                  left: 0.05,
                },
              }
            : clip,
        ),
      })),
    };

    render(
      <Preview
        project={project}
        currentTimeMs={1000}
        isPlaying={false}
      />,
    );

    await flushPreviewEffects();

    expect(screen.getByTestId("preview-video")).toHaveStyle({
      clipPath: "inset(10% 20% 30% 5%)",
    });
  });

  it("renders an image clip as the visual preview", async () => {
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

    await flushPreviewEffects();
    expect(screen.getByAltText("poster.png")).toHaveAttribute(
      "src",
      "asset:///pictures/poster.png",
    );
  });

  it("renders audio-only clips with native controls", async () => {
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

    await flushPreviewEffects();
    await screen.findByTestId("preview-audio");
    expect(screen.getByLabelText("Audio preview")).toBeInTheDocument();
    expect(screen.getByText("music.mp3")).toBeInTheDocument();
  });

  it("keeps active audio layers mounted while a visual preview is playing", async () => {
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

    await screen.findByTestId("preview-video");
    await flushPreviewEffects();
    await screen.findByTestId("preview-audio");
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

  it("re-aligns video to the transport position when playback starts", async () => {
    let project = createProject({ id: "replay-alignment-preview" });

    project = {
      ...project,
      assets: [
        {
          id: "video-replay",
          name: "replay.mp4",
          mediaType: "video",
          sourcePath: "/media/replay.mp4",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-replay");

    const { rerender } = render(
      <Preview
        project={project}
        currentTimeMs={0}
        isPlaying={false}
      />,
    );

    await flushPreviewEffects();

    const video = screen.getByTestId("preview-video") as HTMLVideoElement;
    video.currentTime = 4.8;

    rerender(
      <Preview
        project={project}
        currentTimeMs={0}
        isPlaying
      />,
    );

    await vi.waitFor(() => {
      expect(video.currentTime).toBe(0);
    });
  });

  it("does not continuously seek video while transport ticks during playback", async () => {
    const playMock = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);

    let project = createProject({ id: "playback-no-seek-per-tick" });

    project = {
      ...project,
      assets: [
        {
          id: "video-1",
          name: "smooth.mp4",
          mediaType: "video",
          sourcePath: "/media/smooth.mp4",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-1");

    const { rerender } = render(
      <Preview
        project={project}
        currentTimeMs={0}
        isPlaying={false}
      />,
    );

    await flushPreviewEffects();

    const video = screen.getByTestId("preview-video") as HTMLVideoElement;

    video.currentTime = 0.25;

    rerender(
      <Preview
        project={project}
        currentTimeMs={250}
        isPlaying
      />,
    );

    await vi.waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(1);
      expect(video.currentTime).toBe(0.25);
    });

    video.currentTime = 0.4;

    rerender(
      <Preview
        project={project}
        currentTimeMs={500}
        isPlaying
      />,
    );

    await flushPreviewEffects();

    expect(video.currentTime).toBe(0.4);
    expect(playMock).toHaveBeenCalledTimes(1);
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
