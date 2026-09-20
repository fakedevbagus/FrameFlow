import { describe, expect, it } from "vitest";
import {
  getContainedContentBounds,
  getContainedContentPercentageBounds,
  cropFromPointer,
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
  it("calculates centered percentage bounds for a landscape asset", () => {
    expect(
      getContainedContentPercentageBounds(1080, 1920, 1920, 1080),
    ).toEqual({
      left: 0,
      top: 34.1796875,
      width: 100,
      height: 31.640625,
    });
  });

  it("calculates centered percentage bounds for a portrait asset", () => {
    expect(
      getContainedContentPercentageBounds(1080, 1920, 1080, 1920),
    ).toEqual({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
  });

  it("fits a landscape asset inside a portrait canvas", () => {
    expect(
      getContainedContentBounds(
        { width: 200, height: 400 },
        1920,
        1080,
      ),
    ).toEqual({
      left: 0,
      top: 143.75,
      width: 200,
      height: 112.5,
    });
  });

  it("fits a portrait asset inside a landscape canvas", () => {
    expect(
      getContainedContentBounds(
        { width: 400, height: 200 },
        1080,
        1920,
      ),
    ).toEqual({
      left: 143.75,
      top: 0,
      width: 112.5,
      height: 200,
    });
  });

  it("uses the transform anchor as the scale and rotation pivot", () => {
    expect(
      transformFromPointer(
        "scale",
        base,
        { x: 100, y: 0 },
        { x: 150, y: 0 },
        { left: 0, top: 0, width: 200, height: 200 },
        { x: 0, y: 0 },
      ).scale,
    ).toBe(1.5);

    expect(
      transformFromPointer(
        "rotate",
        base,
        { x: 300, y: 0 },
        { x: 200, y: 100 },
        { left: 0, top: 0, width: 200, height: 200 },
        { x: 1, y: 0 },
      ).rotation,
    ).toBe(90);
  });

  it("uses the content center for scale manipulation", () => {
    expect(
      transformFromPointer(
        "scale",
        base,
        { x: 100, y: 100 },
        { x: 100, y: 150 },
        {
          left: 25,
          top: 100,
          width: 150,
          height: 200,
        },
      ).scale,
    ).toBe(0.5);
  });

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

  it("maps direct crop dragging onto untransformed content coordinates", () => {
    const crop = cropFromPointer(
      "top",
      { top: 0, right: 0, bottom: 0.2, left: 0 },
      { x: 100, y: 40 },
      { left: 0, top: 0, width: 200, height: 400 },
      200,
      400,
      base,
    );

    expect(crop).toEqual({
      top: 0.1,
      right: 0,
      bottom: 0.2,
      left: 0,
    });
  });

  it("maps crop dragging through the active scale, rotation, and anchor", () => {
    const crop = cropFromPointer(
      "left",
      { top: 0, right: 0, bottom: 0, left: 0.1 },
      { x: 100, y: 200 },
      { left: 50, top: 50, width: 200, height: 200 },
      400,
      400,
      { ...base, scale: 2, rotation: 90, x: 10, y: -5 },
      { x: 0, y: 0 },
    );

    expect(crop.left).toBeCloseTo(0.5, 5);
  });

  it("keeps a dragged crop edge away from removing all visible content", () => {
    const crop = cropFromPointer(
      "right",
      { top: 0, right: 0, bottom: 0, left: 0.4 },
      { x: -200, y: 100 },
      { left: 0, top: 0, width: 200, height: 200 },
      200,
      200,
      base,
    );

    expect(crop.left + crop.right).toBeLessThan(1);
    expect(crop.right).toBeLessThanOrEqual(0.599);
  });
});
