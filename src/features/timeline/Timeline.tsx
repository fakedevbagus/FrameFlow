import type { MouseEvent } from "react";
import type { Clip, Project, Track } from "../project/domain";

const basePixelsPerSecond = 40;
const minimumTimelineMs = 20_000;
const rulerStepMs = 5_000;
export const MIN_TIMELINE_ZOOM = 0.5;
export const MAX_TIMELINE_ZOOM = 2.5;
export const DEFAULT_TIMELINE_ZOOM = 1;

interface TimelineProps {
  project: Project;
  currentTimeMs?: number;
  onCurrentTimeChange?: (timeMs: number) => void;
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

export function Timeline({
  project,
  currentTimeMs = 0,
  onCurrentTimeChange,
  selectedClipId = null,
  onSelectClip,
  zoom = DEFAULT_TIMELINE_ZOOM,
  onZoomChange,
}: TimelineProps) {
  const timelineDurationMs = getTimelineDurationMs(project);
  const pixelsPerSecond = basePixelsPerSecond * zoom;
  const clampedCurrentTimeMs = Math.min(Math.max(currentTimeMs, 0), timelineDurationMs);

  function handleRulerClick(event: MouseEvent<HTMLDivElement>) {
    if (!onCurrentTimeChange) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
    const timeMs = (x / pixelsPerSecond) * 1000;

    onCurrentTimeChange(Math.round(Math.min(timeMs, timelineDurationMs)));
  }

  function handleZoomChange(delta: number) {
    onZoomChange?.(
      clampZoom(Math.round((zoom + delta) * 10) / 10),
    );
  }

  return (
    <section className="timeline-region" aria-label="Timeline">
      <div className="timeline-toolbar">
        <span>Timeline</span>
        <div className="timeline-actions">
          <button
            aria-label="Zoom out timeline"
            className="toolbar-button"
            disabled={zoom <= MIN_TIMELINE_ZOOM}
            onClick={() => handleZoomChange(-0.25)}
            type="button"
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in timeline"
            className="toolbar-button"
            disabled={zoom >= MAX_TIMELINE_ZOOM}
            onClick={() => handleZoomChange(0.25)}
            type="button"
          >
            +
          </button>
        </div>
      </div>

      <div className="timeline-scroll">
        <div className="timeline-ruler">
          <div className="timeline-track-spacer" />
          <div
            className="timeline-ruler-scale"
            onClick={handleRulerClick}
            role="presentation"
            style={{ width: timelineWidth(timelineDurationMs, zoom) + "px" }}
          >
            {createRulerMarks(timelineDurationMs).map((mark) => (
              <span
                key={mark}
                style={{ left: (mark / 1000 * pixelsPerSecond) + "px" }}
              >
                {formatTimecode(mark)}
              </span>
            ))}
            <div
              aria-label={"Playhead at " + formatTimecode(clampedCurrentTimeMs)}
              className="timeline-playhead"
              style={{ left: (clampedCurrentTimeMs / 1000 * pixelsPerSecond) + "px" }}
            />
          </div>
        </div>

        {project.tracks.map((track) => (
          <TimelineTrack
            key={track.id}
            track={track}
            project={project}
            timelineDurationMs={timelineDurationMs}
            selectedClipId={selectedClipId}
            onSelectClip={onSelectClip}
            zoom={zoom}
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
  zoom: number;
}

function TimelineTrack({
  track,
  project,
  timelineDurationMs,
  selectedClipId,
  onSelectClip,
  zoom,
}: TimelineTrackProps) {
  const pixelsPerSecond = basePixelsPerSecond * zoom;

  return (
    <div className="track">
      <div className="track-label">
        <strong>{track.type === "video" ? "V1" : "A1"}</strong>
        <span>{track.name}</span>
      </div>
      <div
        className="timeline-lane"
        style={{ width: timelineWidth(timelineDurationMs, zoom) + "px" }}
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

function timelineWidth(durationMs: number, zoom: number): number {
  return durationMs / 1000 * basePixelsPerSecond * zoom;
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, zoom));
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
