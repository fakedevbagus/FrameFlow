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
export const DEFAULT_AUDIO_COMPRESSOR_ENABLED = false;
export const DEFAULT_AUDIO_COMPRESSOR_THRESHOLD_DB = -24;
export const DEFAULT_AUDIO_COMPRESSOR_RATIO = 4;
export const DEFAULT_AUDIO_COMPRESSOR_ATTACK_MS = 20;
export const DEFAULT_AUDIO_COMPRESSOR_RELEASE_MS = 250;
export const DEFAULT_AUDIO_CLIP_VOLUME = 1;
export const DEFAULT_VISUAL_EFFECT_BRIGHTNESS = 0;
export const DEFAULT_VISUAL_EFFECT_CONTRAST = 0;
export const DEFAULT_VISUAL_EFFECT_SATURATION = 0;
export const DEFAULT_TEXT_OVERLAY_X = 0.5;
export const DEFAULT_TEXT_OVERLAY_Y = 0.5;
export const DEFAULT_TEXT_OVERLAY_FONT_SIZE = 56;
export const DEFAULT_TEXT_OVERLAY_COLOR = "#ffffff";
export const DEFAULT_TEXT_OVERLAY_ALIGNMENT = "center" as const;
export const MAX_TEXT_OVERLAY_LENGTH = 500;

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

export interface AudioCompressor {
  enabled: boolean;
  thresholdDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
}

export interface VisualEffects {
  brightness: number;
  contrast: number;
  saturation: number;
}

export type TextOverlayAlignment = "left" | "center" | "right";

export interface TextOverlay {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  alignment: TextOverlayAlignment;
}

export interface AudioVolumeKeyframe {
  timeMs: number;
  volume: number;
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
  audioCompressor?: AudioCompressor;
  visualEffects?: VisualEffects;
  textOverlay?: TextOverlay;
  audioVolumeKeyframes?: AudioVolumeKeyframe[];
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

  const assets = validateAssets(value.assets);
  validateTracks(value.tracks, assets);
}

function validateAssets(value: unknown): MediaAsset[] {
  if (!Array.isArray(value)) {
    throw new ProjectValidationError("Project assets must be an array.");
  }

  const assets: MediaAsset[] = [];
  const assetIds = new Set<string>();

  for (let index = 0; index < value.length; index += 1) {
    const asset = value[index];
    const fieldPrefix = "Asset " + index;

    if (!isRecord(asset)) {
      throw new ProjectValidationError(fieldPrefix + " must be an object.");
    }

    assertNonEmptyString(asset.id, fieldPrefix + " id");
    if (assetIds.has(asset.id)) {
      throw new ProjectValidationError(
        "Duplicate asset id: " + asset.id + ".",
      );
    }
    assetIds.add(asset.id);

    assertNonEmptyString(asset.name, fieldPrefix + " name");
    assertMediaType(asset.mediaType, fieldPrefix + " mediaType");
    assertNonEmptyString(asset.sourcePath, fieldPrefix + " sourcePath");

    if (
      asset.durationMs !== null &&
      (!isFiniteNumber(asset.durationMs) || asset.durationMs < 0)
    ) {
      throw new ProjectValidationError(
        fieldPrefix + " durationMs must be null or a non-negative number.",
      );
    }

    assets.push(asset as MediaAsset);
  }

  return assets;
}

function validateTracks(
  value: unknown,
  assets: MediaAsset[],
): void {
  if (!Array.isArray(value)) {
    throw new ProjectValidationError("Project tracks must be an array.");
  }

  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const trackIds = new Set<string>();
  const clipIds = new Set<string>();

  for (let trackIndex = 0; trackIndex < value.length; trackIndex += 1) {
    const track = value[trackIndex];
    const fieldPrefix = "Track " + trackIndex;

    if (!isRecord(track)) {
      throw new ProjectValidationError(fieldPrefix + " must be an object.");
    }

    assertNonEmptyString(track.id, fieldPrefix + " id");
    if (trackIds.has(track.id)) {
      throw new ProjectValidationError(
        "Duplicate track id: " + track.id + ".",
      );
    }
    trackIds.add(track.id);

    assertNonEmptyString(track.name, fieldPrefix + " name");

    if (track.type !== "audio" && track.type !== "video") {
      throw new ProjectValidationError(
        fieldPrefix + " type must be audio or video.",
      );
    }

    if (typeof track.isLocked !== "boolean") {
      throw new ProjectValidationError(
        fieldPrefix + " isLocked must be a boolean.",
      );
    }

    if (typeof track.isMuted !== "boolean") {
      throw new ProjectValidationError(
        fieldPrefix + " isMuted must be a boolean.",
      );
    }

    if (
      track.volume !== undefined &&
      (!isFiniteNumber(track.volume) || track.volume < 0 || track.volume > 1)
    ) {
      throw new ProjectValidationError(
        fieldPrefix + " volume must be between 0 and 1.",
      );
    }

    if (
      track.pan !== undefined &&
      (!isFiniteNumber(track.pan) || track.pan < -1 || track.pan > 1)
    ) {
      throw new ProjectValidationError(
        fieldPrefix + " pan must be between -1 and 1.",
      );
    }

    if (!Array.isArray(track.clips)) {
      throw new ProjectValidationError(fieldPrefix + " clips must be an array.");
    }

    for (let clipIndex = 0; clipIndex < track.clips.length; clipIndex += 1) {
      validateClip(
        track.clips[clipIndex],
        track,
        trackIndex,
        clipIndex,
        assetById,
        clipIds,
      );
    }
  }
}

function validateClip(
  value: unknown,
  track: Record<string, unknown>,
  trackIndex: number,
  clipIndex: number,
  assetById: Map<string, MediaAsset>,
  clipIds: Set<string>,
): void {
  const fieldPrefix = "Clip " + trackIndex + "." + clipIndex;

  if (!isRecord(value)) {
    throw new ProjectValidationError(fieldPrefix + " must be an object.");
  }

  assertNonEmptyString(value.id, fieldPrefix + " id");
  if (clipIds.has(value.id)) {
    throw new ProjectValidationError(
      "Duplicate clip id: " + value.id + ".",
    );
  }
  clipIds.add(value.id);

  assertNonEmptyString(value.assetId, fieldPrefix + " assetId");
  const asset = assetById.get(value.assetId);
  if (!asset) {
    throw new ProjectValidationError(
      fieldPrefix + " references missing asset: " + value.assetId + ".",
    );
  }

  assertFiniteNonNegativeNumber(
    value.timelineStartMs,
    fieldPrefix + " timelineStartMs",
  );
  assertFiniteNonNegativeNumber(
    value.sourceStartMs,
    fieldPrefix + " sourceStartMs",
  );

  if (value.sourceEndMs !== null && value.sourceEndMs !== undefined) {
    assertFiniteNonNegativeNumber(
      value.sourceEndMs,
      fieldPrefix + " sourceEndMs",
    );

    if (value.sourceEndMs <= value.sourceStartMs) {
      throw new ProjectValidationError(
        fieldPrefix + " sourceEndMs must be greater than sourceStartMs.",
      );
    }

    if (
      asset.durationMs !== null &&
      asset.durationMs !== undefined &&
      value.sourceEndMs > asset.durationMs
    ) {
      throw new ProjectValidationError(
        fieldPrefix + " sourceEndMs cannot exceed asset duration.",
      );
    }
  }

  if (
    asset.durationMs !== null &&
    asset.durationMs !== undefined &&
    value.sourceStartMs > asset.durationMs
  ) {
    throw new ProjectValidationError(
      fieldPrefix + " sourceStartMs cannot exceed asset duration.",
    );
  }

  const expectedTrackType = asset.mediaType === "audio" ? "audio" : "video";
  if (track.type !== expectedTrackType) {
    throw new ProjectValidationError(
      fieldPrefix +
        " uses media type " +
        asset.mediaType +
        " on a " +
        track.type +
        " track.",
    );
  }

  validateOptionalAudioFields(value, fieldPrefix);
}

function validateOptionalAudioFields(
  clip: Record<string, unknown>,
  fieldPrefix: string,
): void {
  for (const field of ["audioFadeInMs", "audioFadeOutMs"] as const) {
    const value = clip[field];
    if (
      value !== undefined &&
      (!isFiniteNumber(value) || value < 0 || !Number.isInteger(value))
    ) {
      throw new ProjectValidationError(
        fieldPrefix + " " + field + " must be a non-negative integer.",
      );
    }
  }

  const audioEq = clip.audioEq;
  if (audioEq !== undefined) {
    if (!isRecord(audioEq)) {
      throw new ProjectValidationError(fieldPrefix + " audioEq must be an object.");
    }

    if (typeof audioEq.enabled !== "boolean") {
      throw new ProjectValidationError(
        fieldPrefix + " audioEq enabled must be a boolean.",
      );
    }

    for (const field of ["lowGainDb", "midGainDb", "highGainDb"] as const) {
      const value = audioEq[field];
      if (!isFiniteNumber(value) || value < -12 || value > 12) {
        throw new ProjectValidationError(
          fieldPrefix + " audioEq " + field + " must be between -12 and 12.",
        );
      }
    }
  }

  const audioVolumeKeyframes = clip.audioVolumeKeyframes;
  if (audioVolumeKeyframes !== undefined) {
    if (!Array.isArray(audioVolumeKeyframes)) {
      throw new ProjectValidationError(
        fieldPrefix + " audioVolumeKeyframes must be an array.",
      );
    }

    const keyframeTimes = new Set<number>();
    for (let index = 0; index < audioVolumeKeyframes.length; index += 1) {
      const keyframe = audioVolumeKeyframes[index];
      const keyframePrefix =
        fieldPrefix + " audioVolumeKeyframes[" + index + "]";

      if (!isRecord(keyframe)) {
        throw new ProjectValidationError(keyframePrefix + " must be an object.");
      }

      assertFiniteNonNegativeNumber(
        keyframe.timeMs,
        keyframePrefix + " timeMs",
      );
      if (!isFiniteNumber(keyframe.volume) || keyframe.volume < 0 || keyframe.volume > 1) {
        throw new ProjectValidationError(
          keyframePrefix + " volume must be between 0 and 1.",
        );
      }

      if (keyframeTimes.has(keyframe.timeMs)) {
        throw new ProjectValidationError(
          keyframePrefix + " duplicates a previous timeMs.",
        );
      }
      keyframeTimes.add(keyframe.timeMs);

      if (
        clip.sourceEndMs !== null &&
        clip.sourceEndMs !== undefined &&
        keyframe.timeMs > Number(clip.sourceEndMs) - Number(clip.sourceStartMs)
      ) {
        throw new ProjectValidationError(
          keyframePrefix + " timeMs must be inside the clip duration.",
        );
      }
    }
  }
}

function assertMediaType(value: unknown, field: string): asserts value is MediaType {
  if (value !== "audio" && value !== "image" && value !== "video") {
    throw new ProjectValidationError(
      field + " must be audio, image, or video.",
    );
  }
}

function assertFiniteNonNegativeNumber(value: unknown, field: string): asserts value is number {
  if (!isFiniteNumber(value) || value < 0) {
    throw new ProjectValidationError(field + " must be a finite non-negative number.");
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

export function getVisualEffects(clip: Clip): VisualEffects {
  const value = clip.visualEffects;

  return {
    brightness: normalizeVisualEffectValue(
      value?.brightness,
      DEFAULT_VISUAL_EFFECT_BRIGHTNESS,
    ),
    contrast: normalizeVisualEffectValue(
      value?.contrast,
      DEFAULT_VISUAL_EFFECT_CONTRAST,
    ),
    saturation: normalizeVisualEffectValue(
      value?.saturation,
      DEFAULT_VISUAL_EFFECT_SATURATION,
    ),
  };
}

function normalizeVisualEffectValue(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(-1, Math.round(value * 100) / 100));
}

export function getTextOverlay(clip: Clip): TextOverlay | undefined {
  return normalizeTextOverlay(clip.textOverlay);
}

export function normalizeTextOverlay(value: unknown): TextOverlay | undefined {
  if (!isRecord(value) || typeof value.text !== "string") {
    return undefined;
  }

  const text = value.text.trim().slice(0, MAX_TEXT_OVERLAY_LENGTH);

  if (!text) {
    return undefined;
  }

  const alignment: TextOverlayAlignment =
    value.alignment === "left" ||
    value.alignment === "right" ||
    value.alignment === "center"
      ? value.alignment
      : DEFAULT_TEXT_OVERLAY_ALIGNMENT;

  return {
    text,
    x: normalizeTextOverlayPosition(value.x, DEFAULT_TEXT_OVERLAY_X),
    y: normalizeTextOverlayPosition(value.y, DEFAULT_TEXT_OVERLAY_Y),
    fontSize: normalizeTextOverlayFontSize(
      value.fontSize,
      DEFAULT_TEXT_OVERLAY_FONT_SIZE,
    ),
    color: normalizeTextOverlayColor(value.color),
    alignment,
  };
}

function normalizeTextOverlayPosition(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, Math.round(value * 1000) / 1000));
}

function normalizeTextOverlayFontSize(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(240, Math.max(12, Math.round(value)));
}

function normalizeTextOverlayColor(value: unknown): string {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return DEFAULT_TEXT_OVERLAY_COLOR;
  }

  return value.toLowerCase();
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

export function getAudioCompressor(clip: Clip): AudioCompressor {
  const value = clip.audioCompressor;

  return {
    enabled: value?.enabled === true,
    thresholdDb: normalizeAudioCompressorThreshold(
      value?.thresholdDb,
      DEFAULT_AUDIO_COMPRESSOR_THRESHOLD_DB,
    ),
    ratio: normalizeAudioCompressorRatio(
      value?.ratio,
      DEFAULT_AUDIO_COMPRESSOR_RATIO,
    ),
    attackMs: normalizeAudioCompressorTime(
      value?.attackMs,
      DEFAULT_AUDIO_COMPRESSOR_ATTACK_MS,
      0.01,
      2000,
    ),
    releaseMs: normalizeAudioCompressorTime(
      value?.releaseMs,
      DEFAULT_AUDIO_COMPRESSOR_RELEASE_MS,
      0.01,
      9000,
    ),
  };
}

function normalizeAudioCompressorThreshold(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const rounded = Math.round(Math.abs(value) * 10) / 10;
  return Math.min(0, Math.max(-60, value < 0 ? -rounded : rounded));
}

function normalizeAudioCompressorRatio(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(20, Math.max(1, Math.round(value * 10) / 10));
}

function normalizeAudioCompressorTime(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value * 100) / 100));
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
