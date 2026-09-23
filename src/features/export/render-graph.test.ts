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

  it("compiles an image clip into a looped visual input", () => {
    let project = createVideoProject();
    project.assets = [
      ...project.assets,
      {
        id: "image-a",
        name: "cover.png",
        mediaType: "image",
        sourcePath: "/media/cover.png",
        durationMs: null,
      },
    ];
    project = addAssetToTimeline(project, "image-a");

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.inputs).toEqual([
      {
        inputIndex: 0,
        sourcePath: "/media/cover.png",
      },
    ]);
    expect(graph.filterComplex).toContain(
      "[0:v:0]trim=start=0:end=3,setpts=PTS-STARTPTS",
    );
    expect(graph.filterComplex).toContain(
      "scale=w=1080:h=1920:force_original_aspect_ratio=decrease",
    );
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

  it("compiles static X/Y/scale/rotation/opacity into the FFmpeg graph", () => {
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
                  y: -5,
                  scale: 1.25,
                  rotation: 15,
                  opacity: 0.75,
                },
              })),
            }
          : track,
      ),
    };

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).toContain(
      "[0:v:0]trim=start=0:end=5,setpts=PTS-STARTPTS,scale=w=1080:h=1920:force_original_aspect_ratio=decrease",
    );
    expect(graph.filterComplex).toContain("scale=w=iw*1.25:h=ih*1.25");
    expect(graph.filterComplex).toContain(
      "rotate=0.261799:c=none:ow=rotw(0.261799):oh=roth(0.261799)",
    );
    expect(graph.filterComplex).toContain("colorchannelmixer=aa=0.75");
    expect(graph.filterComplex).toContain(
      "color=c=black@0.0:s=1080x1920:r=30:d=5,format=rgba",
    );
    expect(graph.filterComplex).toContain(
      "overlay=x=(W-w)/2+108:y=(H-h)/2+-96:shortest=1,format=yuv420p",
    );
  });

  it("retains the minimal direct graph for default transform values", () => {
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
                  x: 0,
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

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).not.toContain("transform_fg_");
    expect(graph.filterComplex).not.toContain("color=c=black@0.0");
    expect(graph.filterComplex).not.toContain("colorchannelmixer=");
  });

  it("rejects non-centered transform anchors", () => {
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
                transformAnchor: {
                  x: 0,
                  y: 0.5,
                },
              })),
            }
          : track,
      ),
    };

    const graphPlan = createRenderPlan(
      project,
      createDefaultExportSettings(project),
    );

    expect(() => compileSingleVideoTrackGraph(graphPlan)).toThrow(
      "non-centered transform anchors",
    );
  });

  it("compiles static crop and crop position into the FFmpeg graph", () => {
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
                crop: {
                  top: 0.1,
                  right: 0.2,
                  bottom: 0.15,
                  left: 0.05,
                },
                cropPosition: {
                  x: 0.65,
                  y: 0.4,
                },
              })),
            }
          : track,
      ),
    };

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).toContain("format=rgba");
    expect(graph.filterComplex).toContain(
      "crop=w=trunc(iw*0.75):h=trunc(ih*0.75)",
    );
    expect(graph.filterComplex).toContain(
      "x=trunc(iw*(0.65-0.375)):y=trunc(ih*(0.4-0.375))",
    );
    expect(graph.filterComplex).toContain(
      "pad=w=iw/0.75:h=ih/0.75:x=(iw/0.75)*0.05:y=(ih/0.75)*0.1:color=black@0",
    );
    expect(graph.filterComplex).toContain(
      "scale=w=1080:h=1920:force_original_aspect_ratio=decrease",
    );
    expect(graph.filterComplex).toContain("[vout]");
  });

  it("combines static crop with static transforms", () => {
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
                crop: {
                  top: 0.05,
                  right: 0.05,
                  bottom: 0.1,
                  left: 0.1,
                },
                cropPosition: {
                  x: 0.6,
                  y: 0.55,
                },
                transform: {
                  x: 8,
                  y: -4,
                  scale: 1.2,
                  rotation: 12,
                  opacity: 0.8,
                },
              })),
            }
          : track,
      ),
    };

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).toContain("crop=w=trunc(iw*0.85):h=trunc(ih*0.85)");
    expect(graph.filterComplex).toContain("scale=w=iw*1.2:h=ih*1.2");
    expect(graph.filterComplex).toContain(
      "rotate=0.20944:c=none:ow=rotw(0.20944):oh=roth(0.20944)",
    );
    expect(graph.filterComplex).toContain("colorchannelmixer=aa=0.8");
    expect(graph.filterComplex).toContain(
      "overlay=x=(W-w)/2+86.4:y=(H-h)/2+-76.8:shortest=1",
    );
  });

  it("rejects transform keyframes until animated export is implemented", () => {
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
                transformKeyframes: [
                  {
                    timeMs: 0,
                    transform: {
                      x: 0,
                      y: 0,
                      scale: 1,
                      rotation: 0,
                      opacity: 1,
                    },
                  },
                  {
                    timeMs: 1000,
                    transform: {
                      x: 20,
                      y: 0,
                      scale: 1.5,
                      rotation: 15,
                      opacity: 0.8,
                    },
                  },
                ],
              })),
            }
          : track,
      ),
    };

    const plan = createRenderPlan(project, createDefaultExportSettings(project));

    expect(() => compileSingleVideoTrackGraph(plan)).toThrow(
      "animated transform export is deferred",
    );
  });


});
