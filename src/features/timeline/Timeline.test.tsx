import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline, addTransformKeyframe, addTrack } from "./commands";
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

  it("renders transform keyframe markers and jumps the playhead to a marker", () => {
    let project = createVideoProject();
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(project, clipId, 2000);
    project = addTransformKeyframe(project, clipId, 7000);

    const onCurrentTimeChange = vi.fn();

    render(
      <Timeline
        project={project}
        currentTimeMs={2000}
        onCurrentTimeChange={onCurrentTimeChange}
      />,
    );

    const markers = screen.getAllByRole("button", {
      name: /Go to transform keyframe for intro.mp4/,
    });

    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveAttribute("title", "00:02.000");
    expect(markers[1]).toHaveAttribute("title", "00:07.000");
    expect(markers[0].className).toContain("timeline-keyframe-marker-active");

    fireEvent.click(markers[1]);

    expect(onCurrentTimeChange).toHaveBeenCalledWith(7000);
  });

  it("selects the clip when a keyframe marker receives keyboard focus", () => {
    let project = createVideoProject();
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(project, clipId, 2000);

    const onSelectClip = vi.fn();

    render(
      <Timeline
        project={project}
        currentTimeMs={2000}
        onSelectClip={onSelectClip}
      />,
    );

    const markerButton = screen.getByRole("button", {
      name: "Go to transform keyframe for intro.mp4 at 00:02.000",
    });

    fireEvent.focus(markerButton);

    expect(onSelectClip).toHaveBeenCalledWith(clipId);
    expect(markerButton).toHaveAttribute("aria-current", "time");
  });

  it("cancels an active keyframe drag with Escape", () => {
    let project = createVideoProject();
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(project, clipId, 2000);
    project = addTransformKeyframe(project, clipId, 7000);

    const onMoveTransformKeyframe = vi.fn();

    render(
      <Timeline
        project={project}
        onMoveTransformKeyframe={onMoveTransformKeyframe}
      />,
    );

    const markerButton = screen.getByRole("button", {
      name: "Go to transform keyframe for intro.mp4 at 00:02.000",
    });

    fireEvent.pointerDown(markerButton, {
      button: 0,
      buttons: 1,
      clientX: 80,
      pointerId: 7,
    });
    fireEvent.pointerMove(markerButton, {
      buttons: 1,
      clientX: 160,
      pointerId: 7,
    });
    fireEvent.keyDown(markerButton, { key: "Escape" });
    fireEvent.pointerUp(markerButton, {
      button: 0,
      buttons: 0,
      clientX: 160,
      pointerId: 7,
    });

    expect(onMoveTransformKeyframe).not.toHaveBeenCalled();
  });

  it("drags a transform keyframe and commits its new time", () => {
    let project = createVideoProject();
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(project, clipId, 2000);
    project = addTransformKeyframe(project, clipId, 7000);

    const onMoveTransformKeyframe = vi.fn();
    const onCurrentTimeChange = vi.fn();

    render(
      <Timeline
        project={project}
        currentTimeMs={2000}
        onCurrentTimeChange={onCurrentTimeChange}
        onMoveTransformKeyframe={onMoveTransformKeyframe}
      />,
    );

    const markerButton = screen.getByRole("button", {
      name: "Go to transform keyframe for intro.mp4 at 00:02.000",
    });

    fireEvent.pointerDown(markerButton, {
      button: 0,
      buttons: 1,
      clientX: 80,
      pointerId: 7,
    });
    fireEvent.pointerMove(markerButton, {
      buttons: 1,
      clientX: 160,
      pointerId: 7,
    });
    fireEvent.pointerUp(markerButton, {
      button: 0,
      buttons: 0,
      clientX: 160,
      pointerId: 7,
    });

    expect(onMoveTransformKeyframe).toHaveBeenCalledWith(
      clipId,
      2000,
      4000,
    );
    expect(onCurrentTimeChange).toHaveBeenLastCalledWith(4000);
  });

  it("deletes a focused transform keyframe with Delete", () => {
    let project = createVideoProject();
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(project, clipId, 2000);
    project = addTransformKeyframe(project, clipId, 7000);

    const onRemoveTransformKeyframe = vi.fn();

    render(
      <Timeline
        project={project}
        currentTimeMs={2000}
        onRemoveTransformKeyframe={onRemoveTransformKeyframe}
      />,
    );

    const markerButton = screen.getByRole("button", {
      name: "Go to transform keyframe for intro.mp4 at 00:02.000",
    });

    markerButton.focus();
    fireEvent.keyDown(markerButton, { key: "Delete" });

    expect(onRemoveTransformKeyframe).toHaveBeenCalledWith(clipId, 2000);
  });

  it("nudges a focused transform keyframe with Arrow keys", () => {
    let project = createVideoProject();
    const clipId = project.tracks[0].clips[0].id;

    project = addTransformKeyframe(project, clipId, 2000);
    project = addTransformKeyframe(project, clipId, 7000);

    const onMoveTransformKeyframe = vi.fn();
    const onCurrentTimeChange = vi.fn();

    render(
      <Timeline
        project={project}
        currentTimeMs={2000}
        onCurrentTimeChange={onCurrentTimeChange}
        onMoveTransformKeyframe={onMoveTransformKeyframe}
      />,
    );

    const markerButton = screen.getByRole("button", {
      name: "Go to transform keyframe for intro.mp4 at 00:02.000",
    });

    markerButton.focus();
    fireEvent.keyDown(markerButton, { key: "ArrowRight" });

    expect(onMoveTransformKeyframe).toHaveBeenCalledWith(
      clipId,
      2000,
      2033,
    );
    expect(onCurrentTimeChange).toHaveBeenCalledWith(2033);

    fireEvent.keyDown(markerButton, {
      key: "ArrowLeft",
      shiftKey: true,
    });

    expect(onMoveTransformKeyframe).toHaveBeenLastCalledWith(
      clipId,
      2000,
      1500,
    );
    expect(onCurrentTimeChange).toHaveBeenLastCalledWith(1500);
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

  it("drags the audio fade-in handle and commits once", () => {
    let project = createVideoProject();
    project.assets.push({
      id: "audio-fade",
      name: "music.mp3",
      mediaType: "audio",
      sourcePath: "/music.mp3",
      durationMs: 5000,
    });
    project = addAssetToTimeline(project, "audio-fade");

    const clip = project.tracks[1].clips[0];
    const onUpdateAudioClipFades = vi.fn();
    render(
      <Timeline
        project={project}
        onUpdateAudioClipFades={onUpdateAudioClipFades}
      />,
    );

    const handle = screen.getByRole("button", {
      name: "Adjust audio fade in for music.mp3 to 0 ms",
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      pointerId: 51,
    });
    fireEvent.pointerMove(handle, {
      buttons: 1,
      clientX: 140,
      pointerId: 51,
    });
    fireEvent.pointerUp(handle, {
      button: 0,
      clientX: 140,
      pointerId: 51,
    });

    expect(onUpdateAudioClipFades).toHaveBeenCalledTimes(1);
    expect(onUpdateAudioClipFades).toHaveBeenCalledWith(clip.id, 1000, 0);
  });

  it("cancels audio fade-handle dragging with Escape without committing", () => {
    let project = createVideoProject();
    project.assets.push({
      id: "audio-fade-cancel",
      name: "music-cancel.mp3",
      mediaType: "audio",
      sourcePath: "/music-cancel.mp3",
      durationMs: 5000,
    });
    project = addAssetToTimeline(project, "audio-fade-cancel");

    const onUpdateAudioClipFades = vi.fn();
    render(
      <Timeline
        project={project}
        onUpdateAudioClipFades={onUpdateAudioClipFades}
      />,
    );

    const handle = screen.getByRole("button", {
      name: "Adjust audio fade out for music-cancel.mp3 to 0 ms",
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 300,
      pointerId: 52,
    });
    fireEvent.pointerMove(handle, {
      buttons: 1,
      clientX: 240,
      pointerId: 52,
    });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(handle, {
      button: 0,
      clientX: 240,
      pointerId: 52,
    });

    expect(onUpdateAudioClipFades).not.toHaveBeenCalled();
  });

  it("nudges a focused audio fade handle by 100 ms", () => {
    let project = createVideoProject();
    project.assets.push({
      id: "audio-fade-keyboard",
      name: "music-keyboard.mp3",
      mediaType: "audio",
      sourcePath: "/music-keyboard.mp3",
      durationMs: 5000,
    });
    project = addAssetToTimeline(project, "audio-fade-keyboard");

    const onUpdateAudioClipFades = vi.fn();
    render(
      <Timeline
        project={project}
        onUpdateAudioClipFades={onUpdateAudioClipFades}
      />,
    );

    fireEvent.keyDown(
      screen.getByRole("button", {
        name: "Adjust audio fade in for music-keyboard.mp3 to 0 ms",
      }),
      { key: "ArrowRight" },
    );

    expect(onUpdateAudioClipFades).toHaveBeenCalledWith(
      project.tracks[1].clips[0].id,
      100,
      0,
    );
  });
  it("shows an audio track volume slider and reports changes", () => {
    const project = createVideoProject();
    const onUpdateTrackVolume = vi.fn();

    render(
      <Timeline
        project={project}
        onUpdateTrackVolume={onUpdateTrackVolume}
      />,
    );

    const volume = screen.getByRole("slider", { name: "Volume Audio 1" });

    expect(volume).toHaveValue("1");
    expect(volume).toHaveAttribute("aria-valuetext", "100%");

    fireEvent.change(volume, { target: { value: "0.35" } });

    expect(onUpdateTrackVolume).toHaveBeenCalledWith("audio-1", 0.35);
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

    const dropEvent = createEvent.drop(secondLane, { dataTransfer });
    Object.defineProperty(dropEvent, "clientX", {
      configurable: true,
      value: 120,
    });
    fireEvent(secondLane, dropEvent);

    expect(onAddAssetToTrack).toHaveBeenCalledWith(
      "asset-overlay",
      project.tracks[1].id,
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
      extraTrack.tracks[1].id,
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

  it("shows and edits a fade-through-black transition", () => {
    const project = createVideoProject();
    project.assets.push(
      {
        id: "fade-outgoing",
        name: "outgoing.mp4",
        mediaType: "video",
        sourcePath: "/outgoing.mp4",
        durationMs: 5000,
      },
      {
        id: "fade-incoming",
        name: "incoming.mp4",
        mediaType: "video",
        sourcePath: "/incoming.mp4",
        durationMs: 4000,
      },
    );

    const outgoing = project.tracks[0].clips[0];
    const nextProject = {
      ...project,
      tracks: [
        {
          ...project.tracks[0],
          clips: [
            {
              ...outgoing,
              assetId: "fade-outgoing",
              sourceEndMs: 5000,
              transitionOut: {
                type: "fade-through-black" as const,
                durationMs: 300,
              },
            },
            {
              ...outgoing,
              id: "fade-incoming-clip",
              assetId: "fade-incoming",
              timelineStartMs: 5000,
              sourceEndMs: 9000,
            },
          ],
        },
        project.tracks[1],
      ],
    };

    const onUpdateClipTransition = vi.fn();

    render(
      <Timeline
        project={nextProject}
        onUpdateClipTransition={onUpdateClipTransition}
      />,
    );

    const indicator = screen.getByRole("button", {
      name: "Select outgoing.mp4 fade through black transition to incoming.mp4",
    });

    expect(indicator).toHaveAttribute("title", "Fade through black · 300 ms");

    const handle = screen.getByRole("button", {
      name: "Adjust fade through black duration for outgoing.mp4 to 300 ms",
    });

    fireEvent.keyDown(handle, { key: "ArrowLeft" });

    expect(onUpdateClipTransition).toHaveBeenCalledWith(
      outgoing.id,
      {
        type: "fade-through-black",
        durationMs: 350,
      },
    );
  });

  it("shows a dissolve transition indicator between adjacent visual clips", () => {
    const project = createVideoProject();
    project.assets.push({
      id: "outgoing-transition",
      name: "outgoing.mp4",
      mediaType: "video",
      sourcePath: "/outgoing.mp4",
      durationMs: 5000,
    });
    project.assets.push({
      id: "incoming-transition",
      name: "incoming.mp4",
      mediaType: "video",
      sourcePath: "/incoming.mp4",
      durationMs: 4000,
    });

    const outgoing = project.tracks[0].clips[0];
    const nextProject = {
      ...project,
      tracks: [
        {
          ...project.tracks[0],
          clips: [
            {
              ...outgoing,
              assetId: "outgoing-transition",
              sourceEndMs: 5000,
              transitionOut: {
                type: "dissolve" as const,
                durationMs: 300,
              },
            },
            {
              ...outgoing,
              id: "incoming-clip",
              assetId: "incoming-transition",
              timelineStartMs: 5000,
              sourceEndMs: 9000,
            },
          ],
        },
        project.tracks[1],
      ],
    };

    const onSelectClip = vi.fn();

    render(
      <Timeline
        project={nextProject}
        onSelectClip={onSelectClip}
      />,
    );

    const indicator = screen.getByRole("button", {
      name: "Select outgoing.mp4 dissolve transition to incoming.mp4",
    });

    expect(indicator).toHaveAttribute("title", "Dissolve · 300 ms");

    fireEvent.click(indicator);

    expect(onSelectClip).toHaveBeenCalledWith(outgoing.id);
  });

  it("adjusts dissolve duration by dragging the timeline handle and commits once", () => {
    let project = createVideoProject();
    project.assets.push(
      {
        id: "outgoing-transition",
        name: "outgoing.mp4",
        mediaType: "video",
        sourcePath: "/outgoing.mp4",
        durationMs: 5000,
      },
      {
        id: "incoming-transition",
        name: "incoming.mp4",
        mediaType: "video",
        sourcePath: "/incoming.mp4",
        durationMs: 4000,
      },
    );

    const outgoing = project.tracks[0].clips[0];
    project = {
      ...project,
      tracks: [
        {
          ...project.tracks[0],
          clips: [
            {
              ...outgoing,
              assetId: "outgoing-transition",
              sourceEndMs: 5000,
              transitionOut: {
                type: "dissolve" as const,
                durationMs: 300,
              },
            },
            {
              ...outgoing,
              id: "incoming-clip",
              assetId: "incoming-transition",
              timelineStartMs: 5000,
              sourceEndMs: 9000,
            },
          ],
        },
        project.tracks[1],
      ],
    };

    const onUpdateClipTransition = vi.fn();
    render(
      <Timeline
        project={project}
        onUpdateClipTransition={onUpdateClipTransition}
      />,
    );

    const handle = screen.getByRole("button", {
      name: "Adjust dissolve duration for outgoing.mp4 to 300 ms",
    });

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 188,
      pointerId: 41,
    });
    fireEvent.pointerMove(handle, {
      buttons: 1,
      clientX: 168,
      pointerId: 41,
    });
    fireEvent.pointerUp(handle, {
      button: 0,
      clientX: 168,
      pointerId: 41,
    });

    expect(onUpdateClipTransition).toHaveBeenCalledTimes(1);
    expect(onUpdateClipTransition).toHaveBeenCalledWith(
      outgoing.id,
      {
        type: "dissolve",
        durationMs: 800,
      },
    );
  });

  it("cancels direct transition duration editing with Escape", () => {
    let project = createVideoProject();
    project.assets.push(
      {
        id: "outgoing-transition",
        name: "outgoing.mp4",
        mediaType: "video",
        sourcePath: "/outgoing.mp4",
        durationMs: 5000,
      },
      {
        id: "incoming-transition",
        name: "incoming.mp4",
        mediaType: "video",
        sourcePath: "/incoming.mp4",
        durationMs: 4000,
      },
    );

    const outgoing = project.tracks[0].clips[0];
    project = {
      ...project,
      tracks: [
        {
          ...project.tracks[0],
          clips: [
            {
              ...outgoing,
              assetId: "outgoing-transition",
              sourceEndMs: 5000,
              transitionOut: {
                type: "dissolve" as const,
                durationMs: 300,
              },
            },
            {
              ...outgoing,
              id: "incoming-clip",
              assetId: "incoming-transition",
              timelineStartMs: 5000,
              sourceEndMs: 9000,
            },
          ],
        },
        project.tracks[1],
      ],
    };

    const onUpdateClipTransition = vi.fn();
    render(
      <Timeline
        project={project}
        onUpdateClipTransition={onUpdateClipTransition}
      />,
    );

    const handle = screen.getByRole("button", {
      name: "Adjust dissolve duration for outgoing.mp4 to 300 ms",
    });

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 188,
      pointerId: 42,
    });
    fireEvent.pointerMove(handle, {
      buttons: 1,
      clientX: 168,
      pointerId: 42,
    });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(handle, {
      button: 0,
      clientX: 168,
      pointerId: 42,
    });

    expect(onUpdateClipTransition).not.toHaveBeenCalled();
  });

  it("nudges dissolve duration with the keyboard handle", () => {
    let project = createVideoProject();
    project.assets.push(
      {
        id: "outgoing-transition",
        name: "outgoing.mp4",
        mediaType: "video",
        sourcePath: "/outgoing.mp4",
        durationMs: 5000,
      },
      {
        id: "incoming-transition",
        name: "incoming.mp4",
        mediaType: "video",
        sourcePath: "/incoming.mp4",
        durationMs: 4000,
      },
    );

    const outgoing = project.tracks[0].clips[0];
    project = {
      ...project,
      tracks: [
        {
          ...project.tracks[0],
          clips: [
            {
              ...outgoing,
              assetId: "outgoing-transition",
              sourceEndMs: 5000,
              transitionOut: {
                type: "dissolve" as const,
                durationMs: 300,
              },
            },
            {
              ...outgoing,
              id: "incoming-clip",
              assetId: "incoming-transition",
              timelineStartMs: 5000,
              sourceEndMs: 9000,
            },
          ],
        },
        project.tracks[1],
      ],
    };

    const onUpdateClipTransition = vi.fn();
    render(
      <Timeline
        project={project}
        onUpdateClipTransition={onUpdateClipTransition}
      />,
    );

    fireEvent.keyDown(
      screen.getByRole("button", {
        name: "Adjust dissolve duration for outgoing.mp4 to 300 ms",
      }),
      { key: "ArrowLeft" },
    );

    expect(onUpdateClipTransition).toHaveBeenCalledWith(
      outgoing.id,
      {
        type: "dissolve",
        durationMs: 350,
      },
    );
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

  it("cancels clip movement and trimming with Escape", () => {
    const project = createVideoProject();
    const onMoveClip = vi.fn();
    const onTrimClipStart = vi.fn();
    const onTrimClipEnd = vi.fn();

    const { container } = render(
      <Timeline
        project={project}
        onMoveClip={onMoveClip}
        onTrimClipStart={onTrimClipStart}
        onTrimClipEnd={onTrimClipEnd}
      />,
    );

    const clip = screen.getByRole("button", {
      name: "Select intro.mp4 clip",
    });
    const startHandle = container.querySelector(
      ".timeline-trim-handle-start",
    );
    const endHandle = container.querySelector(".timeline-trim-handle-end");

    expect(startHandle).not.toBeNull();
    expect(endHandle).not.toBeNull();

    fireEvent.pointerDown(clip, {
      button: 0,
      buttons: 1,
      clientX: 0,
      pointerId: 31,
    });
    fireEvent.pointerMove(clip, {
      buttons: 1,
      clientX: 96,
      pointerId: 31,
    });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(clip, {
      button: 0,
      buttons: 0,
      clientX: 96,
      pointerId: 31,
    });

    fireEvent.pointerDown(startHandle as HTMLSpanElement, {
      button: 0,
      buttons: 1,
      clientX: 0,
      pointerId: 32,
    });
    fireEvent.pointerMove(clip, {
      buttons: 1,
      clientX: 80,
      pointerId: 32,
    });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(clip, {
      button: 0,
      buttons: 0,
      clientX: 80,
      pointerId: 32,
    });

    fireEvent.pointerDown(endHandle as HTMLSpanElement, {
      button: 0,
      buttons: 1,
      clientX: 480,
      pointerId: 33,
    });
    fireEvent.pointerMove(clip, {
      buttons: 1,
      clientX: 400,
      pointerId: 33,
    });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(clip, {
      button: 0,
      buttons: 0,
      clientX: 400,
      pointerId: 33,
    });

    expect(onMoveClip).not.toHaveBeenCalled();
    expect(onTrimClipStart).not.toHaveBeenCalled();
    expect(onTrimClipEnd).not.toHaveBeenCalled();
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
