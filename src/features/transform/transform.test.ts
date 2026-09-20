import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLIP_TRANSFORM,
  getClipTransform,
  normalizeClipTransform,
} from "./transform";

describe("clip transforms", () => {
  it("provides stable defaults for legacy clips", () => {
    expect(getClipTransform(undefined)).toEqual(DEFAULT_CLIP_TRANSFORM);
    expect(getClipTransform({ x: 12, opacity: 0.5 })).toEqual({
      ...DEFAULT_CLIP_TRANSFORM,
      x: 12,
      opacity: 0.5,
    });
  });

  it("clamps transform values to safe editor limits", () => {
    expect(
      normalizeClipTransform({
        x: 250,
        y: -250,
        scale: 0,
        rotation: 540,
        opacity: 2,
      }),
    ).toEqual({
      x: 100,
      y: -100,
      scale: 0.05,
      rotation: 180,
      opacity: 1,
    });
  });

  it("normalizes negative rotations without changing their direction", () => {
    expect(normalizeClipTransform({ rotation: -450 }).rotation).toBe(-90);
  });
});
