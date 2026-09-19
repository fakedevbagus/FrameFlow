import { describe, expect, it } from "vitest";
import {
  PROJECT_SCHEMA_VERSION,
  ProjectValidationError,
  createProject,
  parseProject,
  serializeProject,
} from "./domain";

describe("project domain", () => {
  it("creates a vertical project with base audio and video tracks", () => {
    const project = createProject({
      id: "project-1",
      name: "  First edit  ",
      now: new Date("2026-09-19T12:00:00.000Z"),
    });

    expect(project).toMatchObject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "project-1",
      name: "First edit",
      canvas: { width: 1080, height: 1920, frameRate: 30 },
    });
    expect(project.tracks.map((track) => track.type)).toEqual(["video", "audio"]);
  });

  it("round-trips a valid project document", () => {
    const project = createProject({ id: "project-1", now: new Date("2026-09-19T12:00:00.000Z") });

    expect(parseProject(serializeProject(project))).toEqual(project);
  });

  it("rejects invalid JSON and unsupported schemas", () => {
    expect(() => parseProject("not json")).toThrow(ProjectValidationError);
    expect(() => parseProject('{"schemaVersion":999}')).toThrow(
      "Project schema version is not supported.",
    );
  });
});
