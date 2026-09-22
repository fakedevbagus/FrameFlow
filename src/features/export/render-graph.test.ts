import { describe, expect, it } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline, addAssetToTrack } from "../timeline/commands";
import { createDefaultExportSettings } from "./export";
import { createRenderPlan } from "./render-plan";
import {
  compileSingleVideoTrackGraph,
  M3_38_DIRECT_GRAPH_MARKER,
} from "./render-graph";

function createVideoProject() {
  const project = createProject({ id: "render-graph" });
  project.assets = [
    {
      id: "video-a",
      name: "a.mp4",
      mediaType: "video",
      sourcePath: "/media/a.mp4",
      durationMs: 5000,
    },
    {
      id: "video-b",
      name: "b.mp4",
      mediaType: "video",
      sourcePath: "/media/b.mp4",
      durationMs: 3000,
    },
    {
      id: "audio-a",
      name: "a.wav",
      mediaType: "audio",
      sourcePath: "/media/a.wav",
      durationMs: 2000,
    },
  ];

  return project;
}

describe("single video render graph", () => {
  it("builds a minimal direct graph for one clip without concat", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.inputs).toEqual([
      {
        inputIndex: 0,
        sourcePath: "/media/a.mp4",
      },
    ]);
    expect(graph.filterComplex).toContain(
      "[0:v:0]trim=start=0:end=5,setpts=PTS-STARTPTS",
    );
    expect(graph.filterComplex).toContain(
      "scale=w=1080:h=1920:force_original_aspect_ratio=decrease",
    );
    expect(graph.filterComplex).not.toContain("fps=");
    expect(graph.filterComplex).not.toContain("concat=");
    expect(graph.filterComplex).not.toContain("setsar=");
    expect(graph.filterComplex).not.toContain("format=yuv420p");
    expect(graph.filterComplex).toContain("[vout]");
    expect(graph.filterComplex).toBe(
      "[0:v:0]trim=start=0:end=5,setpts=PTS-STARTPTS,scale=w=1080:h=1920:force_original_aspect_ratio=decrease,pad=w=1080:h=1920:x=(ow-iw)/2:y=(oh-ih)/2[vout]",
    );
    expect(M3_38_DIRECT_GRAPH_MARKER).toBe("m3.38-direct-graph-v2");
    expect(graph.videoMap).toBe("[vout]");
  });

  it("compiles visual effects into the segment filter chain", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "video-1"
          ? {
              ...track,
              clips: track.clips.map((clip) => ({
                ...clip,
                visualEffects: {
                  brightness: 0.25,
                  contrast: -0.5,
                  saturation: 0.4,
                },
              })),
            }
          : track,
      ),
    };

    const plan = createRenderPlan(
      project,
      createDefaultExportSettings(project),
    );
    const graph = compileSingleVideoTrackGraph(plan);

    expect(graph.filterComplex).toContain(
      "eq=brightness=0.25:contrast=0.5:saturation=1.4",
    );
  });

  it("compiles text overlays into the segment filter chain", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "video-1"
          ? {
              ...track,
              clips: track.clips.map((clip) => ({
                ...clip,
                textOverlay: {
                  text: "Hello, FrameFlow!",
                  x: 0.25,
                  y: 0.75,
                  fontSize: 64,
                  color: "#ffffff",
                  alignment: "center" as const,
                },
              })),
            }
          : track,
      ),
    };

    const plan = createRenderPlan(
      project,
      createDefaultExportSettings(project),
    );
    const graph = compileSingleVideoTrackGraph(plan);

    expect(graph.filterComplex).toContain(
      "drawtext=font='DejaVu Sans':text='Hello\\, FrameFlow!':fontsize=64:fontcolor=#ffffff:x=(w-text_w)*0.25:y=(h-text_h)*0.75:line_spacing=4:expansion=none",
    );
  });

  it("inserts black video for timeline gaps", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");
    project = addAssetToTrack(project, "video-b", "video-1", 7000);

    const plan = createRenderPlan(project, createDefaultExportSettings(project));
    const graph = compileSingleVideoTrackGraph(plan);

    expect(graph.filterComplex).toContain("color=c=black:s=1080x1920:r=30:d=2");
    expect(graph.filterComplex).toContain("concat=n=3:v=1:a=0");
  });

  it("rejects multiple video tracks", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");
    project = {
      ...project,
      tracks: [
        ...project.tracks,
        {
          id: "video-2",
          name: "Video 2",
          type: "video",
          isLocked: false,
          isMuted: false,
          clips: [],
        },
      ],
    };
    project = addAssetToTrack(project, "video-b", "video-2", 0);

    const plan = createRenderPlan(project, createDefaultExportSettings(project));

    expect(() => compileSingleVideoTrackGraph(plan)).toThrow(
      "multi-track compositing is deferred",
    );
  });

  it("rejects audio mixing until the audio graph exists", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");
    project = addAssetToTrack(project, "audio-a", "audio-1", 0);

    const plan = createRenderPlan(project, createDefaultExportSettings(project));

    expect(() => compileSingleVideoTrackGraph(plan)).toThrow("audio mixing yet");
  });

  it("rejects transitions and non-default visual state", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");

    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "video-1"
          ? {
              ...track,
              clips: track.clips.map((clip) => ({
                ...clip,
                transform: {
                  x: 10,
                  y: 0,
                  scale: 1,
                  rotation: 0,
                  opacity: 1,
                },
              })),
            }
          : track,
      ),
    };

    const plan = createRenderPlan(project, createDefaultExportSettings(project));

    expect(() => compileSingleVideoTrackGraph(plan)).toThrow("visual transforms");
  });
});
