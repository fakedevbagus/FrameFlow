import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLIP_CROP,
  getClipCrop,
  getClipCropPosition,
  isValidClipCrop,
  normalizeClipCrop,
  normalizeClipCropPosition,
} from "./transform";

describe("clip crop", () => {
  it("defaults missing crop values to zero", () => {
    expect(getClipCrop(undefined)).toEqual(DEFAULT_CLIP_CROP);
  });

  it("normalizes non-finite and out-of-range crop values", () => {
    expect(
      normalizeClipCrop({
        top: -1,
        right: Number.POSITIVE_INFINITY,
        bottom: 0.25,
        left: 2,
      }),
    ).toEqual({
      top: 0,
      right: 0,
      bottom: 0.25,
      left: 0.99,
    });
  });

  it("derives a backward-compatible crop position from the crop window", () => {
    expect(
      getClipCropPosition(
        {
          top: 0.1,
          right: 0.2,
          bottom: 0.3,
          left: 0.05,
        },
        undefined,
      ),
    ).toEqual({
      x: 0.425,
      y: 0.4,
    });
  });

  it("normalizes an explicit crop position", () => {
    expect(
      normalizeClipCropPosition(
        { top: 0.1, right: 0, bottom: 0.1, left: 0 },
        { x: 2, y: -1 },
      ),
    ).toEqual({
      x: 1,
      y: 0,
    });
  });

  it("rejects crops that remove all horizontal or vertical content", () => {
    expect(
      isValidClipCrop({
        top: 0.25,
        right: 0.25,
        bottom: 0.25,
        left: 0.25,
      }),
    ).toBe(true);

    expect(
      isValidClipCrop({
        top: 0,
        right: 0.5,
        bottom: 0,
        left: 0.5,
      }),
    ).toBe(false);

    expect(
      isValidClipCrop({
        top: 0.6,
        right: 0,
        bottom: 0.4,
        left: 0,
      }),
    ).toBe(false);
  });
});
