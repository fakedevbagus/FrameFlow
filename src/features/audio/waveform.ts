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
      waveform.durationMs <= 0 ||
      !Number.isFinite(waveform.sampleRate) ||
      waveform.sampleRate <= 0 ||
      !Array.isArray(waveform.peaks) ||
      waveform.peaks.length === 0
    ) {
      throw new Error("Native waveform data is invalid.");
    }

    return {
      durationMs: Math.max(0, Math.round(waveform.durationMs)),
      sampleRate: Math.max(1, Math.round(waveform.sampleRate)),
      peaks: waveform.peaks.map(normalizeWaveformPeak),
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

function normalizeWaveformPeak(peak: number): number {
  if (!Number.isFinite(peak)) {
    return 0;
  }

  return Math.min(1, Math.max(0, peak));
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

export interface WaveformSelectionRange {
  startMs: number;
  endMs: number;
}

export function getWaveformSelectionRangeMs(
  startClientX: number,
  endClientX: number,
  left: number,
  width: number,
  durationMs: number,
): WaveformSelectionRange | null {
  const startMs = getWaveformLocalTimeMs(
    startClientX,
    left,
    width,
    durationMs,
  );
  const endMs = getWaveformLocalTimeMs(
    endClientX,
    left,
    width,
    durationMs,
  );

  if (startMs === endMs) {
    return null;
  }

  return {
    startMs: Math.min(startMs, endMs),
    endMs: Math.max(startMs, endMs),
  };
}

export function buildWaveformPath(
  peaks: number[],
  width = 128,
  height = 1,
): string {
  if (
    !peaks.length ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return "";
  }

  const normalizedPeaks = peaks.map(normalizeWaveformPeak);
  const center = height / 2;
  const amplitude = height * 0.36;
  const points = normalizedPeaks.map((peak, index) => {

    const x =
      normalizedPeaks.length === 1
        ? width / 2
        : index / (normalizedPeaks.length - 1) * width;
    const visualPeak = Math.pow(peak, 0.72);
    const yTop = center - visualPeak * amplitude;
    const yBottom = center + visualPeak * amplitude;

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
