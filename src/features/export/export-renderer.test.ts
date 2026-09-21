import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  renderSingleSourceToMp4,
  renderVideoGraphToMp4,
  renderVideoSegmentsToMp4,
} from "./export-renderer";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("export renderer", () => {
  it("invokes the native multi-segment renderer with audio enabled", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      outputPath: "/tmp/multi-export.mp4",
    });

    const request = {
      segments: [
        {
          sourcePath: "/media/a.mp4",
          sourceStartMs: 0,
          durationMs: 2000,
        },
        {
          durationMs: 1000,
        },
      ],
      outputPath: "/tmp/multi-export.mp4",
      width: 406,
      height: 720,
      frameRate: 30,
      includeAudio: true,
    };

    await expect(renderVideoSegmentsToMp4(request)).resolves.toEqual({
      outputPath: "/tmp/multi-export.mp4",
    });

    expect(invoke).toHaveBeenCalledWith("render_video_segments_to_mp4", {
      request,
    });
  });


  it("invokes the native multi-segment renderer with ordered segments", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      outputPath: "/tmp/multi-export.mp4",
    });

    const request = {
      segments: [
        {
          sourcePath: "/media/a.mp4",
          sourceStartMs: 500,
          durationMs: 2000,
        },
        {
          durationMs: 2000,
        },
        {
          sourcePath: "/media/b.mp4",
          sourceStartMs: 0,
          durationMs: 4000,
        },
      ],
      outputPath: "/tmp/multi-export.mp4",
      width: 406,
      height: 720,
      frameRate: 30,
    };

    await expect(renderVideoSegmentsToMp4(request)).resolves.toEqual({
      outputPath: "/tmp/multi-export.mp4",
    });

    expect(invoke).toHaveBeenCalledWith("render_video_segments_to_mp4", {
      request,
    });
  });


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
      includeAudio: true,
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
