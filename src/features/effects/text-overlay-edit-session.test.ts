import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TextOverlay } from "../project/domain";
import {
  clearTextOverlayEditSession,
  getTextOverlayEditSession,
  setTextOverlayEditSession,
  subscribeToTextOverlayEditSession,
} from "./text-overlay-edit-session";

const overlay: TextOverlay = {
  text: "Hello",
  x: 0.5,
  y: 0.5,
  fontSize: 56,
  color: "#ffffff",
  alignment: "center",
};

describe("text overlay edit session", () => {
  beforeEach(() => {
    clearTextOverlayEditSession();
  });

  it("publishes live changes synchronously without touching project state", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTextOverlayEditSession(listener);

    setTextOverlayEditSession({
      clipId: "clip-a",
      overlay,
    });

    expect(getTextOverlayEditSession()).toEqual({
      clipId: "clip-a",
      overlay,
    });
    expect(listener).toHaveBeenCalledTimes(1);

    setTextOverlayEditSession({
      clipId: "clip-a",
      overlay: {
        ...overlay,
        x: 0.49,
      },
    });

    expect(getTextOverlayEditSession()?.overlay.x).toBe(0.49);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("does not notify subscribers when the session value is unchanged", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTextOverlayEditSession(listener);

    setTextOverlayEditSession({
      clipId: "clip-a",
      overlay,
    });
    listener.mockClear();

    setTextOverlayEditSession({
      clipId: "clip-a",
      overlay: { ...overlay },
    });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("replaces and clears the active edit session by clip", () => {
    setTextOverlayEditSession({
      clipId: "clip-a",
      overlay,
    });

    setTextOverlayEditSession({
      clipId: "clip-b",
      overlay: { ...overlay, text: "World" },
    });

    expect(getTextOverlayEditSession()).toEqual({
      clipId: "clip-b",
      overlay: { ...overlay, text: "World" },
    });

    clearTextOverlayEditSession();

    expect(getTextOverlayEditSession()).toBeNull();
  });
});
