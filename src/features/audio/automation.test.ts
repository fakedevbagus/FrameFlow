import { describe, expect, it } from "vitest";
import {
  getAudioVolumeAtTime,
  getAudioVolumeKeyframeAtTime,
  normalizeAudioVolumeKeyframes,
  removeAudioVolumeKeyframe,
  upsertAudioVolumeKeyframe,
} from "./automation";

describe("audio volume automation", () => {
  it("normalizes, sorts, clamps, and deduplicates volume keyframes", () => {
    expect(
      normalizeAudioVolumeKeyframes([
        { timeMs: 1000.4, volume: 1.4 },
        { timeMs: 0, volume: 0.5 },
        { timeMs: 1000.4, volume: 0.25 },
        { timeMs: -20, volume: 0.8 },
      ]),
    ).toEqual([
      { timeMs: 0, volume: 0.5 },
      { timeMs: 1000, volume: 0.25 },
    ]);
  });

  it("returns the default volume when no keyframes exist", () => {
    expect(getAudioVolumeAtTime({ audioVolumeKeyframes: undefined }, 500)).toBe(1);
  });

  it("interpolates linearly between keyframes and holds the endpoints", () => {
    const clip = {
      audioVolumeKeyframes: [
        { timeMs: 1000, volume: 0 },
        { timeMs: 3000, volume: 1 },
      ],
    };

    expect(getAudioVolumeAtTime(clip, 0)).toBe(0);
    expect(getAudioVolumeAtTime(clip, 2000)).toBe(0.5);
    expect(getAudioVolumeAtTime(clip, 4000)).toBe(1);
  });

  it("finds an exact keyframe at the rounded playhead", () => {
    expect(
      getAudioVolumeKeyframeAtTime(
        [{ timeMs: 1000, volume: 0.5 }],
        1000.4,
      ),
    ).toEqual({ timeMs: 1000, volume: 0.5 });
  });

  it("upserts and removes keyframes", () => {
    const updated = upsertAudioVolumeKeyframe(undefined, 1500.4, 0.4);
    expect(updated).toEqual([{ timeMs: 1500, volume: 0.4 }]);

    const replaced = upsertAudioVolumeKeyframe(updated, 1500, 0.8);
    expect(replaced).toEqual([{ timeMs: 1500, volume: 0.8 }]);

    expect(removeAudioVolumeKeyframe(replaced, 1500)).toEqual([]);
  });



  it("preserves the safe-integer time boundary and rejects unsafe runtime times", () => {
    expect(
      upsertAudioVolumeKeyframe(
        undefined,
        Number.MAX_SAFE_INTEGER,
        0.5,
      ),
    ).toEqual([
      { timeMs: Number.MAX_SAFE_INTEGER, volume: 0.5 },
    ]);

    expect(
      normalizeAudioVolumeKeyframes([
        { timeMs: Number.MAX_SAFE_INTEGER, volume: 0.5 },
        { timeMs: Number.MAX_SAFE_INTEGER + 2, volume: 0.8 },
      ]),
    ).toEqual([
      { timeMs: Number.MAX_SAFE_INTEGER, volume: 0.5 },
    ]);

    expect(() =>
      upsertAudioVolumeKeyframe(
        undefined,
        Number.MAX_SAFE_INTEGER + 1,
        0.5,
      ),
    ).toThrow("safe integer");
  });

  it("rejects invalid keyframe values", () => {
    expect(() => upsertAudioVolumeKeyframe(undefined, -1, 0.5)).toThrow();
    expect(() => upsertAudioVolumeKeyframe(undefined, 0, 1.1)).toThrow();
  });
});
