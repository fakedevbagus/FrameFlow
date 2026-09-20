import type { Clip, MediaAsset, Project, Track } from "../project/domain";
import {
  getClipTransition,
  getDissolveOpacities,
  isTransitionAdjacent,
} from "../transition/transition";

export interface ActivePreviewClip {
  asset: MediaAsset;
  clip: Clip;
  track: Track;
  trackIndex: number;
  transitionOpacity?: number;
}

export function getActiveVisualPreviewClips(
  project: Project,
  timelineTimeMs: number,
): ActivePreviewClip[] {
  const safeTimeMs = Math.max(0, timelineTimeMs);
  const activeLayers: ActivePreviewClip[] = [];

  project.tracks.forEach((track, trackIndex) => {
    if (track.isMuted || track.type !== "video") {
      return;
    }

    const orderedClips = [...track.clips].sort(
      (left, right) => left.timelineStartMs - right.timelineStartMs,
    );

    for (let index = 0; index < orderedClips.length; index += 1) {
      const outgoingClip = orderedClips[index];
      const outgoingAsset = project.assets.find(
        (candidate) => candidate.id === outgoingClip.assetId,
      );

      if (
        !outgoingAsset ||
        (outgoingAsset.mediaType !== "video" &&
          outgoingAsset.mediaType !== "image")
      ) {
        continue;
      }

      const incomingClip = orderedClips[index + 1];

      if (incomingClip) {
        const incomingAsset = project.assets.find(
          (candidate) => candidate.id === incomingClip.assetId,
        );
        const transition = getClipTransition(outgoingClip.transitionOut);

        if (
          incomingAsset &&
          (incomingAsset.mediaType === "video" ||
            incomingAsset.mediaType === "image") &&
          transition &&
          isTransitionAdjacent(outgoingClip, incomingClip)
        ) {
          const opacities = getDissolveOpacities(
            safeTimeMs,
            outgoingClip,
            incomingClip,
            transition,
          );

          if (opacities) {
            activeLayers.push({
              asset: outgoingAsset,
              clip: outgoingClip,
              track,
              trackIndex,
              transitionOpacity: opacities.outgoingOpacity,
            });
            activeLayers.push({
              asset: incomingAsset,
              clip: incomingClip,
              track,
              trackIndex,
              transitionOpacity: opacities.incomingOpacity,
            });
            return;
          }
        }
      }

      const clipDurationMs =
        outgoingClip.sourceEndMs === null
          ? Number.POSITIVE_INFINITY
          : Math.max(0, outgoingClip.sourceEndMs - outgoingClip.sourceStartMs);
      const clipEndMs = outgoingClip.timelineStartMs + clipDurationMs;

      if (
        safeTimeMs >= outgoingClip.timelineStartMs &&
        safeTimeMs < clipEndMs
      ) {
        activeLayers.push({
          asset: outgoingAsset,
          clip: outgoingClip,
          track,
          trackIndex,
        });
      }
    }
  });

  return activeLayers;
}

export function getActiveAudioPreviewClips(
  project: Project,
  timelineTimeMs: number,
): ActivePreviewClip[] {
  return getActivePreviewClips(
    project,
    timelineTimeMs,
    (track, asset) => track.type === "audio" && asset.mediaType === "audio",
  );
}

export function findActivePreviewClip(
  project: Project,
  timelineTimeMs: number,
): ActivePreviewClip | null {
  const visualClips = getActiveVisualPreviewClips(project, timelineTimeMs);

  if (visualClips.length > 0) {
    return visualClips[visualClips.length - 1];
  }

  const audioClips = getActiveAudioPreviewClips(project, timelineTimeMs);

  return audioClips.length > 0 ? audioClips[audioClips.length - 1] : null;
}

export function getClipLocalTimeMs(clip: Clip, timelineTimeMs: number): number {
  const durationMs =
    clip.sourceEndMs === null
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, clip.sourceEndMs - clip.sourceStartMs);

  const offsetMs = Math.max(0, timelineTimeMs - clip.timelineStartMs);

  return Math.min(durationMs, clip.sourceStartMs + offsetMs);
}

function getActivePreviewClips(
  project: Project,
  timelineTimeMs: number,
  predicate: (track: Track, asset: MediaAsset) => boolean,
): ActivePreviewClip[] {
  const safeTimeMs = Math.max(0, timelineTimeMs);
  const activeClips: ActivePreviewClip[] = [];

  project.tracks.forEach((track, trackIndex) => {
    if (track.isMuted) {
      return;
    }

    track.clips.forEach((clip) => {
      const asset = project.assets.find(
        (candidate) => candidate.id === clip.assetId,
      );

      if (!asset || !predicate(track, asset)) {
        return;
      }

      const clipDurationMs =
        clip.sourceEndMs === null
          ? Number.POSITIVE_INFINITY
          : Math.max(0, clip.sourceEndMs - clip.sourceStartMs);
      const clipEndMs = clip.timelineStartMs + clipDurationMs;

      if (safeTimeMs >= clip.timelineStartMs && safeTimeMs < clipEndMs) {
        activeClips.push({ asset, clip, track, trackIndex });
      }
    });
  });

  return activeClips;
}
