import { describe, expect, it } from "vitest";
import {
  transformFromPointer,
  type CanvasPointer,
} from "./canvasManipulation";

const base = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

const rect = {
  width: 200,
  height: 400,
};

describe("canvas manipulation", () => {
  it("moves a clip in canvas-relative percentages", () => {
    const start: CanvasPointer = { x: 50, y: 100 };
    const current: CanvasPointer = { x: 90, y: 60 };

    expect(
      transformFromPointer("move", base, start, current, rect),
    ).toMatchObject({
      x: 20,
      y: -10,
    });
  });

  it("scales relative to the canvas center", () => {
    const start: CanvasPointer = { x: 200, y: 400 };
    const current: CanvasPointer = { x: 250, y: 500 };

    expect(
      transformFromPointer("scale", base, start, current, rect).scale,
    ).toBeGreaterThan(1);
  });

  it("rotates relative to the canvas center", () => {
    const start: CanvasPointer = { x: 100, y: 0 };
    const current: CanvasPointer = { x: 200, y: 100 };

    expect(
      transformFromPointer("rotate", base, start, current, rect).rotation,
    ).toBe(45);
  });

  it("keeps opacity unchanged during direct manipulation", () => {
    expect(
      transformFromPointer(
        "move",
        { ...base, opacity: 0.4 },
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        rect,
      ).opacity,
    ).toBe(0.4);
  });
});
