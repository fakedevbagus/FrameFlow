import type { Project } from "../project/domain";
import { createRenderPlan } from "./render-plan";
import { renderVideoPlanToMp4 } from "./render-pipeline";
import {
  completeExportJob,
  createExportJob,
  failExportJob,
  startExportJob,
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

  try {
    const plan = createRenderPlan(project, request.settings);
    const result = await renderVideoPlanToMp4(plan, request.outputPath);
    job = completeExportJob(job, result.outputPath);
  } catch (error) {
    job = failExportJob(job, getExportErrorMessage(error));
  }

  onUpdate?.(job);
  return job;
}

function getExportErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Export failed.";
}
