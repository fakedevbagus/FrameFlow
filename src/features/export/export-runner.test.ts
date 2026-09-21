import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultExportSettings } from "./export";
import { runExportJob } from "./export-runner";
import { createProject } from "../project/domain";

const { createRenderPlan, renderVideoPlanToMp4, subscribeToExportProgress } = vi.hoisted(() => ({
  createRenderPlan: vi.fn(),
  renderVideoPlanToMp4: vi.fn(),
  subscribeToExportProgress: vi.fn(),
}));

vi.mock("./render-plan", () => ({
  createRenderPlan,
}));

vi.mock("./render-pipeline", () => ({
  renderVideoPlanToMp4,
}));

vi.mock("./export-progress", () => ({
  subscribeToExportProgress,
}));

describe("runExportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeToExportProgress.mockResolvedValue(vi.fn());
  });

  it("runs a render plan and completes the job", async () => {
    const project = createProject();
    const settings = createDefaultExportSettings(project);
    const plan = {
      width: 1080,
      height: 1920,
      frameRate: 30,
      durationMs: 2000,
      segments: [],
    };
    const updates: string[] = [];

    createRenderPlan.mockReturnValueOnce(plan);
    renderVideoPlanToMp4.mockResolvedValueOnce({
      outputPath: "/home/user/Exports/demo.mp4",
    });

    const job = await runExportJob(
      project,
      {
        settings,
        outputPath: "/home/user/Exports/demo.mp4",
      },
      (update) => updates.push(update.phase),
      "export-test",
    );

    expect(createRenderPlan).toHaveBeenCalledWith(project, settings);
    expect(renderVideoPlanToMp4).toHaveBeenCalledWith(
      plan,
      "/home/user/Exports/demo.mp4",
      "export-test",
    );
    expect(updates).toEqual(["running", "completed"]);
    expect(job.phase).toBe("completed");
    expect(job.progress).toBe(1);
    expect(job.outputPath).toBe("/home/user/Exports/demo.mp4");
  });

  it("turns planner or renderer errors into a failed job", async () => {
    const project = createProject();
    const settings = createDefaultExportSettings(project);

    createRenderPlan.mockImplementationOnce(() => {
      throw new Error("Render plan has no supported video clips.");
    });

    const job = await runExportJob(
      project,
      {
        settings,
        outputPath: "/home/user/Exports/demo.mp4",
      },
      undefined,
      "export-failed",
    );

    expect(job.phase).toBe("failed");
    expect(job.progress).toBe(0);
    expect(job.errorMessage).toBe(
      "m3.38-direct-graph-v2: Render plan has no supported video clips.",
    );
    expect(renderVideoPlanToMp4).not.toHaveBeenCalled();
  });
});


  it("maps two-stage video and audio progress into one monotonic progress bar", async () => {
    const project = createProject();
    const settings = createDefaultExportSettings(project);
    const plan = {
      width: 1080,
      height: 1920,
      frameRate: 30,
      durationMs: 5000,
      segments: [
        {
          trackType: "video",
          durationMs: 5000,
        },
        {
          trackType: "audio",
          durationMs: 3000,
        },
      ],
    };
    const progressValues: number[] = [];

    createRenderPlan.mockReturnValueOnce(plan);
    subscribeToExportProgress.mockImplementationOnce(
      async (_jobId: string, onProgress: (event: unknown) => void) => {
        onProgress({
          jobId: "export-progress",
          stage: "video",
          progress: 0.5,
        });
        onProgress({
          jobId: "export-progress",
          stage: "audio-mix",
          progress: 0.5,
        });
        return vi.fn();
      },
    );
    renderVideoPlanToMp4.mockResolvedValueOnce({
      outputPath: "/home/user/Exports/demo.mp4",
    });

    const job = await runExportJob(
      project,
      {
        settings,
        outputPath: "/home/user/Exports/demo.mp4",
      },
      (update) => progressValues.push(update.progress),
      "export-progress",
    );

    expect(progressValues).toEqual([0, 0.4, 0.9, 1]);
    expect(job.phase).toBe("completed");
  });
