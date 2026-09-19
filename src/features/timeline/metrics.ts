import type { Clip, Project } from "../project/domain";

export function getClipDurationMs(clip: Clip): number {
  if (clip.sourceEndMs === null) {
    return 0;
  }

  return Math.max(0, clip.sourceEndMs - clip.sourceStartMs);
}

export function getTimelineDurationMs(project: Project, minimumTimelineMs = 20_000): number {
  const latestClipEndMs = project.tracks.reduce(
    (latestTrackEnd, track) =>
      Math.max(
        latestTrackEnd,
        ...track.clips.map(
          (clip) => clip.timelineStartMs + getClipDurationMs(clip),
        ),
      ),
    0,
  );

  return Math.max(minimumTimelineMs, latestClipEndMs);
}
