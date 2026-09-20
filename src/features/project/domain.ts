export const PROJECT_SCHEMA_VERSION = 1;

export type MediaType = "audio" | "image" | "video";
export type TrackType = "audio" | "video";

export interface CanvasSettings {
  width: number;
  height: number;
  frameRate: number;
}

export interface MediaAsset {
  id: string;
  name: string;
  mediaType: MediaType;
  sourcePath: string;
  durationMs: number | null;
}

export interface ClipTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export type TransformEasing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out";

export interface TransformKeyframe {
  timeMs: number;
  transform: ClipTransform;
  easing?: TransformEasing;
}

export interface Clip {
  id: string;
  assetId: string;
  timelineStartMs: number;
  sourceStartMs: number;
  sourceEndMs: number | null;
  transform?: ClipTransform;
  transformKeyframes?: TransformKeyframe[];
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  isLocked: boolean;
  isMuted: boolean;
  clips: Clip[];
}

export interface Project {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  canvas: CanvasSettings;
  assets: MediaAsset[];
  tracks: Track[];
}

export interface CreateProjectOptions {
  id?: string;
  name?: string;
  now?: Date;
}

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectValidationError";
  }
}

export function createProject(options: CreateProjectOptions = {}): Project {
  const timestamp = (options.now ?? new Date()).toISOString();

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: options.id ?? crypto.randomUUID(),
    name: options.name?.trim() || "Untitled project",
    createdAt: timestamp,
    updatedAt: timestamp,
    canvas: {
      width: 1080,
      height: 1920,
      frameRate: 30,
    },
    assets: [],
    tracks: [
      createTrack("video-1", "Video 1", "video"),
      createTrack("audio-1", "Audio 1", "audio"),
    ],
  };
}

export function serializeProject(project: Project): string {
  validateProject(project);

  return JSON.stringify(project, null, 2);
}

export function parseProject(source: string): Project {
  let value: unknown;

  try {
    value = JSON.parse(source);
  } catch {
    throw new ProjectValidationError("Project file is not valid JSON.");
  }

  validateProject(value);

  return value;
}

export function validateProject(value: unknown): asserts value is Project {
  if (!isRecord(value)) {
    throw new ProjectValidationError("Project data must be an object.");
  }

  if (value.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new ProjectValidationError("Project schema version is not supported.");
  }

  assertNonEmptyString(value.id, "Project id");
  assertNonEmptyString(value.name, "Project name");
  assertIsoTimestamp(value.createdAt, "Project createdAt");
  assertIsoTimestamp(value.updatedAt, "Project updatedAt");
  validateCanvas(value.canvas);

  if (!Array.isArray(value.assets)) {
    throw new ProjectValidationError("Project assets must be an array.");
  }

  if (!Array.isArray(value.tracks)) {
    throw new ProjectValidationError("Project tracks must be an array.");
  }
}

function createTrack(id: string, name: string, type: TrackType): Track {
  return {
    id,
    name,
    type,
    isLocked: false,
    isMuted: false,
    clips: [],
  };
}

function validateCanvas(value: unknown): asserts value is CanvasSettings {
  if (!isRecord(value)) {
    throw new ProjectValidationError("Project canvas must be an object.");
  }

  assertPositiveNumber(value.width, "Canvas width");
  assertPositiveNumber(value.height, "Canvas height");
  assertPositiveNumber(value.frameRate, "Canvas frameRate");
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProjectValidationError(`${field} must be a non-empty string.`);
  }
}

function assertIsoTimestamp(value: unknown, field: string): asserts value is string {
  assertNonEmptyString(value, field);

  if (Number.isNaN(Date.parse(value))) {
    throw new ProjectValidationError(`${field} must be an ISO timestamp.`);
  }
}

function assertPositiveNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new ProjectValidationError(`${field} must be a positive number.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
