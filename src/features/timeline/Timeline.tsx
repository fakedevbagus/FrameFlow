import type { Clip, Project, Track } from "../project/domain";

const pixelsPerSecond = 40;
const minimumTimelineMs = 20_000;
const rulerStepMs = 5_000;

interface TimelineProps {
  project: Project;
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string) => void;
}

export function Timeline({ project, selectedClipId = null, onSelectClip }: TimelineProps) {
  const timelineDurationMs = getTimelineDurationMs(project);

  return (
    <section className="timeline-region" aria-label="Timeline">
      <div className="timeline-toolbar">
        <span>Timeline</span>
        <div className="timeline-actions">
          <button className="toolbar-button" disabled type="button">−</button>
          <span>100%</span>
          <button className="toolbar-button" disabled type="button">+</button>
        </div>
      </div>

      <div className="timeline-scroll">
        <div className="timeline-ruler">
          <div className="timeline-track-spacer" />
          <div
            className="timeline-ruler-scale"
            style={{ width: (timelineDurationMs / 1000 * pixelsPerSecond) + "px" }}
          >
            {createRulerMarks(timelineDurationMs).map((mark) => (
              <span
                key={mark}
                style={{ left: (mark / 1000 * pixelsPerSecond) + "px" }}
              >
                {formatTimecode(mark)}
              </span>
            ))}
          </div>
        </div>

        {project.tracks.map((track) => (
          <TimelineTrack
            key={track.id}
            track={track}
            project={project}
            timelineDurationMs={timelineDurationMs}
          />
        ))}
      </div>
    </section>
  );
}

interface TimelineTrackProps {
  track: Track;
  project: Project;
  timelineDurationMs: number;
  selectedClipId: string | null;
  onSelectClip?: (clipId: string) => void;
}

function TimelineTrack({
  track,
  project,
  timelineDurationMs,
  selectedClipId,
  onSelectClip,
}: TimelineTrackProps) {
  return (
    <div className="track">
      <div className="track-label">
        <strong>{track.type === "video" ? "V1" : "A1"}</strong>
        <span>{track.name}</span>
      </div>
      <div
        className="timeline-lane"
        style={{ width: (timelineDurationMs / 1000 * pixelsPerSecond) + "px" }}
      >
        {track.clips.map((clip) => {
          const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
          const durationMs = getClipDurationMs(clip);
          const width = Math.max(72, durationMs / 1000 * pixelsPerSecond);

          const isSelected = clip.id === selectedClipId;

          return (
            <button
              aria-label={"Select " + (asset?.name ?? "Missing media") + " clip"}
              aria-pressed={isSelected}
              className={
                "timeline-clip timeline-clip-" +
                track.type +
                (isSelected ? " timeline-clip-selected" : "")
              }
              key={clip.id}
              onClick={() => onSelectClip?.(clip.id)}
              style={{
                left: (clip.timelineStartMs / 1000 * pixelsPerSecond) + "px",
                width: width + "px",
              }}
              title={asset ? asset.name + " · " + formatTimecode(durationMs) : "Missing media"}
              type="button"
            >
              <span className="timeline-clip-name">{asset?.name ?? "Missing media"}</span>
              <small>{formatTimecode(durationMs)}</small>
            </button>
          );
        })}

        {track.clips.length === 0 ? (
          <div className="track-empty">Klik media untuk menambahkannya</div>
        ) : null}
      </div>
    </div>
  );
}

function getTimelineDurationMs(project: Project): number {
  const latestClipEndMs = project.tracks.reduce(
    (latestTrackEnd, track) =>
      Math.max(
        latestTrackEnd,
        ...track.clips.map((clip) => clip.timelineStartMs + getClipDurationMs(clip)),
      ),
    0,
  );

  return Math.max(minimumTimelineMs, latestClipEndMs);
}

function getClipDurationMs(clip: Clip): number {
  if (clip.sourceEndMs === null) {
    return 0;
  }

  return Math.max(0, clip.sourceEndMs - clip.sourceStartMs);
}

function createRulerMarks(durationMs: number): number[] {
  const marks: number[] = [];

  for (let timeMs = 0; timeMs <= durationMs; timeMs += rulerStepMs) {
    marks.push(timeMs);
  }

  return marks;
}

function formatTimecode(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0");
}
