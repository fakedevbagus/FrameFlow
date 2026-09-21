import type { Project } from "../project/domain";

export type ExportFormat = "mp4";
export type ExportQuality = "source" | "1080p" | "720p";

export interface ExportSettings {
  format: ExportFormat;
  quality: ExportQuality;
  width: number;
  height: number;
  frameRate: number;
  fileName: string;
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: "mp4",
  quality: "source",
  width: 1920,
  height: 1080,
  frameRate: 30,
  fileName: "FrameFlow-export.mp4",
};

export function createDefaultExportSettings(project: Project): ExportSettings {
  return {
    ...DEFAULT_EXPORT_SETTINGS,
    width: project.canvas.width,
    height: project.canvas.height,
    frameRate: project.canvas.frameRate,
    fileName: sanitizeExportFileName(project.name),
  };
}

export function normalizeExportSettings(
  settings: ExportSettings,
  project: Project,
): ExportSettings {
  const frameRate = Number.isFinite(settings.frameRate) && settings.frameRate > 0
    ? settings.frameRate
    : project.canvas.frameRate;

  const width = Number.isFinite(settings.width) && settings.width > 0
    ? Math.round(settings.width)
    : project.canvas.width;

  const height = Number.isFinite(settings.height) && settings.height > 0
    ? Math.round(settings.height)
    : project.canvas.height;

  return {
    format: "mp4",
    quality: settings.quality,
    width,
    height,
    frameRate,
    fileName: sanitizeExportFileName(settings.fileName),
  };
}

export function getExportDimensions(
  quality: ExportQuality,
  project: Project,
): { width: number; height: number } {
  if (quality === "1080p") {
    return fitWithinHeight(project.canvas.width, project.canvas.height, 1080);
  }

  if (quality === "720p") {
    return fitWithinHeight(project.canvas.width, project.canvas.height, 720);
  }

  return {
    width: project.canvas.width,
    height: project.canvas.height,
  };
}

export function sanitizeExportFileName(value: string): string {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, "-");

  if (!normalized) {
    return "FrameFlow-export.mp4";
  }

  return normalized.toLowerCase().endsWith(".mp4")
    ? normalized
    : normalized + ".mp4";
}

function fitWithinHeight(
  sourceWidth: number,
  sourceHeight: number,
  targetHeight: number,
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: 1280, height: targetHeight };
  }

  const width = Math.max(2, Math.round((sourceWidth / sourceHeight) * targetHeight));

  return {
    width: width % 2 === 0 ? width : width + 1,
    height: targetHeight,
  };
}
