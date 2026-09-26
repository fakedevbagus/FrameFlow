import { invoke } from "@tauri-apps/api/core";

export interface AudioWaveform {
  durationMs: number;
  sampleRate: number;
  peaks: number[];
  sourceFingerprint: string;
}

interface AudioWaveformSourceFingerprint {
  sourceFingerprint: string;
}

interface PersistentWaveformEntry {
  cacheKey: string;
  waveform: AudioWaveform;
  lastUsedAt: number;
}

interface PersistentWaveformStore {
  version: 1;
  entries: PersistentWaveformEntry[];
}

const PERSISTENT_WAVEFORM_STORAGE_KEY = "frameflow.audio-waveform-cache.v1";
const MAX_PERSISTENT_WAVEFORM_ENTRIES = 32;
const waveformRequestCache = new Map<string, Promise<AudioWaveform>>();

export function getAudioWaveform(
  sourcePath: string,
  peakCount = 128,
): Promise<AudioWaveform> {
  const normalizedPeakCount = normalizeWaveformPeakCount(peakCount);
  const requestKey = sourcePath + "::" + normalizedPeakCount;
  const cachedRequest = waveformRequestCache.get(requestKey);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = invoke<AudioWaveformSourceFingerprint>(
    "get_audio_waveform_source_fingerprint",
    { path: sourcePath },
  )
    .then((fingerprint) => {
      if (
        !fingerprint ||
        typeof fingerprint.sourceFingerprint !== "string" ||
        fingerprint.sourceFingerprint.length === 0
      ) {
        throw new Error("Native waveform source fingerprint is invalid.");
      }

      return fingerprint.sourceFingerprint;
    })
    .then((fingerprint) => {
      const cacheKey =
        sourcePath + "::" + normalizedPeakCount + "::" + fingerprint;
      const persistent = readPersistentWaveform(cacheKey);

      if (persistent) {
        return persistent;
      }

      return invoke<AudioWaveform>("generate_audio_waveform", {
        path: sourcePath,
        peakCount: normalizedPeakCount,
      }).then((waveform) => {
        if (
          !waveform ||
          !Number.isSafeInteger(waveform.durationMs) ||
          waveform.durationMs <= 0 ||
          !Number.isSafeInteger(waveform.sampleRate) ||
          waveform.sampleRate <= 0 ||
          !Array.isArray(waveform.peaks) ||
          waveform.peaks.length === 0 ||
          typeof waveform.sourceFingerprint !== "string" ||
          waveform.sourceFingerprint.length === 0
        ) {
          throw new Error("Native waveform data is invalid.");
        }

        const normalizedWaveform = {
          durationMs: waveform.durationMs,
          sampleRate: waveform.sampleRate,
          peaks: waveform.peaks.map(normalizeWaveformPeak),
          sourceFingerprint: waveform.sourceFingerprint,
        };

        writePersistentWaveform(
          sourcePath +
            "::" +
            normalizedPeakCount +
            "::" +
            normalizedWaveform.sourceFingerprint,
          normalizedWaveform,
        );

        return normalizedWaveform;
      });
    });

  waveformRequestCache.set(requestKey, request);

  void request.then(
    () => {
      if (waveformRequestCache.get(requestKey) === request) {
        waveformRequestCache.delete(requestKey);
      }
    },
    () => {
      if (waveformRequestCache.get(requestKey) === request) {
        waveformRequestCache.delete(requestKey);
      }
    },
  );

  return request;
}

function normalizeWaveformPeakCount(peakCount: number): number {
  if (!Number.isFinite(peakCount)) {
    return 128;
  }

  return Math.min(2048, Math.max(32, Math.round(peakCount)));
}

export function clearAudioWaveformCache(): void {
  waveformRequestCache.clear();

  try {
    globalThis.localStorage?.removeItem(PERSISTENT_WAVEFORM_STORAGE_KEY);
  } catch {
    // Persistent waveform caching is best-effort.
  }
}

function readPersistentWaveform(cacheKey: string): AudioWaveform | null {
  try {
    const raw = globalThis.localStorage?.getItem(
      PERSISTENT_WAVEFORM_STORAGE_KEY,
    );
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isPersistentWaveformStore(parsed)) {
      return null;
    }

    const store = parsed;

    const entry = store.entries.find((candidate) => candidate.cacheKey === cacheKey);
    if (!entry || !isValidAudioWaveform(entry.waveform)) {
      return null;
    }

    touchPersistentWaveform(store.entries, entry);
    persistWaveformStore(store);

    return {
      ...entry.waveform,
      peaks: entry.waveform.peaks.map(normalizeWaveformPeak),
    };
  } catch {
    return null;
  }
}

function writePersistentWaveform(
  cacheKey: string,
  waveform: AudioWaveform,
): void {
  try {
    const raw = globalThis.localStorage?.getItem(
      PERSISTENT_WAVEFORM_STORAGE_KEY,
    );
    const parsed = raw
      ? (JSON.parse(raw) as Partial<PersistentWaveformStore>)
      : null;
    const entries =
      parsed?.version === 1 && Array.isArray(parsed.entries)
        ? parsed.entries.filter((entry) => entry.cacheKey !== cacheKey)
        : [];

    entries.push({
      cacheKey,
      waveform,
      lastUsedAt: Date.now(),
    });

    entries.sort((left, right) => right.lastUsedAt - left.lastUsedAt);
    entries.splice(MAX_PERSISTENT_WAVEFORM_ENTRIES);

    persistWaveformStore({
      version: 1,
      entries,
    });
  } catch {
    // Persistent waveform caching is best-effort.
  }
}

function persistWaveformStore(store: PersistentWaveformStore): void {
  try {
    globalThis.localStorage?.setItem(
      PERSISTENT_WAVEFORM_STORAGE_KEY,
      JSON.stringify(store),
    );
  } catch {
    // Persistent waveform caching is best-effort.
  }
}

function touchPersistentWaveform(
  entries: PersistentWaveformEntry[],
  entry: PersistentWaveformEntry,
): void {
  entry.lastUsedAt = Date.now();
  entries.sort((left, right) => right.lastUsedAt - left.lastUsedAt);
}

function isValidAudioWaveform(
  waveform: unknown,
): waveform is AudioWaveform {
  if (!waveform || typeof waveform !== "object") {
    return false;
  }

  const candidate = waveform as Partial<AudioWaveform>;
  return (
    candidate.durationMs !== undefined &&
    Number.isFinite(candidate.durationMs) &&
    candidate.durationMs > 0 &&
    candidate.sampleRate !== undefined &&
    Number.isFinite(candidate.sampleRate) &&
    candidate.sampleRate > 0 &&
    Array.isArray(candidate.peaks) &&
    candidate.peaks.length > 0 &&
    typeof candidate.sourceFingerprint === "string" &&
    candidate.sourceFingerprint.length > 0
  );
}

function isPersistentWaveformStore(
  value: unknown,
): value is PersistentWaveformStore {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistentWaveformStore>;
  return candidate.version === 1 && Array.isArray(candidate.entries);
}

function normalizeWaveformPeak(peak: number): number {
  if (!Number.isFinite(peak)) {
    return 0;
  }

  return Math.min(1, Math.max(0, peak));
}

export function getWaveformPeaksForSourceRange(
  peaks: number[],
  sourceDurationMs: number,
  sourceStartMs: number,
  sourceEndMs: number | null,
  outputPeakCount = peaks.length,
): number[] {
  if (
    peaks.length === 0 ||
    !Number.isFinite(sourceDurationMs) ||
    sourceDurationMs <= 0 ||
    !Number.isFinite(sourceStartMs) ||
    sourceStartMs < 0 ||
    !Number.isFinite(outputPeakCount) ||
    outputPeakCount <= 0
  ) {
    return [];
  }

  const safeOutputCount = Math.max(1, Math.round(outputPeakCount));
  const safeStartMs = Math.min(sourceDurationMs, Math.max(0, sourceStartMs));
  const requestedEndMs =
    sourceEndMs === null || !Number.isFinite(sourceEndMs)
      ? sourceDurationMs
      : sourceEndMs;
  const safeEndMs = Math.min(
    sourceDurationMs,
    Math.max(safeStartMs, requestedEndMs),
  );

  if (safeEndMs <= safeStartMs) {
    return Array.from({ length: safeOutputCount }, () => 0);
  }

  if (
    safeStartMs === 0 &&
    safeEndMs === sourceDurationMs &&
    safeOutputCount === peaks.length
  ) {
    return peaks.map(normalizeWaveformPeak);
  }

  const lastSourceIndex = peaks.length - 1;
  const rangeDurationMs = safeEndMs - safeStartMs;

  return Array.from({ length: safeOutputCount }, (_, index) => {
    const progress = safeOutputCount === 1 ? 0 : index / (safeOutputCount - 1);
    const sourceTimeMs = safeStartMs + progress * rangeDurationMs;
    const sourcePosition =
      sourceDurationMs <= 0
        ? 0
        : sourceTimeMs / sourceDurationMs * lastSourceIndex;
    const leftIndex = Math.floor(sourcePosition);
    const rightIndex = Math.min(lastSourceIndex, leftIndex + 1);
    const fraction = sourcePosition - leftIndex;
    const leftPeak = normalizeWaveformPeak(peaks[leftIndex] ?? 0);
    const rightPeak = normalizeWaveformPeak(peaks[rightIndex] ?? leftPeak);

    return normalizeWaveformPeak(
      leftPeak + (rightPeak - leftPeak) * fraction,
    );
  });
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
