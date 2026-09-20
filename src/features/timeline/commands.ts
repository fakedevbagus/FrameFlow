import type {
  TransformAnchor,
  ClipCrop,
  CropPosition,
  Clip,
  ClipTransform,
  Project,
  TrackType,
  TransformEasing,
  ClipTransition,
} from "../project/domain";
import {
  DEFAULT_CLIP_TRANSFORM,
  getClipTransform,
  getClipTransformAtTime,
  getClipTransformAnchor,
  getTransformKeyframeAtTime,
  isValidClipCrop,
  normalizeClipTransform,
  normalizeTransformAnchor,
  compensateTransformForAnchorChange,
  normalizeClipCrop,
  normalizeClipCropPosition,
  removeTransformKeyframe as removeTransformKeyframeAtTime,
  upsertTransformKeyframe,
} from "../transform/transform";
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
    !Number.isFinite(height) ||
    !Number.isInteger(height) ||
    height <= 0
  ) {
    throw new Error("Canvas dimensions must be positive integers.");
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
      Math.max(latest, clip.timelineStartMs + clipDuration(clip)),
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
  const requestedStartMs =
    timelineStartMs === null
      ? track.clips.reduce(
          (latest, clip) =>
            Math.max(latest, clip.timelineStartMs + clipDuration(clip)),
          0,
        )
      : Math.max(0, timelineStartMs);

  const candidateEndMs = requestedStartMs + durationMs;

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

  if (transition.type !== "dissolve") {
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

  const clipEndMs = location.clip.timelineStartMs + getClipDurationMs(location.clip);

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

  if (!Number.isFinite(timeMs) || timeMs < 0 || timeMs > durationMs) {
    throw new Error("Transform keyframe time must be inside the clip.");
  }

  const currentTransform = getClipTransformAtTime(
    location.clip.transform,
    location.clip.transformKeyframes,
    timeMs,
  );
  const nextTransform = normalizeClipTransform({
    ...currentTransform,
    ...changes,
  });

  if (location.clip.transformKeyframes?.length) {
    const nextKeyframes = upsertTransformKeyframe(
      location.clip.transformKeyframes,
      timeMs,
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

  if (!Number.isFinite(timeMs) || timeMs < 0 || timeMs > durationMs) {
    throw new Error("Transform keyframe time must be inside the clip.");
  }

  const transform = getClipTransformAtTime(
    location.clip.transform,
    location.clip.transformKeyframes,
    timeMs,
  );
  const keyframes = upsertTransformKeyframe(
    location.clip.transformKeyframes,
    timeMs,
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

  if (
    !Number.isFinite(fromTimeMs) ||
    !Number.isFinite(toTimeMs) ||
    fromTimeMs < 0 ||
    toTimeMs < 0 ||
    fromTimeMs > durationMs ||
    toTimeMs > durationMs
  ) {
    throw new Error("Transform keyframe time must be inside the clip.");
  }

  const keyframe = getTransformKeyframeAtTime(
    location.clip.transformKeyframes,
    fromTimeMs,
  );

  if (!keyframe) {
    throw new Error("No transform keyframe exists at the source time.");
  }

  if (
    toTimeMs !== fromTimeMs &&
    getTransformKeyframeAtTime(location.clip.transformKeyframes, toTimeMs)
  ) {
    throw new Error("A transform keyframe already exists at the target time.");
  }

  const remaining = removeTransformKeyframeAtTime(
    location.clip.transformKeyframes,
    fromTimeMs,
  );
  const keyframes = upsertTransformKeyframe(
    remaining,
    toTimeMs,
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
        toTimeMs,
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

  const keyframe = getTransformKeyframeAtTime(
    location.clip.transformKeyframes,
    timeMs,
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

  const keyframe = getTransformKeyframeAtTime(
    location.clip.transformKeyframes,
    timeMs,
  );

  if (!keyframe) {
    throw new Error("No transform keyframe exists at this time.");
  }

  const keyframes = removeTransformKeyframeAtTime(
    location.clip.transformKeyframes,
    timeMs,
  );

  return updateClipAtLocation(
    project,
    location,
    {
      transformKeyframes: keyframes.length ? keyframes : undefined,
      transform: getClipTransformAtTime(
        location.clip.transform,
        keyframes,
        timeMs,
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

  const candidateEndMs = timelineStartMs + getClipDurationMs(location.clip);

  if (hasTimelineOverlap(location.track, clipId, timelineStartMs, candidateEndMs)) {
    throw new Error("Clip cannot overlap another clip on the same track.");
  }

  const tracks = project.tracks.map((track, index) => {
    if (index !== location.trackIndex) {
      return track;
    }

    return sanitizeProjectTrackTransitions(project, {
      ...track,
      clips: track.clips.map((clip) =>
        clip.id === clipId ? { ...clip, timelineStartMs } : clip,
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
    sourceEndMs === null ||
    newSourceStartMs >= sourceEndMs
  ) {
    throw new Error("Clip start trim would create an invalid source range.");
  }

  const timelineStartMs = clip.timelineStartMs + (newSourceStartMs - clip.sourceStartMs);

  if (timelineStartMs < 0) {
    throw new Error("Clip cannot be trimmed before the start of the timeline.");
  }

  const candidateEndMs = clip.timelineStartMs + getClipDurationMs(clip);

  if (hasTimelineOverlap(location.track, clipId, timelineStartMs, candidateEndMs)) {
    throw new Error("Clip cannot overlap another clip on the same track.");
  }

  const updatedProject = updateClipAtLocation(
    project,
    location,
    {
      sourceStartMs: newSourceStartMs,
      timelineStartMs,
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
    newSourceEndMs <= clip.sourceStartMs ||
    clip.sourceEndMs === null
  ) {
    throw new Error("Clip end trim would create an invalid source range.");
  }

  if (asset?.durationMs !== null && asset?.durationMs !== undefined) {
    if (newSourceEndMs > asset.durationMs) {
      throw new Error("Clip end cannot exceed the source media duration.");
    }
  }

  const candidateEndMs = clip.timelineStartMs + (newSourceEndMs - clip.sourceStartMs);

  if (hasTimelineOverlap(location.track, clipId, clip.timelineStartMs, candidateEndMs)) {
    throw new Error("Clip cannot overlap another clip on the same track.");
  }

  const updatedProject = updateClipAtLocation(
    project,
    location,
    { sourceEndMs: newSourceEndMs },
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

  if (!Number.isFinite(timelineTimeMs) || timelineTimeMs <= clip.timelineStartMs) {
    throw new Error("Split time must be inside the selected clip.");
  }

  if (clip.sourceEndMs === null) {
    throw new Error("Clip does not have a known source duration.");
  }

  const clipEndMs =
    clip.timelineStartMs + (clip.sourceEndMs - clip.sourceStartMs);

  if (timelineTimeMs >= clipEndMs) {
    throw new Error("Split time must be inside the selected clip.");
  }

  const sourceSplitMs =
    clip.sourceStartMs + (timelineTimeMs - clip.timelineStartMs);

  const splitLocalTimeMs = timelineTimeMs - clip.timelineStartMs;
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

  const firstClip: Clip = {
    ...clip,
    sourceEndMs: sourceSplitMs,
    transitionOut: undefined,
    transformKeyframes: firstKeyframes,
  };
  const secondClip: Clip = {
    ...clip,
    id: crypto.randomUUID(),
    timelineStartMs: timelineTimeMs,
    sourceStartMs: sourceSplitMs,
    transformKeyframes: secondKeyframes,
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
    const existingEndMs = existingStartMs + getClipDurationMs(clip);

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
