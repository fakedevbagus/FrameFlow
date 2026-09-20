import { describe, expect, it } from "vitest";
import { createProject, type Clip } from "../project/domain";
import {
  DEFAULT_DISSOLVE_DURATION_MS,
  getClipEndMs,
  getDissolveOpacities,
  getNextClipForTransition,
  isTransitionAdjacent,
  normalizeClipTransition,
  normalizeTransitionForAdjacentClips,
  sanitizeTrackTransitions,
} from "./transition";

function createClip(id: string, timelineStartMs: number, durationMs: number): Clip {
  return {
    id,
    assetId: id,
    timelineStartMs,
    sourceStartMs: 0,
    sourceEndMs: durationMs,
    transform: {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
    },
  };
}

describe("transition helpers", () => {
  it("normalizes dissolve duration into supported bounds", () => {
    expect(
      normalizeClipTransition({
        type: "dissolve",
        durationMs: 333.7,
      }),
    ).toEqual({
      type: "dissolve",
      durationMs: 334,
    });

    expect(
      normalizeClipTransition({
        type: "dissolve",
        durationMs: 5,
      }),
    ).toEqual({
      type: "dissolve",
      durationMs: 50,
    });
  });

  it("returns the next clip by timeline order", () => {
    const project = createProject({ id: "transition-order" });
    const first = createClip("first", 0, 4000);
    const second = createClip("second", 4000, 3000);

    project.tracks[0] = {
      ...project.tracks[0],
      clips: [second, first],
    };

    expect(getNextClipForTransition(project.tracks[0], "first")).toEqual(second);
  });

  it("recognizes directly adjacent clips", () => {
    const first = createClip("first", 0, 4000);
    const second = createClip("second", 4000, 3000);

    expect(getClipEndMs(first)).toBe(4000);
    expect(isTransitionAdjacent(first, second)).toBe(true);
    expect(
      isTransitionAdjacent(first, {
        ...second,
        timelineStartMs: 4500,
      }),
    ).toBe(false);
  });

  it("normalizes a transition against the duration of both adjacent clips", () => {
    const first = createClip("first", 0, 400);
    const second = createClip("second", 400, 250);

    expect(
      normalizeTransitionForAdjacentClips(
        first,
        second,
        { type: "dissolve", durationMs: 600 },
      ),
    ).toEqual({
      type: "dissolve",
      durationMs: 250,
    });

    expect(
      normalizeTransitionForAdjacentClips(
        first,
        { ...second, timelineStartMs: 500 },
        { type: "dissolve", durationMs: 300 },
      ),
    ).toBeUndefined();
  });

  it("clears stale transitions when a track is no longer structurally eligible", () => {
    const first = createClip("first", 0, 4000);
    const second = createClip("second", 5000, 3000);

    first.transitionOut = {
      type: "dissolve",
      durationMs: 800,
    };

    const track = {
      id: "video-1",
      name: "Video 1",
      type: "video" as const,
      isLocked: false,
      isMuted: false,
      clips: [first, second],
    };

    const sanitized = sanitizeTrackTransitions(track, () => true);

    expect(sanitized.clips[0].transitionOut).toBeUndefined();
  });

  it("calculates a linear dissolve across the transition window", () => {
    const first = createClip("first", 0, 4000);
    const second = createClip("second", 4000, 3000);

    expect(
      getDissolveOpacities(
        3600,
        first,
        second,
        { type: "dissolve", durationMs: 300 },
      ),
    ).toBeNull();

    expect(
      getDissolveOpacities(
        4000 - DEFAULT_DISSOLVE_DURATION_MS / 2,
        first,
        second,
        { type: "dissolve", durationMs: DEFAULT_DISSOLVE_DURATION_MS },
      ),
    ).toEqual({
      outgoingOpacity: 0.5,
      incomingOpacity: 0.5,
    });
  });
});
