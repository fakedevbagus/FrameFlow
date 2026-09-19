import { afterEach, describe, expect, it } from "vitest";
import { createProject } from "./domain";
import { loadWorkspaceProject, saveWorkspaceProject } from "./workspace";

afterEach(() => {
  localStorage.clear();
});

describe("workspace project", () => {
  it("restores a saved project", () => {
    const project = createProject({ id: "project-1", now: new Date("2026-09-19T12:00:00.000Z") });
    project.assets.push({
      id: "asset-1",
      name: "intro.mp4",
      mediaType: "video",
      sourcePath: "/media/intro.mp4",
      durationMs: 12000,
    });

    saveWorkspaceProject(project);

    expect(loadWorkspaceProject()).toEqual(project);
  });

  it("creates a fresh project when saved data is invalid", () => {
    localStorage.setItem("frameflow.workspace-project", "invalid");

    expect(loadWorkspaceProject().assets).toEqual([]);
    expect(localStorage.getItem("frameflow.workspace-project")).toBeNull();
  });
});
