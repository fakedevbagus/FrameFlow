import {
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { Clip, Project, Track } from "../project/domain";
import {
  DEFAULT_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM,
} from "./constants";
import {
  pixelsToMilliseconds,
  snapTimelineTime,
} from "./interaction";

const basePixelsPerSecond = 40;
const minimumTimelineMs = 20_000;
const rulerStepMs = 5_000;

interface TimelineProps {
  project: Project;
  currentTimeMs?: number;
  onCurrentTimeChange?: (timeMs: number) => void;
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string) => void;
  onMoveClip?: (clipId: string, timelineStartMs: number) => void;
  onTrimClipStart?: (clipId: string, sourceStartMs: number) => void;
  onTrimClipEnd?: (clipId: string, sourceEndMs: number) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

type ClipInteractionMode = "move" | "trim-start" | "trim-end";

interface ClipInteraction {
  clipId: string;
  mode: ClipInteractionMode;
  startClientX: number;
  originalTimelineStartMs: number;
  originalSourceStartMs: number;
  originalSourceEndMs: number | null;
  previewTimelineStartMs: number;
  previewSourceStartMs: number;
  previewSourceEndMs: number | null;
  hasMoved: boolean;
}

export function Timeline({
  project,
  currentTimeMs = 0,
  onCurrentTimeChange,
  selectedClipId = null,
  onSelectClip,
  onMoveClip,
  onTrimClipStart,
  onTrimClipEnd,
  zoom = DEFAULT_TIMELINE_ZOOM,
  onZoomChange,
}: TimelineProps) {
  const [interaction, setInteraction] = useState<ClipInteraction | null>(null);
  const timelineDurationMs = getTimelineDurationMs(project);
  const pixelsPerSecond = basePixelsPerSecond * zoom;
  const clampedCurrentTimeMs = Math.min(Math.max(currentTimeMs, 0), timelineDurationMs);

  function handleRulerClick(event: PointerEvent<HTMLDivElement>) {
    if (!onCurrentTimeChange || event.button !== 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
    const timeMs = (x / pixelsPerSecond) * 1000;

    onCurrentTimeChange(Math.round(Math.min(timeMs, timelineDurationMs)));
  }

  function handleZoomChange(delta: number) {
    onZoomChange?.(clampZoom(Math.round((zoom + delta) * 100) / 100));
  }

  function getDisplayClip(clip: Clip): Clip {
    if (!interaction || interaction.clipId !== clip.id) {
      return clip;
    }

    return {
      ...clip,
      timelineStartMs: interaction.previewTimelineStartMs,
      sourceStartMs: interaction.previewSourceStartMs,
      sourceEndMs: interaction.previewSourceEndMs,
    };
  }

  function beginClipInteraction(
    event: PointerEvent<HTMLElement>,
    clip: Clip,
    mode: ClipInteractionMode,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    onSelectClip?.(clip.id);

    setInteraction({
      clipId: clip.id,
      mode,
      startClientX: event.clientX,
      originalTimelineStartMs: clip.timelineStartMs,
      originalSourceStartMs: clip.sourceStartMs,
      originalSourceEndMs: clip.sourceEndMs,
      previewTimelineStartMs: clip.timelineStartMs,
      previewSourceStartMs: clip.sourceStartMs,
      previewSourceEndMs: clip.sourceEndMs,
      hasMoved: false,
    });
  }

  function updateClipInteraction(event: PointerEvent<HTMLElement>) {
    if (!interaction || event.buttons !== 1) {
      return;
    }

    const clip = project.tracks
      .flatMap((track) => track.clips)
      .find((candidate) => candidate.id === interaction.clipId);

    if (!clip) {
      return;
    }

    const deltaPixels = event.clientX - interaction.startClientX;

    if (Math.abs(deltaPixels) < 3) {
      return;
    }

    const deltaMs = pixelsToMilliseconds(deltaPixels, pixelsPerSecond);
    const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
    const snapCandidates = buildSnapCandidates(
      project,
      interaction.clipId,
      project.tracks.find((track) =>
        track.clips.some((candidate) => candidate.id === interaction.clipId),
      )?.id ?? null,
    );

    if (interaction.mode === "move") {
      const nextStartMs = snapTimelineTime(
        interaction.originalTimelineStartMs + deltaMs,
        snapCandidates,
      );

      setInteraction({
        ...interaction,
        hasMoved: true,
        previewTimelineStartMs: nextStartMs,
      });
      return;
    }

    if (interaction.mode === "trim-start") {
      const nextSourceStartMs = snapSourceTime(
        interaction.originalSourceStartMs + deltaMs,
        interaction.originalSourceEndMs,
      );
      const sourceEndMs = interaction.originalSourceEndMs;

      if (sourceEndMs === null || nextSourceStartMs >= sourceEndMs) {
        return;
      }

      const nextTimelineStartMs =
        interaction.originalTimelineStartMs +
        (nextSourceStartMs - interaction.originalSourceStartMs);

      if (nextTimelineStartMs < 0) {
        return;
      }

      setInteraction({
        ...interaction,
        hasMoved: true,
        previewTimelineStartMs: nextTimelineStartMs,
        previewSourceStartMs: nextSourceStartMs,
      });
      return;
    }

    const sourceEndMs = interaction.originalSourceEndMs;
    if (sourceEndMs === null) {
      return;
    }

    const nextSourceEndMs = snapSourceEndTime(
      sourceEndMs + deltaMs,
      interaction.originalSourceStartMs,
      asset?.durationMs ?? null,
    );

    if (nextSourceEndMs <= interaction.originalSourceStartMs) {
      return;
    }

    setInteraction({
      ...interaction,
      hasMoved: true,
      previewSourceEndMs: nextSourceEndMs,
    });
  }

  function finishClipInteraction() {
    if (!interaction) {
      return;
    }

    if (!interaction.hasMoved) {
      setInteraction(null);
      return;
    }

    if (interaction.mode === "move" && onMoveClip) {
      onMoveClip(interaction.clipId, interaction.previewTimelineStartMs);
    } else if (interaction.mode === "trim-start" && onTrimClipStart) {
      onTrimClipStart(interaction.clipId, interaction.previewSourceStartMs);
    } else if (interaction.mode === "trim-end" && onTrimClipEnd) {
      if (interaction.previewSourceEndMs !== null) {
        onTrimClipEnd(interaction.clipId, interaction.previewSourceEndMs);
      }
    }

    setInteraction(null);
  }

  function cancelClipInteraction() {
    setInteraction(null);
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
            currentTimeMs={clampedCurrentTimeMs}
            selectedClipId={selectedClipId}
            onSelectClip={onSelectClip}
            zoom={zoom}
            interaction={interaction}
            getDisplayClip={getDisplayClip}
            onBeginClipInteraction={beginClipInteraction}
            onUpdateClipInteraction={updateClipInteraction}
            onFinishClipInteraction={finishClipInteraction}
            onCancelClipInteraction={cancelClipInteraction}
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
  currentTimeMs: number;
  selectedClipId: string | null;
  onSelectClip?: (clipId: string) => void;
  zoom: number;
  interaction: ClipInteraction | null;
  getDisplayClip: (clip: Clip) => Clip;
  onBeginClipInteraction: (
    event: PointerEvent<HTMLElement>,
    clip: Clip,
    mode: ClipInteractionMode,
  ) => void;
  onUpdateClipInteraction: (event: PointerEvent<HTMLElement>) => void;
  onFinishClipInteraction: () => void;
  onCancelClipInteraction: () => void;
}

function TimelineTrack({
  track,
  project,
  timelineDurationMs,
  currentTimeMs,
  selectedClipId,
  onSelectClip,
  zoom,
  interaction,
  getDisplayClip,
  onBeginClipInteraction,
  onUpdateClipInteraction,
  onFinishClipInteraction,
  onCancelClipInteraction,
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
        {track.clips.map((sourceClip) => {
          const clip = getDisplayClip(sourceClip);
          const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
          const durationMs = getClipDurationMs(clip);
          const width = Math.max(72, durationMs / 1000 * pixelsPerSecond);
          const isSelected = clip.id === selectedClipId;
          const isInteracting = interaction?.clipId === clip.id;

          function handleClipKeyDown(event: KeyboardEvent<HTMLDivElement>) {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectClip?.(clip.id);
            }
          }

          return (
            <div
              aria-label={"Select " + (asset?.name ?? "Missing media") + " clip"}
              aria-pressed={isSelected}
              className={
                "timeline-clip timeline-clip-" +
                track.type +
                (isSelected ? " timeline-clip-selected" : "") +
                (isInteracting ? " timeline-clip-interacting" : "")
              }
              key={clip.id}
              onClick={() => onSelectClip?.(clip.id)}
              onKeyDown={handleClipKeyDown}
              onPointerDown={(event) => onBeginClipInteraction(event, sourceClip, "move")}
              onPointerMove={onUpdateClipInteraction}
              onPointerUp={onFinishClipInteraction}
              onPointerCancel={onCancelClipInteraction}
              role="button"
              tabIndex={0}
              title={asset ? asset.name + " · " + formatTimecode(durationMs) : "Missing media"}
            >
              <span
                aria-label="Trim clip start"
                className="timeline-trim-handle timeline-trim-handle-start"
                onPointerDown={(event) =>
                  onBeginClipInteraction(event, sourceClip, "trim-start")
                }
                role="presentation"
              />
              <span className="timeline-clip-name">{asset?.name ?? "Missing media"}</span>
              <small>{formatTimecode(durationMs)}</small>
              <span
                aria-label="Trim clip end"
                className="timeline-trim-handle timeline-trim-handle-end"
                onPointerDown={(event) =>
                  onBeginClipInteraction(event, sourceClip, "trim-end")
                }
                role="presentation"
              />
            </div>
          );
        })}

        {track.clips.length === 0 ? (
          <div className="track-empty">Klik media untuk menambahkannya</div>
        ) : null}

        <div
          aria-hidden="true"
          className="timeline-track-playhead"
          style={{ left: (currentTimeMs / 1000 * pixelsPerSecond) + "px" }}
        />
      </div>
    </div>
  );
}

function buildSnapCandidates(
  project: Project,
  clipId: string,
  trackId: string | null,
): number[] {
  const candidates = [0];

  if (!trackId) {
    return candidates;
  }

  const track = project.tracks.find((candidate) => candidate.id === trackId);
  if (!track) {
    return candidates;
  }

  for (const clip of track.clips) {
    if (clip.id === clipId) {
      continue;
    }

    candidates.push(clip.timelineStartMs);

    const durationMs = getClipDurationMs(clip);
    candidates.push(clip.timelineStartMs + durationMs);
  }

  return candidates;
}

function snapSourceTime(
  sourceTimeMs: number,
  sourceEndMs: number | null,
): number {
  const candidates = sourceEndMs === null ? [] : [sourceEndMs];

  return Math.max(
    0,
    Math.min(
      snapTimelineTime(sourceTimeMs, candidates),
      sourceEndMs === null ? Number.MAX_SAFE_INTEGER : sourceEndMs - 1,
    ),
  );
}

function snapSourceEndTime(
  sourceEndMs: number,
  sourceStartMs: number,
  assetDurationMs: number | null,
): number {
  const maxSourceEndMs = assetDurationMs ?? Number.MAX_SAFE_INTEGER;

  return Math.max(
    sourceStartMs + 1,
    Math.min(
      snapTimelineTime(sourceEndMs),
      maxSourceEndMs,
    ),
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
