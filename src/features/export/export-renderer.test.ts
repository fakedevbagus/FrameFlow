import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  renderSingleSourceToMp4,
  renderVideoGraphToMp4,
} from "./export-renderer";

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
      sourceStartMs: 1000,
      sourceDurationMs: 2500,
      includeAudio: false,
    };

    await expect(renderSingleSourceToMp4(request)).resolves.toEqual({
      outputPath: "/tmp/export.mp4",
    });

    expect(invoke).toHaveBeenCalledWith("render_single_source_to_mp4", {
      request,
    });
  });

  it("invokes the native video graph renderer with the compiled graph contract", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      outputPath: "/tmp/timeline-export.mp4",
    });

    const request = {
      inputs: ["/media/a.mp4", "/media/b.mp4"],
      outputPath: "/tmp/timeline-export.mp4",
      width: 1080,
      height: 1920,
      frameRate: 30,
      filterComplex:
        "[0:v:0]trim=start=0:end=2,setpts=PTS-STARTPTS[v0];[1:v:0]trim=start=0:end=1,setpts=PTS-STARTPTS[v1];[v0][v1]concat=n=2:v=1:a=0[vout]",
      videoMap: "[vout]",
    };

    await expect(renderVideoGraphToMp4(request)).resolves.toEqual({
      outputPath: "/tmp/timeline-export.mp4",
    });

    expect(invoke).toHaveBeenCalledWith("render_video_graph_to_mp4", {
      request,
    });
  });
});
