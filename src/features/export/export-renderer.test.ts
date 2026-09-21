import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { renderSingleSourceToMp4 } from "./export-renderer";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("export renderer", () => {
  it("invokes the native single-source renderer with the export request", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      outputPath: "/tmp/export.mp4",
    });

    const request = {
      sourcePath: "/media/source.mp4",
      outputPath: "/tmp/export.mp4",
      width: 1280,
      height: 720,
      frameRate: 30,
    };

    await expect(renderSingleSourceToMp4(request)).resolves.toEqual({
      outputPath: "/tmp/export.mp4",
    });

    expect(invoke).toHaveBeenCalledWith("render_single_source_to_mp4", {
      request,
    });
  });
});
