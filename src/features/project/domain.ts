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
export const MAX_CANVAS_FRAME_RATE = 240;

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
  if (value.name !== value.name.trim()) {
    throw new ProjectValidationError("Project name must be trimmed.");
  }
  assertIsoTimestamp(value.createdAt, "Project createdAt");
  assertIsoTimestamp(value.updatedAt, "Project updatedAt");

  if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) {
    throw new ProjectValidationError(
      "Project updatedAt must be the same as or later than createdAt.",
    );
  }

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
      (!isFiniteNumber(asset.durationMs) ||
        !Number.isInteger(asset.durationMs) ||
        asset.durationMs < 0)
    ) {
      throw new ProjectValidationError(
        fieldPrefix +
          " durationMs must be null or a non-negative integer number of milliseconds.",
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
      track.volume !== undefined &&
      normalizeTrackVolume(track.volume) !== track.volume
    ) {
      throw new ProjectValidationError(
        fieldPrefix + " volume must use at most two decimal places.",
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

    if (
      track.pan !== undefined &&
      normalizeTrackPan(track.pan) !== track.pan
    ) {
      throw new ProjectValidationError(
        fieldPrefix + " pan must use at most two decimal places.",
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

    validateTrackTopology(track, trackIndex, assetById);
  }
}

function validateTrackTopology(
  track: Record<string, unknown>,
  trackIndex: number,
  assetById: Map<string, MediaAsset>,
): void {
  const clips = track.clips as unknown[];
  const orderedClips = clips
    .map((clip, index) => ({
      clip: clip as Record<string, unknown>,
      index,
    }))
    .sort((left, right) => {
      const startDelta =
        Number(left.clip.timelineStartMs) - Number(right.clip.timelineStartMs);
      return startDelta !== 0 ? startDelta : left.index - right.index;
    });

  for (let index = 1; index < orderedClips.length; index += 1) {
    const previous = orderedClips[index - 1].clip;
    const current = orderedClips[index].clip;
    const previousEnd =
      Number(previous.timelineStartMs) +
      (previous.sourceEndMs === null
        ? 0
        : Number(previous.sourceEndMs) - Number(previous.sourceStartMs));

    if (previousEnd > Number(current.timelineStartMs)) {
      throw new ProjectValidationError(
        "Track " +
          trackIndex +
          " contains overlapping clips at indices " +
          orderedClips[index - 1].index +
          " and " +
          orderedClips[index].index +
          ".",
      );
    }
  }

  for (const { clip, index } of orderedClips) {
    if (clip.transitionOut === undefined) {
      continue;
    }

    const asset = assetById.get(String(clip.assetId));
    if (
      track.type !== "video" ||
      !asset ||
      (asset.mediaType !== "video" && asset.mediaType !== "image")
    ) {
      throw new ProjectValidationError(
        "Clip " +
          trackIndex +
          "." +
          index +
          " transitionOut requires a visual clip on a video track.",
      );
    }

    const position = orderedClips.findIndex(
      (candidate) => candidate.index === index,
    );
    const next = position >= 0 ? orderedClips[position + 1]?.clip : undefined;

    if (!next) {
      throw new ProjectValidationError(
        "Clip " + trackIndex + "." + index + " transitionOut requires a following clip.",
      );
    }

    const nextAsset = assetById.get(String(next.assetId));
    if (
      !nextAsset ||
      (nextAsset.mediaType !== "video" && nextAsset.mediaType !== "image")
    ) {
      throw new ProjectValidationError(
        "Clip " +
          trackIndex +
          "." +
          index +
          " transitionOut requires the following clip to be visual.",
      );
    }

    const outgoingEnd =
      Number(clip.timelineStartMs) +
      (clip.sourceEndMs === null
        ? 0
        : Number(clip.sourceEndMs) - Number(clip.sourceStartMs));

    if (outgoingEnd !== Number(next.timelineStartMs)) {
      throw new ProjectValidationError(
        "Clip " +
          trackIndex +
          "." +
          index +
          " transitionOut requires directly adjacent clips.",
      );
    }

    const outgoingDuration =
      clip.sourceEndMs === null
        ? 0
        : Number(clip.sourceEndMs) - Number(clip.sourceStartMs);
    const incomingDuration =
      next.sourceEndMs === null
        ? 0
        : Number(next.sourceEndMs) - Number(next.sourceStartMs);
    const transitionDuration = (
      clip.transitionOut as Record<string, unknown>
    ).durationMs;

    if (
      !isFiniteNumber(transitionDuration) ||
      transitionDuration > outgoingDuration ||
      transitionDuration > incomingDuration
    ) {
      throw new ProjectValidationError(
        "Clip " +
          trackIndex +
          "." +
          index +
          " transitionOut duration cannot exceed either adjacent clip duration.",
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

  assertFiniteNonNegativeIntegerMilliseconds(
    value.timelineStartMs,
    fieldPrefix + " timelineStartMs",
  );
  assertFiniteNonNegativeIntegerMilliseconds(
    value.sourceStartMs,
    fieldPrefix + " sourceStartMs",
  );

  if (value.sourceEndMs === null) {
    // Unknown source duration is allowed for persisted projects.
  } else if (value.sourceEndMs === undefined) {
    throw new ProjectValidationError(
      fieldPrefix + " sourceEndMs must be a number or null.",
    );
  } else {
    assertFiniteNonNegativeIntegerMilliseconds(
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

  if (asset.mediaType === "audio") {
    rejectVisualPayloads(value, fieldPrefix);
  } else {
    validateVisualPayloads(value, fieldPrefix);
  }

  validateOptionalAudioFields(value, fieldPrefix, track.type, asset.mediaType);
}

function validateVisualPayloads(
  clip: Record<string, unknown>,
  fieldPrefix: string,
): void {
  validateTransformPayload(clip.transform, fieldPrefix + " transform");
  validateAnchorPayload(clip.transformAnchor, fieldPrefix + " transformAnchor");
  validateCropPayload(clip.crop, fieldPrefix + " crop");
  validateCropPositionPayload(
    clip.cropPosition,
    fieldPrefix + " cropPosition",
  );
  validateVisualEffectsPayload(
    clip.visualEffects,
    fieldPrefix + " visualEffects",
  );
  validateTextOverlayPayload(
    clip.textOverlay,
    fieldPrefix + " textOverlay",
  );
  validateTransformKeyframesPayload(
    clip.transformKeyframes,
    clip,
    fieldPrefix + " transformKeyframes",
  );
  validateTransitionPayload(
    clip.transitionOut,
    fieldPrefix + " transitionOut",
  );
}

function rejectVisualPayloads(
  clip: Record<string, unknown>,
  fieldPrefix: string,
): void {
  for (const field of [
    "transform",
    "transformAnchor",
    "crop",
    "cropPosition",
    "visualEffects",
    "textOverlay",
    "transformKeyframes",
    "transitionOut",
  ]) {
    if (clip[field] !== undefined) {
      throw new ProjectValidationError(
        fieldPrefix + " " + field + " is only available for visual clips.",
      );
    }
  }
}

function validateTransformPayload(
  value: unknown,
  field: string,
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    throw new ProjectValidationError(field + " must be an object.");
  }

  for (const [key, minimum, maximum] of [
    ["x", -100, 100],
    ["y", -100, 100],
    ["scale", 0.05, 10],
    ["opacity", 0, 1],
  ] as const) {
    const entry = value[key];
    if (!isFiniteNumber(entry) || entry < minimum || entry > maximum) {
      throw new ProjectValidationError(
        field + " " + key + " is outside the supported range.",
      );
    }

    if (
      (key === "scale" || key === "opacity") &&
      Math.round(entry * 100) / 100 !== entry
    ) {
      throw new ProjectValidationError(
        field + " " + key + " must use at most two decimal places.",
      );
    }
  }

  if (!isFiniteNumber(value.rotation)) {
    throw new ProjectValidationError(
      field + " rotation must be a finite number.",
    );
  }

  if (value.rotation < -180 || value.rotation > 180) {
    throw new ProjectValidationError(
      field + " rotation must be between -180 and 180 degrees.",
    );
  }
}

function validateAnchorPayload(value: unknown, field: string): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    throw new ProjectValidationError(field + " must be an object.");
  }

  for (const key of ["x", "y"] as const) {
    const entry = value[key];
    if (!isFiniteNumber(entry) || entry < 0 || entry > 1) {
      throw new ProjectValidationError(
        field + " " + key + " must be between 0 and 1.",
      );
    }

  }
}

function validateCropPayload(value: unknown, field: string): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    throw new ProjectValidationError(field + " must be an object.");
  }

  for (const key of ["top", "right", "bottom", "left"] as const) {
    const entry = value[key];
    if (!isFiniteNumber(entry) || entry < 0 || entry > 0.99) {
      throw new ProjectValidationError(
        field + " " + key + " must be between 0 and 0.99.",
      );
    }
  }

  if (
    Number(value.left) + Number(value.right) >= 1 ||
    Number(value.top) + Number(value.bottom) >= 1
  ) {
    throw new ProjectValidationError(
      field + " must leave a positive visible region.",
    );
  }
}

function validateCropPositionPayload(
  value: unknown,
  field: string,
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    throw new ProjectValidationError(field + " must be an object.");
  }

  for (const key of ["x", "y"] as const) {
    const entry = value[key];
    if (!isFiniteNumber(entry) || entry < 0 || entry > 1) {
      throw new ProjectValidationError(
        field + " " + key + " must be between 0 and 1.",
      );
    }
  }
}

function validateVisualEffectsPayload(
  value: unknown,
  field: string,
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    throw new ProjectValidationError(field + " must be an object.");
  }

  for (const key of ["brightness", "contrast", "saturation"] as const) {
    const entry = value[key];
    if (!isFiniteNumber(entry) || entry < -1 || entry > 1) {
      throw new ProjectValidationError(
        field + " " + key + " must be between -1 and 1.",
      );
    }

    if (Math.round(entry * 100) / 100 !== entry) {
      throw new ProjectValidationError(
        field + " " + key + " must use at most two decimal places.",
      );
    }
  }
}

function validateTextOverlayPayload(
  value: unknown,
  field: string,
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    throw new ProjectValidationError(field + " must be an object.");
  }

  if (typeof value.text !== "string" || value.text.trim().length === 0) {
    throw new ProjectValidationError(field + " text must be non-empty.");
  }

  if (value.text !== value.text.trim()) {
    throw new ProjectValidationError(
      field + " text must be trimmed.",
    );
  }

  if (value.text.trim().length > MAX_TEXT_OVERLAY_LENGTH) {
    throw new ProjectValidationError(
      field + " text exceeds the supported length.",
    );
  }

  for (const key of ["x", "y"] as const) {
    const entry = value[key];
    if (!isFiniteNumber(entry) || entry < 0 || entry > 1) {
      throw new ProjectValidationError(
        field + " " + key + " must be between 0 and 1.",
      );
    }

    if (Math.round(entry * 100) / 100 !== entry) {
      throw new ProjectValidationError(
        field + " " + key + " must use at most two decimal places.",
      );
    }
  }

  if (
    !isFiniteNumber(value.fontSize) ||
    !Number.isInteger(value.fontSize) ||
    value.fontSize < 12 ||
    value.fontSize > 240
  ) {
    throw new ProjectValidationError(
      field + " fontSize must be an integer between 12 and 240.",
    );
  }

  if (
    typeof value.color !== "string" ||
    !/^#[0-9a-f]{6}$/.test(value.color)
  ) {
    throw new ProjectValidationError(
      field + " color must be a lowercase six-digit hex color.",
    );
  }

  if (
    value.alignment !== "left" &&
    value.alignment !== "center" &&
    value.alignment !== "right"
  ) {
    throw new ProjectValidationError(
      field + " alignment is invalid.",
    );
  }
}

function validateTransformKeyframesPayload(
  value: unknown,
  clip: Record<string, unknown>,
  field: string,
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    throw new ProjectValidationError(field + " must be an array.");
  }

  const times = new Set<number>();
  let previousTimeMs: number | undefined;
  const durationMs =
    clip.sourceEndMs === null || clip.sourceEndMs === undefined
      ? null
      : Number(clip.sourceEndMs) - Number(clip.sourceStartMs);

  for (let index = 0; index < value.length; index += 1) {
    const keyframe = value[index];
    const keyframeField = field + "[" + index + "]";

    if (!isRecord(keyframe)) {
      throw new ProjectValidationError(keyframeField + " must be an object.");
    }

    assertFiniteNonNegativeNumber(keyframe.timeMs, keyframeField + " timeMs");

    if (!Number.isInteger(keyframe.timeMs)) {
      throw new ProjectValidationError(
        keyframeField + " timeMs must be an integer number of milliseconds.",
      );
    }

    if (durationMs !== null && keyframe.timeMs > durationMs) {
      throw new ProjectValidationError(
        keyframeField + " timeMs must be inside the clip duration.",
      );
    }

    if (times.has(keyframe.timeMs)) {
      throw new ProjectValidationError(
        keyframeField + " duplicates a previous timeMs.",
      );
    }

    if (!isRecord(keyframe.transform)) {
      throw new ProjectValidationError(
        keyframeField + " transform must be an object.",
      );
    }

    if (previousTimeMs !== undefined && keyframe.timeMs < previousTimeMs) {
      throw new ProjectValidationError(
        keyframeField + " timeMs must be in strictly increasing order.",
      );
    }

    times.add(keyframe.timeMs);
    previousTimeMs = keyframe.timeMs;

    validateTransformPayload(
      keyframe.transform,
      keyframeField + " transform",
    );

    if (
      keyframe.easing !== undefined &&
      keyframe.easing !== "linear" &&
      keyframe.easing !== "ease-in" &&
      keyframe.easing !== "ease-out" &&
      keyframe.easing !== "ease-in-out"
    ) {
      throw new ProjectValidationError(
        keyframeField + " easing is invalid.",
      );
    }
  }
}

function validateTransitionPayload(
  value: unknown,
  field: string,
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    throw new ProjectValidationError(field + " must be an object.");
  }

  if (
    value.type !== "dissolve" &&
    value.type !== "fade-through-black"
  ) {
    throw new ProjectValidationError(field + " type is invalid.");
  }

  if (
    !isFiniteNumber(value.durationMs) ||
    !Number.isInteger(value.durationMs) ||
    value.durationMs < 50 ||
    value.durationMs > 2000
  ) {
    throw new ProjectValidationError(
      field + " durationMs must be an integer between 50 and 2000.",
    );
  }
}

function validateOptionalAudioFields(
  clip: Record<string, unknown>,
  fieldPrefix: string,
  trackType: TrackType,
  mediaType: MediaType,
): void {
  const isAudioBearingClip =
    (trackType === "audio" && mediaType === "audio") ||
    (trackType === "video" && mediaType === "video");

  for (const field of [
    "audioFadeInMs",
    "audioFadeOutMs",
    "audioEq",
    "audioCompressor",
    "audioVolumeKeyframes",
  ] as const) {
    if (clip[field] !== undefined && !isAudioBearingClip) {
      throw new ProjectValidationError(
        fieldPrefix + " " + field + " is only available for audio-bearing clips.",
      );
    }
  }

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

  if (clip.audioFadeInMs !== undefined || clip.audioFadeOutMs !== undefined) {
    const fadeInMs = clip.audioFadeInMs === undefined ? 0 : Number(clip.audioFadeInMs);
    const fadeOutMs = clip.audioFadeOutMs === undefined ? 0 : Number(clip.audioFadeOutMs);

    if (clip.sourceEndMs === null) {
      if (fadeInMs > 0 || fadeOutMs > 0) {
        throw new ProjectValidationError(
          fieldPrefix + " audio fade durations require a known clip duration.",
        );
      }
    } else {
      const durationMs = Number(clip.sourceEndMs) - Number(clip.sourceStartMs);

      if (fadeInMs > durationMs || fadeOutMs > durationMs) {
        throw new ProjectValidationError(
          fieldPrefix + " audio fade duration cannot exceed the clip duration.",
        );
      }

      if (fadeInMs + fadeOutMs > durationMs) {
        throw new ProjectValidationError(
          fieldPrefix + " audio fade-in and fade-out cannot overlap.",
        );
      }
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

      if (Math.round(value * 10) / 10 !== value) {
        throw new ProjectValidationError(
          fieldPrefix + " audioEq " + field + " must use at most one decimal place.",
        );
      }
    }
  }

  const audioCompressor = clip.audioCompressor;
  if (audioCompressor !== undefined) {
    if (!isRecord(audioCompressor)) {
      throw new ProjectValidationError(
        fieldPrefix + " audioCompressor must be an object.",
      );
    }

    if (typeof audioCompressor.enabled !== "boolean") {
      throw new ProjectValidationError(
        fieldPrefix + " audioCompressor enabled must be a boolean.",
      );
    }

    const thresholdDb = audioCompressor.thresholdDb;
    const ratio = audioCompressor.ratio;
    const attackMs = audioCompressor.attackMs;
    const releaseMs = audioCompressor.releaseMs;

    if (!isFiniteNumber(thresholdDb) || thresholdDb < -60 || thresholdDb > 0) {
      throw new ProjectValidationError(
        fieldPrefix + " audioCompressor thresholdDb must be between -60 and 0.",
      );
    }

    if (Math.round(thresholdDb * 10) / 10 !== thresholdDb) {
      throw new ProjectValidationError(
        fieldPrefix + " audioCompressor thresholdDb must use at most one decimal place.",
      );
    }

    if (!isFiniteNumber(ratio) || ratio < 1 || ratio > 20) {
      throw new ProjectValidationError(
        fieldPrefix + " audioCompressor ratio must be between 1 and 20.",
      );
    }

    if (Math.round(ratio * 10) / 10 !== ratio) {
      throw new ProjectValidationError(
        fieldPrefix + " audioCompressor ratio must use at most one decimal place.",
      );
    }

    if (!isFiniteNumber(attackMs) || attackMs < 0.01 || attackMs > 2000) {
      throw new ProjectValidationError(
        fieldPrefix + " audioCompressor attackMs must be between 0.01 and 2000.",
      );
    }

    if (Math.round(attackMs * 100) / 100 !== attackMs) {
      throw new ProjectValidationError(
        fieldPrefix + " audioCompressor attackMs must use at most two decimal places.",
      );
    }

    if (!isFiniteNumber(releaseMs) || releaseMs < 0.01 || releaseMs > 9000) {
      throw new ProjectValidationError(
        fieldPrefix + " audioCompressor releaseMs must be between 0.01 and 9000.",
      );
    }

    if (Math.round(releaseMs * 100) / 100 !== releaseMs) {
      throw new ProjectValidationError(
        fieldPrefix + " audioCompressor releaseMs must use at most two decimal places.",
      );
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
    let previousTimeMs: number | undefined;
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
      if (!Number.isInteger(keyframe.timeMs)) {
        throw new ProjectValidationError(
          keyframePrefix + " timeMs must be an integer number of milliseconds.",
        );
      }
      if (!isFiniteNumber(keyframe.volume) || keyframe.volume < 0 || keyframe.volume > 1) {
        throw new ProjectValidationError(
          keyframePrefix + " volume must be between 0 and 1.",
        );
      }

      if (Math.round(keyframe.volume * 1000) / 1000 !== keyframe.volume) {
        throw new ProjectValidationError(
          keyframePrefix + " volume must use at most three decimal places.",
        );
      }

      if (keyframeTimes.has(keyframe.timeMs)) {
        throw new ProjectValidationError(
          keyframePrefix + " duplicates a previous timeMs.",
        );
      }

      if (previousTimeMs !== undefined && keyframe.timeMs < previousTimeMs) {
        throw new ProjectValidationError(
          keyframePrefix + " timeMs must be in strictly increasing order.",
        );
      }

      keyframeTimes.add(keyframe.timeMs);
      previousTimeMs = keyframe.timeMs;

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

function assertFiniteNonNegativeIntegerMilliseconds(
  value: unknown,
  field: string,
): asserts value is number {
  if (!isFiniteNumber(value) || !Number.isInteger(value) || value < 0) {
    throw new ProjectValidationError(
      field + " must be a non-negative integer number of milliseconds.",
    );
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

  assertPositiveInteger(value.width, "Canvas width");
  assertPositiveInteger(value.height, "Canvas height");
  assertPositiveNumber(value.frameRate, "Canvas frameRate");

  if (value.frameRate > MAX_CANVAS_FRAME_RATE) {
    throw new ProjectValidationError(
      "Canvas frameRate must be at most 240 fps.",
    );
  }
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProjectValidationError(`${field} must be a non-empty string.`);
  }
}

function assertIsoTimestamp(value: unknown, field: string): asserts value is string {
  assertNonEmptyString(value, field);

  if (
    !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new ProjectValidationError(
      `${field} must be a canonical UTC ISO timestamp.`,
    );
  }
}

function assertPositiveInteger(
  value: unknown,
  field: string,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new ProjectValidationError(
      `${field} must be a positive integer.`,
    );
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

export function normalizeTrackVolume(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

export function normalizeTrackPan(value: number): number {
  return Math.min(1, Math.max(-1, Math.round(value * 100) / 100));
}

export function getTrackVolume(track: Track): number {
  const volume = track.volume;

  if (typeof volume !== "number" || !Number.isFinite(volume)) {
    return DEFAULT_TRACK_VOLUME;
  }

  return normalizeTrackVolume(volume);
}


export function getTrackPan(track: Track): number {
  const pan = track.pan;

  if (typeof pan !== "number" || !Number.isFinite(pan)) {
    return DEFAULT_TRACK_PAN;
  }

  return normalizeTrackPan(pan);
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

  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
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