export const PROJECT_SCHEMA_VERSION = 1;

export type MediaType = "audio" | "image" | "video";
export type TrackType = "audio" | "video";
export const DEFAULT_TRACK_VOLUME = 1;
export const DEFAULT_TRACK_PAN = 0;
export const DEFAULT_AUDIO_FADE_IN_MS = 0;
export const DEFAULT_AUDIO_FADE_OUT_MS = 0;
export const DEFAULT_AUDIO_EQ_ENABLED = false;
export const DEFAULT_AUDIO_EQ_LOW_GAIN_DB = 0;
export const DEFAULT_AUDIO_EQ_MID_GAIN_DB = 0;
export const DEFAULT_AUDIO_EQ_HIGH_GAIN_DB = 0;

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

export interface TransformAnchor {
  x: number;
  y: number;
}

export interface ClipCrop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CropPosition {
  x: number;
  y: number;
}

export interface AudioEq {
  enabled: boolean;
  lowGainDb: number;
  midGainDb: number;
  highGainDb: number;
}

export interface DissolveTransition {
  type: "dissolve";
  durationMs: number;
}

export interface FadeThroughBlackTransition {
  type: "fade-through-black";
  durationMs: number;
}

export type ClipTransition = DissolveTransition | FadeThroughBlackTransition;

export interface Clip {
  id: string;
  assetId: string;
  timelineStartMs: number;
  sourceStartMs: number;
  sourceEndMs: number | null;
  transform?: ClipTransform;
  transformAnchor?: TransformAnchor;
  crop?: ClipCrop;
  cropPosition?: CropPosition;
  transitionOut?: ClipTransition;
  audioFadeInMs?: number;
  audioFadeOutMs?: number;
  audioEq?: AudioEq;
  transformKeyframes?: TransformKeyframe[];
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  isLocked: boolean;
  isMuted: boolean;
  volume?: number;
  pan?: number;
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
    volume: DEFAULT_TRACK_VOLUME,
    pan: DEFAULT_TRACK_PAN,
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

export function getTrackVolume(track: Track): number {
  const volume = track.volume;

  if (typeof volume !== "number" || !Number.isFinite(volume)) {
    return DEFAULT_TRACK_VOLUME;
  }

  return Math.min(1, Math.max(0, volume));
}


export function getTrackPan(track: Track): number {
  const pan = track.pan;

  if (typeof pan !== "number" || !Number.isFinite(pan)) {
    return DEFAULT_TRACK_PAN;
  }

  return Math.min(1, Math.max(-1, pan));
}

export function getAudioEq(clip: Clip): AudioEq {
  const value = clip.audioEq;

  return {
    enabled: value?.enabled === true,
    lowGainDb: normalizeAudioEqGain(
      value?.lowGainDb,
      DEFAULT_AUDIO_EQ_LOW_GAIN_DB,
    ),
    midGainDb: normalizeAudioEqGain(
      value?.midGainDb,
      DEFAULT_AUDIO_EQ_MID_GAIN_DB,
    ),
    highGainDb: normalizeAudioEqGain(
      value?.highGainDb,
      DEFAULT_AUDIO_EQ_HIGH_GAIN_DB,
    ),
  };
}

function normalizeAudioEqGain(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(12, Math.max(-12, Math.round(value * 10) / 10));
}

export function getAudioFadeInMs(clip: Clip): number {
  return normalizeAudioFadeValue(clip.audioFadeInMs, DEFAULT_AUDIO_FADE_IN_MS);
}

export function getAudioFadeOutMs(clip: Clip): number {
  return normalizeAudioFadeValue(clip.audioFadeOutMs, DEFAULT_AUDIO_FADE_OUT_MS);
}

export function getAudioFadeDurations(
  clip: Clip,
): { fadeInMs: number; fadeOutMs: number } {
  const durationMs =
    clip.sourceEndMs === null
      ? 0
      : Math.max(0, clip.sourceEndMs - clip.sourceStartMs);
  const fadeInMs = Math.min(durationMs, getAudioFadeInMs(clip));
  const fadeOutMs = Math.min(
    Math.max(0, durationMs - fadeInMs),
    getAudioFadeOutMs(clip),
  );

  return { fadeInMs, fadeOutMs };
}

function normalizeAudioFadeValue(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}
