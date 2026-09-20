import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLIP_TRANSFORM,
  DEFAULT_TRANSFORM_ANCHOR,
  getClipTransform,
  getClipTransformAnchor,
  getClipTransformAtTime,
  getTransformKeyframeAtTime,
  normalizeClipTransform,
  normalizeTransformKeyframes,
  removeTransformKeyframe,
  upsertTransformKeyframe,
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

  it("normalizes legacy and out-of-range transform anchors", () => {
    expect(getClipTransformAnchor(undefined)).toEqual(DEFAULT_TRANSFORM_ANCHOR);
    expect(getClipTransformAnchor({ x: 2, y: -1 })).toEqual({
      x: 1,
      y: 0,
    });
  });

  it("normalizes negative rotations without changing their direction", () => {
    expect(normalizeClipTransform({ rotation: -450 }).rotation).toBe(-90);
  });
});


describe("transform keyframes", () => {
  it("normalizes, sorts, and deduplicates keyframes", () => {
    const keyframes = normalizeTransformKeyframes([
      {
        timeMs: 1000,
        transform: { x: 10, y: 0, scale: 1.5, rotation: 0, opacity: 0.8 },
      },
      {
        timeMs: 0,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      },
      {
        timeMs: 1000,
        transform: { x: 20, y: 5, scale: 2, rotation: 10, opacity: 0.7 },
      },
    ]);

    expect(keyframes).toHaveLength(2);
    expect(keyframes[0].timeMs).toBe(0);
    expect(keyframes[1]).toEqual({
      timeMs: 1000,
      transform: {
        x: 20,
        y: 5,
        scale: 2,
        rotation: 10,
        opacity: 0.7,
      },
      easing: "linear",
    });
  });

  it("defaults legacy keyframes to linear easing", () => {
    const normalized = normalizeTransformKeyframes([
      {
        timeMs: 0,
        transform: DEFAULT_CLIP_TRANSFORM,
      },
    ]);

    expect(normalized[0].easing).toBe("linear");
  });

  it("applies ease-in interpolation to the destination keyframe", () => {
    const keyframes = [
      {
        timeMs: 0,
        transform: DEFAULT_CLIP_TRANSFORM,
        easing: "linear" as const,
      },
      {
        timeMs: 1000,
        transform: {
          ...DEFAULT_CLIP_TRANSFORM,
          x: 100,
        },
        easing: "ease-in" as const,
      },
    ];

    expect(getClipTransformAtTime(undefined, keyframes, 500).x).toBe(25);
  });

  it("applies ease-out interpolation to the destination keyframe", () => {
    const keyframes = [
      {
        timeMs: 0,
        transform: DEFAULT_CLIP_TRANSFORM,
        easing: "linear" as const,
      },
      {
        timeMs: 1000,
        transform: {
          ...DEFAULT_CLIP_TRANSFORM,
          x: 100,
        },
        easing: "ease-out" as const,
      },
    ];

    expect(getClipTransformAtTime(undefined, keyframes, 500).x).toBe(75);
  });

  it("interpolates transforms at the playhead", () => {
    const keyframes = [
      {
        timeMs: 0,
        transform: {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 170,
          opacity: 1,
        },
      },
      {
        timeMs: 1000,
        transform: {
          x: 20,
          y: -10,
          scale: 2,
          rotation: -170,
          opacity: 0.5,
        },
      },
    ];

    expect(getClipTransformAtTime(undefined, keyframes, 500)).toEqual({
      x: 10,
      y: -5,
      scale: 1.5,
      rotation: 180,
      opacity: 0.75,
    });
    expect(getClipTransformAtTime(undefined, keyframes, 1500)).toEqual(
      keyframes[1].transform,
    );
  });

  it("upserts and removes keyframes deterministically", () => {
    const initial = upsertTransformKeyframe(
      undefined,
      500,
      { x: 5, y: 0, scale: 1, rotation: 0, opacity: 1 },
    );
    const updated = upsertTransformKeyframe(
      initial,
      500,
      { x: 15, y: 2, scale: 1.2, rotation: 12, opacity: 0.8 },
    );

    expect(getTransformKeyframeAtTime(updated, 500)).toEqual({
      timeMs: 500,
      transform: {
        x: 15,
        y: 2,
        scale: 1.2,
        rotation: 12,
        opacity: 0.8,
      },
      easing: "linear",
    });

    expect(removeTransformKeyframe(updated, 500)).toEqual([]);
  });
});
