import { describe, expect, it } from "vitest";
import { createProject } from "../project/domain";
import { addAssetToTimeline, addAssetToTrack, addTrack } from "../timeline/commands";
import { createDefaultExportSettings } from "./export";
import { createRenderPlan } from "./render-plan";
import {
  compileSingleVideoTrackGraph,
  compileVideoTracksGraph,
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

  it("compiles a text overlay on an image clip", () => {
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
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "video-1"
          ? {
              ...track,
              clips: track.clips.map((clip) => ({
                ...clip,
                textOverlay: {
                  text: "Image",
                  x: 0.5,
                  y: 0.5,
                  fontSize: 48,
                  color: "#ffffff",
                  alignment: "center" as const,
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
      "drawtext=font='DejaVu Sans':text='Image':fontsize=48",
    );
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

  it("compiles static transforms around a non-centered anchor", () => {
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
                  x: 8,
                  y: -4,
                  scale: 1.5,
                  rotation: 90,
                  opacity: 0.8,
                },
                transformAnchor: {
                  x: 0.25,
                  y: 0.75,
                },
              })),
            }
          : track,
      ),
    };

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).toContain("anchor_bg_0");
    expect(graph.filterComplex).toContain("anchor_pivot_0");
    expect(graph.filterComplex).toContain("anchor_rotated_0");
    expect(graph.filterComplex).toContain(
      "scale=w='iw*1.5':h='ih*1.5':eval=frame",
    );
    expect(graph.filterComplex).toContain("rotate='");
    expect(graph.filterComplex).toContain("overlay=x='(W/2)-(0.25)*w':y='(H/2)-(0.75)*h'");
    expect(graph.filterComplex).toContain("colorchannelmixer=aa=0.8");
    expect(graph.filterComplex).toContain("anchor_output_bg_0");
    expect(graph.filterComplex).toContain("overlay=x='(W-w)/2+");
    expect(graph.filterComplex).not.toContain(
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

  it("compiles animated transforms around a non-centered anchor", () => {
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
                transformAnchor: {
                  x: 0.2,
                  y: 0.8,
                },
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
                      y: -10,
                      scale: 1.4,
                      rotation: 75,
                      opacity: 0.65,
                    },
                    easing: "ease-in-out",
                  },
                ],
              })),
            }
          : track,
      ),
    };

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).toContain("anchor_scaled_0");
    expect(graph.filterComplex).toContain("eval=frame");
    expect(graph.filterComplex).toContain("anchor_pivot_0");
    expect(graph.filterComplex).toContain("rotate='");
    expect(graph.filterComplex).toContain("overlay=x='(W/2)-(0.2)*w':y='(H/2)-(0.8)*h'");
    expect(graph.filterComplex).toContain("N/30");
    expect(graph.filterComplex).toContain("\\,");
    expect(graph.filterComplex).not.toContain(
      "non-centered transform anchors",
    );
  });

  it("compiles a dissolve transition without shortening the timeline", () => {
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
    project = addAssetToTimeline(project, "video-a");
    project = addAssetToTrack(project, "image-a", "video-1", 5000);
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "video-1"
          ? {
              ...track,
              clips: track.clips.map((clip) =>
                clip.assetId === "video-a"
                  ? {
                      ...clip,
                      transitionOut: {
                        type: "dissolve" as const,
                        durationMs: 500,
                      },
                    }
                  : clip,
              ),
            }
          : track,
      ),
    };

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).toContain(
      "[full0]trim=start=0:end=4.5,setpts=PTS-STARTPTS[transition_0_prefix]",
    );
    expect(graph.filterComplex).toContain(
      "loop=loop=-1:size=1:start=0,trim=duration=0.5",
    );
    expect(graph.filterComplex).toContain(
      "fade=t=in:st=0:d=0.5:alpha=1",
    );
    expect(graph.filterComplex).toContain(
      "overlay=x=0:y=0:shortest=1,format=yuv420p[transition_0_dissolve]",
    );
    expect(graph.filterComplex).toContain(
      "[transition_0_prefix][transition_0_dissolve][full1]concat=n=3:v=1:a=0",
    );
    expect(graph.filterComplex).not.toContain("xfade=");
  });

  it("compiles fade-through-black transitions as explicit black midpoint stages", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");
    project = addAssetToTrack(project, "video-b", "video-1", 5000);
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "video-1"
          ? {
              ...track,
              clips: track.clips.map((clip) =>
                clip.assetId === "video-a"
                  ? {
                      ...clip,
                      transitionOut: {
                        type: "fade-through-black" as const,
                        durationMs: 1000,
                      },
                    }
                  : clip,
              ),
            }
          : track,
      ),
    };

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).toContain("fade=t=out:st=0:d=0.5");
    expect(graph.filterComplex).toContain("fade=t=in:st=0:d=0.5");
    expect(graph.filterComplex).toContain(
      "[transition_0_prefix][transition_0_fade_out][transition_0_fade_in][full1]concat=n=4:v=1:a=0",
    );
  });

  it("rejects transitions when the incoming visual clip is not directly adjacent", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");
    project = addAssetToTrack(project, "video-b", "video-1", 6000);
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === "video-1"
          ? {
              ...track,
              clips: track.clips.map((clip) =>
                clip.assetId === "video-a"
                  ? {
                      ...clip,
                      transitionOut: {
                        type: "dissolve" as const,
                        durationMs: 500,
                      },
                    }
                  : clip,
              ),
            }
          : track,
      ),
    };

    const plan = createRenderPlan(project, createDefaultExportSettings(project));

    expect(() => compileSingleVideoTrackGraph(plan)).toThrow(
      "directly adjacent visual clips",
    );
  });


  it("compiles animated transform keyframes into time-based FFmpeg expressions", () => {
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
                      y: -10,
                      scale: 1.5,
                      rotation: 30,
                      opacity: 0.5,
                      },
                    easing: "ease-in",
                  },
                  {
                    timeMs: 2000,
                    transform: {
                      x: -20,
                      y: 10,
                      scale: 0.75,
                      rotation: -30,
                      opacity: 1,
                    },
                    easing: "ease-in-out",
                  },
                ],
              })),
            }
          : track,
      ),
    };

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).toContain("scale=w='iw*");
    expect(graph.filterComplex).toContain("eval=frame");
    expect(graph.filterComplex).toContain("rotate='");
    expect(graph.filterComplex).toContain("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*");
    expect(graph.filterComplex).toContain("overlay=x='(W-w)/2+(");
    expect(graph.filterComplex).toContain("overlay=x='");
    expect(graph.filterComplex).toContain("\\,");
    expect(graph.filterComplex).toContain("2*(");
    expect(graph.filterComplex).not.toContain(
      "animated transform export is deferred",
    );
  });

  it("preserves crop and visual effects before animated transforms", () => {
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
                  right: 0.1,
                  bottom: 0.05,
                  left: 0.1,
                },
                cropPosition: {
                  x: 0.6,
                  y: 0.5,
                },
                visualEffects: {
                  brightness: 0.1,
                  contrast: 0.2,
                  saturation: -0.1,
                },
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
                      x: 10,
                      y: 5,
                      scale: 1.2,
                      rotation: 10,
                      opacity: 0.8,
                    },
                  },
                ],
              })),
            }
          : track,
      ),
    };

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    const filter = graph.filterComplex;
    expect(filter.indexOf("eq=brightness=0.1:contrast=1.2:saturation=0.9")).toBeGreaterThanOrEqual(0);
    expect(filter.indexOf("crop=w=trunc(iw*0.8):h=trunc(ih*0.9)")).toBeGreaterThanOrEqual(0);
    expect(filter.indexOf("scale=w='iw*")).toBeGreaterThanOrEqual(0);
    expect(filter.indexOf("overlay=x='")).toBeGreaterThanOrEqual(0);
  });


  it("compiles text overlays into the visual segment filter chain", () => {
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

    const graph = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).toContain(
      "drawtext=font='DejaVu Sans':text='Hello\\, FrameFlow!':fontsize=64:fontcolor=#ffffff:x=(w-text_w)*0.25:y=(h-text_h)*0.75:line_spacing=4:expansion=none",
    );
  });

  it("keeps text after crop and effects and before transforms", () => {
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
                  brightness: 0.1,
                  contrast: 0.2,
                  saturation: -0.1,
                },
                crop: {
                  top: 0.05,
                  right: 0.1,
                  bottom: 0.05,
                  left: 0.1,
                },
                cropPosition: {
                  x: 0.6,
                  y: 0.5,
                },
                textOverlay: {
                  text: "Ordered",
                  x: 0.5,
                  y: 0.5,
                  fontSize: 64,
                  color: "#ffffff",
                  alignment: "center" as const,
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

    const filter = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    ).filterComplex;

    const effectsIndex = filter.indexOf("eq=brightness=0.1:contrast=1.2:saturation=0.9");
    const cropIndex = filter.indexOf("crop=w=trunc(iw*0.85):h=trunc(iw*0.85)");
    const textIndex = filter.indexOf("drawtext=font='DejaVu Sans'");
    const transformIndex = filter.indexOf("scale=w=iw*1.2:h=ih*1.2");

    expect(effectsIndex).toBeGreaterThanOrEqual(0);
    expect(cropIndex).toBeGreaterThanOrEqual(0);
    expect(textIndex).toBeGreaterThan(cropIndex);
    expect(textIndex).toBeGreaterThan(effectsIndex);
    expect(transformIndex).toBeGreaterThan(textIndex);
  });

  it("keeps text before animated transform stages", () => {
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
                  text: "Animated",
                  x: 0.5,
                  y: 0.5,
                  fontSize: 56,
                  color: "#ffffff",
                  alignment: "center" as const,
                },
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
                      x: 10,
                      y: 5,
                      scale: 1.25,
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

    const filter = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    ).filterComplex;

    const textIndex = filter.indexOf("drawtext=font='DejaVu Sans'");
    const scaleIndex = filter.indexOf("scale=w='iw*");

    expect(textIndex).toBeGreaterThanOrEqual(0);
    expect(scaleIndex).toBeGreaterThan(textIndex);
    expect(filter).toContain("eval=frame");
  });

  it("keeps text inside the anchor-aware transform chain", () => {
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
                  text: "Anchored",
                  x: 0.25,
                  y: 0.75,
                  fontSize: 48,
                  color: "#ffffff",
                  alignment: "left" as const,
                },
                transformAnchor: {
                  x: 0.25,
                  y: 0.75,
                },
                transform: {
                  x: 8,
                  y: -4,
                  scale: 1.5,
                  rotation: 30,
                  opacity: 0.9,
                },
              })),
            }
          : track,
      ),
    };

    const filter = compileSingleVideoTrackGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    ).filterComplex;

    const textIndex = filter.indexOf("drawtext=font='DejaVu Sans'");
    const scaleIndex = filter.indexOf("scale=w='iw*1.5':h='ih*1.5':eval=frame");

    expect(textIndex).toBeGreaterThanOrEqual(0);
    expect(scaleIndex).toBeGreaterThan(textIndex);
    expect(filter).toContain("anchor_pivot_0");
  });

  it("preserves text overlay rendering on an upper multi-track clip", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");
    project = addTrack(project, "video");
    const videoTrackId = project.tracks.find(
      (track) => track.id !== "video-1" && track.type === "video",
    )?.id;
    if (!videoTrackId) throw new Error("Test video track was not created.");
    project = addAssetToTrack(project, "video-b", videoTrackId, 0);
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === videoTrackId
          ? {
              ...track,
              clips: track.clips.map((clip) => ({
                ...clip,
                textOverlay: {
                  text: "Upper track",
                  x: 0.5,
                  y: 0.2,
                  fontSize: 48,
                  color: "#00ff00",
                  alignment: "left" as const,
                },
              })),
            }
          : track,
      ),
    };

    const graph = compileVideoTracksGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).toContain(
      "drawtext=font='DejaVu Sans':text='Upper track':fontsize=48:fontcolor=#00ff00:x=w*0.5:y=(h-text_h)*0.2:line_spacing=4:expansion=none",
    );
    expect(graph.filterComplex).toContain("track_1_sequence");
  });

  it("composites multiple video tracks in project track order", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");
    project = addTrack(project, "video");
    const videoTrackId = project.tracks.find((track) => track.id !== "video-1" && track.type === "video")?.id;
    if (!videoTrackId) throw new Error("Test video track was not created.");
    project = addAssetToTrack(project, "video-b", videoTrackId, 0);

    const graph = compileVideoTracksGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    const filter = graph.filterComplex;
    const trackZero = filter.indexOf("[track_0_sequence]");
    const trackOne = filter.indexOf("[track_1_sequence]");

    expect(graph.inputs).toEqual([
      { inputIndex: 0, sourcePath: "/media/a.mp4" },
      { inputIndex: 1, sourcePath: "/media/b.mp4" },
    ]);
    expect(filter).toContain("color=c=black@0.0:s=1080x1920");
    expect(filter).toContain("[multitrack_bg][track_0_sequence]overlay=x=0:y=0");
    expect(filter).toContain("[multitrack_composite_0][track_1_sequence]overlay=x=0:y=0");
    expect(trackZero).toBeGreaterThanOrEqual(0);
    expect(trackOne).toBeGreaterThan(trackZero);
    expect(filter).toContain("format=yuv420p");
    expect(filter).not.toContain("multi-track compositing is deferred");
  });

  it("keeps lower tracks visible through transparent gaps and ignores muted video tracks", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");
    project = addTrack(project, "video");
    const videoTrackId = project.tracks.find((track) => track.id !== "video-1" && track.type === "video")?.id;
    if (!videoTrackId) throw new Error("Test video track was not created.");
    project = addAssetToTrack(project, "video-b", videoTrackId, 2000);
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === videoTrackId
          ? {
              ...track,
              isMuted: true,
            }
          : track,
      ),
    };

    const graph = compileVideoTracksGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).toContain("track_0_sequence");
    expect(graph.filterComplex).not.toContain("track_1_sequence");
    expect(graph.filterComplex).toContain("color=c=black@0.0:s=1080x1920");
    expect(graph.filterComplex).toContain("[multitrack_bg][track_0_sequence]overlay");
    expect(graph.videoMap).toBe("[vout]");
  });

  it("preserves transformed visual clips while compositing multiple tracks", () => {
    let project = createVideoProject();
    project = addAssetToTimeline(project, "video-a");
    project = addTrack(project, "video");
    const videoTrackId = project.tracks.find((track) => track.id !== "video-1" && track.type === "video")?.id;
    if (!videoTrackId) throw new Error("Test video track was not created.");
    project = addAssetToTrack(project, "video-b", videoTrackId, 0);
    project = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === videoTrackId
          ? {
              ...track,
              clips: track.clips.map((clip) => ({
                ...clip,
                transform: {
                  x: 12,
                  y: -8,
                  scale: 1.25,
                  rotation: 18,
                  opacity: 0.8,
                },
                transformAnchor: {
                  x: 0.2,
                  y: 0.8,
                },
              })),
            }
          : track,
      ),
    };

    const graph = compileVideoTracksGraph(
      createRenderPlan(project, createDefaultExportSettings(project)),
    );

    expect(graph.filterComplex).toContain("anchor_pivot_1");
    expect(graph.filterComplex).toContain("colorchannelmixer=aa=0.8");
    expect(graph.filterComplex).toContain("track_1_sequence");
  });

});
