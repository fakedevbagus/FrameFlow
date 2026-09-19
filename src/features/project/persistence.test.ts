import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { createProject, serializeProject } from "./domain";
import { loadProject, saveProject } from "./persistence";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("project persistence", () => {
  it("serializes a project before saving it", async () => {
    const project = createProject({ id: "project-1", now: new Date("2026-09-19T12:00:00.000Z") });

    await saveProject("/projects/first-edit.frameflow.json", project);

    expect(invokeMock).toHaveBeenCalledWith("save_project", {
      path: "/projects/first-edit.frameflow.json",
      content: serializeProject(project),
    });
  });

  it("parses a project after opening it", async () => {
    const project = createProject({ id: "project-1", now: new Date("2026-09-19T12:00:00.000Z") });
    invokeMock.mockResolvedValueOnce(serializeProject(project));

    await expect(loadProject("/projects/first-edit.frameflow.json")).resolves.toEqual(project);
    expect(invokeMock).toHaveBeenCalledWith("open_project", {
      path: "/projects/first-edit.frameflow.json",
    });
  });
});
