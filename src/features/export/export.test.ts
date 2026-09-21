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
      fileName: "Untitled-project.mp4",
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

  it("sanitizes export file names", () => {
    expect(sanitizeExportFileName("My / Final:Edit")).toBe(
      "my - final-edit.mp4",
    );
    expect(sanitizeExportFileName("clip.mp4")).toBe("clip.mp4");
  });
});
