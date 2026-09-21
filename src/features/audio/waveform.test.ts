import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { buildWaveformPath, clearAudioWaveformCache, getAudioWaveform } from "./waveform";
import { invoke } from "@tauri-apps/api/core";

describe("audio waveform", () => {
  it("builds a closed SVG waveform path", () => {
    const path = buildWaveformPath([0, 0.5, 1], 100, 20);

    expect(path).toContain("M 0.000 10.000");
    expect(path).toContain("L 100.000 0.800");
    expect(path).toContain("L 100.000 19.200");
    expect(path.endsWith(" Z")).toBe(true);
  });

  it("returns an empty path for empty or invalid dimensions", () => {
    expect(buildWaveformPath([], 100, 20)).toBe("");
    expect(buildWaveformPath([1], 0, 20)).toBe("");
    expect(buildWaveformPath([1], 100, 0)).toBe("");
  });

  it("clamps waveform request size and caches identical requests", async () => {
    clearAudioWaveformCache();

    vi.mocked(invoke).mockResolvedValue({
      durationMs: 5000,
      sampleRate: 1024,
      peaks: [-1, 0.25, 0.75, 2],
    });

    const first = getAudioWaveform("/music.mp3", 10);
    const second = getAudioWaveform("/music.mp3", 10);

    expect(first).toBe(second);

    const waveform = await first;

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("generate_audio_waveform", {
      path: "/music.mp3",
      peakCount: 32,
    });
    expect(waveform).toEqual({
      durationMs: 5000,
      sampleRate: 1024,
      peaks: [0, 0.25, 0.75, 1],
    });
  });

  it("does not permanently cache rejected waveform requests", async () => {
    clearAudioWaveformCache();

    vi.mocked(invoke)
      .mockRejectedValueOnce(new Error("generation failed"))
      .mockResolvedValueOnce({
        durationMs: 1000,
        sampleRate: 1000,
        peaks: [0.5],
      });

    await expect(getAudioWaveform("/broken.mp3")).rejects.toThrow(
      "generation failed",
    );

    await expect(getAudioWaveform("/broken.mp3")).resolves.toEqual({
      durationMs: 1000,
      sampleRate: 1000,
      peaks: [0.5],
    });

    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
