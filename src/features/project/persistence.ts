import { invoke } from "@tauri-apps/api/core";
import { parseProject, serializeProject, type Project } from "./domain";

export async function loadProject(path: string): Promise<Project> {
  const content = await invoke<string>("open_project", { path });

  return parseProject(content);
}

export async function saveProject(path: string, project: Project): Promise<void> {
  await invoke("save_project", {
    path,
    content: serializeProject(project),
  });
}
