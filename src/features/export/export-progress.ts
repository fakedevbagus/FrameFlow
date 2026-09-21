import { listen } from "@tauri-apps/api/event";

export interface ExportProgressEvent {
  jobId: string;
  stage: "video" | "audio" | "audio-mix";
  progress: number;
}

export type ExportProgressHandler = (event: ExportProgressEvent) => void;

export async function subscribeToExportProgress(
  jobId: string,
  onProgress: ExportProgressHandler,
): Promise<() => void> {
  return listen<ExportProgressEvent>("export-progress", (event) => {
    if (event.payload.jobId !== jobId) {
      return;
    }

    onProgress({
      ...event.payload,
      progress: Math.min(1, Math.max(0, event.payload.progress)),
    });
  });
}
