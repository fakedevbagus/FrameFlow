import { invoke } from "@tauri-apps/api/core";
import type {
  AudioCompressor,
  AudioEq,
  AudioVolumeKeyframe,
  MediaType,
} from "../project/domain";

export interface NativeExportRenderRequest {
  sourcePath: string;
  outputPath: string;
  width: number;
  height: number;
  frameRate: number;
  sourceStartMs?: number;
  sourceDurationMs?: number;
  includeAudio?: boolean;
}

export interface NativeExportRenderResult {
  outputPath: string;
}

export interface NativeVideoSegment {
  sourcePath?: string;
  sourceStartMs?: number;
  durationMs: number;
}

export interface NativeVideoSegmentsRenderRequest {
  segments: NativeVideoSegment[];
  outputPath: string;
  width: number;
  height: number;
  frameRate: number;
  includeAudio?: boolean;
}



export interface NativeAudioGraphRenderRequest {
  inputs: string[];
  outputPath: string;
  filterComplex: string;
  audioMap: string;
}

export interface NativeVideoWithAudioGraphRenderRequest {
  videoSourcePath: string;
  audioInputs: string[];
  audioFilterComplex: string;
  audioMap: string;
  durationMs: number;
  outputPath: string;
}

export interface NativeSourceAudioSegment {
  inputIndex: number;
  sourceStartMs: number;
  timelineStartMs: number;
  durationMs: number;
  trackVolume: number;
  trackPan: number;
  audioVolumeKeyframes?: AudioVolumeKeyframe[];
  audioEq?: AudioEq;
  audioCompressor?: AudioCompressor;
}

export interface NativeVideoAudioGraphRenderRequest {
  videoInputs: string[];
  videoInputMediaTypes: MediaType[];
  audioInputs: string[];
  sourceAudioSegments?: NativeSourceAudioSegment[];
  videoFilterComplex: string;
  videoMap: string;
  audioFilterComplex: string;
  audioMap: string;
  durationMs: number;
  width: number;
  height: number;
  frameRate: number;
  outputPath: string;
}

export interface NativeVideoGraphRenderRequest {
  inputs: string[];
  inputMediaTypes?: MediaType[];
  outputPath: string;
  width: number;
  height: number;
  frameRate: number;
  filterComplex: string;
  videoMap: string;
}

export function renderSingleSourceToMp4(
  request: NativeExportRenderRequest,
  jobId?: string,
): Promise<NativeExportRenderResult> {
  return invoke<NativeExportRenderResult>("render_single_source_to_mp4", {
    request,
    ...(jobId ? { jobId } : {}),
  });
}

export function renderAudioGraphToMp4(
  request: NativeAudioGraphRenderRequest,
  jobId?: string,
  durationMs?: number,
): Promise<NativeExportRenderResult> {
  return invoke<NativeExportRenderResult>("render_audio_graph_to_mp4", {
    request,
    ...(jobId ? { jobId } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  });
}

export function renderVideoWithAudioGraphToMp4(
  request: NativeVideoWithAudioGraphRenderRequest,
  jobId?: string,
): Promise<NativeExportRenderResult> {
  return invoke<NativeExportRenderResult>(
    "render_video_with_audio_graph_to_mp4",
    {
      request,
      ...(jobId ? { jobId } : {}),
    },
  );
}

export function renderVideoAudioGraphToMp4(
  request: NativeVideoAudioGraphRenderRequest,
  jobId?: string,
): Promise<NativeExportRenderResult> {
  return invoke<NativeExportRenderResult>(
    "render_video_audio_graph_to_mp4",
    {
      request,
      ...(jobId ? { jobId } : {}),
    },
  );
}

export function renderVideoGraphToMp4(
  request: NativeVideoGraphRenderRequest,
  jobId?: string,
  durationMs?: number,
): Promise<NativeExportRenderResult> {
  return invoke<NativeExportRenderResult>("render_video_graph_to_mp4", {
    request,
    ...(jobId ? { jobId } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  });
}
export function renderVideoSegmentsToMp4(
  request: NativeVideoSegmentsRenderRequest,
  jobId?: string,
): Promise<NativeExportRenderResult> {
  return invoke<NativeExportRenderResult>("render_video_segments_to_mp4", {
    request,
    ...(jobId ? { jobId } : {}),
  });
}

export function requestExportCancellation(jobId: string): Promise<void> {
  return invoke<void>("cancel_export_job", {
    request: { jobId },
  });
}

