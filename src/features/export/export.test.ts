import { describe, expect, it } from "vitest";
import { createProject } from "../project/domain";
import {
  createDefaultExportSettings,
  getExportDimensions,
  normalizeExportSettings,
  sanitizeExportFileName,
} from "./export";

describe("export settings", () => {
  it("derives source export settings from the project canvas", () => {
    const project = createProject({ id: "portrait-export" });
    project.canvas = { width: 1080, height: 1920, frameRate: 60 };

    expect(createDefaultExportSettings(project)).toEqual({
      format: "mp4",
      quality: "source",
      width: 1080,
      height: 1920,
      frameRate: 60,
      fileName: "Untitled project.mp4",
    });
  });

  it("fits standard quality presets to the project aspect ratio", () => {
    const project = createProject({ id: "landscape-export" });
    project.canvas = { width: 1920, height: 1080, frameRate: 30 };

    expect(getExportDimensions("1080p", project)).toEqual({
      width: 1920,
      height: 1080,
    });

    expect(getExportDimensions("720p", project)).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it("normalizes invalid numeric settings back to project values", () => {
    const project = createProject({ id: "normalize-export" });
    project.canvas = { width: 1080, height: 1920, frameRate: 24 };

    expect(
      normalizeExportSettings(
        {
          format: "mp4",
          quality: "source",
          width: 0,
          height: Number.NaN,
          frameRate: Number.NaN,
          fileName: "  ",
        },
        project,
      ),
    ).toEqual({
      format: "mp4",
      quality: "source",
      width: 1080,
      height: 1920,
      frameRate: 24,
      fileName: "FrameFlow-export.mp4",
    });
  });

  it("normalizes export dimensions to positive even values", () => {
    const project = createProject({ id: "normalize-export-dimensions" });
    project.canvas = { width: 1080, height: 1920, frameRate: 30 };

    expect(
      normalizeExportSettings(
        {
          format: "mp4",
          quality: "source",
          width: 1921,
          height: 1079,
          frameRate: 30,
          fileName: "output.mp4",
        },
        project,
      ),
    ).toEqual({
      format: "mp4",
      quality: "source",
      width: 1922,
      height: 1080,
      frameRate: 30,
      fileName: "output.mp4",
    });

    expect(
      normalizeExportSettings(
        {
          format: "mp4",
          quality: "source",
          width: 1,
          height: 0.5,
          frameRate: 30,
          fileName: "output.mp4",
        },
        project,
      ).width,
    ).toBe(2);
  });

  it("falls back to the project frame rate when export FPS exceeds the native limit", () => {
    const project = createProject({ id: "normalize-export-framerate" });
    project.canvas = { width: 1080, height: 1920, frameRate: 29.97 };

    expect(
      normalizeExportSettings(
        {
          format: "mp4",
          quality: "source",
          width: 1080,
          height: 1920,
          frameRate: 240.001,
          fileName: "output.mp4",
        },
        project,
      ).frameRate,
    ).toBe(29.97);
  });

  it("sanitizes export file names", () => {
    expect(sanitizeExportFileName("My / Final:Edit")).toBe(
      "My - Final-Edit.mp4",
    );
    expect(sanitizeExportFileName("clip.mp4")).toBe("clip.mp4");
  });
});
