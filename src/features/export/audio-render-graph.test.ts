import { describe, expect, it } from "vitest";
import { compileSingleAudioTrackGraph } from "./audio-render-graph";
import type { RenderPlan } from "./render-plan";

function createAudioSegment(
  overrides: Partial<RenderPlan["segments"][number]> = {},
): RenderPlan["segments"][number] {
  return {
    inputIndex: 0,
    assetId: "audio-a",
    sourcePath: "/media/audio-a.mp3",
    mediaType: "audio",
    trackId: "audio-1",
    trackType: "audio",
    trackIndex: 0,
    timelineStartMs: 0,
    timelineEndMs: 2000,
    sourceStartMs: 1000,
    sourceEndMs: 3000,
    durationMs: 2000,
    isMuted: false,
    ...overrides,
  };
}

function createPlan(
  segments: RenderPlan["segments"],
  durationMs = 5000,
): RenderPlan {
  return {
    width: 406,
    height: 720,
    frameRate: 30,
    durationMs,
    segments,
  };
}

describe("audio render graph", () => {
  it("compiles a trimmed audio clip with timeline delay and stereo normalization", () => {
    const graph = compileSingleAudioTrackGraph(
      createPlan([
        createAudioSegment({
          inputIndex: 2,
          timelineStartMs: 1500,
          timelineEndMs: 3500,
        }),
      ]),
    );

    expect(graph.inputs).toEqual([
      {
        inputIndex: 0,
        sourcePath: "/media/audio-a.mp3",
        sourceStartMs: 1000,
        sourceEndMs: 3000,
        timelineStartMs: 1500,
        durationMs: 2000,
      },
    ]);
    expect(graph.filterComplex).toContain(
      "[0:a:0]atrim=start=1:end=3,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=1,adelay=1500:all=1[audio0]",
    );
    expect(graph.filterComplex).toContain(
      "anullsrc=r=48000:cl=stereo,atrim=duration=5,asetpts=PTS-STARTPTS[silence]",
    );
    expect(graph.filterComplex).toContain(
      "[silence][audio0]amix=inputs=2:duration=longest:dropout_transition=0[aout]",
    );
    expect(graph.audioMap).toBe("[aout]");
  });


  it("applies the track volume inside each audio clip graph", () => {
    const graph = compileSingleAudioTrackGraph(
      createPlan([
        createAudioSegment({
          trackVolume: 0.35,
        }),
      ]),
    );

    expect(graph.filterComplex).toContain(
      ",aformat=sample_rates=48000:channel_layouts=stereo,volume=0.35,adelay=0:all=1[audio0]",
    );
  });

  it("renders audio fade-in and fade-out filters before timeline delay", () => {
    const graph = compileSingleAudioTrackGraph(
      createPlan([
        createAudioSegment({
          durationMs: 5000,
          timelineEndMs: 5000,
          audioFadeInMs: 1000,
          audioFadeOutMs: 1500,
        }),
      ]),
    );

    expect(graph.filterComplex).toContain(
      ",volume=1,afade=t=in:st=0:d=1,afade=t=out:st=3.5:d=1.5,adelay=0:all=1[audio0]",
    );
  });

  it("supports a native input offset for combined video and audio execution", () => {
    const graph = compileSingleAudioTrackGraph(
      createPlan([
        createAudioSegment({
          inputIndex: 7,
          timelineStartMs: 2500,
          timelineEndMs: 3500,
          durationMs: 1000,
        }),
      ]),
      { inputIndexOffset: 1 },
    );

    expect(graph.inputs).toEqual([
      {
        inputIndex: 1,
        sourcePath: "/media/audio-a.mp3",
        sourceStartMs: 1000,
        sourceEndMs: 3000,
        timelineStartMs: 2500,
        durationMs: 1000,
      },
    ]);
    expect(graph.filterComplex).toContain(
      "[1:a:0]atrim=start=1:end=3",
    );
    expect(graph.filterComplex).not.toContain("[7:a:0]");
  });

  it("preserves ordered audio inputs by timeline position", () => {
    const graph = compileSingleAudioTrackGraph(
      createPlan([
        createAudioSegment({
          inputIndex: 3,
          assetId: "audio-b",
          sourcePath: "/media/audio-b.wav",
          timelineStartMs: 4000,
          timelineEndMs: 5000,
          sourceStartMs: 2000,
          sourceEndMs: 3000,
          durationMs: 1000,
        }),
        createAudioSegment({
          inputIndex: 1,
          timelineStartMs: 0,
          timelineEndMs: 1500,
          sourceStartMs: 500,
          sourceEndMs: 2000,
          durationMs: 1500,
        }),
      ]),
    );

    expect(graph.inputs.map((input) => input.inputIndex)).toEqual([0, 1]);
    expect(graph.filterComplex).toContain("[0:a:0]");
    expect(graph.filterComplex).toContain("[1:a:0]");
    expect(graph.filterComplex).toMatch(/\[silence\]\[audio0\]\[audio1\]amix=inputs=3/);
  });

  it("omits muted audio clips from the mix", () => {
    const graph = compileSingleAudioTrackGraph(
      createPlan([
        createAudioSegment({
          inputIndex: 0,
          isMuted: true,
        }),
        createAudioSegment({
          inputIndex: 1,
          timelineStartMs: 2000,
          timelineEndMs: 3000,
          sourceStartMs: 0,
          sourceEndMs: 1000,
          durationMs: 1000,
        }),
      ]),
    );

    expect(graph.filterComplex).not.toContain("[0:a:0]");
    expect(graph.filterComplex).toContain("[1:a:0]");
    expect(graph.filterComplex).toContain("[silence][audio1]amix=inputs=2");
  });

  it("mixes independent audio tracks while preserving deterministic track order", () => {
    const graph = compileSingleAudioTrackGraph(
      createPlan([
        createAudioSegment({
          inputIndex: 2,
          assetId: "audio-track-2",
          trackId: "audio-2",
          trackIndex: 1,
          timelineStartMs: 0,
          timelineEndMs: 2000,
        }),
        createAudioSegment({
          inputIndex: 1,
          assetId: "audio-track-1",
          trackId: "audio-1",
          trackIndex: 0,
          timelineStartMs: 1000,
          timelineEndMs: 3000,
        }),
      ]),
    );

    expect(graph.inputs.map((input) => input.inputIndex)).toEqual([0, 1]);
    expect(graph.filterComplex).toContain("[0:a:0]atrim=start=1:end=3");
    expect(graph.filterComplex).toContain("[1:a:0]atrim=start=0:end=2");
    expect(graph.filterComplex).toMatch(
      /\[silence\]\[audio0\]\[audio1\]amix=inputs=3:duration=longest:dropout_transition=0\[aout\]/,
    );
  });

  it("rejects non-audio assets placed on an audio track", () => {
    expect(() =>
      compileSingleAudioTrackGraph(
        createPlan([
          createAudioSegment({
            mediaType: "video",
          }),
        ]),
      ),
    ).toThrow("audio assets");
  });

  it("rejects plans without audio clips", () => {
    expect(() =>
      compileSingleAudioTrackGraph(
        createPlan([
          {
            ...createAudioSegment(),
            trackType: "video",
          },
        ]),
      ),
    ).toThrow("no audio clips");
  });
});
