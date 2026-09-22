import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import {
  buildWaveformPath,
  clearAudioWaveformCache,
  getAudioWaveform,
  getWaveformLocalTimeMs,
} from "./waveform";
import { invoke } from "@tauri-apps/api/core";

describe("audio waveform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAudioWaveformCache();
  });

  it("maps waveform pointer positions to clamped local clip time", () => {
    expect(getWaveformLocalTimeMs(100, 0, 200, 5000)).toBe(2500);
    expect(getWaveformLocalTimeMs(-50, 0, 200, 5000)).toBe(0);
    expect(getWaveformLocalTimeMs(250, 0, 200, 5000)).toBe(5000);
    expect(getWaveformLocalTimeMs(100, 0, 0, 5000)).toBe(0);
  });

  it("builds a closed SVG waveform path", () => {
    const path = buildWaveformPath([0, 0.5, 1], 100, 20);

    expect(path).toContain("M 0.000 10.000");
    expect(path).toContain("L 100.000 0.800");
    expect(path).toContain("L 100.000 19.200");
    expect(path.endsWith(" Z")).toBe(true);
  });

  it("returns an empty path for non-finite SVG dimensions", () => {
    expect(buildWaveformPath([0.5, 1], Number.NaN, 20)).toBe("");
    expect(buildWaveformPath([0.5, 1], 100, Number.POSITIVE_INFINITY)).toBe("");
  });

  it("centers a single peak and safely renders an all-zero waveform", () => {
    expect(buildWaveformPath([0.75], 100, 20)).toContain(
      "M 50.000 3.100",
    );

    const zeroPath = buildWaveformPath([0, 0, 0, 0], 100, 20);

    expect(zeroPath).not.toContain("NaN");
    expect(zeroPath).toContain("M 0.000 10.000");
    expect(zeroPath.endsWith(" Z")).toBe(true);
  });

  it("sanitizes non-finite peaks without generating an invalid SVG path", () => {
    const path = buildWaveformPath(
      [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1],
      100,
      20,
    );

    expect(path).not.toContain("NaN");
    expect(path).not.toContain("Infinity");
    expect(path.endsWith(" Z")).toBe(true);
  });

  it("stretches consistently loud audio peaks for visible timeline contrast", () => {
    const path = buildWaveformPath(
      [0.8, 0.85, 0.9, 0.95, 1],
      100,
      20,
    );

    expect(path).toContain("M 0.000 10.000");
    expect(path).toContain("L 100.000 0.800");
    expect(path).not.toContain("L 50.000 10.000");
  });

  it("returns an empty path for empty or invalid dimensions", () => {
    expect(buildWaveformPath([], 100, 20)).toBe("");
    expect(buildWaveformPath([1], 0, 20)).toBe("");
    expect(buildWaveformPath([1], 100, 0)).toBe("");
  });

  it("creates a predictable path for a large valid peak array", () => {
    const peaks = Array.from({ length: 512 }, (_, index) =>
      (index % 32) / 31,
    );
    const path = buildWaveformPath(peaks, 512, 20);

    expect(path).toContain("M 0.000");
    expect(path).toContain("512.000");
    expect(path.length).toBeGreaterThan(10_000);
    expect(path).not.toMatch(/(?:NaN|Infinity)/);
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

  it("preserves waveform bucket positions when native peaks contain invalid values", async () => {
    vi.mocked(invoke).mockResolvedValue({
      durationMs: 1000,
      sampleRate: 1024,
      peaks: [0.25, Number.NaN, 0.75],
    });

    await expect(getAudioWaveform("/invalid-peaks.mp3")).resolves.toEqual({
      durationMs: 1000,
      sampleRate: 1024,
      peaks: [0.25, 0, 0.75],
    });
  });

  it("rejects an empty native peak array", async () => {
    vi.mocked(invoke).mockResolvedValue({
      durationMs: 1000,
      sampleRate: 1024,
      peaks: [],
    });

    await expect(getAudioWaveform("/empty-peaks.mp3")).rejects.toThrow(
      "Native waveform data is invalid.",
    );
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
