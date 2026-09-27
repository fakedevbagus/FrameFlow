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
const MAX_WAVEFORM_OUTPUT_PEAK_COUNT = 2048;
const MAX_WAVEFORM_SOURCE_FINGERPRINT_LENGTH = 128;
const waveformRequestCache = new Map<string, Promise<AudioWaveform>>();

export async function getAudioWaveform(
  sourcePath: string,
  peakCount = 128,
): Promise<AudioWaveform> {
  const normalizedPeakCount = normalizeWaveformPeakCount(peakCount);

  const fingerprintResponse = await invoke<AudioWaveformSourceFingerprint>(
    "get_audio_waveform_source_fingerprint",
    { path: sourcePath },
  );

  if (
    !fingerprintResponse ||
    typeof fingerprintResponse.sourceFingerprint !== "string" ||
    fingerprintResponse.sourceFingerprint.length === 0 ||
    fingerprintResponse.sourceFingerprint.length > MAX_WAVEFORM_SOURCE_FINGERPRINT_LENGTH
  ) {
    throw new Error("Native waveform source fingerprint is invalid.");
  }

  const fingerprint = fingerprintResponse.sourceFingerprint;
  const requestKey =
    sourcePath + "::" + normalizedPeakCount + "::" + fingerprint;
  const cachedRequest = waveformRequestCache.get(requestKey);

  if (cachedRequest) {
    return cachedRequest;
  }

  const persistent = readPersistentWaveform(requestKey);
  if (persistent) {
    return persistent;
  }

  const request = invoke<AudioWaveform>("generate_audio_waveform", {
    path: sourcePath,
    peakCount: normalizedPeakCount,
  }).then((waveform) => {
    if (
      !waveform ||
      !Number.isSafeInteger(waveform.durationMs) ||
      waveform.durationMs <= 0 ||
      !Number.isSafeInteger(waveform.sampleRate) ||
      waveform.sampleRate <= 0 ||
      !isValidWaveformPeakArray(waveform.peaks) ||
      typeof waveform.sourceFingerprint !== "string" ||
      waveform.sourceFingerprint.length === 0 ||
      waveform.sourceFingerprint.length > MAX_WAVEFORM_SOURCE_FINGERPRINT_LENGTH
    ) {
      throw new Error("Native waveform data is invalid.");
    }

    if (waveform.sourceFingerprint !== fingerprint) {
      throw new Error(
        "Native waveform source fingerprint changed during generation.",
      );
    }

    const normalizedWaveform = {
      durationMs: waveform.durationMs,
      sampleRate: waveform.sampleRate,
      peaks: waveform.peaks.map(normalizeWaveformPeak),
      sourceFingerprint: waveform.sourceFingerprint,
    };

    const generatedCacheKey =
      sourcePath +
      "::" +
      normalizedPeakCount +
      "::" +
      normalizedWaveform.sourceFingerprint;

    writePersistentWaveform(generatedCacheKey, normalizedWaveform);

    return normalizedWaveform;
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
    if (!entry || !isValidPersistentWaveformEntry(entry)) {
      return null;
    }

    if (!isPersistentWaveformEntryKeyConsistent(entry, cacheKey)) {
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
    const entries = isPersistentWaveformStore(parsed)
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

function isValidWaveformPeakArray(value: unknown): value is number[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_WAVEFORM_OUTPUT_PEAK_COUNT
  ) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    if (typeof value[index] !== "number") {
      return false;
    }
  }

  return true;
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
    Number.isSafeInteger(candidate.durationMs) &&
    candidate.durationMs > 0 &&
    candidate.sampleRate !== undefined &&
    Number.isSafeInteger(candidate.sampleRate) &&
    candidate.sampleRate > 0 &&
    isValidWaveformPeakArray(candidate.peaks) &&
    typeof candidate.sourceFingerprint === "string" &&
    candidate.sourceFingerprint.length > 0 &&
    candidate.sourceFingerprint.length <= MAX_WAVEFORM_SOURCE_FINGERPRINT_LENGTH
  );
}

function isValidPersistentWaveformEntry(
  value: unknown,
): value is PersistentWaveformEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistentWaveformEntry>;
  return (
    typeof candidate.cacheKey === "string" &&
    candidate.cacheKey.length > 0 &&
    isValidAudioWaveform(candidate.waveform) &&
    candidate.lastUsedAt !== undefined &&
    Number.isSafeInteger(candidate.lastUsedAt) &&
    candidate.lastUsedAt >= 0
  );
}

function isPersistentWaveformEntryKeyConsistent(
  entry: PersistentWaveformEntry,
  cacheKey: string,
): boolean {
  return cacheKey.endsWith("::" + entry.waveform.sourceFingerprint);
}

function isPersistentWaveformStore(
  value: unknown,
): value is PersistentWaveformStore {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistentWaveformStore>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.entries) &&
    candidate.entries.length <= MAX_PERSISTENT_WAVEFORM_ENTRIES &&
    candidate.entries.every(isValidPersistentWaveformEntry)
  );
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
    !isValidWaveformPeakArray(peaks) ||
    !Number.isSafeInteger(sourceDurationMs) ||
    sourceDurationMs <= 0 ||
    !Number.isSafeInteger(sourceStartMs) ||
    !Number.isSafeInteger(outputPeakCount) ||
    outputPeakCount <= 0 ||
    (sourceEndMs !== null && !Number.isSafeInteger(sourceEndMs))
  ) {
    return [];
  }

  const safeOutputCount = outputPeakCount;
  if (
    !Number.isSafeInteger(safeOutputCount) ||
    safeOutputCount <= 0 ||
    safeOutputCount > MAX_WAVEFORM_OUTPUT_PEAK_COUNT
  ) {
    return [];
  }

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
    !Number.isSafeInteger(durationMs) ||
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
    !isValidWaveformPeakArray(peaks) ||
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
