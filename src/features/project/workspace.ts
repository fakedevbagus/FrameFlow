import { createProject, parseProject, serializeProject, type Project } from "./domain";

const workspaceProjectKey = "frameflow.workspace-project";

export function loadWorkspaceProject(storage: Storage = localStorage): Project {
  const source = storage.getItem(workspaceProjectKey);

  if (source === null) {
    return createProject();
  }

  try {
    return parseProject(source);
  } catch {
    storage.removeItem(workspaceProjectKey);
    return createProject();
  }
}

export function saveWorkspaceProject(project: Project, storage: Storage = localStorage): void {
  storage.setItem(workspaceProjectKey, serializeProject(project));
}
