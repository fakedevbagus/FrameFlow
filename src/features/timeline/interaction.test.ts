import { describe, expect, it } from "vitest";
import {
  SNAP_GRID_MS,
  SNAP_THRESHOLD_MS,
  pixelsToMilliseconds,
  snapTimelineTime,
} from "./interaction";

describe("timeline interaction helpers", () => {
  it("converts pixels to timeline milliseconds", () => {
    expect(pixelsToMilliseconds(40, 40)).toBe(1000);
    expect(pixelsToMilliseconds(-20, 40)).toBe(-500);
  });

  it("snaps to the nearest grid when no edge is close", () => {
    expect(snapTimelineTime(1_240)).toBe(1_000);
    expect(snapTimelineTime(1_260)).toBe(1_500);
    expect(SNAP_GRID_MS).toBe(500);
  });

  it("snaps to an edit edge when it is inside the snap threshold", () => {
    expect(snapTimelineTime(2_100, [2_000])).toBe(2_000);
    expect(snapTimelineTime(2_300, [2_000])).toBe(2_500);
    expect(SNAP_THRESHOLD_MS).toBe(250);
  });

  it("never snaps to invalid negative candidates", () => {
    expect(snapTimelineTime(100, [-200])).toBe(0);
  });
});
