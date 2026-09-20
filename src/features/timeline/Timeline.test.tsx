import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline, addTrack } from "./commands";
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

  it("toggles a track mute control", () => {
    const project = createVideoProject();
    const onToggleTrackMute = vi.fn();

    render(
      <Timeline
        project={project}
        onToggleTrackMute={onToggleTrackMute}
      />,
    );

    const muteButton = screen.getByRole("button", { name: "Mute Video 1" });

    expect(muteButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(muteButton);

    expect(onToggleTrackMute).toHaveBeenCalledWith("video-1");
  });

  it("adds video and audio tracks through timeline controls", () => {
    const project = createVideoProject();
    const onAddTrack = vi.fn();

    render(
      <Timeline
        project={project}
        onAddTrack={onAddTrack}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add video track" }));
    fireEvent.click(screen.getByRole("button", { name: "Add audio track" }));

    expect(onAddTrack).toHaveBeenNthCalledWith(1, "video");
    expect(onAddTrack).toHaveBeenNthCalledWith(2, "audio");
  });

  it("shows dynamic track labels and routes dropped media to the target track", () => {
    let project = createProject({ id: "drop-project" });

    project = {
      ...project,
      assets: [
        {
          id: "asset-overlay",
          name: "overlay.mp4",
          mediaType: "video",
          sourcePath: "/media/overlay.mp4",
          durationMs: 4000,
        },
      ],
    };
    project = addTrack(project, "video");

    const onAddAssetToTrack = vi.fn();

    const { container } = render(
      <Timeline
        project={project}
        onAddAssetToTrack={onAddAssetToTrack}
      />,
    );

    expect(screen.getByText("V2")).toBeInTheDocument();

    const lanes = container.querySelectorAll(".timeline-lane");
    const secondLane = lanes[1];

    Object.defineProperty(secondLane, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 69,
        height: 69,
        left: 0,
        right: 800,
        top: 0,
        width: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "copy",
      types: ["application/x-frameflow-asset-id"],
      getData: vi.fn(() => "asset-overlay"),
    };

    fireEvent.drop(secondLane, {
      dataTransfer,
      clientX: 120,
    });

    expect(onAddAssetToTrack).toHaveBeenCalledWith(
      "asset-overlay",
      project.tracks[2].id,
      3000,
    );
  });

  it("disables removal for populated tracks and exposes removal for empty extra tracks", () => {
    const project = createVideoProject();
    const extraTrack = addTrack(project, "video");
    const onRemoveTrack = vi.fn();

    render(
      <Timeline
        project={extraTrack}
        onRemoveTrack={onRemoveTrack}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Remove Video 2 track" }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Remove Video 1 track" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Video 2 track" }),
    );
    expect(onRemoveTrack).toHaveBeenCalledWith(
      extraTrack.tracks[2].id,
    );
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

  it("does not commit a move for a simple click", () => {
    const project = createVideoProject();
    const onMoveClip = vi.fn();
    const onSelectClip = vi.fn();

    render(
      <Timeline
        project={project}
        onMoveClip={onMoveClip}
        onSelectClip={onSelectClip}
      />,
    );

    const clip = screen.getByRole("button", { name: "Select intro.mp4 clip" });

    fireEvent.pointerDown(clip, { button: 0, clientX: 120 });
    fireEvent.pointerUp(clip, { button: 0, clientX: 120 });

    expect(onMoveClip).not.toHaveBeenCalled();
    expect(onSelectClip).toHaveBeenCalledWith(project.tracks[0].clips[0].id);
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
