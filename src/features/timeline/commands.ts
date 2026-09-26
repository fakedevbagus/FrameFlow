import {
  getAudioEq,
  getAudioFadeDurations,
  getVisualEffects,
  getTextOverlay,
  getAudioCompressor,
  normalizeTrackVolume,
  normalizeTrackPan,
  normalizeTextOverlay,
  type AudioCompressor,
  type AudioEq,
  type VisualEffects,
  type TextOverlay,
  type TransformAnchor,
  type ClipCrop,
  type CropPosition,
  type Clip,
  type ClipTransform,
  type Project,
  type TrackType,
  type TransformEasing,
  type ClipTransition,
} from "../project/domain";
import {
  DEFAULT_CLIP_TRANSFORM,
  getClipTransform,
  getClipTransformAtTime,
  getClipTransformAnchor,
  getTransformKeyframeAtTime,
  isValidClipCrop,
  normalizeClipTransform,
  normalizeTransformKeyframeTime,
  normalizeTransformAnchor,
  compensateTransformForAnchorChange,
  normalizeClipCrop,
  normalizeClipCropPosition,
  removeTransformKeyframe as removeTransformKeyframeAtTime,
  upsertTransformKeyframe,
} from "../transform/transform";
import {
  getAudioVolumeAtTime,
  getAudioVolumeKeyframeAtTime,
  normalizeAudioVolumeKeyframes,
  removeAudioVolumeKeyframe,
  upsertAudioVolumeKeyframe,
} from "../audio/automation";
import {
  getNextClipForTransition,
  normalizeClipTransition,
  sanitizeTrackTransitions,
} from "../transition/transition";

const defaultImageDurationMs = 3000;

export function updateCanvasDimensions(
  project: Project,
  width: number,
  height: number,
  now: Date = new Date(),
): Project {
  if (
    !Number.isFinite(width) ||
    !Number.isInteger(width) ||
    width <= 0 ||
    width % 2 !== 0 ||
    !Number.isFinite(height) ||
    !Number.isInteger(height) ||
    height <= 0 ||
    height % 2 !== 0
  ) {
    throw new Error("Canvas dimensions must be positive even integers.");
  }

  return {
    ...project,
    canvas: {
      ...project.canvas,
      width,
      height,
    },
    updatedAt: now.toISOString(),
  };
}

export function updateClipTransformAnchorWithCompensation(
  project: Project,
  clipId: string,
  anchor: TransformAnchor,
  contentBounds: { widthPercent: number; heightPercent: number },
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find((candidate) => candidate.id === location.clip.assetId);

  if (!asset || (asset.mediaType !== "video" && asset.mediaType !== "image")) {
    throw new Error("Transform anchors are only available for visual media.");
  }

  const currentAnchor = getClipTransformAnchor(location.clip.transformAnchor);
  const nextAnchor = normalizeTransformAnchor(anchor);

  if (
    currentAnchor.x === nextAnchor.x &&
    currentAnchor.y === nextAnchor.y
  ) {
    return project;
  }

  const transform = compensateTransformForAnchorChange(
    getClipTransform(location.clip.transform),
    currentAnchor,
    nextAnchor,
    contentBounds,
  );
  const normalizedKeyframes = location.clip.transformKeyframes
    ? location.clip.transformKeyframes.map((keyframe) => ({
        ...keyframe,
        transform: compensateTransformForAnchorChange(
          keyframe.transform,
          currentAnchor,
          nextAnchor,
          contentBounds,
        ),
      }))
    : undefined;

  return updateClipAtLocation(
    project,
    location,
    {
      transformAnchor: nextAnchor,
      transform,
      transformKeyframes: normalizedKeyframes,
    },
    now,
  );
}

export function updateClipTransformAnchor(
  project: Project,
  clipId: string,
  anchor: TransformAnchor,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find((candidate) => candidate.id === location.clip.assetId);

  if (!asset || (asset.mediaType !== "video" && asset.mediaType !== "image")) {
    throw new Error("Transform anchors are only available for visual media.");
  }

  return updateClipAtLocation(
    project,
    location,
    { transformAnchor: normalizeTransformAnchor(anchor) },
    now,
  );
}

export function updateClipCrop(
  project: Project,
  clipId: string,
  crop: ClipCrop,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find((candidate) => candidate.id === location.clip.assetId);

  if (!asset || (asset.mediaType !== "video" && asset.mediaType !== "image")) {
    throw new Error("Crop controls are only available for visual media.");
  }

  const normalizedCrop = normalizeClipCrop(crop);

  if (!isValidClipCrop(normalizedCrop)) {
    throw new Error("Crop cannot remove the entire visual content.");
  }

  return updateClipAtLocation(
    project,
    location,
    {
      crop: normalizedCrop,
      cropPosition:
        normalizedCrop.top === 0 &&
        normalizedCrop.right === 0 &&
        normalizedCrop.bottom === 0 &&
        normalizedCrop.left === 0
          ? undefined
          : location.clip.cropPosition,
    },
    now,
  );
}

export function updateClipCropWithPosition(
  project: Project,
  clipId: string,
  crop: ClipCrop,
  position: CropPosition | undefined,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find((candidate) => candidate.id === location.clip.assetId);

  if (!asset || (asset.mediaType !== "video" && asset.mediaType !== "image")) {
    throw new Error("Crop controls are only available for visual media.");
  }

  const normalizedCrop = normalizeClipCrop(crop);

  if (!isValidClipCrop(normalizedCrop)) {
    throw new Error("Crop cannot remove the entire visual content.");
  }

  const hasCrop =
    normalizedCrop.top > 0 ||
    normalizedCrop.right > 0 ||
    normalizedCrop.bottom > 0 ||
    normalizedCrop.left > 0;

  return updateClipAtLocation(
    project,
    location,
    {
      crop: normalizedCrop,
      cropPosition: hasCrop
        ? normalizeClipCropPosition(normalizedCrop, position)
        : undefined,
    },
    now,
  );
}

export function updateClipCropPosition(
  project: Project,
  clipId: string,
  position: CropPosition,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find((candidate) => candidate.id === location.clip.assetId);

  if (!asset || (asset.mediaType !== "video" && asset.mediaType !== "image")) {
    throw new Error("Crop position controls are only available for visual media.");
  }

  const crop = normalizeClipCrop(location.clip.crop);

  if (!isValidClipCrop(crop)) {
    throw new Error("Crop cannot remove the entire visual content.");
  }

  return updateClipAtLocation(
    project,
    location,
    {
      cropPosition: normalizeClipCropPosition(crop, position),
    },
    now,
  );
}

export function addAssetToTimeline(
  project: Project,
  assetId: string,
  now: Date = new Date(),
): Project {
  const asset = project.assets.find((candidate) => candidate.id === assetId);

  if (!asset) {
    throw new Error("Asset does not exist in this project.");
  }

  const trackType: TrackType = asset.mediaType === "audio" ? "audio" : "video";
  const track = project.tracks.find((candidate) => candidate.type === trackType);

  if (!track) {
    throw new Error(`Project has no ${trackType} track.`);
  }

  const timelineStartMs = track.clips.reduce(
    (latest, clip) =>
      Math.max(
        latest,
        addSafeTimelineMilliseconds(
          clip.timelineStartMs,
          clipDuration(clip),
          `Timeline clip ${clip.id} end`,
        ),
      ),
    0,
  );

  return addAssetToTrack(project, assetId, track.id, timelineStartMs, now);
}

export function addAssetToTrack(
  project: Project,
  assetId: string,
  trackId: string,
  timelineStartMs: number | null = null,
  now: Date = new Date(),
): Project {
  const asset = project.assets.find((candidate) => candidate.id === assetId);
  const trackIndex = project.tracks.findIndex((candidate) => candidate.id === trackId);

  if (!asset) {
    throw new Error("Asset does not exist in this project.");
  }

  if (trackIndex === -1) {
    throw new Error("Track does not exist in this project.");
  }

  const track = project.tracks[trackIndex];

  if (track.isLocked) {
    throw new Error("Track is locked.");
  }

  const compatible =
    track.type === "audio"
      ? asset.mediaType === "audio"
      : asset.mediaType === "video" || asset.mediaType === "image";

  if (!compatible) {
    throw new Error(
      `Cannot add ${asset.mediaType} media to a ${track.type} track.`,
    );
  }

  const durationMs = asset.durationMs ?? defaultImageDurationMs;

  if (
    timelineStartMs !== null &&
    (!Number.isFinite(timelineStartMs) || timelineStartMs < 0)
  ) {
    throw new Error("Clip timeline position must be zero or greater.");
  }

  const requestedStartMs =
    timelineStartMs === null
      ? track.clips.reduce(
          (latest, clip) =>
            Math.max(
              latest,
              addSafeTimelineMilliseconds(
                clip.timelineStartMs,
                clipDuration(clip),
                `Timeline clip ${clip.id} end`,
              ),
            ),
          0,
        )
      : Math.round(timelineStartMs);

  const candidateEndMs = addSafeTimelineMilliseconds(
    requestedStartMs,
    durationMs,
    `Clip ${asset.id} timeline end`,
  );

  if (
    hasTimelineOverlap(
      track,
      "",
      requestedStartMs,
      candidateEndMs,
    )
  ) {
    throw new Error("Media cannot overlap another clip on the same track.");
  }

  const clip: Clip = {
    id: crypto.randomUUID(),
    assetId: asset.id,
    timelineStartMs: requestedStartMs,
    sourceStartMs: 0,
    sourceEndMs: durationMs,
    transform: { ...DEFAULT_CLIP_TRANSFORM },
  };

  const tracks = project.tracks.map((candidate, index) =>
    index === trackIndex
      ? { ...candidate, clips: [...candidate.clips, clip] }
      : candidate,
  );

  return { ...project, tracks, updatedAt: now.toISOString() };
}

export function addTrack(
  project: Project,
  type: TrackType,
  now: Date = new Date(),
): Project {
  const label = type === "video" ? "Video" : "Audio";
  const existingNames = new Set(
    project.tracks
      .filter((track) => track.type === type)
      .map((track) => track.name),
  );
  let nextNumber = 1;

  while (existingNames.has(`${label} ${nextNumber}`)) {
    nextNumber += 1;
  }

  const track = {
    id: crypto.randomUUID(),
    name: `${label} ${nextNumber}`,
    type,
    isLocked: false,
    isMuted: false,
    clips: [],
  } satisfies Project["tracks"][number];

  const insertionIndex =
    project.tracks.reduce(
      (lastIndex, candidate, index) =>
        candidate.type === type ? index + 1 : lastIndex,
      0,
    );

  return {
    ...project,
    tracks: [
      ...project.tracks.slice(0, insertionIndex),
      track,
      ...project.tracks.slice(insertionIndex),
    ],
    updatedAt: now.toISOString(),
  };
}

export function removeTrack(
  project: Project,
  trackId: string,
  now: Date = new Date(),
): Project {
  const trackIndex = project.tracks.findIndex((track) => track.id === trackId);

  if (trackIndex === -1) {
    throw new Error("Track does not exist in this project.");
  }

  const track = project.tracks[trackIndex];

  if (track.clips.length > 0) {
    throw new Error("Track must be empty before it can be removed.");
  }

  const remainingSameType = project.tracks.filter(
    (candidate) => candidate.type === track.type,
  );

  if (remainingSameType.length <= 1) {
    throw new Error("The last track of this type cannot be removed.");
  }

  return {
    ...project,
    tracks: project.tracks.filter((_, index) => index !== trackIndex),
    updatedAt: now.toISOString(),
  };
}

function clipDuration(clip: Clip): number {
  return (clip.sourceEndMs ?? clip.sourceStartMs) - clip.sourceStartMs;
}


export function toggleTrackMute(
  project: Project,
  trackId: string,
  now: Date = new Date(),
): Project {
  const trackIndex = project.tracks.findIndex((track) => track.id === trackId);

  if (trackIndex === -1) {
    throw new Error("Track does not exist in this project.");
  }

  const tracks = [...project.tracks];
  const track = tracks[trackIndex];
  tracks[trackIndex] = {
    ...track,
    isMuted: !track.isMuted,
  };

  return { ...project, tracks, updatedAt: now.toISOString() };
}


export function updateTrackVolume(
  project: Project,
  trackId: string,
  volume: number,
  now: Date = new Date(),
): Project {
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
    throw new Error("Track volume must be between 0 and 1.");
  }

  const normalizedVolume = normalizeTrackVolume(volume);

  const trackIndex = project.tracks.findIndex((track) => track.id === trackId);

  if (trackIndex === -1) {
    throw new Error("Track does not exist in this project.");
  }

  const tracks = [...project.tracks];
  tracks[trackIndex] = {
    ...tracks[trackIndex],
    volume: normalizedVolume,
  };

  return { ...project, tracks, updatedAt: now.toISOString() };
}


export function updateTrackPan(
  project: Project,
  trackId: string,
  pan: number,
  now: Date = new Date(),
): Project {
  if (!Number.isFinite(pan) || pan < -1 || pan > 1) {
    throw new Error("Track pan must be between -1 and 1.");
  }

  const normalizedPan = normalizeTrackPan(pan);

  const trackIndex = project.tracks.findIndex((track) => track.id === trackId);

  if (trackIndex === -1) {
    throw new Error("Track does not exist in this project.");
  }

  const tracks = [...project.tracks];
  tracks[trackIndex] = {
    ...tracks[trackIndex],
    pan: normalizedPan,
  };

  return { ...project, tracks, updatedAt: now.toISOString() };
}

export function updateClipTextOverlay(
  project: Project,
  clipId: string,
  overlay: TextOverlay | undefined,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find(
    (candidate) => candidate.id === location.clip.assetId,
  );

  if (
    location.track.type !== "video" ||
    !asset ||
    (asset.mediaType !== "video" && asset.mediaType !== "image")
  ) {
    throw new Error("Text overlays are only available for visual clips.");
  }

  const normalized = normalizeTextOverlay(overlay);
  const current = getTextOverlay(location.clip);

  if (areTextOverlaysEqual(current, normalized)) {
    return project;
  }

  return updateClipAtLocation(
    project,
    location,
    { textOverlay: normalized },
    now,
  );
}

function areTextOverlaysEqual(
  left: TextOverlay | undefined,
  right: TextOverlay | undefined,
): boolean {
  return (
    left?.text === right?.text &&
    left?.x === right?.x &&
    left?.y === right?.y &&
    left?.fontSize === right?.fontSize &&
    left?.color === right?.color &&
    left?.alignment === right?.alignment
  );
}

export function updateClipVisualEffects(
  project: Project,
  clipId: string,
  effects: VisualEffects,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find(
    (candidate) => candidate.id === location.clip.assetId,
  );

  if (
    location.track.type !== "video" ||
    (asset?.mediaType !== "video" && asset?.mediaType !== "image")
  ) {
    throw new Error("Visual effects are only available for visual clips.");
  }

  if (
    !Number.isFinite(effects.brightness) ||
    effects.brightness < -1 ||
    effects.brightness > 1 ||
    !Number.isFinite(effects.contrast) ||
    effects.contrast < -1 ||
    effects.contrast > 1 ||
    !Number.isFinite(effects.saturation) ||
    effects.saturation < -1 ||
    effects.saturation > 1
  ) {
    throw new Error("Visual effect values must be between -1 and 1.");
  }

  const normalized: VisualEffects = {
    brightness: Math.round(effects.brightness * 100) / 100,
    contrast: Math.round(effects.contrast * 100) / 100,
    saturation: Math.round(effects.saturation * 100) / 100,
  };
  const current = getVisualEffects(location.clip);

  if (
    current.brightness === normalized.brightness &&
    current.contrast === normalized.contrast &&
    current.saturation === normalized.saturation
  ) {
    return project;
  }

  const isDefault =
    normalized.brightness === 0 &&
    normalized.contrast === 0 &&
    normalized.saturation === 0;

  return updateClipAtLocation(
    project,
    location,
    { visualEffects: isDefault ? undefined : normalized },
    now,
  );
}

export function updateAudioClipFades(
  project: Project,
  clipId: string,
  fadeInMs: number,
  fadeOutMs: number,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find(
    (candidate) => candidate.id === location.clip.assetId,
  );

  const isAudioBearingClip =
    (location.track.type === "audio" && asset?.mediaType === "audio") ||
    (location.track.type === "video" && asset?.mediaType === "video");

  if (!isAudioBearingClip) {
    throw new Error("Audio fades are only available for audio-bearing clips.");
  }

  if (
    !Number.isFinite(fadeInMs) ||
    !Number.isInteger(fadeInMs) ||
    fadeInMs < 0 ||
    !Number.isFinite(fadeOutMs) ||
    !Number.isInteger(fadeOutMs) ||
    fadeOutMs < 0
  ) {
    throw new Error("Audio fade durations must be non-negative integers.");
  }

  const durationMs = getClipDurationMs(location.clip);

  if (fadeInMs > durationMs || fadeOutMs > durationMs) {
    throw new Error("Audio fade duration cannot exceed the clip duration.");
  }

  if (fadeInMs + fadeOutMs > durationMs) {
    throw new Error("Audio fade-in and fade-out cannot overlap.");
  }

  const current = getAudioFadeDurations(location.clip);

  if (
    current.fadeInMs === fadeInMs &&
    current.fadeOutMs === fadeOutMs
  ) {
    return project;
  }

  return updateClipAtLocation(
    project,
    location,
    {
      audioFadeInMs: fadeInMs || undefined,
      audioFadeOutMs: fadeOutMs || undefined,
    },
    now,
  );
}

export function updateAudioClipEq(
  project: Project,
  clipId: string,
  eq: AudioEq,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find(
    (candidate) => candidate.id === location.clip.assetId,
  );

  const isAudioBearingClip =
    (location.track.type === "audio" && asset?.mediaType === "audio") ||
    (location.track.type === "video" && asset?.mediaType === "video");

  if (!isAudioBearingClip) {
    throw new Error("Audio EQ is only available for audio-bearing clips.");
  }

  if (
    typeof eq.enabled !== "boolean" ||
    !Number.isFinite(eq.lowGainDb) ||
    eq.lowGainDb < -12 ||
    eq.lowGainDb > 12 ||
    !Number.isFinite(eq.midGainDb) ||
    eq.midGainDb < -12 ||
    eq.midGainDb > 12 ||
    !Number.isFinite(eq.highGainDb) ||
    eq.highGainDb < -12 ||
    eq.highGainDb > 12
  ) {
    throw new Error("Audio EQ gains must be between -12 and 12 dB.");
  }

  const normalized: AudioEq = {
    enabled: eq.enabled,
    lowGainDb: Math.round(eq.lowGainDb * 10) / 10,
    midGainDb: Math.round(eq.midGainDb * 10) / 10,
    highGainDb: Math.round(eq.highGainDb * 10) / 10,
  };
  const current = getAudioEq(location.clip);

  if (
    current.enabled === normalized.enabled &&
    current.lowGainDb === normalized.lowGainDb &&
    current.midGainDb === normalized.midGainDb &&
    current.highGainDb === normalized.highGainDb
  ) {
    return project;
  }

  const isDefault =
    !normalized.enabled &&
    normalized.lowGainDb === 0 &&
    normalized.midGainDb === 0 &&
    normalized.highGainDb === 0;

  return updateClipAtLocation(
    project,
    location,
    {
      audioEq: isDefault ? undefined : normalized,
    },
    now,
  );
}

export function updateAudioClipCompressor(
  project: Project,
  clipId: string,
  compressor: AudioCompressor,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find(
    (candidate) => candidate.id === location.clip.assetId,
  );

  const isAudioBearingClip =
    (location.track.type === "audio" && asset?.mediaType === "audio") ||
    (location.track.type === "video" && asset?.mediaType === "video");

  if (!isAudioBearingClip) {
    throw new Error("Audio compression is only available for audio-bearing clips.");
  }

  if (
    typeof compressor.enabled !== "boolean" ||
    !Number.isFinite(compressor.thresholdDb) ||
    compressor.thresholdDb < -60 ||
    compressor.thresholdDb > 0 ||
    !Number.isFinite(compressor.ratio) ||
    compressor.ratio < 1 ||
    compressor.ratio > 20 ||
    !Number.isFinite(compressor.attackMs) ||
    compressor.attackMs < 0.01 ||
    compressor.attackMs > 2000 ||
    !Number.isFinite(compressor.releaseMs) ||
    compressor.releaseMs < 0.01 ||
    compressor.releaseMs > 9000
  ) {
    throw new Error("Audio compressor settings are outside the supported range.");
  }

  const normalized: AudioCompressor = {
    enabled: compressor.enabled,
    thresholdDb:
      compressor.thresholdDb < 0
        ? -Math.round(Math.abs(compressor.thresholdDb) * 10) / 10
        : Math.round(compressor.thresholdDb * 10) / 10,
    ratio: Math.round(compressor.ratio * 10) / 10,
    attackMs: Math.round(compressor.attackMs * 100) / 100,
    releaseMs: Math.round(compressor.releaseMs * 100) / 100,
  };
  const current = getAudioCompressor(location.clip);

  if (
    current.enabled === normalized.enabled &&
    current.thresholdDb === normalized.thresholdDb &&
    current.ratio === normalized.ratio &&
    current.attackMs === normalized.attackMs &&
    current.releaseMs === normalized.releaseMs
  ) {
    return project;
  }

  const isDefault =
    !normalized.enabled &&
    normalized.thresholdDb === -24 &&
    normalized.ratio === 4 &&
    normalized.attackMs === 20 &&
    normalized.releaseMs === 250;

  return updateClipAtLocation(
    project,
    location,
    { audioCompressor: isDefault ? undefined : normalized },
    now,
  );
}

export function updateAudioClipVolumeAtTime(
  project: Project,
  clipId: string,
  timeMs: number,
  volume: number,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find(
    (candidate) => candidate.id === location.clip.assetId,
  );

  if (
    (location.track.type !== "audio" || asset?.mediaType !== "audio") &&
    (location.track.type !== "video" || asset?.mediaType !== "video")
  ) {
    throw new Error(
      "Audio volume automation is only available for audio-bearing clips.",
    );
  }

  const durationMs = getClipDurationMs(location.clip);
  if (
    !Number.isFinite(timeMs) ||
    timeMs < 0 ||
    timeMs > durationMs
  ) {
    throw new Error("Audio volume keyframe time must be inside the clip.");
  }

  if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
    throw new Error("Audio volume must be between 0 and 1.");
  }

  const roundedTimeMs = Math.round(timeMs);
  const normalizedVolume = Math.round(volume * 1000) / 1000;
  const current = getAudioVolumeKeyframeAtTime(
    location.clip.audioVolumeKeyframes,
    roundedTimeMs,
  );

  if (current && current.volume === normalizedVolume) {
    return project;
  }

  const keyframes = upsertAudioVolumeKeyframe(
    location.clip.audioVolumeKeyframes,
    roundedTimeMs,
    normalizedVolume,
  );

  return updateClipAtLocation(
    project,
    location,
    { audioVolumeKeyframes: keyframes },
    now,
  );
}

export function moveAudioClipVolumeKeyframe(
  project: Project,
  clipId: string,
  fromTimeMs: number,
  toTimeMs: number,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find(
    (candidate) => candidate.id === location.clip.assetId,
  );

  const isAudioBearingClip =
    (location.track.type === "audio" && asset?.mediaType === "audio") ||
    (location.track.type === "video" && asset?.mediaType === "video");

  if (!isAudioBearingClip) {
    throw new Error("Audio volume automation is only available for audio-bearing clips.");
  }

  const durationMs = getClipDurationMs(location.clip);
  if (
    !Number.isFinite(fromTimeMs) ||
    !Number.isFinite(toTimeMs) ||
    fromTimeMs < 0 ||
    fromTimeMs > durationMs ||
    toTimeMs < 0 ||
    toTimeMs > durationMs
  ) {
    throw new Error("Audio volume keyframe time must be inside the clip.");
  }

  const normalizedKeyframes = normalizeAudioVolumeKeyframes(
    location.clip.audioVolumeKeyframes,
  );
  const from = Math.round(fromTimeMs);
  const to = Math.round(toTimeMs);
  const index = normalizedKeyframes.findIndex(
    (keyframe) => keyframe.timeMs === from,
  );

  if (index === -1 || to === from) {
    return project;
  }

  if (normalizedKeyframes.some((keyframe) => keyframe.timeMs === to)) {
    throw new Error("Audio volume keyframe time is already occupied.");
  }

  const moved = normalizedKeyframes.map((keyframe, keyframeIndex) =>
    keyframeIndex === index
      ? { ...keyframe, timeMs: to }
      : keyframe,
  );

  moved.sort((a, b) => a.timeMs - b.timeMs);

  return updateClipAtLocation(
    project,
    location,
    { audioVolumeKeyframes: moved },
    now,
  );
}

export function removeAudioClipVolumeKeyframe(
  project: Project,
  clipId: string,
  timeMs: number,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find(
    (candidate) => candidate.id === location.clip.assetId,
  );

  const isAudioBearingClip =
    (location.track.type === "audio" && asset?.mediaType === "audio") ||
    (location.track.type === "video" && asset?.mediaType === "video");

  if (!isAudioBearingClip) {
    throw new Error("Audio volume automation is only available for audio-bearing clips.");
  }

  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new Error("Audio volume keyframe time must be zero or greater.");
  }

  const current = getAudioVolumeKeyframeAtTime(
    location.clip.audioVolumeKeyframes,
    timeMs,
  );

  if (!current) {
    return project;
  }

  const keyframes = removeAudioVolumeKeyframe(
    location.clip.audioVolumeKeyframes,
    timeMs,
  );

  return updateClipAtLocation(
    project,
    location,
    { audioVolumeKeyframes: keyframes.length ? keyframes : undefined },
    now,
  );
}

export function updateClipTransition(
  project: Project,
  clipId: string,
  transition: ClipTransition | undefined,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find((candidate) => candidate.id === location.clip.assetId);

  if (!asset || (asset.mediaType !== "video" && asset.mediaType !== "image")) {
    throw new Error("Transitions are only available for visual media.");
  }

  if (transition === undefined) {
    return updateClipAtLocation(
      project,
      location,
      { transitionOut: undefined },
      now,
    );
  }

  if (
    transition.type !== "dissolve" &&
    transition.type !== "fade-through-black"
  ) {
    throw new Error("Unsupported transition type.");
  }

  const nextClip = getNextClipForTransition(location.track, clipId);

  if (!nextClip) {
    throw new Error("Transition requires an adjacent visual clip.");
  }

  const nextAsset = project.assets.find(
    (candidate) => candidate.id === nextClip.assetId,
  );

  if (!nextAsset || (nextAsset.mediaType !== "video" && nextAsset.mediaType !== "image")) {
    throw new Error("Transition requires an adjacent visual clip.");
  }

  const clipEndMs = addSafeTimelineMilliseconds(
    location.clip.timelineStartMs,
    getClipDurationMs(location.clip),
    `Clip ${clipId} timeline end`,
  );

  if (clipEndMs !== nextClip.timelineStartMs) {
    throw new Error("Transition requires two adjacent clips.");
  }

  const normalized = normalizeClipTransition(transition);

  if (!normalized) {
    throw new Error("Transition duration must be a finite number.");
  }

  const maxDurationMs = Math.min(
    getClipDurationMs(location.clip),
    getClipDurationMs(nextClip),
  );

  if (normalized.durationMs > maxDurationMs) {
    throw new Error("Transition duration cannot exceed either clip duration.");
  }

  return updateClipAtLocation(
    project,
    location,
    { transitionOut: normalized },
    now,
  );
}

export function updateClipTransform(
  project: Project,
  clipId: string,
  changes: Partial<ClipTransform>,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);
  const asset = project.assets.find((candidate) => candidate.id === location.clip.assetId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  if (!asset || (asset.mediaType !== "video" && asset.mediaType !== "image")) {
    throw new Error("Transform controls are only available for visual media.");
  }

  const nextTransform = normalizeClipTransform({
    ...location.clip.transform,
    ...changes,
  });

  return updateClipAtLocation(
    project,
    location,
    { transform: nextTransform },
    now,
  );
}

export function updateClipTransformAtTime(
  project: Project,
  clipId: string,
  timeMs: number,
  changes: Partial<ClipTransform>,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);
  const asset = project.assets.find((candidate) => candidate.id === location.clip.assetId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  if (!asset || (asset.mediaType !== "video" && asset.mediaType !== "image")) {
    throw new Error("Transform controls are only available for visual media.");
  }

  const durationMs = getClipDurationMs(location.clip);
  const normalizedTimeMs = normalizeTransformKeyframeTime(timeMs);

  if (!Number.isFinite(timeMs) || timeMs < 0 || normalizedTimeMs > durationMs) {
    throw new Error("Transform keyframe time must be inside the clip.");
  }

  const currentTransform = getClipTransformAtTime(
    location.clip.transform,
    location.clip.transformKeyframes,
    normalizedTimeMs,
  );
  const nextTransform = normalizeClipTransform({
    ...currentTransform,
    ...changes,
  });

  if (location.clip.transformKeyframes?.length) {
    const nextKeyframes = upsertTransformKeyframe(
      location.clip.transformKeyframes,
      normalizedTimeMs,
      nextTransform,
    );

    return updateClipAtLocation(
      project,
      location,
      {
        transform: nextTransform,
        transformKeyframes: nextKeyframes,
      },
      now,
    );
  }

  return updateClipAtLocation(
    project,
    location,
    { transform: nextTransform },
    now,
  );
}

export function addTransformKeyframe(
  project: Project,
  clipId: string,
  timeMs: number,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);
  const asset = project.assets.find((candidate) => candidate.id === location.clip.assetId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  if (!asset || (asset.mediaType !== "video" && asset.mediaType !== "image")) {
    throw new Error("Transform keyframes are only available for visual media.");
  }

  const durationMs = getClipDurationMs(location.clip);
  const normalizedTimeMs = normalizeTransformKeyframeTime(timeMs);

  if (!Number.isFinite(timeMs) || timeMs < 0 || normalizedTimeMs > durationMs) {
    throw new Error("Transform keyframe time must be inside the clip.");
  }

  const transform = getClipTransformAtTime(
    location.clip.transform,
    location.clip.transformKeyframes,
    normalizedTimeMs,
  );
  const keyframes = upsertTransformKeyframe(
    location.clip.transformKeyframes,
    normalizedTimeMs,
    transform,
  );

  return updateClipAtLocation(
    project,
    location,
    {
      transformKeyframes: keyframes,
      transform: transform,
    },
    now,
  );
}

export function moveTransformKeyframe(
  project: Project,
  clipId: string,
  fromTimeMs: number,
  toTimeMs: number,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find((candidate) => candidate.id === location.clip.assetId);

  if (!asset || (asset.mediaType !== "video" && asset.mediaType !== "image")) {
    throw new Error("Transform keyframes are only available for visual media.");
  }

  const durationMs = getClipDurationMs(location.clip);
  const normalizedFromTimeMs = normalizeTransformKeyframeTime(fromTimeMs);
  const normalizedToTimeMs = normalizeTransformKeyframeTime(toTimeMs);

  if (
    !Number.isFinite(fromTimeMs) ||
    !Number.isFinite(toTimeMs) ||
    fromTimeMs < 0 ||
    toTimeMs < 0 ||
    normalizedFromTimeMs > durationMs ||
    normalizedToTimeMs > durationMs
  ) {
    throw new Error("Transform keyframe time must be inside the clip.");
  }

  if (normalizedFromTimeMs === normalizedToTimeMs) {
    return project;
  }

  const keyframe = getTransformKeyframeAtTime(
    location.clip.transformKeyframes,
    normalizedFromTimeMs,
  );

  if (!keyframe) {
    throw new Error("No transform keyframe exists at the source time.");
  }

  if (getTransformKeyframeAtTime(location.clip.transformKeyframes, normalizedToTimeMs)) {
    throw new Error("A transform keyframe already exists at the target time.");
  }

  const remaining = removeTransformKeyframeAtTime(
    location.clip.transformKeyframes,
    normalizedFromTimeMs,
  );
  const keyframes = upsertTransformKeyframe(
    remaining,
    normalizedToTimeMs,
    keyframe.transform,
  );

  return updateClipAtLocation(
    project,
    location,
    {
      transformKeyframes: keyframes,
      transform: getClipTransformAtTime(
        location.clip.transform,
        keyframes,
        normalizedToTimeMs,
      ),
    },
    now,
  );
}

export function updateTransformKeyframeEasing(
  project: Project,
  clipId: string,
  timeMs: number,
  easing: TransformEasing,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find((candidate) => candidate.id === location.clip.assetId);

  if (!asset || (asset.mediaType !== "video" && asset.mediaType !== "image")) {
    throw new Error("Transform keyframes are only available for visual media.");
  }

  const normalizedTimeMs = normalizeTransformKeyframeTime(timeMs);
  const keyframe = getTransformKeyframeAtTime(
    location.clip.transformKeyframes,
    normalizedTimeMs,
  );

  if (!keyframe) {
    throw new Error("No transform keyframe exists at this time.");
  }

  const keyframes = (location.clip.transformKeyframes ?? []).map((candidate) =>
    candidate.timeMs === keyframe.timeMs
      ? {
          ...candidate,
          easing,
        }
      : candidate,
  );

  return updateClipAtLocation(
    project,
    location,
    { transformKeyframes: keyframes },
    now,
  );
}

export function removeTransformKeyframe(
  project: Project,
  clipId: string,
  timeMs: number,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find((candidate) => candidate.id === location.clip.assetId);

  if (!asset || (asset.mediaType !== "video" && asset.mediaType !== "image")) {
    throw new Error("Transform keyframes are only available for visual media.");
  }

  const normalizedTimeMs = normalizeTransformKeyframeTime(timeMs);
  const keyframe = getTransformKeyframeAtTime(
    location.clip.transformKeyframes,
    normalizedTimeMs,
  );

  if (!keyframe) {
    throw new Error("No transform keyframe exists at this time.");
  }

  const keyframes = removeTransformKeyframeAtTime(
    location.clip.transformKeyframes,
    normalizedTimeMs,
  );

  return updateClipAtLocation(
    project,
    location,
    {
      transformKeyframes: keyframes.length ? keyframes : undefined,
      transform: getClipTransformAtTime(
        location.clip.transform,
        keyframes,
        normalizedTimeMs,
      ),
    },
    now,
  );
}

export function resetClipTransform(
  project: Project,
  clipId: string,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  return updateClipAtLocation(
    project,
    location,
    {
      transform: { ...DEFAULT_CLIP_TRANSFORM },
      transformAnchor: undefined,
      transformKeyframes: undefined,
    },
    now,
  );
}

export function removeClipFromTimeline(
  project: Project,
  clipId: string,
  now: Date = new Date(),
): Project {
  const trackIndex = project.tracks.findIndex((track) =>
    track.clips.some((clip) => clip.id === clipId),
  );

  if (trackIndex === -1) {
    throw new Error("Clip does not exist in this project.");
  }

  const track = project.tracks[trackIndex];
  const clips = track.clips.filter((clip) => clip.id !== clipId);
  const tracks = [...project.tracks];
  tracks[trackIndex] = sanitizeProjectTrackTransitions(
    project,
    { ...track, clips },
  );

  return { ...project, tracks, updatedAt: now.toISOString() };
}


export function moveClipOnTimeline(
  project: Project,
  clipId: string,
  timelineStartMs: number,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);

  if (location.track.isLocked) {
    throw new Error("Track is locked.");
  }

  if (!Number.isFinite(timelineStartMs) || timelineStartMs < 0) {
    throw new Error("Clip timeline position must be zero or greater.");
  }

  const normalizedTimelineStartMs = Math.round(timelineStartMs);
  const candidateEndMs = addSafeTimelineMilliseconds(
    normalizedTimelineStartMs,
    getClipDurationMs(location.clip),
    `Clip ${clipId} timeline end`,
  );

  if (
    hasTimelineOverlap(
      location.track,
      clipId,
      normalizedTimelineStartMs,
      candidateEndMs,
    )
  ) {
    throw new Error("Clip cannot overlap another clip on the same track.");
  }

  const tracks = project.tracks.map((track, index) => {
    if (index !== location.trackIndex) {
      return track;
    }

    return sanitizeProjectTrackTransitions(project, {
      ...track,
      clips: track.clips.map((clip) =>
        clip.id === clipId
          ? { ...clip, timelineStartMs: normalizedTimelineStartMs }
          : clip,
      ),
    });
  });

  return { ...project, tracks, updatedAt: now.toISOString() };
}

export function trimClipStart(
  project: Project,
  clipId: string,
  newSourceStartMs: number,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);
  const { clip, track } = location;

  if (track.isLocked) {
    throw new Error("Track is locked.");
  }

  const sourceEndMs = clip.sourceEndMs;

  if (
    !Number.isFinite(newSourceStartMs) ||
    newSourceStartMs < 0 ||
    sourceEndMs === null
  ) {
    throw new Error("Clip start trim would create an invalid source range.");
  }

  const normalizedNewSourceStartMs = Math.round(newSourceStartMs);

  if (normalizedNewSourceStartMs >= sourceEndMs) {
    throw new Error("Clip start trim would create an invalid source range.");
  }

  const timelineStartMs = addSafeTimelineMilliseconds(
    clip.timelineStartMs,
    normalizedNewSourceStartMs - clip.sourceStartMs,
    `Clip ${clipId} timeline start`,
  );

  if (timelineStartMs < 0) {
    throw new Error("Clip cannot be trimmed before the start of the timeline.");
  }

  const candidateEndMs = addSafeTimelineMilliseconds(
    clip.timelineStartMs,
    getClipDurationMs(clip),
    `Clip ${clipId} timeline end`,
  );

  if (hasTimelineOverlap(location.track, clipId, timelineStartMs, candidateEndMs)) {
    throw new Error("Clip cannot overlap another clip on the same track.");
  }

  const updatedProject = updateClipAtLocation(
    project,
    location,
    {
      sourceStartMs: normalizedNewSourceStartMs,
      timelineStartMs,
      ...getClampedAudioFadePatch(
        clip,
        normalizedNewSourceStartMs,
        sourceEndMs,
      ),
    },
    now,
  );
  const tracks = [...updatedProject.tracks];

  tracks[location.trackIndex] = sanitizeProjectTrackTransitions(
    updatedProject,
    tracks[location.trackIndex],
  );

  return { ...updatedProject, tracks };
}

export function trimClipEnd(
  project: Project,
  clipId: string,
  newSourceEndMs: number,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);
  const { clip, track } = location;

  if (track.isLocked) {
    throw new Error("Track is locked.");
  }

  const asset = project.assets.find((candidate) => candidate.id === clip.assetId);

  if (
    !Number.isFinite(newSourceEndMs) ||
    clip.sourceEndMs === null
  ) {
    throw new Error("Clip end trim would create an invalid source range.");
  }

  const normalizedNewSourceEndMs = Math.round(newSourceEndMs);

  if (normalizedNewSourceEndMs <= clip.sourceStartMs) {
    throw new Error("Clip end trim would create an invalid source range.");
  }

  if (asset?.durationMs !== null && asset?.durationMs !== undefined) {
    if (normalizedNewSourceEndMs > asset.durationMs) {
      throw new Error("Clip end cannot exceed the source media duration.");
    }
  }

  const candidateEndMs = addSafeTimelineMilliseconds(
    clip.timelineStartMs,
    normalizedNewSourceEndMs - clip.sourceStartMs,
    `Clip ${clipId} timeline end`,
  );

  if (hasTimelineOverlap(location.track, clipId, clip.timelineStartMs, candidateEndMs)) {
    throw new Error("Clip cannot overlap another clip on the same track.");
  }

  const updatedProject = updateClipAtLocation(
    project,
    location,
    {
      sourceEndMs: normalizedNewSourceEndMs,
      ...getClampedAudioFadePatch(
        clip,
        clip.sourceStartMs,
        normalizedNewSourceEndMs,
      ),
    },
    now,
  );
  const tracks = [...updatedProject.tracks];

  tracks[location.trackIndex] = sanitizeProjectTrackTransitions(
    updatedProject,
    tracks[location.trackIndex],
  );

  return { ...updatedProject, tracks };
}

export function splitClipAtTime(
  project: Project,
  clipId: string,
  timelineTimeMs: number,
  now: Date = new Date(),
): Project {
  const location = findClipLocation(project, clipId);
  const { clip, track } = location;

  if (track.isLocked) {
    throw new Error("Track is locked.");
  }

  if (!Number.isFinite(timelineTimeMs)) {
    throw new Error("Split time must be inside the selected clip.");
  }

  const normalizedTimelineTimeMs = Math.round(timelineTimeMs);

  if (normalizedTimelineTimeMs <= clip.timelineStartMs) {
    throw new Error("Split time must be inside the selected clip.");
  }

  if (clip.sourceEndMs === null) {
    throw new Error("Clip does not have a known source duration.");
  }

  const clipEndMs = addSafeTimelineMilliseconds(
    clip.timelineStartMs,
    clip.sourceEndMs - clip.sourceStartMs,
    `Clip ${clipId} timeline end`,
  );

  if (normalizedTimelineTimeMs >= clipEndMs) {
    throw new Error("Split time must be inside the selected clip.");
  }

  const sourceSplitMs =
    clip.sourceStartMs +
    (normalizedTimelineTimeMs - clip.timelineStartMs);

  const splitLocalTimeMs =
    normalizedTimelineTimeMs - clip.timelineStartMs;
  const hasKeyframes = Boolean(clip.transformKeyframes?.length);
  const splitTransform = hasKeyframes
    ? getClipTransformAtTime(
        clip.transform,
        clip.transformKeyframes,
        splitLocalTimeMs,
      )
    : undefined;
  const firstKeyframes = hasKeyframes
    ? upsertTransformKeyframe(
        (clip.transformKeyframes ?? []).filter(
          (keyframe) => keyframe.timeMs <= splitLocalTimeMs,
        ),
        splitLocalTimeMs,
        splitTransform ?? DEFAULT_CLIP_TRANSFORM,
      )
    : undefined;
  const secondKeyframes = hasKeyframes
    ? upsertTransformKeyframe(
        (clip.transformKeyframes ?? [])
          .filter((keyframe) => keyframe.timeMs >= splitLocalTimeMs)
          .map((keyframe) => ({
            ...keyframe,
            timeMs: keyframe.timeMs - splitLocalTimeMs,
          })),
        0,
        splitTransform ?? DEFAULT_CLIP_TRANSFORM,
      )
    : undefined;

  const audioVolumeKeyframes = clip.audioVolumeKeyframes ?? [];
  const hasAudioVolumeKeyframes = audioVolumeKeyframes.length > 0;
  const splitAudioVolume = hasAudioVolumeKeyframes
    ? getAudioVolumeAtTime(clip, splitLocalTimeMs)
    : undefined;
  const firstAudioVolumeKeyframes = hasAudioVolumeKeyframes
    ? upsertAudioVolumeKeyframe(
        audioVolumeKeyframes.filter(
          (keyframe) => keyframe.timeMs <= splitLocalTimeMs,
        ),
        splitLocalTimeMs,
        splitAudioVolume ?? 1,
      )
    : undefined;
  const secondAudioVolumeKeyframes = hasAudioVolumeKeyframes
    ? upsertAudioVolumeKeyframe(
        audioVolumeKeyframes
          .filter((keyframe) => keyframe.timeMs >= splitLocalTimeMs)
          .map((keyframe) => ({
            ...keyframe,
            timeMs: keyframe.timeMs - splitLocalTimeMs,
          })),
        0,
        splitAudioVolume ?? 1,
      )
    : undefined;

  const firstClip: Clip = {
    ...clip,
    sourceEndMs: sourceSplitMs,
    transitionOut: undefined,
    audioFadeOutMs: undefined,
    transformKeyframes: firstKeyframes,
    audioVolumeKeyframes: firstAudioVolumeKeyframes,
  };
  const secondClip: Clip = {
    ...clip,
    id: crypto.randomUUID(),
    timelineStartMs: normalizedTimelineTimeMs,
    sourceStartMs: sourceSplitMs,
    audioFadeInMs: undefined,
    transformKeyframes: secondKeyframes,
    audioVolumeKeyframes: secondAudioVolumeKeyframes,
  };

  const clips = track.clips.flatMap((candidate) =>
    candidate.id === clipId ? [firstClip, secondClip] : [candidate],
  );
  const tracks = project.tracks.map((candidateTrack, index) =>
    index === location.trackIndex
      ? sanitizeProjectTrackTransitions(project, {
          ...candidateTrack,
          clips,
        })
      : candidateTrack,
  );

  return { ...project, tracks, updatedAt: now.toISOString() };
}

type ClipLocation = {
  track: Project["tracks"][number];
  trackIndex: number;
  clip: Clip;
  clipIndex: number;
};

function sanitizeProjectTrackTransitions(
  project: Project,
  track: Project["tracks"][number],
): Project["tracks"][number] {
  return sanitizeTrackTransitions(
    track,
    (clip) => {
      const asset = project.assets.find(
        (candidate) => candidate.id === clip.assetId,
      );
      return asset?.mediaType === "video" || asset?.mediaType === "image";
    },
  );
}

function getClampedAudioFadePatch(
  clip: Clip,
  sourceStartMs: number,
  sourceEndMs: number | null,
): Pick<Clip, "audioFadeInMs" | "audioFadeOutMs"> {
  if (sourceEndMs === null) {
    return {
      audioFadeInMs: clip.audioFadeInMs,
      audioFadeOutMs: clip.audioFadeOutMs,
    };
  }

  const durationMs = Math.max(0, sourceEndMs - sourceStartMs);
  const currentFadeInMs = Math.max(
    0,
    Math.floor(
      typeof clip.audioFadeInMs === "number" && Number.isFinite(clip.audioFadeInMs)
        ? clip.audioFadeInMs
        : 0,
    ),
  );
  const currentFadeOutMs = Math.max(
    0,
    Math.floor(
      typeof clip.audioFadeOutMs === "number" && Number.isFinite(clip.audioFadeOutMs)
        ? clip.audioFadeOutMs
        : 0,
    ),
  );
  const fadeInMs = Math.min(durationMs, currentFadeInMs);
  const fadeOutMs = Math.min(
    Math.max(0, durationMs - fadeInMs),
    currentFadeOutMs,
  );

  return {
    audioFadeInMs: fadeInMs || undefined,
    audioFadeOutMs: fadeOutMs || undefined,
  };
}

function addSafeTimelineMilliseconds(
  startMs: number,
  deltaMs: number,
  context: string,
): number {
  if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(deltaMs)) {
    throw new Error(`${context} contains an unsafe millisecond value.`);
  }

  const resultMs = startMs + deltaMs;

  if (!Number.isSafeInteger(resultMs) || resultMs < 0) {
    throw new Error(
      `${context} exceeds the supported safe millisecond range.`,
    );
  }

  return resultMs;
}

function hasTimelineOverlap(
  track: Project["tracks"][number],
  excludedClipId: string,
  candidateStartMs: number,
  candidateEndMs: number,
): boolean {
  return track.clips.some((clip) => {
    if (clip.id === excludedClipId) {
      return false;
    }

    const existingStartMs = clip.timelineStartMs;
    const existingEndMs = addSafeTimelineMilliseconds(
      existingStartMs,
      getClipDurationMs(clip),
      `Clip ${clip.id} timeline end`,
    );

    return candidateStartMs < existingEndMs && candidateEndMs > existingStartMs;
  });
}

function getClipDurationMs(clip: Clip): number {
  if (clip.sourceEndMs === null) {
    return 0;
  }

  return Math.max(0, clip.sourceEndMs - clip.sourceStartMs);
}

function findClipLocation(project: Project, clipId: string): ClipLocation {
  for (let trackIndex = 0; trackIndex < project.tracks.length; trackIndex += 1) {
    const track = project.tracks[trackIndex];
    const clipIndex = track.clips.findIndex((clip) => clip.id === clipId);

    if (clipIndex !== -1) {
      return { track, trackIndex, clip: track.clips[clipIndex], clipIndex };
    }
  }

  throw new Error("Clip does not exist in this project.");
}

function updateClipAtLocation(
  project: Project,
  location: ClipLocation,
  changes: Partial<Clip>,
  now: Date,
): Project {
  const tracks = project.tracks.map((track, index) =>
    index === location.trackIndex
      ? {
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === location.clip.id ? { ...clip, ...changes } : clip,
          ),
        }
      : track,
  );

  return { ...project, tracks, updatedAt: now.toISOString() };
}