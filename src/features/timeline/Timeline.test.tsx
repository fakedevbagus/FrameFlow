import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline } from "./commands";
import { Timeline } from "./Timeline";

describe("Timeline", () => {
  function createVideoProject() {
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

    return project;
  }

  it("renders clips from project tracks with duration-based position and width", () => {
    const project = createVideoProject();

    render(<Timeline project={project} />);

    const clip = screen.getByTitle("intro.mp4 · 00:12");

    expect(clip).toBeInTheDocument();
    expect(clip).toHaveStyle({ left: "0px", width: "480px" });
    expect(screen.getByText("V1")).toBeInTheDocument();
    expect(screen.getByText("Video 1")).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(screen.getByText("00:05")).toBeInTheDocument();
    expect(screen.getByText("00:10")).toBeInTheDocument();
  });

  it("moves the playhead when the ruler is clicked", () => {
    const project = createVideoProject();
    const onCurrentTimeChange = vi.fn();
    function TimelineHarness() {
      const [currentTimeMs, setCurrentTimeMs] = useState(0);

      return (
        <Timeline
          project={project}
          currentTimeMs={currentTimeMs}
          onCurrentTimeChange={(timeMs) => {
            onCurrentTimeChange(timeMs);
            setCurrentTimeMs(timeMs);
          }}
        />
      );
    }

    const { container } = render(<TimelineHarness />);

    const ruler = container.querySelector(".timeline-ruler-scale");
    expect(ruler).not.toBeNull();

    Object.defineProperty(ruler, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 0,
        height: 28,
        left: 0,
        right: 800,
        top: 0,
        width: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    fireEvent.click(ruler as HTMLDivElement, { clientX: 200 });

    expect(onCurrentTimeChange).toHaveBeenCalledWith(5_000);
    expect(screen.getByLabelText("Playhead at 00:05")).toBeInTheDocument();
  });

  it("updates zoom through the timeline controls", () => {
    const project = createVideoProject();
    const onZoomChange = vi.fn();

    render(
      <Timeline
        project={project}
        zoom={1}
        onZoomChange={onZoomChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Zoom in timeline" }));

    expect(onZoomChange).toHaveBeenCalledWith(1.25);
  });

  it("marks the selected clip", () => {
    const project = createProject({ id: "project-2" });
    project.assets.push({
      id: "asset-2",
      name: "selected.mp4",
      mediaType: "video",
      sourcePath: "/selected.mp4",
      durationMs: 5000,
    });

    const populatedProject = addAssetToTimeline(project, "asset-2");

    render(
      <Timeline
        project={populatedProject}
        selectedClipId={populatedProject.tracks[0].clips[0].id}
      />,
    );

    const clip = screen.getByRole("button", { name: "Select selected.mp4 clip" });

    expect(clip).toHaveAttribute("aria-pressed", "true");
    expect(clip.className).toContain("timeline-clip-selected");
  });

  it("moves a clip by dragging and commits the snapped position", () => {
    const project = createVideoProject();
    const onMoveClip = vi.fn();

    render(
      <Timeline
        project={project}
        onMoveClip={onMoveClip}
      />,
    );

    const clip = screen.getByRole("button", { name: "Select intro.mp4 clip" });

    fireEvent.pointerDown(clip, { button: 0, clientX: 0 });
    fireEvent.pointerMove(clip, { buttons: 1, clientX: 96 });
    fireEvent.pointerUp(clip, { button: 0, clientX: 96 });

    expect(onMoveClip).toHaveBeenCalledWith(
      project.tracks[0].clips[0].id,
      2500,
    );
  });

  it("trims the start handle and commits the snapped source start", () => {
    const project = createVideoProject();
    const onTrimClipStart = vi.fn();

    const { container } = render(
      <Timeline
        project={project}
        onTrimClipStart={onTrimClipStart}
      />,
    );

    const handle = container.querySelector(".timeline-trim-handle-start");
    const clip = screen.getByRole("button", { name: "Select intro.mp4 clip" });

    expect(handle).not.toBeNull();

    fireEvent.pointerDown(handle as HTMLSpanElement, { button: 0, clientX: 0 });
    fireEvent.pointerMove(clip, { buttons: 1, clientX: 80 });
    fireEvent.pointerUp(clip, { button: 0, clientX: 80 });

    expect(onTrimClipStart).toHaveBeenCalledWith(
      project.tracks[0].clips[0].id,
      2000,
    );
  });

  it("trims the end handle and commits the snapped source end", () => {
    const project = createVideoProject();
    const onTrimClipEnd = vi.fn();

    const { container } = render(
      <Timeline
        project={project}
        onTrimClipEnd={onTrimClipEnd}
      />,
    );

    const handle = container.querySelector(".timeline-trim-handle-end");
    const clip = screen.getByRole("button", { name: "Select intro.mp4 clip" });

    expect(handle).not.toBeNull();

    fireEvent.pointerDown(handle as HTMLSpanElement, { button: 0, clientX: 480 });
    fireEvent.pointerMove(clip, { buttons: 1, clientX: 400 });
    fireEvent.pointerUp(clip, { button: 0, clientX: 400 });

    expect(onTrimClipEnd).toHaveBeenCalledWith(
      project.tracks[0].clips[0].id,
      10_000,
    );
  });

});
