import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { importMediaFiles } from "./features/media/import";

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

});
