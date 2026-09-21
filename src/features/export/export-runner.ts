import type { Project } from "../project/domain";
import { createRenderPlan } from "./render-plan";
import { M3_38_DIRECT_GRAPH_MARKER } from "./render-graph";
import { renderVideoPlanToMp4 } from "./render-pipeline";
import { requestExportCancellation } from "./export-renderer";
import { subscribeToExportProgress, type ExportProgressEvent } from "./export-progress";
import {
  cancelExportJob as markExportJobCancelled,
  completeExportJob,
  createExportJob,
  failExportJob,
  startExportJob,
  updateExportJobProgress,
  type ExportJob,
  type ExportJobRequest,
} from "./export-job";

export type ExportJobUpdateHandler = (job: ExportJob) => void;

export async function runExportJob(
  project: Project,
  request: ExportJobRequest,
  onUpdate?: ExportJobUpdateHandler,
  id?: string,
): Promise<ExportJob> {
  let job = startExportJob(createExportJob(request, id));
  onUpdate?.(job);

  let unsubscribeProgress: (() => void) | null = null;

  try {
    const plan = createRenderPlan(project, request.settings);
    const hasIndependentAudio = plan.segments.some(
      (segment) => segment.trackType === "audio" && segment.durationMs > 0,
    );

    try {
      unsubscribeProgress = await subscribeToExportProgress(job.id, (event) => {
        job = updateExportJobProgress(
          job,
          mapNativeExportProgress(event, hasIndependentAudio),
        );
        onUpdate?.(job);
      });
    } catch {
      // Progress events are optional so browser-mode tests and unavailable runtimes can still render.
    }

    const result = await renderVideoPlanToMp4(
      plan,
      request.outputPath,
      job.id,
    );
    job = completeExportJob(job, result.outputPath);
  } catch (error) {
    if (isExportCancellationError(error)) {
      job = markExportJobCancelled(job);
    } else {
      job = failExportJob(job, getExportErrorMessage(error));
    }
  } finally {
    unsubscribeProgress?.();
  }

  onUpdate?.(job);
  return job;
}

export async function requestExportJobCancellation(jobId: string): Promise<void> {
  await requestExportCancellation(jobId);
}

function mapNativeExportProgress(
  event: ExportProgressEvent,
  hasIndependentAudio: boolean,
): number {
  const progress = Math.min(1, Math.max(0, event.progress));

  if (!hasIndependentAudio) {
    return progress;
  }

  if (event.stage === "audio-mix") {
    return 0.8 + progress * 0.2;
  }

  return progress * 0.8;
}

function isExportCancellationError(error: unknown): boolean {
  return (
    (error instanceof Error && error.message === "Export cancelled.") ||
    error === "Export cancelled."
  );
}

function getExportErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${M3_38_DIRECT_GRAPH_MARKER}: ${error.message}`;
  }

  if (typeof error === "string") {
    return `${M3_38_DIRECT_GRAPH_MARKER}: ${error}`;
  }

  return `${M3_38_DIRECT_GRAPH_MARKER}: Export failed.`;
}
