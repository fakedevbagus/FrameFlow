import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultExportSettings } from "./export";
import { runExportJob } from "./export-runner";
import { createProject } from "../project/domain";

const { createRenderPlan, renderVideoPlanToMp4 } = vi.hoisted(() => ({
  createRenderPlan: vi.fn(),
  renderVideoPlanToMp4: vi.fn(),
}));

vi.mock("./render-plan", () => ({
  createRenderPlan,
}));

vi.mock("./render-pipeline", () => ({
  renderVideoPlanToMp4,
}));

describe("runExportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      "Render plan has no supported video clips.",
    );
    expect(renderVideoPlanToMp4).not.toHaveBeenCalled();
  });
});
