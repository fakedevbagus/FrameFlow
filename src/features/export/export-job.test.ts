import { describe, expect, it } from "vitest";
import { createProject } from "../project/domain";
import {
  cancelExportJob,
  completeExportJob,
  createExportJob,
  failExportJob,
  startExportJob,
  updateExportJobProgress,
} from "./export-job";
import { createDefaultExportSettings } from "./export";

describe("export job", () => {
  it("creates a queued job with zero progress", () => {
    const request = {
      settings: createDefaultExportSettings(createProject()),
      outputPath: "/tmp/example.mp4",
    };

    expect(createExportJob(request, "job-1")).toEqual({
      id: "job-1",
      phase: "queued",
      progress: 0,
      request,
      errorMessage: null,
      outputPath: null,
    });
  });

  it("transitions through running progress and completion", () => {
    const request = {
      settings: createDefaultExportSettings(createProject()),
      outputPath: "/tmp/example.mp4",
    };

    const job = createExportJob(request, "job-1");

    expect(
      completeExportJob(updateExportJobProgress(startExportJob(job), 1.4)),
    ).toMatchObject({
      phase: "completed",
      progress: 1,
      outputPath: "/tmp/example.mp4",
      errorMessage: null,
    });
  });

  it("never moves progress backwards", () => {
    const request = {
      settings: createDefaultExportSettings(createProject()),
      outputPath: "/tmp/example.mp4",
    };
    const job = updateExportJobProgress(
      startExportJob(createExportJob(request, "job-1")),
      0.75,
    );

    expect(updateExportJobProgress(job, 0.25).progress).toBe(0.75);
    expect(updateExportJobProgress(job, 1.2).progress).toBe(1);
  });

  it("preserves terminal failure and cancellation states", () => {
    const request = {
      settings: createDefaultExportSettings(createProject()),
      outputPath: "/tmp/example.mp4",
    };
    const job = createExportJob(request, "job-1");

    expect(failExportJob(job, "  renderer failed  ")).toMatchObject({
      phase: "failed",
      errorMessage: "renderer failed",
    });
    expect(cancelExportJob(job)).toMatchObject({
      phase: "cancelled",
      errorMessage: null,
    });
  });
});
