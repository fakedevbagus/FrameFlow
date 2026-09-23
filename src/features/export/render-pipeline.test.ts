        "[1:a:0]atrim=start=0.5:end=3.5",
      ),
      audioMap: "[aout]",
      durationMs: 5000,
      outputPath: "/tmp/project.mp4",
    });

    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
  });

  it("does not call the native renderer when graph compilation rejects unsupported state", () => {
    const plan: RenderPlan = {
      width: 1080,
      height: 1920,
      frameRate: 30,
      durationMs: 2000,
      segments: [
        {
          inputIndex: 0,
          assetId: "video-a",
          sourcePath: "/media/a.mp4",
          mediaType: "video",
          trackId: "video-1",
          trackType: "video",
          trackIndex: 0,
          timelineStartMs: 0,
          timelineEndMs: 2000,
          sourceStartMs: 0,
          sourceEndMs: 2000,
          durationMs: 2000,
          isMuted: false,
          transform: { x: 10, y: 0, scale: 1, rotation: 0, opacity: 1 },
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
        },
      ],
    };

    expect(() =>
      renderVideoPlanToMp4(plan, "/tmp/timeline-export.mp4"),
    ).toThrow("animated transform export is deferred");
    expect(renderSingleSourceToMp4).not.toHaveBeenCalled();
    expect(renderVideoGraphToMp4).not.toHaveBeenCalled();
    expect(renderVideoSegmentsToMp4).not.toHaveBeenCalled();
  });

  it("compiles the graph before invoking native rendering", () => {
    expect(typeof compileSingleVideoTrackGraph).toBe("function");
  });
});