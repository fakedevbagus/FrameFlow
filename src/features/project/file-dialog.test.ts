import { open, save } from "@tauri-apps/plugin-dialog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProject } from "./domain";
import { openProjectFromDialog, saveProjectFromDialog } from "./file-dialog";
import { loadProject, saveProject } from "./persistence";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock("./persistence", () => ({ loadProject: vi.fn(), saveProject: vi.fn() }));

const openMock = vi.mocked(open);
const saveDialogMock = vi.mocked(save);
const loadProjectMock = vi.mocked(loadProject);
const saveProjectMock = vi.mocked(saveProject);

afterEach(() => vi.clearAllMocks());

describe("project file dialogs", () => {
  it("opens a selected project", async () => {
    const project = createProject({ id: "project-1" });
    openMock.mockResolvedValueOnce("/projects/first.frameflow.json");
    loadProjectMock.mockResolvedValueOnce(project);

    await expect(openProjectFromDialog()).resolves.toEqual({ path: "/projects/first.frameflow.json", project });
  });

  it("saves a project to a selected path", async () => {
    const project = createProject({ id: "project-1", name: "First edit" });
    saveDialogMock.mockResolvedValueOnce("/projects/first-edit.frameflow.json");

    await expect(saveProjectFromDialog(project)).resolves.toBe("/projects/first-edit.frameflow.json");
    expect(saveProjectMock).toHaveBeenCalledWith("/projects/first-edit.frameflow.json", project);
  });
});
