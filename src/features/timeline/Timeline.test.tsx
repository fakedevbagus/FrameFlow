import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline } from "./commands";
import { Timeline } from "./Timeline";

describe("Timeline", () => {
  it("renders clips from project tracks with duration-based position and width", () => {
    let project = createProject({
      id: "project-1",
      now: new Date("2026-09-19T00:00:00.000Z"),
    });

    project = {
      ...project,
      assets: [
        {
          id: "asset-1",
          name: "intro.mp4",
          mediaType: "video",
          sourcePath: "/media/intro.mp4",
          durationMs: 12_000,
        },
      ],
    };

    project = addAssetToTimeline(project, "asset-1");
    project.tracks[0].clips[0].id = "generated-clip";

    const onSelectClip = vi.fn();
    render(<Timeline project={project} onSelectClip={onSelectClip} />);

    const clip = screen.getByTitle("intro.mp4 · 00:12");

    expect(clip).toBeInTheDocument();
    expect(clip).toHaveStyle({ left: "0px", width: "480px" });
    expect(screen.getByText("V1")).toBeInTheDocument();
    expect(screen.getByText("Video 1")).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(screen.getByText("00:05")).toBeInTheDocument();
    expect(screen.getByText("00:10")).toBeInTheDocument();

    fireEvent.click(clip);

    expect(onSelectClip).toHaveBeenCalledWith("generated-clip");
  });

  it("marks the selected clip", () => {
    let project = createProject({ id: "project-2" });
    project = {
      ...project,
      assets: [
        {
          id: "asset-2",
          name: "selected.mp4",
          mediaType: "video",
          sourcePath: "/selected.mp4",
          durationMs: 5000,
        },
      ],
    };

    project = addAssetToTimeline(project, "asset-2");

    render(
      <Timeline
        project={project}
        selectedClipId={project.tracks[0].clips[0].id}
      />,
    );

    const clip = screen.getByRole("button", { name: "Select selected.mp4 clip" });

    expect(clip).toHaveAttribute("aria-pressed", "true");
    expect(clip.className).toContain("timeline-clip-selected");
  });
});
