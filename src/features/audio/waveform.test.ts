import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import {
  buildWaveformPath,
  clearAudioWaveformCache,
  getAudioWaveform,
  getWaveformLocalTimeMs,
  getWaveformPeaksForSourceRange,
  getWaveformSelectionRangeMs,
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

  it("maps waveform drag coordinates to an ordered local selection range", () => {
    expect(getWaveformSelectionRangeMs(150, 50, 10, 200, 5000)).toEqual({
      startMs: 1000,
      endMs: 3500,
    });
    expect(getWaveformSelectionRangeMs(50, 50, 10, 200, 5000)).toBeNull();
    expect(getWaveformSelectionRangeMs(10, 210, 10, 200, 5000)).toEqual({
      startMs: 0,
      endMs: 5000,
    });
  });

  it("resamples a trimmed source range into the visible waveform", () => {
    expect(
      getWaveformPeaksForSourceRange(
        [0, 0, 1, 1],
        10_000,
        2_500,
        7_500,
        4,
      ),
    ).toEqual([0, 0.5, 1, 1]);

    expect(
      getWaveformPeaksForSourceRange(
        [0, 0.5, 1, 0.5],
        10_000,
        0,
        null,
        4,
      ),
    ).toEqual([0, 0.5, 1, 0.5]);
  });

  it("rejects unsafe waveform output peak counts before allocation", () => {
    expect(
      getWaveformPeaksForSourceRange(
        [0, 0.5, 1],
        10_000,
        0,
        null,
        Number.MAX_SAFE_INTEGER,
      ),
    ).toEqual([]);

    expect(
      getWaveformPeaksForSourceRange(
        [0, 0.5, 1],
        10_000,
        0,
        null,
        2049,
      ),
    ).toEqual([]);
  });

  it("accepts the maximum waveform output peak count", () => {
    expect(
      getWaveformPeaksForSourceRange(
        [0, 1],
        10_000,
        0,
        null,
        2048,
      ),
    ).toHaveLength(2048);
  });

  it("clamps an out-of-range source window safely", () => {
    expect(
      getWaveformPeaksForSourceRange(
        [0, 0.5, 1],
        10_000,
        -500,
        12_000,
        3,
      ),
    ).toEqual([0, 0.5, 1]);

    expect(
      getWaveformPeaksForSourceRange(
        [0.25, 0.5, 0.75],
        10_000,
        6_000,
        4_000,
        3,
      ),
    ).toEqual([0, 0, 0]);
  });

  it("builds a closed SVG waveform path", () => {
    const path = buildWaveformPath([0, 0.5, 1], 100, 20);

    expect(path).toContain("M 0.000 10.000");
    expect(path).toContain("L 100.000 2.800");
    expect(path).toContain("L 100.000 17.200");
    expect(path.endsWith(" Z")).toBe(true);
  });

  it("returns an empty path for non-finite SVG dimensions", () => {
    expect(buildWaveformPath([0.5, 1], Number.NaN, 20)).toBe("");
    expect(buildWaveformPath([0.5, 1], 100, Number.POSITIVE_INFINITY)).toBe("");
  });

  it("centers a single peak and safely renders an all-zero waveform", () => {
    expect(buildWaveformPath([0.75], 100, 20)).toContain(
      "M 50.000 4.147",
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

    expect(path).toContain("M 0.000 3.869");
    expect(path).not.toContain("L 50.000 10.000");
    expect(path).not.toContain("L 100.000 0.800");
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

  it("normalizes invalid waveform request sizes to the default", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ sourceFingerprint: "1000:peak-count-default" })
      .mockResolvedValueOnce({
        durationMs: 1000,
        sampleRate: 1024,
        peaks: [0.5, 0.5],
        sourceFingerprint: "1000:peak-count-default",
      });

    await expect(
      getAudioWaveform("/peak-count.mp3", Number.NaN),
    ).resolves.toMatchObject({
      durationMs: 1000,
      sampleRate: 1024,
    });

    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "generate_audio_waveform",
      {
        path: "/peak-count.mp3",
        peakCount: 128,
      },
    );
  });

  it("clamps waveform request size and caches identical requests", async () => {
    clearAudioWaveformCache();

    vi.mocked(invoke)
      .mockResolvedValueOnce({ sourceFingerprint: "5000:100" })
      .mockResolvedValueOnce({
        durationMs: 5000,
        sampleRate: 1024,
        peaks: [-1, 0.25, 0.75, 2],
        sourceFingerprint: "5000:100",
      });

    const first = getAudioWaveform("/music.mp3", 10);
    const second = getAudioWaveform("/music.mp3", 10);

    expect(first).toBe(second);

    const waveform = await first;

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(
      1,
      "get_audio_waveform_source_fingerprint",
      { path: "/music.mp3" },
    );
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "generate_audio_waveform",
      {
        path: "/music.mp3",
        peakCount: 32,
      },
    );
    expect(waveform).toEqual({
      durationMs: 5000,
      sampleRate: 1024,
      peaks: [0, 0.25, 0.75, 1],
      sourceFingerprint: "5000:100",
    });
  });

  it("preserves waveform bucket positions when native peaks contain invalid values", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ sourceFingerprint: "1000:200" })
      .mockResolvedValueOnce({
        durationMs: 1000,
        sampleRate: 1024,
        peaks: [0.25, Number.NaN, 0.75],
        sourceFingerprint: "1000:200",
      });

    await expect(getAudioWaveform("/invalid-peaks.mp3")).resolves.toEqual({
      durationMs: 1000,
      sampleRate: 1024,
      peaks: [0.25, 0, 0.75],
      sourceFingerprint: "1000:200",
    });
  });

  it("rejects a native waveform duration outside the safe integer range", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ sourceFingerprint: "safe-boundary-duration" })
      .mockResolvedValueOnce({
        durationMs: Number.MAX_SAFE_INTEGER + 1,
        sampleRate: 1024,
        peaks: [0.5],
        sourceFingerprint: "safe-boundary-duration",
      });

    await expect(
      getAudioWaveform("/unsafe-duration.mp3"),
    ).rejects.toThrow("Native waveform data is invalid.");
  });

  it("rejects non-integer native waveform timing metadata", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ sourceFingerprint: "fractional-metadata" })
      .mockResolvedValueOnce({
        durationMs: 1000.5,
        sampleRate: 1024.5,
        peaks: [0.5],
        sourceFingerprint: "fractional-metadata",
      });

    await expect(
      getAudioWaveform("/fractional-metadata.mp3"),
    ).rejects.toThrow("Native waveform data is invalid.");
  });

  it("rejects an empty native peak array", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ sourceFingerprint: "1000:300" })
      .mockResolvedValueOnce({
        durationMs: 1000,
        sampleRate: 1024,
        peaks: [],
        sourceFingerprint: "1000:300",
      });

    await expect(getAudioWaveform("/empty-peaks.mp3")).rejects.toThrow(
      "Native waveform data is invalid.",
    );
  });

  it("does not permanently cache rejected waveform requests", async () => {
    clearAudioWaveformCache();

    vi.mocked(invoke)
      .mockResolvedValueOnce({ sourceFingerprint: "1000:400" })
      .mockRejectedValueOnce(new Error("generation failed"))
      .mockResolvedValueOnce({ sourceFingerprint: "1000:400" })
      .mockResolvedValueOnce({
        durationMs: 1000,
        sampleRate: 1000,
        peaks: [0.5],
        sourceFingerprint: "1000:400",
      });

    await expect(getAudioWaveform("/broken.mp3")).rejects.toThrow(
      "generation failed",
    );

    await expect(getAudioWaveform("/broken.mp3")).resolves.toEqual({
      durationMs: 1000,
      sampleRate: 1000,
      peaks: [0.5],
      sourceFingerprint: "1000:400",
    });

    expect(invoke).toHaveBeenCalledTimes(4);
  });

  it("reuses a persisted waveform without regenerating FFmpeg data", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ sourceFingerprint: "2048:500" })
      .mockResolvedValueOnce({
        durationMs: 2048,
        sampleRate: 2048,
        peaks: [0.25, 0.75],
        sourceFingerprint: "2048:500",
      })
      .mockResolvedValueOnce({ sourceFingerprint: "2048:500" });

    const first = await getAudioWaveform("/persisted.mp3", 128);

    expect(first.peaks).toEqual([0.25, 0.75]);

    const second = await getAudioWaveform("/persisted.mp3", 128);

    expect(second).toEqual(first);
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(invoke).toHaveBeenNthCalledWith(
      3,
      "get_audio_waveform_source_fingerprint",
      { path: "/persisted.mp3" },
    );
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      "generate_audio_waveform",
      {
        path: "/persisted.mp3",
        peakCount: 128,
      },
    );
  });

  it("regenerates when the source fingerprint changes", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ sourceFingerprint: "2048:600" })
      .mockResolvedValueOnce({
        durationMs: 2048,
        sampleRate: 2048,
        peaks: [0.25],
        sourceFingerprint: "2048:600",
      })
      .mockResolvedValueOnce({ sourceFingerprint: "2048:601" })
      .mockResolvedValueOnce({
        durationMs: 2048,
        sampleRate: 2048,
        peaks: [0.9],
        sourceFingerprint: "2048:601",
      });

    await expect(getAudioWaveform("/changed.mp3")).resolves.toMatchObject({
      peaks: [0.25],
      sourceFingerprint: "2048:600",
    });

    await expect(getAudioWaveform("/changed.mp3")).resolves.toMatchObject({
      peaks: [0.9],
      sourceFingerprint: "2048:601",
    });

    expect(invoke).toHaveBeenCalledTimes(4);
  });

  it("treats malformed persisted waveform data as a cache miss", async () => {
    localStorage.setItem(
      "frameflow.audio-waveform-cache.v1",
      JSON.stringify({
        version: 1,
        entries: [
          {
            cacheKey: "/broken-cache.mp3::512::bad",
            waveform: {
              durationMs: -1,
              sampleRate: 0,
              peaks: [],
              sourceFingerprint: "bad",
            },
            lastUsedAt: 1,
          },
        ],
      }),
    );

    vi.mocked(invoke)
      .mockResolvedValueOnce({ sourceFingerprint: "1000:700" })
      .mockResolvedValueOnce({
        durationMs: 1000,
        sampleRate: 1000,
        peaks: [0.5],
        sourceFingerprint: "1000:700",
      });

    await expect(getAudioWaveform("/broken-cache.mp3", 512)).resolves.toEqual({
      durationMs: 1000,
      sampleRate: 1000,
      peaks: [0.5],
      sourceFingerprint: "1000:700",
    });

    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("falls back to waveform generation when persistent storage throws", async () => {
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    vi.mocked(invoke)
      .mockResolvedValueOnce({ sourceFingerprint: "1000:800" })
      .mockResolvedValueOnce({
        durationMs: 1000,
        sampleRate: 1000,
        peaks: [0.5],
        sourceFingerprint: "1000:800",
      });

    await expect(getAudioWaveform("/storage-error.mp3")).resolves.toMatchObject({
      sourceFingerprint: "1000:800",
    });

    expect(invoke).toHaveBeenCalledTimes(2);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(originalGetItem);
  });
});
