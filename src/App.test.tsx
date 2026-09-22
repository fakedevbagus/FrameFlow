import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { addAssetToTimeline } from "./features/timeline/commands";
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

  it("opens export settings from the toolbar and updates quality", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open export settings" }));

    expect(
      screen.getByRole("dialog", { name: "Export settings" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Export quality" }), {
      target: { value: "720p" },
    });

    expect(
      screen.getByRole("dialog", { name: "Export settings" }),
    ).toHaveTextContent("406 × 720");

    fireEvent.click(
      screen.getByRole("button", { name: "Close export settings" }),
    );

    expect(
      screen.queryByRole("dialog", { name: "Export settings" }),
    ).not.toBeInTheDocument();
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

  it("edits visual color adjustments and resets them", async () => {
    let project = createProject({ id: "visual-effects-ui" });

    project = {
      ...project,
      assets: [
        {
          id: "asset-visual-effects",
          name: "effects-ui.mp4",
          mediaType: "video",
          sourcePath: "/media/effects-ui.mp4",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "asset-visual-effects");
    localStorage.setItem(
      "frameflow.workspace-project",
      serializeProject(project),
    );

    render(<App />);

    await waitFor(() =>
      expect(screen.getByTitle("effects-ui.mp4 · 00:05")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Select effects-ui.mp4 clip" }),
    );

    expect(screen.getByTestId("color-adjustments")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show color adjustments" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Brightness" })).toHaveValue(0);
    expect(screen.getByRole("spinbutton", { name: "Contrast" })).toHaveValue(0);
    expect(screen.getByRole("spinbutton", { name: "Saturation" })).toHaveValue(0);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Brightness" }), {
      target: { value: "25" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Brightness" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Contrast" }), {
      target: { value: "-50" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Contrast" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Saturation" }), {
      target: { value: "40" },
    });
    fireEvent.blur(screen.getByRole("spinbutton", { name: "Saturation" }));

    expect(
      screen.getByRole("spinbutton", { name: "Brightness" }),
    ).toHaveValue(25);
    expect(
      screen.getByRole("spinbutton", { name: "Contrast" }),
    ).toHaveValue(-50);
    expect(
      screen.getByRole("spinbutton", { name: "Saturation" }),
    ).toHaveValue(40);
    expect(screen.getByTestId("preview-video")).toHaveStyle({
      filter: "brightness(125%) contrast(50%) saturate(140%)",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Reset color adjustments" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "Brightness" })).toHaveValue(0);
      expect(screen.getByRole("spinbutton", { name: "Contrast" })).toHaveValue(0);
      expect(screen.getByRole("spinbutton", { name: "Saturation" })).toHaveValue(0);
    });

    expect(screen.getByTestId("preview-video")).toHaveStyle({ filter: "" });
  });

  it("edits and resets a text overlay from the inspector", async () => {
    let project = createProject({ id: "text-overlay-ui" });

    project = {
      ...project,
      assets: [
        {
          id: "asset-text-overlay",
          name: "text-ui.mp4",
          mediaType: "video",
          sourcePath: "/media/text-ui.mp4",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "asset-text-overlay");
    localStorage.setItem(
      "frameflow.workspace-project",
      serializeProject(project),
    );

    render(<App />);

    await waitFor(() =>
      expect(screen.getByTitle("text-ui.mp4 · 00:05")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Select text-ui.mp4 clip" }),
    );

    expect(screen.getByTestId("text-overlay")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show text overlay" }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Text overlay content" }),
      { target: { value: "Hello FrameFlow" } },
    );

    await waitFor(() =>
      expect(
        screen.getByTestId(
          "preview-text-overlay-" + project.tracks[0].clips[0].id,
        ),
      ).toHaveTextContent("Hello FrameFlow"),
    );

    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Text overlay X position" }),
      { target: { value: "20" } },
    );

    await waitFor(() =>
      expect(
        screen.getByTestId(
          "preview-text-overlay-" + project.tracks[0].clips[0].id,
        ),
      ).toHaveStyle({ left: "20%" }),
    );

    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Text overlay font size" }),
      { target: { value: "72" } },
    );

    await waitFor(() =>
      expect(
        screen.getByTestId(
          "preview-text-overlay-" + project.tracks[0].clips[0].id,
        ),
      ).toHaveStyle({ fontSize: "72px" }),
    );

    fireEvent.blur(
      screen.getByRole("spinbutton", { name: "Text overlay font size" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Align text left" }),
    );

    expect(
      screen.getByRole("spinbutton", { name: "Text overlay X position" }),
    ).toHaveValue(20);
    expect(
      screen.getByRole("spinbutton", { name: "Text overlay font size" }),
    ).toHaveValue(72);
    expect(
      screen.getByRole("button", { name: "Align text left" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Reset text overlay" }));

    await waitFor(() => {
      expect(
        screen.queryByTestId("preview-text-overlay-" + project.tracks[0].clips[0].id),
      ).not.toBeInTheDocument();
    });
  });

  it("autosaves text overlay edits without requiring another control", async () => {
    let project = createProject({ id: "text-overlay-autosave-ui" });

    project = {
      ...project,
      assets: [
        {
          id: "asset-text-autosave",
          name: "autosave-text.mp4",
          mediaType: "video",
          sourcePath: "/media/autosave-text.mp4",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "asset-text-autosave");
    localStorage.setItem(
      "frameflow.workspace-project",
      serializeProject(project),
    );

    render(<App />);

    await waitFor(() =>
      expect(
        screen.getByTitle("autosave-text.mp4 · 00:05"),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Select autosave-text.mp4 clip" }),
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: "Text overlay content" }),
      { target: { value: "Autosave now" } },
    );

    await waitFor(() =>
      expect(
        screen.getByTestId(
          "preview-text-overlay-" + project.tracks[0].clips[0].id,
        ),
      ).toHaveTextContent("Autosave now"),
    );

    await waitFor(
      () => {
        const saved = JSON.parse(
          localStorage.getItem("frameflow.workspace-project") ?? "{}",
        );
        expect(saved.tracks?.[0]?.clips?.[0]?.textOverlay?.text).toBe(
          "Autosave now",
        );
      },
      { timeout: 1500 },
    );

    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Text overlay X position" }),
      { target: { value: "20" } },
    );

    await waitFor(() =>
      expect(
        screen.getByTestId(
          "preview-text-overlay-" + project.tracks[0].clips[0].id,
        ),
      ).toHaveStyle({ left: "20%" }),
    );
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

  it("selects fade through black from the transition inspector", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-transition-a",
        name: "transition-a.mp4",
        mediaType: "video",
        sourcePath: "/media/transition-a.mp4",
        durationMs: 5000,
      },
      {
        id: "asset-transition-b",
        name: "transition-b.mp4",
        mediaType: "video",
        sourcePath: "/media/transition-b.mp4",
        durationMs: 4000,
      },
    ]);

    const { container } = render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("transition-a.mp4")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add transition-a.mp4 to timeline" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add transition-b.mp4 to timeline" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Select transition-a.mp4 clip" }),
    );

    const transitionType = screen.getByRole("combobox", {
      name: "Transition type",
    });

    fireEvent.change(transitionType, {
      target: { value: "fade-through-black" },
    });

    await waitFor(() =>
      expect(transitionType).toHaveValue("fade-through-black"),
    );
    expect(container).toHaveTextContent("Transition updated.");
    expect(
      screen.getByRole("spinbutton", { name: "Transition duration" }),
    ).toHaveValue(300);
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

  it("edits audio volume automation from the inspector", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-audio-volume-automation",
        name: "volume-automation.mp3",
        mediaType: "audio",
        sourcePath: "/media/volume-automation.mp3",
        durationMs: 6000,
      },
    ]);

    const { container } = render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("volume-automation.mp3")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add volume-automation.mp3 to timeline",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select volume-automation.mp3 clip",
      }),
    );

    const volumeInput = screen.getByRole("spinbutton", {
      name: "Audio volume automation",
    });

    fireEvent.change(volumeInput, { target: { value: "40" } });
    fireEvent.blur(volumeInput);

    await waitFor(() => {
      expect(screen.getByText("1 keyframe")).toBeInTheDocument();
      expect(volumeInput).toHaveValue(40);
    });

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

    fireEvent.click(ruler as HTMLDivElement, { clientX: 80 });

    await waitFor(() =>
      expect(screen.getByLabelText("Playhead at 00:02")).toBeInTheDocument(),
    );

    fireEvent.change(volumeInput, { target: { value: "80" } });
    fireEvent.blur(volumeInput);

    await waitFor(() => {
      expect(screen.getByText("2 keyframes")).toBeInTheDocument();
      expect(volumeInput).toHaveValue(80);
    });

    fireEvent.click(ruler as HTMLDivElement, { clientX: 40 });

    await waitFor(() => {
      expect(screen.getByLabelText("Playhead at 00:01")).toBeInTheDocument();
      expect(volumeInput).toHaveValue(60);
    });

    fireEvent.click(ruler as HTMLDivElement, { clientX: 80 });

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Remove audio volume keyframe",
        }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove audio volume keyframe",
      }),
    );

    await waitFor(() => expect(screen.getByText("1 keyframe")).toBeInTheDocument());
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

  it("throttles playback-driven React clock updates while media keeps playing", async () => {
    const playMock = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);

    let project = createProject({ id: "playback-throttle" });
    project = {
      ...project,
      assets: [
        {
          id: "asset-playback-throttle",
          name: "playback-throttle.mp4",
          mediaType: "video",
          sourcePath: "/media/playback-throttle.mp4",
          durationMs: 5000,
        },
      ],
    };
    project = addAssetToTimeline(project, "asset-playback-throttle");

    localStorage.setItem(
      "frameflow.workspace-project",
      serializeProject(project),
    );

    const callbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameMock = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback);
        return callbacks.length;
      });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(playMock).toHaveBeenCalled());
    expect(requestAnimationFrameMock).toHaveBeenCalled();

    expect(screen.getByText("00:00:00:00")).toBeInTheDocument();

    const runFrame = (timestamp: number) => {
      const callback = callbacks.shift();

      if (!callback) {
        throw new Error("Expected a scheduled playback animation frame.");
      }

      act(() => {
        callback(timestamp);
      });
    };

    runFrame(0);
    runFrame(16);
    runFrame(32);

    expect(screen.getByText("00:00:00:00")).toBeInTheDocument();

    runFrame(34);

    await waitFor(() =>
      expect(screen.getByText("00:00:00:01")).toBeInTheDocument(),
    );

    requestAnimationFrameMock.mockRestore();
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

  it("updates the audio track volume from the timeline", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-audio-volume-ui",
        name: "music.mp3",
        mediaType: "audio",
        sourcePath: "/media/music.mp3",
        durationMs: 5000,
      },
    ]);

    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("music.mp3")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add music.mp3 to timeline" }),
    );

    const volume = screen.getByRole("slider", { name: "Volume Audio 1" });

    expect(volume).toHaveValue("1");

    fireEvent.change(volume, { target: { value: "0.35" } });

    await waitFor(() => {
      expect(volume).toHaveValue("0.35");
      expect(volume).toHaveAttribute("aria-valuetext", "35%");
    });
  });

  it("updates the audio track pan from the timeline", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-audio-pan-ui",
        name: "pan.mp3",
        mediaType: "audio",
        sourcePath: "/media/pan.mp3",
        durationMs: 5000,
      },
    ]);

    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("pan.mp3")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add pan.mp3 to timeline" }),
    );

    const pan = screen.getByRole("slider", { name: "Pan Audio 1" });

    expect(pan).toHaveValue("0");

    fireEvent.change(pan, { target: { value: "-0.65" } });

    await waitFor(() => {
      expect(pan).toHaveValue("-0.65");
    });
  });

  it("updates audio clip EQ controls from the inspector", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-audio-eq-ui",
        name: "eq-music.mp3",
        mediaType: "audio",
        sourcePath: "/media/eq-music.mp3",
        durationMs: 5000,
      },
    ]);

    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("eq-music.mp3")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add eq-music.mp3 to timeline" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Select eq-music.mp3 clip" }),
    );

    const enable = screen.getByRole("checkbox", { name: "Enable audio EQ" });
    const low = screen.getByRole("spinbutton", { name: "Audio EQ low gain" });
    const mid = screen.getByRole("spinbutton", { name: "Audio EQ mid gain" });
    const high = screen.getByRole("spinbutton", { name: "Audio EQ high gain" });

    expect(enable).not.toBeChecked();
    expect(low).toHaveValue(0);
    expect(mid).toHaveValue(0);
    expect(high).toHaveValue(0);

    fireEvent.click(enable);
    fireEvent.change(low, { target: { value: "4.5" } });
    fireEvent.blur(low);
    fireEvent.change(mid, { target: { value: "-2" } });
    fireEvent.blur(mid);
    fireEvent.change(high, { target: { value: "6" } });
    fireEvent.blur(high);

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Enable audio EQ" })).toBeChecked();
      expect(screen.getByRole("spinbutton", { name: "Audio EQ low gain" })).toHaveValue(4.5);
      expect(screen.getByRole("spinbutton", { name: "Audio EQ mid gain" })).toHaveValue(-2);
      expect(screen.getByRole("spinbutton", { name: "Audio EQ high gain" })).toHaveValue(6);
    });
  });

  it("updates audio clip compressor controls from the inspector", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-audio-compressor-ui",
        name: "compressor.mp3",
        mediaType: "audio",
        sourcePath: "/media/compressor.mp3",
        durationMs: 5000,
      },
    ]);

    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);
    await waitFor(() =>
      expect(screen.getByText("compressor.mp3")).toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add compressor.mp3 to timeline" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Select compressor.mp3 clip" }),
    );

    const enable = screen.getByRole("checkbox", {
      name: "Enable audio compressor",
    });
    const threshold = screen.getByRole("spinbutton", {
      name: "Audio compressor threshold",
    });
    const ratio = screen.getByRole("spinbutton", {
      name: "Audio compressor ratio",
    });
    const attack = screen.getByRole("spinbutton", {
      name: "Audio compressor attack",
    });
    const release = screen.getByRole("spinbutton", {
      name: "Audio compressor release",
    });

    expect(enable).not.toBeChecked();
    expect(threshold).toHaveValue(-24);
    expect(ratio).toHaveValue(4);
    expect(attack).toHaveValue(20);
    expect(release).toHaveValue(250);

    fireEvent.click(enable);
    fireEvent.change(threshold, { target: { value: "-18" } });
    fireEvent.blur(threshold);
    fireEvent.change(ratio, { target: { value: "6" } });
    fireEvent.blur(ratio);
    fireEvent.change(attack, { target: { value: "10" } });
    fireEvent.blur(attack);
    fireEvent.change(release, { target: { value: "300" } });
    fireEvent.blur(release);

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Enable audio compressor" })).toBeChecked();
      expect(screen.getByRole("spinbutton", { name: "Audio compressor threshold" })).toHaveValue(-18);
      expect(screen.getByRole("spinbutton", { name: "Audio compressor ratio" })).toHaveValue(6);
      expect(screen.getByRole("spinbutton", { name: "Audio compressor attack" })).toHaveValue(10);
      expect(screen.getByRole("spinbutton", { name: "Audio compressor release" })).toHaveValue(300);
    });
  });

  it("updates audio clip fade controls from the inspector", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-audio-fades-ui",
        name: "fade-music.mp3",
        mediaType: "audio",
        sourcePath: "/media/fade-music.mp3",
        durationMs: 5000,
      },
    ]);

    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);

    await waitFor(() =>
      expect(screen.getByText("fade-music.mp3")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add fade-music.mp3 to timeline" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Select fade-music.mp3 clip" }),
    );

    const fadeIn = screen.getByRole("spinbutton", { name: "Audio fade in" });
    const fadeOut = screen.getByRole("spinbutton", { name: "Audio fade out" });

    expect(fadeIn).toHaveValue(0);
    expect(fadeOut).toHaveValue(0);

    fireEvent.change(fadeIn, { target: { value: "1000" } });
    fireEvent.blur(fadeIn);

    // The sibling field must remain editable while the first field commits.
    expect(fadeOut).toBeInTheDocument();

    fireEvent.change(fadeOut, { target: { value: "1500" } });
    expect(fadeOut).toHaveValue(1500);
    fireEvent.blur(fadeOut);

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "Audio fade in" })).toHaveValue(1000);
      expect(screen.getByRole("spinbutton", { name: "Audio fade out" })).toHaveValue(1500);
    });
  });

  it("does not surface expected playback AbortError as a project error", async () => {
    const playMock = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValue(
        new DOMException("The operation was aborted.", "AbortError"),
      );

    let project = createProject({ id: "playback-abort" });

    project = {
      ...project,
      assets: [
        {
          id: "video-abort",
          name: "abort.mp4",
          mediaType: "video",
          sourcePath: "/media/abort.mp4",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-abort");
    localStorage.setItem(
      "frameflow.workspace-project",
      serializeProject(project),
    );

    render(<App />);

    await screen.findByTestId("preview-video");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(playMock).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    });

    expect(
      screen.queryByText("The operation was aborted."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Preview playback could not start."),
    ).not.toBeInTheDocument();
  });

  it("still surfaces a genuine playback failure", async () => {
    const playMock = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValue(new Error("codec failure"));

    let project = createProject({ id: "playback-failure" });

    project = {
      ...project,
      assets: [
        {
          id: "video-failure",
          name: "failure.mp4",
          mediaType: "video",
          sourcePath: "/media/failure.mp4",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-failure");
    localStorage.setItem(
      "frameflow.workspace-project",
      serializeProject(project),
    );

    render(<App />);

    await screen.findByTestId("preview-video");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(playMock).toHaveBeenCalled();
      expect(screen.getByText("codec failure")).toBeInTheDocument();
    });
  });

  it("does not let a playback AbortError hide another media failure", async () => {
    const playMock = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(function (this: HTMLMediaElement) {
        return this instanceof HTMLVideoElement
          ? Promise.reject(new Error("video codec failure"))
          : Promise.reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
      });

    let project = createProject({ id: "mixed-playback-failure" });

    project = {
      ...project,
      assets: [
        {
          id: "video-failure",
          name: "failure.mp4",
          mediaType: "video",
          sourcePath: "/media/failure.mp4",
          durationMs: 5000,
        },
        {
          id: "audio-abort",
          name: "abort.mp3",
          mediaType: "audio",
          sourcePath: "/media/abort.mp3",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "video-failure");
    project = addAssetToTimeline(project, "audio-abort");
    localStorage.setItem(
      "frameflow.workspace-project",
      serializeProject(project),
    );

    render(<App />);

    await screen.findByTestId("preview-video");
    await waitFor(() => {
      expect(screen.getByTestId("preview-audio")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(playMock).toHaveBeenCalled();
      expect(screen.getByText("video codec failure")).toBeInTheDocument();
    });

    expect(screen.queryByText("The operation was aborted.")).not.toBeInTheDocument();
  });

  it("updates audio fade controls from the timeline handle", async () => {
    importMediaFilesMock.mockResolvedValueOnce([
      {
        id: "asset-audio-fade-handle-ui",
        name: "fade-handle.mp3",
        mediaType: "audio",
        sourcePath: "/media/fade-handle.mp3",
        durationMs: 5000,
      },
    ]);

    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Import media" })[1]);
    await waitFor(() =>
      expect(screen.getByText("fade-handle.mp3")).toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add fade-handle.mp3 to timeline" }),
    );

    const handle = screen.getByRole("button", {
      name: "Adjust audio fade in for fade-handle.mp3 to 0 ms",
    });
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 61 });
    fireEvent.pointerMove(handle, { buttons: 1, clientX: 140, pointerId: 61 });
    fireEvent.pointerUp(handle, { button: 0, clientX: 140, pointerId: 61 });

    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: "Audio fade in" })).toHaveValue(1000);
      expect(screen.getByRole("spinbutton", { name: "Audio fade out" })).toHaveValue(0);
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
