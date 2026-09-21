import type { ExportSettings } from "./export";

export type ExportJobPhase =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ExportJobRequest {
  settings: ExportSettings;
  outputPath: string;
}

export interface ExportJob {
  id: string;
  phase: ExportJobPhase;
  progress: number;
  request: ExportJobRequest;
  errorMessage: string | null;
  outputPath: string | null;
}

export function createExportJob(
  request: ExportJobRequest,
  id: string = `export-${crypto.randomUUID()}`,
): ExportJob {
  return {
    id,
    phase: "queued",
    progress: 0,
    request,
    errorMessage: null,
    outputPath: null,
  };
}

export function startExportJob(job: ExportJob): ExportJob {
  return {
    ...job,
    phase: "running",
    errorMessage: null,
  };
}

export function updateExportJobProgress(
  job: ExportJob,
  progress: number,
): ExportJob {
  const normalizedProgress = Math.min(1, Math.max(0, progress));

  return {
    ...job,
    progress: Math.max(job.progress, normalizedProgress),
  };
}

export function completeExportJob(
  job: ExportJob,
  outputPath: string = job.request.outputPath,
): ExportJob {
  return {
    ...job,
    phase: "completed",
    progress: 1,
    errorMessage: null,
    outputPath,
  };
}

export function failExportJob(job: ExportJob, errorMessage: string): ExportJob {
  return {
    ...job,
    phase: "failed",
    errorMessage: errorMessage.trim() || "Export failed.",
  };
}

export function cancelExportJob(job: ExportJob): ExportJob {
  return {
    ...job,
    phase: "cancelled",
    errorMessage: null,
  };
}
