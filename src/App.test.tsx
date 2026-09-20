import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createProject, serializeProject } from "./features/project/domain";
import { importMediaFiles } from "./features/media/import";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => "asset://" + path,
  invoke: vi.fn((command: string) => {
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
  }),
}));

vi.mock("./features/media/import", () => ({
  importMediaFiles: vi.fn(),
}));

const importMediaFilesMock = vi.mocked(importMediaFiles);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("App", () => {
  it("renders the editor workspace", () => {
    render(<App />);

    expect(screen.getByText("FrameFlow")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Untitled project" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Import media" })).toHaveLength(2);
  });

  it("fits the preview to the project canvas and changes canvas aspect presets", async () => {
    const project = createProject({ id: "landscape-preview" });
    project.canvas = {
      width: 1080,
      height: 1920,
      frameRate: 30,
    };
    localStorage.setItem(
      "frameflow.workspace-project",
      serializeProject(project),
    );

    const { container } = render(<App />);

    const canvas = container.querySelector(".preview-canvas");

    expect(canvas).not.toBeNull();
    expect(canvas).toHaveStyle({ aspectRatio: "1080 / 1920" });
    expect(screen.getByRole("combobox", { name: "Canvas aspect ratio" })).toHaveValue(
      "9-16",
    );

    fireEvent.change(
      screen.getByRole("combobox", { name: "Canvas aspect ratio" }),
      { target: { value: "16-9" } },
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Canvas aspect ratio" })).toHaveValue(
        "16-9",
      );
      expect(canvas).toHaveStyle({ aspectRatio: "1920 / 1080" });
      expect(screen.getByText("1920 × 1080")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Canvas aspect ratio" })).toHaveValue(
        "9-16",
      );
      expect(canvas).toHaveStyle({ aspectRatio: "1080 / 1920" });
      expect(screen.getByText("1080 × 1920")).toBeInTheDocument();
    });
  });

  it("steps the playhead by one frame with the transport controls", () => {
    render(<App />);

    expect(screen.getByText("00:00:00:00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next frame" }));
    expect(screen.getByText("00:00:00:01")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous frame" }));
    expect(screen.getByText("00:00:00:00")).toBeInTheDocument();
  });

  it("shows imported media in the library", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-1",
        name: "intro.mp4",
        mediaType: "video",
        sourcePath: "/media/intro.mp4",
        durationMs: 12000,
      },
    ]);

    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() => expect(screen.getByText("intro.mp4")).toBeInTheDocument());
    expect(screen.getByText("video · 0:12")).toBeInTheDocument();
  });

  it("adds imported video to the visible timeline when clicked", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-1",
        name: "intro.mp4",
        mediaType: "video",
        sourcePath: "/media/intro.mp4",
        durationMs: 12000,
      },
    ]);

    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() => expect(screen.getByText("intro.mp4")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Add intro.mp4 to timeline" }));

    const clip = screen.getByTitle("intro.mp4 · 00:12");
    expect(clip).toBeInTheDocument();
    expect(screen.getByText("V1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select intro.mp4 clip" }));

    const selectedClip = screen.getByRole("button", { name: "Select intro.mp4 clip" });
    expect(selectedClip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Inspector")).toBeInTheDocument();
    expect(screen.getByText("Track")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete clip" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete clip" }));

    await waitFor(() => {
      expect(screen.queryByTitle("intro.mp4 · 00:12")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Pilih sebuah clip")).toBeInTheDocument();
  });

  it("deletes the selected clip with the Delete key", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-keyboard",
        name: "keyboard.mp4",
        mediaType: "video",
        sourcePath: "/media/keyboard.mp4",
        durationMs: 8000,
      },
    ]);

    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("keyboard.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add keyboard.mp4 to timeline" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Select keyboard.mp4 clip" }),
    );

    fireEvent.keyDown(window, { key: "Delete" });

    await waitFor(() => {
      expect(
        screen.queryByTitle("keyboard.mp4 · 00:08"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("Pilih sebuah clip")).toBeInTheDocument();
  });

  it("applies move and trim controls to the selected clip", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-edit",
        name: "edit.mp4",
        mediaType: "video",
        sourcePath: "/media/edit.mp4",
        durationMs: 8000,
      },
    ]);

    const { container } = render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() => expect(screen.getByText("edit.mp4")).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole("button", { name: "Add edit.mp4 to timeline" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Select edit.mp4 clip" }),
    );

    const clip = screen.getByTitle("edit.mp4 · 00:08");
    fireEvent.click(screen.getByRole("button", { name: "Move clip +1s" }));
    expect(screen.getByTitle("edit.mp4 · 00:08")).toHaveStyle({ left: "40px" });

    fireEvent.click(screen.getByRole("button", { name: "Trim clip start +1s" }));
    expect(screen.getByTitle("edit.mp4 · 00:07")).toHaveStyle({ left: "80px" });

    fireEvent.click(screen.getByRole("button", { name: "Trim clip end -1s" }));
    expect(screen.getByTitle("edit.mp4 · 00:06")).toBeInTheDocument();
    expect(screen.getByTitle("edit.mp4 · 00:06")).toHaveStyle({ left: "80px" });

    expect(clip).toBeInTheDocument();
    expect(container.querySelector(".timeline-playhead")).not.toBeNull();
  });

  it("configures a dissolve transition between adjacent visual clips", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-transition-a",
        name: "transition-a.mp4",
        mediaType: "video",
        sourcePath: "/media/transition-a.mp4",
        durationMs: 4000,
      },
      {
        id: "asset-transition-b",
        name: "transition-b.mp4",
        mediaType: "video",
        sourcePath: "/media/transition-b.mp4",
        durationMs: 3000,
      },
    ]);

    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() => {
      expect(screen.getByText("transition-a.mp4")).toBeInTheDocument();
      expect(screen.getByText("transition-b.mp4")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add transition-a.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add transition-b.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select transition-a.mp4 clip",
      }),
    );

    const typeSelect = screen.getByRole("combobox", {
      name: "Transition type",
    });

    expect(typeSelect).not.toBeDisabled();
    expect(typeSelect).toHaveValue("none");

    fireEvent.change(typeSelect, { target: { value: "dissolve" } });

    await waitFor(() => {
      expect(typeSelect).toHaveValue("dissolve");
      expect(
        screen.getByRole("spinbutton", { name: "Transition duration" }),
      ).toHaveValue(300);
    });

    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Transition duration" }),
      { target: { value: "600" } },
    );
    fireEvent.blur(
      screen.getByRole("spinbutton", { name: "Transition duration" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("spinbutton", { name: "Transition duration" }),
      ).toHaveValue(600),
    );

    expect(screen.getByRole("button", { name: "Undo" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(typeSelect).toHaveValue("dissolve");
      expect(
        screen.getByRole("spinbutton", { name: "Transition duration" }),
      ).toHaveValue(300);
    });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(typeSelect).toHaveValue("none");
    });
  });

  it("commits direct canvas movement into project history", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-canvas-move",
        name: "canvas-move.mp4",
        mediaType: "video",
        sourcePath: "/media/canvas-move.mp4",
        durationMs: 8000,
      },
    ]);

    const { container } = render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("canvas-move.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add canvas-move.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select canvas-move.mp4 clip",
      }),
    );

    const hitArea = container.querySelector(
      '[data-testid^="preview-hit-area-"]',
    );

    expect(hitArea).not.toBeNull();
    if (!hitArea) {
      throw new Error("Preview hit area was not rendered.");
    }

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

    fireEvent.pointerDown(hitArea as HTMLDivElement, {
      button: 0,
      pointerId: 7,
      clientX: 50,
      clientY: 100,
    });
    fireEvent.pointerMove(hitArea as HTMLDivElement, {
      buttons: 1,
      pointerId: 7,
      clientX: 70,
      clientY: 80,
    });
    fireEvent.pointerUp(hitArea as HTMLDivElement, {
      button: 0,
      pointerId: 7,
      clientX: 70,
      clientY: 80,
    });

    await waitFor(() =>
      expect(screen.getByRole("spinbutton", { name: "X position" })).toHaveValue(10),
    );

    expect(screen.getByRole("button", { name: "Undo" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "X position" })).toHaveValue(0);
    });
  });

  it("commits direct crop-handle edits into project history", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-canvas-crop",
        name: "canvas-crop.mp4",
        mediaType: "video",
        sourcePath: "/media/canvas-crop.mp4",
        durationMs: 8000,
      },
    ]);

    const { container } = render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("canvas-crop.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add canvas-crop.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select canvas-crop.mp4 clip",
      }),
    );

    const hitArea = screen.getByTestId(
      /preview-hit-area-/,
    );

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

    const handle = screen.getByRole("button", { name: "Crop top" });

    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 11,
      clientX: 100,
      clientY: 0,
    });
    fireEvent.pointerMove(hitArea, {
      buttons: 1,
      pointerId: 11,
      clientX: 100,
      clientY: 40,
    });
    fireEvent.pointerUp(hitArea, {
      button: 0,
      pointerId: 11,
      clientX: 100,
      clientY: 40,
    });

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "Crop top" })).toHaveValue(10);
      const viewport = screen.getByTestId(/preview-crop-viewport-/);
      expect(viewport).toHaveStyle({
        left: "0%",
        top: "10%",
        width: "100%",
      });
      expect(Number.parseFloat(viewport.style.height)).toBeCloseTo(90, 10);
    });

    expect(container).toHaveTextContent("Canvas crop updated.");
    expect(screen.getByRole("button", { name: "Undo" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "Crop top" })).toHaveValue(0);
      const viewport = screen.getByTestId(/preview-crop-viewport-/);
      expect(viewport).toHaveStyle({
        left: "0%",
        top: "0%",
        width: "100%",
      });
      expect(Number.parseFloat(viewport.style.height)).toBeCloseTo(100, 10);
    });
  });

  it("applies a crop aspect preset as one history edit", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-crop-aspect-ui",
        name: "crop-aspect-ui.mp4",
        mediaType: "video",
        sourcePath: "/media/crop-aspect-ui.mp4",
        durationMs: 8000,
      },
    ]);

    const { container } = render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("crop-aspect-ui.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add crop-aspect-ui.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select crop-aspect-ui.mp4 clip",
      }),
    );

    const video = screen.getByTestId("preview-video");
    Object.defineProperty(video, "videoWidth", {
      configurable: true,
      value: 1920,
    });
    Object.defineProperty(video, "videoHeight", {
      configurable: true,
      value: 1080,
    });
    fireEvent.loadedMetadata(video);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Set crop aspect ratio 1:1" }),
      ).not.toBeDisabled(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Set crop aspect ratio 1:1" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "Crop left" })).toHaveValue(22);
      expect(screen.getByRole("spinbutton", { name: "Crop right" })).toHaveValue(22);
    });

    expect(container).toHaveTextContent("Crop aspect ratio updated.");
    expect(screen.getByRole("button", { name: "Undo" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "Crop left" })).toHaveValue(0);
      expect(screen.getByRole("spinbutton", { name: "Crop right" })).toHaveValue(0);
    });
  });

  it("applies visual transform controls and resets them", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-transform-ui",
        name: "transform-ui.mp4",
        mediaType: "video",
        sourcePath: "/media/transform-ui.mp4",
        durationMs: 8000,
      },
    ]);

    const { container } = render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("transform-ui.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add transform-ui.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select transform-ui.mp4 clip",
      }),
    );

    expect(screen.getByText("Transform")).toBeInTheDocument();
    expect(container).toHaveTextContent("X");
    expect(container).toHaveTextContent("Y");
    expect(screen.getByRole("spinbutton", { name: "X position" })).toHaveValue(0);
    expect(screen.getByRole("spinbutton", { name: "Y position" })).toHaveValue(0);
    expect(screen.getByRole("spinbutton", { name: "Scale" })).toHaveValue(1);
    expect(screen.getByRole("spinbutton", { name: "Rotation" })).toHaveValue(0);
    expect(screen.getByRole("spinbutton", { name: "Opacity" })).toHaveValue(100);

    fireEvent.click(screen.getByRole("button", { name: "Move visual right" }));
    fireEvent.click(screen.getByRole("button", { name: "Scale visual up" }));
    fireEvent.click(screen.getByRole("button", { name: "Rotate visual right" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease visual opacity" }));

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "X position" })).toHaveValue(5);
      expect(screen.getByRole("spinbutton", { name: "Scale" })).toHaveValue(1.1);
      expect(screen.getByRole("spinbutton", { name: "Rotation" })).toHaveValue(15);
      expect(screen.getByRole("spinbutton", { name: "Opacity" })).toHaveValue(90);
    });

    const previewVideo = screen.getByTestId("preview-video");
    const previewContentLayer = previewVideo.closest(".preview-content-layer");

    expect(previewContentLayer).not.toBeNull();
    expect(previewContentLayer).toHaveStyle({
      transform: "translate(5%, 0%) scale(1.1) rotate(15deg)",
      opacity: "0.9",
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset transform" }));

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "X position" })).toHaveValue(0);
      expect(screen.getByRole("spinbutton", { name: "Y position" })).toHaveValue(0);
      expect(screen.getByRole("spinbutton", { name: "Scale" })).toHaveValue(1);
      expect(screen.getByRole("spinbutton", { name: "Rotation" })).toHaveValue(0);
      expect(screen.getByRole("spinbutton", { name: "Opacity" })).toHaveValue(100);
    });
  });

  it("edits transform values precisely from the inspector", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-precision-transform",
        name: "precision-transform.mp4",
        mediaType: "video",
        sourcePath: "/media/precision-transform.mp4",
        durationMs: 8000,
      },
    ]);

    const { container } = render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("precision-transform.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add precision-transform.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select precision-transform.mp4 clip",
      }),
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "X position" }), {
      target: { value: "12.5" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "X position" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Y position" }), {
      target: { value: "-7.5" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Y position" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Scale" }), {
      target: { value: "1.25" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Scale" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Rotation" }), {
      target: { value: "-22" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Rotation" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Opacity" }), {
      target: { value: "73" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Opacity" }));

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "X position" })).toHaveValue(12.5);
      expect(screen.getByRole("spinbutton", { name: "Y position" })).toHaveValue(-7.5);
      expect(screen.getByRole("spinbutton", { name: "Scale" })).toHaveValue(1.25);
      expect(screen.getByRole("spinbutton", { name: "Rotation" })).toHaveValue(-22);
      expect(screen.getByRole("spinbutton", { name: "Opacity" })).toHaveValue(73);
    });

    const previewVideo = screen.getByTestId("preview-video");
    const previewContentLayer = previewVideo.closest(".preview-content-layer");

    expect(previewContentLayer).not.toBeNull();
    expect(previewContentLayer).toHaveStyle({
      transform: "translate(12.5%, -7.5%) scale(1.25) rotate(-22deg)",
      opacity: "0.73",
    });

    expect(container).toHaveTextContent("Transform updated.");
  });

  it("preserves the visual position when changing the transform anchor", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-transform-anchor-compensated-ui",
        name: "anchor-compensated-ui.mp4",
        mediaType: "video",
        sourcePath: "/media/anchor-compensated-ui.mp4",
        durationMs: 8000,
      },
    ]);

    const { container } = render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(
        screen.getByText("anchor-compensated-ui.mp4"),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add anchor-compensated-ui.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select anchor-compensated-ui.mp4 clip",
      }),
    );

    const video = screen.getByTestId("preview-video");
    Object.defineProperty(video, "videoWidth", {
      configurable: true,
      value: 1920,
    });
    Object.defineProperty(video, "videoHeight", {
      configurable: true,
      value: 1080,
    });
    fireEvent.loadedMetadata(video);

    await waitFor(() =>
      expect(screen.getByTestId("preview-video")).toHaveAttribute(
        "data-media-width",
        "1920",
      ),
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "Scale" }), {
      target: { value: "2" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Scale" }));

    await waitFor(() =>
      expect(screen.getByRole("spinbutton", { name: "Scale" })).toHaveValue(2),
    );

    const anchorButton = screen.getByRole("button", {
      name: /Set anchor top left/i,
    });

    fireEvent.click(anchorButton);

    await waitFor(() => {
      expect(anchorButton).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("spinbutton", { name: "X position" })).toHaveValue(
        -50,
      );
      expect(screen.getByRole("spinbutton", { name: "Y position" })).toHaveValue(
        -15.8203125,
      );

      const previewContentLayer = screen
        .getByTestId("preview-video")
        .closest(".preview-content-layer");

      expect(previewContentLayer).not.toBeNull();
      expect(previewContentLayer).toHaveStyle({
        transformOrigin: "0% 0%",
        transform: "translate(-50%, -50%) scale(2) rotate(0deg)",
      });
    });

    expect(container).toHaveTextContent("Transform anchor updated.");
    expect(screen.getByRole("button", { name: "Undo" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Set anchor center/i }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("spinbutton", { name: "X position" })).toHaveValue(0);
      expect(screen.getByRole("spinbutton", { name: "Y position" })).toHaveValue(0);
    });
  });

  it("moves the transform anchor directly on the canvas", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-direct-anchor-ui",
        name: "direct-anchor-ui.mp4",
        mediaType: "video",
        sourcePath: "/media/direct-anchor-ui.mp4",
        durationMs: 8000,
      },
    ]);

    const { container } = render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("direct-anchor-ui.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add direct-anchor-ui.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select direct-anchor-ui.mp4 clip",
      }),
    );

    const video = screen.getByTestId("preview-video");
    Object.defineProperty(video, "videoWidth", {
      configurable: true,
      value: 1920,
    });
    Object.defineProperty(video, "videoHeight", {
      configurable: true,
      value: 1080,
    });
    fireEvent.loadedMetadata(video);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Scale" }), {
      target: { value: "2" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Scale" }));

    await waitFor(() =>
      expect(screen.getByRole("spinbutton", { name: "Scale" })).toHaveValue(2),
    );

    const hitArea = container.querySelector(
      '[data-testid^="preview-hit-area-"]',
    );
    expect(hitArea).not.toBeNull();
    if (!hitArea) {
      throw new Error("Preview hit area was not rendered.");
    }

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

    const anchorHandle = screen.getByTestId("preview-transform-anchor-handle");

    fireEvent.pointerDown(anchorHandle, {
      button: 0,
      pointerId: 21,
      clientX: 100,
      clientY: 200,
    });
    fireEvent.pointerMove(hitArea, {
      buttons: 1,
      pointerId: 21,
      clientX: 50,
      clientY: 100,
    });
    fireEvent.pointerUp(hitArea, {
      button: 0,
      pointerId: 21,
      clientX: 50,
      clientY: 100,
    });

    await waitFor(() => {
      expect(anchorHandle).toHaveStyle({
        left: "37.5%",
        top: "5.555555555555555%",
      });
      expect(screen.getByText("38%, 6%")).toBeInTheDocument();
      expect(screen.getByRole("spinbutton", { name: "X position" })).toHaveValue(
        -12.5,
      );
      expect(screen.getByRole("spinbutton", { name: "Y position" })).toHaveValue(
        -14.0625,
      );
    });

    expect(screen.getByRole("button", { name: "Undo" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Set anchor center/i }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("spinbutton", { name: "X position" })).toHaveValue(0);
      expect(screen.getByRole("spinbutton", { name: "Y position" })).toHaveValue(0);
    });
  });

  it("edits and resets the selected visual crop", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-crop-ui",
        name: "crop-ui.mp4",
        mediaType: "video",
        sourcePath: "/media/crop-ui.mp4",
        durationMs: 8000,
      },
    ]);

    const { container } = render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("crop-ui.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add crop-ui.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select crop-ui.mp4 clip",
      }),
    );

    expect(screen.getByRole("spinbutton", { name: "Crop top" })).toHaveValue(0);
    expect(screen.getByRole("spinbutton", { name: "Crop right" })).toHaveValue(0);
    expect(screen.getByRole("spinbutton", { name: "Crop bottom" })).toHaveValue(0);
    expect(screen.getByRole("spinbutton", { name: "Crop left" })).toHaveValue(0);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Crop top" }), {
      target: { value: "10" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Crop top" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Crop right" }), {
      target: { value: "10" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Crop right" }));

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "Crop top" })).toHaveValue(10);
      expect(screen.getByRole("spinbutton", { name: "Crop right" })).toHaveValue(10);
      const viewport = screen.getByTestId(/preview-crop-viewport-/);
      expect(viewport).toHaveStyle({
        left: "0%",
        top: "10%",
        width: "90%",
      });
      expect(Number.parseFloat(viewport.style.height)).toBeCloseTo(90, 10);
    });

    expect(container).toHaveTextContent("Crop updated.");

    fireEvent.click(screen.getByRole("button", { name: "Reset crop" }));

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "Crop top" })).toHaveValue(0);
      expect(screen.getByRole("spinbutton", { name: "Crop right" })).toHaveValue(0);
      const viewport = screen.getByTestId(/preview-crop-viewport-/);
      expect(viewport).toHaveStyle({
        left: "0%",
        top: "0%",
        width: "100%",
      });
      expect(Number.parseFloat(viewport.style.height)).toBeCloseTo(100, 10);
    });
  });

  it("edits crop content position from the inspector", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-crop-position-ui",
        name: "crop-position-ui.mp4",
        mediaType: "video",
        sourcePath: "/media/crop-position-ui.mp4",
        durationMs: 8000,
      },
    ]);

    render(<App />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Import media" })[1],
    );

    await waitFor(() =>
      expect(screen.getByText("crop-position-ui.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add crop-position-ui.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select crop-position-ui.mp4 clip",
      }),
    );

    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Crop top" }),
      { target: { value: "10" } },
    );
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Crop top" }));

    expect(screen.getByRole("spinbutton", { name: "Crop position X" })).toHaveValue(50);
    expect(screen.getByRole("spinbutton", { name: "Crop position Y" })).toHaveValue(55);

    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Crop position X" }),
      { target: { value: "25" } },
    );
    fireEvent.blur(
      screen.getByRole("spinbutton", { name: "Crop position X" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("spinbutton", { name: "Crop position X" }),
      ).toHaveValue(25),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Center crop content" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("spinbutton", { name: "Crop position X" }),
      ).toHaveValue(50);
      expect(
        screen.getByRole("spinbutton", { name: "Crop position Y" }),
      ).toHaveValue(50);
    });

    expect(screen.getByRole("button", { name: "Undo" })).not.toBeDisabled();
  });

  it("pans crop content directly on the canvas and records history", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-crop-pan-ui",
        name: "crop-pan-ui.mp4",
        mediaType: "video",
        sourcePath: "/media/crop-pan-ui.mp4",
        durationMs: 8000,
      },
    ]);

    render(<App />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Import media" })[1],
    );

    await waitFor(() =>
      expect(screen.getByText("crop-pan-ui.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add crop-pan-ui.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select crop-pan-ui.mp4 clip",
      }),
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "Crop top" }), {
      target: { value: "10" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Crop top" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Crop right" }), {
      target: { value: "20" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Crop right" }));

    await waitFor(() => {
      expect(
        screen.getByRole("spinbutton", { name: "Crop position X" }),
      ).toHaveValue(40);
      expect(
        screen.getByRole("spinbutton", { name: "Crop position Y" }),
      ).toHaveValue(55);
    });

    const hitArea = screen.getByTestId(/preview-hit-area-/);
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

    const surface = await screen.findByRole("button", {
      name: "Pan crop content",
    });

    await act(async () => {
      fireEvent.pointerDown(surface, {
        button: 0,
        pointerId: 13,
        clientX: 100,
        clientY: 200,
      });
    });
    await act(async () => {
      fireEvent.pointerMove(surface, {
        buttons: 1,
        pointerId: 13,
        clientX: 80,
        clientY: 200,
      });
    });
    await act(async () => {
      fireEvent.pointerUp(surface, {
        button: 0,
        pointerId: 13,
        clientX: 80,
        clientY: 200,
      });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("spinbutton", { name: "Crop position X" }),
      ).toHaveValue(50);
      expect(
        screen.getByRole("spinbutton", { name: "Crop position Y" }),
      ).toHaveValue(55);
    });

    expect(screen.getByText("Crop content position updated.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(
        screen.getByRole("spinbutton", { name: "Crop position X" }),
      ).toHaveValue(40);
      expect(
        screen.getByRole("spinbutton", { name: "Crop position Y" }),
      ).toHaveValue(55);
    });
  });

  it("changes keyframe interpolation from the inspector", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-easing-ui",
        name: "easing-ui.mp4",
        mediaType: "video",
        sourcePath: "/media/easing-ui.mp4",
        durationMs: 5000,
      },
    ]);

    const { container } = render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("easing-ui.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add easing-ui.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select easing-ui.mp4 clip",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add keyframe" }));

    const interpolation = screen.getByRole("combobox", {
      name: "Keyframe interpolation",
    });

    fireEvent.change(interpolation, {
      target: { value: "ease-out" },
    });

    expect(interpolation).toHaveValue("ease-out");
    expect(container).toHaveTextContent("Keyframe easing updated.");
  });

  it("deletes a focused timeline keyframe without deleting its clip", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-keyframe-delete",
        name: "keyframe-delete.mp4",
        mediaType: "video",
        sourcePath: "/media/keyframe-delete.mp4",
        durationMs: 5000,
      },
    ]);

    const { container } = render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("keyframe-delete.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add keyframe-delete.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select keyframe-delete.mp4 clip",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add keyframe" }));

    const markerButton = screen.getByRole("button", {
      name: "Go to transform keyframe for keyframe-delete.mp4 at 00:00.000",
    });

    markerButton.focus();
    fireEvent.keyDown(markerButton, { key: "Delete" });

    await waitFor(() => {
      expect(screen.queryByRole("button", {
        name: "Go to transform keyframe for keyframe-delete.mp4 at 00:00.000",
      })).not.toBeInTheDocument();
    });

    const clipButton = screen.getByRole("button", {
      name: "Select keyframe-delete.mp4 clip",
    });
    expect(clipButton).toBeInTheDocument();
    expect(container).toHaveTextContent("Static transform at 00:00.000");
  });

  it("animates transform values between keyframes", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-keyframe-ui",
        name: "keyframe-ui.mp4",
        mediaType: "video",
        sourcePath: "/media/keyframe-ui.mp4",
        durationMs: 8000,
      },
    ]);

    const { container } = render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("keyframe-ui.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add keyframe-ui.mp4 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select keyframe-ui.mp4 clip",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add keyframe" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "X position" }), {
      target: { value: "40" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "X position" }));

    const ruler = container.querySelector(".timeline-ruler-scale");
    expect(ruler).not.toBeNull();

    Object.defineProperty(ruler, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 0,
        height: 28,
        left: 0,
        right: 800,
        top: 0,
        width: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    fireEvent.click(ruler as HTMLDivElement, { clientX: 160 });

    await waitFor(() =>
      expect(screen.getByLabelText("Playhead at 00:04")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "X position" }), {
      target: { value: "80" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "X position" }));

    expect(screen.getByText("2 keyframes")).toBeInTheDocument();

    fireEvent.click(ruler as HTMLDivElement, { clientX: 80 });

    await waitFor(() => {
      expect(screen.getByLabelText("Playhead at 00:02")).toBeInTheDocument();
      expect(screen.getByRole("spinbutton", { name: "X position" })).toHaveValue(60);
      expect(screen.getByText("Animated transform at 00:02.000")).toBeInTheDocument();
    });

    fireEvent.click(ruler as HTMLDivElement, { clientX: 160 });

    await waitFor(() =>
      expect(screen.getByLabelText("Playhead at 00:04")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Remove keyframe" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove keyframe" }));

    await waitFor(() => {
      expect(screen.getByText("1 keyframe")).toBeInTheDocument();
      expect(screen.getByText("Animated transform at 00:04.000")).toBeInTheDocument();
    });
  });

  it("undoes and redoes a timeline edit with keyboard shortcuts", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-history-ui",
        name: "history-ui.mp4",
        mediaType: "video",
        sourcePath: "/media/history-ui.mp4",
        durationMs: 8000,
      },
    ]);

    const { container } = render(<App />);
    const undoButton = screen.getByRole("button", { name: "Undo" });
    const redoButton = screen.getByRole("button", { name: "Redo" });

    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);
    await waitFor(() => expect(screen.getByText("history-ui.mp4")).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole("button", { name: "Add history-ui.mp4 to timeline" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Select history-ui.mp4 clip" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Move clip +1s" }));
    expect(screen.getByTitle("history-ui.mp4 · 00:08")).toHaveStyle({
      left: "40px",
    });
    expect(undoButton).not.toBeDisabled();
    expect(redoButton).toBeDisabled();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByTitle("history-ui.mp4 · 00:08")).toHaveStyle({
        left: "0px",
      });
    });
    expect(redoButton).not.toBeDisabled();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    await waitFor(() => {
      expect(screen.getByTitle("history-ui.mp4 · 00:08")).toHaveStyle({
        left: "40px",
      });
    });

    expect(container.querySelector(".project-notice")).toHaveTextContent("Redo.");
  });

  it("splits the selected clip at the playhead", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-split-ui",
        name: "split-ui.mp4",
        mediaType: "video",
        sourcePath: "/media/split-ui.mp4",
        durationMs: 8000,
      },
    ]);

    const { container } = render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() => expect(screen.getByText("split-ui.mp4")).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole("button", { name: "Add split-ui.mp4 to timeline" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Select split-ui.mp4 clip" }),
    );

    const ruler = container.querySelector(".timeline-ruler-scale");
    expect(ruler).not.toBeNull();

    Object.defineProperty(ruler, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 0,
        height: 28,
        left: 0,
        right: 800,
        top: 0,
        width: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    fireEvent.click(ruler as HTMLDivElement, { clientX: 200 });

    await waitFor(() =>
      expect(screen.getByLabelText("Playhead at 00:05")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Split at playhead" }));

    expect(screen.getByTitle("split-ui.mp4 · 00:05")).toBeInTheDocument();
    expect(screen.getByTitle("split-ui.mp4 · 00:03")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Select split-ui.mp4 clip" })).toHaveLength(2);
  });

  it("starts preview media from the transport click", async () => {
    const playMock = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);

    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-preview-play",
        name: "preview-play.mp4",
        mediaType: "video",
        sourcePath: "/media/preview-play.mp4",
        durationMs: 5000,
      },
    ]);

    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("preview-play.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add preview-play.mp4 to timeline" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(playMock).toHaveBeenCalled();
    });
  });

  it("toggles track mute state from the timeline", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-mute-ui",
        name: "mute-ui.mp4",
        mediaType: "video",
        sourcePath: "/media/mute-ui.mp4",
        durationMs: 5000,
      },
    ]);

    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("mute-ui.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add mute-ui.mp4 to timeline" }),
    );

    const muteButton = screen.getByRole("button", { name: "Mute Video 1" });

    expect(muteButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(muteButton);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Unmute Video 1" }),
      ).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("moves a timeline clip through direct mouse drag", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-direct-drag",
        name: "direct-drag.mp4",
        mediaType: "video",
        sourcePath: "/media/direct-drag.mp4",
        durationMs: 12000,
      },
    ]);

    const { container } = render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("direct-drag.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add direct-drag.mp4 to timeline" }),
    );

    const clip = screen.getByRole("button", { name: "Select direct-drag.mp4 clip" });

    fireEvent.pointerDown(clip, { button: 0, clientX: 0 });
    fireEvent.pointerMove(clip, { buttons: 1, clientX: 80 });
    fireEvent.pointerUp(clip, { button: 0, clientX: 80 });

    await waitFor(() => {
      expect(
        container.querySelector('[title="direct-drag.mp4 · 00:12"]'),
      ).toHaveStyle({ left: "80px" });
    });
  });
});
