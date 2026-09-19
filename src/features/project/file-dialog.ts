import { open, save } from "@tauri-apps/plugin-dialog";
import type { Project } from "./domain";
import { loadProject, saveProject } from "./persistence";

const projectFilter = [{ name: "FrameFlow project", extensions: ["frameflow.json"] }];

export async function openProjectFromDialog(): Promise<{ path: string; project: Project } | null> {
  const path = await open({ directory: false, filters: projectFilter, multiple: false, title: "Open project" });

  if (typeof path !== "string") {
    return null;
  }

  return { path, project: await loadProject(path) };
}

export async function saveProjectFromDialog(project: Project): Promise<string | null> {
  const path = await save({
    defaultPath: `${project.name.replace(/\//g, "-")}.frameflow.json`,
    filters: projectFilter,
    title: "Save project",
  });

  if (path === null) {
    return null;
  }

  await saveProject(path, project);

  return path;
}
