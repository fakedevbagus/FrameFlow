import { invoke } from "@tauri-apps/api/core";

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
}

export interface NativeVideoGraphRenderRequest {
  inputs: string[];
  outputPath: string;
  width: number;
  height: number;
  frameRate: number;
  filterComplex: string;
  videoMap: string;
}

export function renderSingleSourceToMp4(
  request: NativeExportRenderRequest,
): Promise<NativeExportRenderResult> {
  return invoke<NativeExportRenderResult>("render_single_source_to_mp4", {
    request,
  });
}

export function renderVideoGraphToMp4(
  request: NativeVideoGraphRenderRequest,
): Promise<NativeExportRenderResult> {
  return invoke<NativeExportRenderResult>("render_video_graph_to_mp4", {
    request,
  });
}
export function renderVideoSegmentsToMp4(
  request: NativeVideoSegmentsRenderRequest,
): Promise<NativeExportRenderResult> {
  return invoke<NativeExportRenderResult>("render_video_segments_to_mp4", {
    request,
  });
}

