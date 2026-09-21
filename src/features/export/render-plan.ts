import {
  getAudioEq,
  getAudioFadeDurations,
  getTrackPan,
  getTrackVolume,
  type AudioEq,
  type Clip,
  type ClipCrop,
  type ClipTransform,
  type CropPosition,
  type MediaType,
  type Project,
  type TrackType,
  type TransformKeyframe,
} from "../project/domain";
import {
  getExportDimensions,
  normalizeExportSettings,
  type ExportSettings,
} from "./export";

export interface RenderSegment {
  inputIndex: number;
  assetId: string;
  sourcePath: string;
  mediaType: MediaType;
  trackId: string;
  trackType: TrackType;
  trackIndex: number;
  timelineStartMs: number;
  timelineEndMs: number;
  sourceStartMs: number;
  sourceEndMs: number;
  durationMs: number;
  isMuted: boolean;
  trackVolume?: number;
  trackPan?: number;
  audioFadeInMs?: number;
  audioFadeOutMs?: number;
  audioEq?: AudioEq;
  transform?: ClipTransform;
  crop?: ClipCrop;
  cropPosition?: CropPosition;
  transformKeyframes?: TransformKeyframe[];
  transitionOut?: Clip["transitionOut"];
}

export interface RenderPlan {
  width: number;
  height: number;
  frameRate: number;
  durationMs: number;
  segments: RenderSegment[];
}

export function createRenderPlan(
  project: Project,
  settings: ExportSettings,
): RenderPlan {
  const dimensions = getExportDimensions(settings.quality, project);
  const normalizedSettings = normalizeExportSettings(
    {
      ...settings,
      width: dimensions.width,
      height: dimensions.height,
      frameRate: project.canvas.frameRate,
    },
    project,
  );
  const segments: RenderSegment[] = [];
  let inputIndex = 0;
  let durationMs = 0;

  project.tracks.forEach((track, trackIndex) => {
    const orderedClips = [...track.clips].sort(
      (left, right) => left.timelineStartMs - right.timelineStartMs,
    );

    let previousEndMs = 0;

    orderedClips.forEach((clip) => {
      const asset = project.assets.find(
        (candidate) => candidate.id === clip.assetId,
      );

      if (!asset) {
        throw new Error(`Render clip ${clip.id} references a missing asset.`);
      }

      if (!asset.sourcePath.trim()) {
        throw new Error(`Render clip ${clip.id} has no source path.`);
      }

      const clipDurationMs = getClipDurationMs(clip);

      if (clipDurationMs <= 0) {
        throw new Error(`Render clip ${clip.id} has no positive duration.`);
      }

      if (
        !Number.isFinite(clip.timelineStartMs) ||
        clip.timelineStartMs < 0
      ) {
        throw new Error(`Render clip ${clip.id} has an invalid timeline start.`);
      }

      if (
        track.clips.length > 1 &&
        clip.timelineStartMs < previousEndMs
      ) {
        throw new Error(
          `Render track ${track.id} contains overlapping clips.`,
        );
      }

      const sourceEndMs = clip.sourceStartMs + clipDurationMs;
      const timelineEndMs = clip.timelineStartMs + clipDurationMs;

      segments.push({
        inputIndex,
        assetId: asset.id,
        sourcePath: asset.sourcePath,
        mediaType: asset.mediaType,
        trackId: track.id,
        trackType: track.type,
        trackIndex,
        timelineStartMs: clip.timelineStartMs,
        timelineEndMs,
        sourceStartMs: clip.sourceStartMs,
        sourceEndMs,
        durationMs: clipDurationMs,
        isMuted: track.isMuted,
        trackVolume: getTrackVolume(track),
        ...(track.type === "audio"
          ? {
              trackPan: getTrackPan(track),
            }
          : {}),
        ...(track.type === "audio" && asset.mediaType === "audio"
          ? (() => {
              const fades = getAudioFadeDurations(clip);
              return {
                audioFadeInMs: fades.fadeInMs,
                audioFadeOutMs: fades.fadeOutMs,
                audioEq: getAudioEq(clip),
              };
            })()
          : {}),
        transform: clip.transform,
        crop: clip.crop,
        cropPosition: clip.cropPosition,
        transformKeyframes: clip.transformKeyframes,
        transitionOut: clip.transitionOut,
      });

      inputIndex += 1;
      durationMs = Math.max(durationMs, timelineEndMs);
      previousEndMs = timelineEndMs;
    });
  });

  return {
    width: normalizedSettings.width,
    height: normalizedSettings.height,
    frameRate: normalizedSettings.frameRate,
    durationMs,
    segments,
  };
}

function getClipDurationMs(clip: Clip): number {
  if (clip.sourceEndMs === null) {
    return 0;
  }

  return Math.max(0, clip.sourceEndMs - clip.sourceStartMs);
}
