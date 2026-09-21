import { invoke } from "@tauri-apps/api/core";

export interface AudioWaveform {
  durationMs: number;
  sampleRate: number;
  peaks: number[];
}

const waveformCache = new Map<string, Promise<AudioWaveform>>();

export function getAudioWaveform(
  sourcePath: string,
  peakCount = 128,
): Promise<AudioWaveform> {
  const normalizedPeakCount = Math.min(
    2048,
    Math.max(32, Math.round(peakCount)),
  );
  const cacheKey = sourcePath + "::" + normalizedPeakCount;
  const cached = waveformCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const request = invoke<AudioWaveform>("generate_audio_waveform", {
    path: sourcePath,
    peakCount: normalizedPeakCount,
  }).then((waveform) => {
    if (
      !waveform ||
      !Number.isFinite(waveform.durationMs) ||
      !Number.isFinite(waveform.sampleRate) ||
      !Array.isArray(waveform.peaks)
    ) {
      throw new Error("Native waveform data is invalid.");
    }

    return {
      durationMs: Math.max(0, Math.round(waveform.durationMs)),
      sampleRate: Math.max(1, Math.round(waveform.sampleRate)),
      peaks: waveform.peaks
        .filter((peak) => Number.isFinite(peak))
        .map((peak) => Math.min(1, Math.max(0, peak))),
    };
  });

  waveformCache.set(cacheKey, request);

  void request.catch(() => {
    if (waveformCache.get(cacheKey) === request) {
      waveformCache.delete(cacheKey);
    }
  });

  return request;
}

export function clearAudioWaveformCache(): void {
  waveformCache.clear();
}

export function getWaveformLocalTimeMs(
  clientX: number,
  left: number,
  width: number,
  durationMs: number,
): number {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(left) ||
    !Number.isFinite(width) ||
    !Number.isFinite(durationMs) ||
    width <= 0 ||
    durationMs <= 0
  ) {
    return 0;
  }

  const progress = Math.min(
    1,
    Math.max(0, (clientX - left) / width),
  );

  return Math.round(progress * durationMs);
}

export function buildWaveformPath(
  peaks: number[],
  width = 128,
  height = 1,
): string {
  if (!peaks.length || width <= 0 || height <= 0) {
    return "";
  }

  const center = height / 2;
  const amplitude = height * 0.46;
  const points = peaks.map((peak, index) => {
    const x =
      peaks.length === 1
        ? width / 2
        : index / (peaks.length - 1) * width;
    const normalizedPeak = Math.min(1, Math.max(0, peak));
    const yTop = center - normalizedPeak * amplitude;
    const yBottom = center + normalizedPeak * amplitude;

    return { x, yTop, yBottom };
  });

  const top = points
    .map((point, index) =>
      (index === 0 ? "M" : "L") +
      " " +
      point.x.toFixed(3) +
      " " +
      point.yTop.toFixed(3),
    )
    .join(" ");

  const bottom = [...points]
    .reverse()
    .map((point) =>
      "L " +
      point.x.toFixed(3) +
      " " +
      point.yBottom.toFixed(3),
    )
    .join(" ");

  return top + " " + bottom + " Z";
}
