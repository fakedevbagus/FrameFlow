import {
  DEFAULT_AUDIO_CLIP_VOLUME,
  type AudioVolumeKeyframe,
  type Clip,
} from "../project/domain";

export function normalizeAudioVolumeKeyframes(
  keyframes: AudioVolumeKeyframe[] | undefined,
): AudioVolumeKeyframe[] {
  if (!keyframes?.length) return [];

  const sorted = keyframes
    .filter(
      (keyframe) =>
        Number.isFinite(keyframe.timeMs) &&
        keyframe.timeMs >= 0 &&
        Number.isFinite(keyframe.volume),
    )
    .map((keyframe) => ({
      timeMs: Math.max(0, Math.round(keyframe.timeMs)),
      volume: clampAudioVolume(keyframe.volume),
    }))
    .sort((a, b) => a.timeMs - b.timeMs);

  const deduplicated: AudioVolumeKeyframe[] = [];

  for (const keyframe of sorted) {
    const previous = deduplicated[deduplicated.length - 1];
    if (previous && previous.timeMs === keyframe.timeMs) {
      deduplicated[deduplicated.length - 1] = keyframe;
    } else {
      deduplicated.push(keyframe);
    }
  }

  return deduplicated;
}

export function getAudioVolumeKeyframeAtTime(
  keyframes: AudioVolumeKeyframe[] | undefined,
  timeMs: number,
): AudioVolumeKeyframe | null {
  if (!Number.isFinite(timeMs)) return null;

  const currentTimeMs = Math.max(0, Math.round(timeMs));
  return (
    normalizeAudioVolumeKeyframes(keyframes).find(
      (keyframe) => keyframe.timeMs === currentTimeMs,
    ) ?? null
  );
}

export function getAudioVolumeAtTime(
  clip: Pick<Clip, "audioVolumeKeyframes">,
  timeMs: number,
): number {
  const keyframes = normalizeAudioVolumeKeyframes(clip.audioVolumeKeyframes);
  if (!keyframes.length || !Number.isFinite(timeMs)) {
    return DEFAULT_AUDIO_CLIP_VOLUME;
  }

  const currentTimeMs = Math.max(0, timeMs);
  const first = keyframes[0];

  if (currentTimeMs <= first.timeMs) return first.volume;

  const last = keyframes[keyframes.length - 1];
  if (currentTimeMs >= last.timeMs) return last.volume;

  for (let index = 1; index < keyframes.length; index += 1) {
    const next = keyframes[index];
    if (currentTimeMs > next.timeMs) continue;

    const previous = keyframes[index - 1];
    const durationMs = next.timeMs - previous.timeMs;
    const progress = durationMs > 0
      ? (currentTimeMs - previous.timeMs) / durationMs
      : 1;

    return previous.volume + (next.volume - previous.volume) * progress;
  }

  return DEFAULT_AUDIO_CLIP_VOLUME;
}

export function upsertAudioVolumeKeyframe(
  keyframes: AudioVolumeKeyframe[] | undefined,
  timeMs: number,
  volume: number,
): AudioVolumeKeyframe[] {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new Error("Audio volume keyframe time must be zero or greater.");
  }

  if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
    throw new Error("Audio volume must be between 0 and 1.");
  }

  const normalized = normalizeAudioVolumeKeyframes(keyframes);
  const roundedTimeMs = Math.max(0, Math.round(timeMs));
  const next = {
    timeMs: roundedTimeMs,
    volume: clampAudioVolume(volume),
  };

  const existingIndex = normalized.findIndex(
    (keyframe) => keyframe.timeMs === roundedTimeMs,
  );

  if (existingIndex === -1) normalized.push(next);
  else normalized[existingIndex] = next;

  return normalized.sort((a, b) => a.timeMs - b.timeMs);
}

export function removeAudioVolumeKeyframe(
  keyframes: AudioVolumeKeyframe[] | undefined,
  timeMs: number,
): AudioVolumeKeyframe[] {
  if (!Number.isFinite(timeMs)) {
    return normalizeAudioVolumeKeyframes(keyframes);
  }

  const roundedTimeMs = Math.max(0, Math.round(timeMs));
  return normalizeAudioVolumeKeyframes(keyframes).filter(
    (keyframe) => keyframe.timeMs !== roundedTimeMs,
  );
}

function clampAudioVolume(volume: number): number {
  return Math.min(1, Math.max(0, Math.round(volume * 1000) / 1000));
}
