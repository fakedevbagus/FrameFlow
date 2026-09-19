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
