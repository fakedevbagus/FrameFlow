import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importMediaFiles } from "./import";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const openMock = vi.mocked(open);

afterEach(() => {
  vi.clearAllMocks();
});

describe("importMediaFiles", () => {
  it("returns no assets when the dialog is cancelled", async () => {
    openMock.mockResolvedValueOnce(null);

    await expect(importMediaFiles()).resolves.toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("creates media assets from selected files", async () => {
    openMock.mockResolvedValueOnce(["/media/clips/intro.mp4", "/media/music/theme.mp3"]);
    invokeMock
      .mockResolvedValueOnce({ mediaType: "video", durationMs: 12000 })
      .mockResolvedValueOnce({ mediaType: "audio", durationMs: 42000 });

    const assets = await importMediaFiles();

    expect(assets).toEqual([
      expect.objectContaining({
        name: "intro.mp4",
        mediaType: "video",
        sourcePath: "/media/clips/intro.mp4",
        durationMs: 12000,
      }),
      expect.objectContaining({
        name: "theme.mp3",
        mediaType: "audio",
        sourcePath: "/media/music/theme.mp3",
        durationMs: 42000,
      }),
    ]);
  });
});
