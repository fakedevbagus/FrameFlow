import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { importMediaFiles } from "./features/media/import";

vi.mock("./features/media/import", () => ({
  importMediaFiles: vi.fn(),
}));

const importMediaFilesMock = vi.mocked(importMediaFiles);

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
});
