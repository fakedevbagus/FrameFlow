import { describe, expect, it } from "vitest";
import {
  frameDurationMs,
  shouldPublishPlaybackTime,
  stepFrame,
  stepPlaybackTime,
} from "./playback";

describe("playback", () => {
  it("derives frame duration from the project frame rate", () => {
    expect(frameDurationMs(25)).toBeCloseTo(40);
  });

  it("advances playback time without passing the timeline end", () => {
    expect(stepPlaybackTime(9_500, 1_000, 10_000)).toEqual({
      timeMs: 10_000,
      reachedEnd: true,
    });
  });

  it("steps one frame in either direction and clamps to the timeline", () => {
    expect(stepFrame(1_000, 25, 10_000, 1)).toBeCloseTo(1_040);
    expect(stepFrame(10, 30, 10_000, -1)).toBe(0);
  });

  it("publishes the first playback UI timestamp immediately", () => {
    expect(shouldPublishPlaybackTime(100, null)).toBe(true);
  });

  it("throttles playback UI timestamp publishes to the configured interval", () => {
    expect(shouldPublishPlaybackTime(120, 100)).toBe(false);
    expect(shouldPublishPlaybackTime(133, 100)).toBe(true);
  });

  it("supports a custom playback UI publish interval", () => {
    expect(shouldPublishPlaybackTime(149, 100, 50)).toBe(false);
    expect(shouldPublishPlaybackTime(150, 100, 50)).toBe(true);
  });
});
