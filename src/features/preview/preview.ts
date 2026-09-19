import type { Clip, MediaAsset, Project, Track } from "../project/domain";

export interface ActivePreviewClip {
  asset: MediaAsset;
  clip: Clip;
  track: Track;
}

export function findActivePreviewClip(
  project: Project,
  timelineTimeMs: number,
): ActivePreviewClip | null {
  const safeTimeMs = Math.max(0, timelineTimeMs);

  const visualClip = findActiveClip(
    project,
    safeTimeMs,
    (track) => track.type === "video",
  );

  if (visualClip) {
    return visualClip;
  }

  return findActiveClip(
    project,
    safeTimeMs,
    (track) => track.type === "audio",
  );
}

export function getClipLocalTimeMs(clip: Clip, timelineTimeMs: number): number {
  const durationMs =
    clip.sourceEndMs === null
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, clip.sourceEndMs - clip.sourceStartMs);

  const offsetMs = Math.max(0, timelineTimeMs - clip.timelineStartMs);

  return Math.min(durationMs, clip.sourceStartMs + offsetMs);
}

function findActiveClip(
  project: Project,
  timelineTimeMs: number,
  trackPredicate: (track: Track) => boolean,
): ActivePreviewClip | null {
  for (const track of project.tracks) {
    if (!trackPredicate(track) || track.isMuted) {
      continue;
    }

    for (const clip of track.clips) {
      const clipEndMs =
        clip.sourceEndMs === null
          ? Number.POSITIVE_INFINITY
          : clip.timelineStartMs +
            Math.max(0, clip.sourceEndMs - clip.sourceStartMs);

      if (
        timelineTimeMs >= clip.timelineStartMs &&
        timelineTimeMs < clipEndMs
      ) {
        const asset = project.assets.find(
          (candidate) => candidate.id === clip.assetId,
        );

        if (asset) {
          return { asset, clip, track };
        }
      }
    }
  }

  return null;
}
