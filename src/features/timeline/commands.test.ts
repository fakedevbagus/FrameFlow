      project,
      "audio-1",
      -0.65,
      new Date("2026-09-20T00:00:01.000Z"),
    );

    expect(updated.tracks.find((track) => track.id === "audio-1")?.pan).toBe(-0.65);
    expect(updated.updatedAt).toBe("2026-09-20T00:00:01.000Z");
  });

  it("rejects invalid pan values and unknown tracks", () => {
    const project = createProject({ id: "pan-command-errors" });

    expect(() => updateTrackPan(project, "audio-1", -1.01)).toThrow(
      "Track pan must be between -1 and 1.",
    );
    expect(() => updateTrackPan(project, "audio-1", 1.01)).toThrow(
      "Track pan must be between -1 and 1.",
    );
    expect(() => updateTrackPan(project, "missing-track", 0)).toThrow(
      "Track does not exist in this project.",
    );
  });

});

describe("updateTrackVolume", () => {
  it("updates the track volume and project timestamp", () => {
    const project = createProject({
      id: "volume-command",
      now: new Date("2026-09-20T00:00:00.000Z"),
    });
