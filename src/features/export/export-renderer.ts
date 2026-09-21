import { invoke } from "@tauri-apps/api/core";

export interface NativeExportRenderRequest {
  sourcePath: string;
  outputPath: string;
  width: number;
  height: number;
  frameRate: number;
}

export interface NativeExportRenderResult {
  outputPath: string;
}

export interface NativeVideoGraphRenderRequest {
  inputs: Array<{
    inputIndex: number;
    sourcePath: string;
  }>;
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
