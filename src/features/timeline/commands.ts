import type { Clip, Project, TrackType } from "../project/domain";

const defaultImageDurationMs = 3000;

export function addAssetToTimeline(project: Project, assetId: string, now: Date = new Date()): Project {
  const asset = project.assets.find((candidate) => candidate.id === assetId);

  if (!asset) {
    throw new Error("Asset does not exist in this project.");
  }

  const trackType: TrackType = asset.mediaType === "audio" ? "audio" : "video";
  const trackIndex = project.tracks.findIndex((track) => track.type === trackType);

  if (trackIndex === -1) {
    throw new Error(`Project has no ${trackType} track.`);
  }

  const track = project.tracks[trackIndex];
  const timelineStartMs = track.clips.reduce((latest, clip) => Math.max(latest, clip.timelineStartMs + clipDuration(clip)), 0);
  const durationMs = asset.durationMs ?? defaultImageDurationMs;
  const clip: Clip = {
    id: crypto.randomUUID(),
    assetId: asset.id,
    timelineStartMs,
    sourceStartMs: 0,
    sourceEndMs: durationMs,
  };
  const tracks = [...project.tracks];
  tracks[trackIndex] = { ...track, clips: [...track.clips, clip] };

  return { ...project, tracks, updatedAt: now.toISOString() };
}

function clipDuration(clip: Clip): number {
  return (clip.sourceEndMs ?? clip.sourceStartMs) - clip.sourceStartMs;
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
  tracks[trackIndex] = { ...track, clips };

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

  const tracks = project.tracks.map((track, index) =>
    index === location.trackIndex
      ? {
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId ? { ...clip, timelineStartMs } : clip,
          ),
        }
      : track,
  );

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

  return updateClipAtLocation(
    project,
    location,
    {
      sourceStartMs: newSourceStartMs,
      timelineStartMs,
    },
    now,
  );
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

  return updateClipAtLocation(
    project,
    location,
    { sourceEndMs: newSourceEndMs },
    now,
  );
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

  const firstClip: Clip = {
    ...clip,
    sourceEndMs: sourceSplitMs,
  };
  const secondClip: Clip = {
    ...clip,
    id: crypto.randomUUID(),
    timelineStartMs: timelineTimeMs,
    sourceStartMs: sourceSplitMs,
  };

  const clips = track.clips.flatMap((candidate) =>
    candidate.id === clipId ? [firstClip, secondClip] : [candidate],
  );
  const tracks = project.tracks.map((candidateTrack, index) =>
    index === location.trackIndex ? { ...candidateTrack, clips } : candidateTrack,
  );

  return { ...project, tracks, updatedAt: now.toISOString() };
}

type ClipLocation = {
  track: Project["tracks"][number];
  trackIndex: number;
  clip: Clip;
  clipIndex: number;
};

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
