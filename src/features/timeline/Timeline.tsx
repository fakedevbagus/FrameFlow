import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  getAudioFadeDurations,
  getTrackVolume,
  type Clip,
  type ClipTransition,
  type Project,
  type Track,
} from "../project/domain";
import {
  DEFAULT_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM,
} from "./constants";
import {
  pixelsToMilliseconds,
  snapTimelineTime,
} from "./interaction";
import { getClipDurationMs, getTimelineDurationMs } from "./metrics";
import {
  getClipTransition,
  getNextClipForTransition,
  isTransitionAdjacent,
  MAX_DISSOLVE_DURATION_MS,
  MIN_DISSOLVE_DURATION_MS,
  getTransitionLabel,
} from "../transition/transition";

const basePixelsPerSecond = 40;
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
  onToggleTrackMute?: (trackId: string) => void;
  onUpdateTrackVolume?: (trackId: string, volume: number) => void;
  onUpdateAudioClipFades?: (
    clipId: string,
    fadeInMs: number,
    fadeOutMs: number,
  ) => void;
  onAddAssetToTrack?: (
    assetId: string,
    trackId: string,
    timelineStartMs: number,
  ) => void;
  onAddTrack?: (type: "audio" | "video") => void;
  onRemoveTrack?: (trackId: string) => void;
  onRemoveTransformKeyframe?: (
    clipId: string,
    timeMs: number,
  ) => void;
  onMoveTransformKeyframe?: (
    clipId: string,
    fromTimeMs: number,
    toTimeMs: number,
  ) => void;
  onUpdateClipTransition?: (
    clipId: string,
    transition: ClipTransition | undefined,
  ) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

type ClipInteractionMode = "move" | "trim-start" | "trim-end";

interface AudioFadeInteraction {
  clipId: string;
  mode: "fade-in" | "fade-out";
  pointerId: number;
  startClientX: number;
  originalFadeInMs: number;
  originalFadeOutMs: number;
  previewFadeInMs: number;
  previewFadeOutMs: number;
  hasMoved: boolean;
}

const AUDIO_FADE_HANDLE_STEP_MS = 100;

interface KeyframeInteraction {
  clipId: string;
  pointerId: number;
  keyframeTimeMs: number;
  startClientX: number;
  previewTimeMs: number;
  hasMoved: boolean;
}

interface TransitionInteraction {
  clipId: string;
  pointerId: number;
  startClientX: number;
  transitionType: ClipTransition["type"];
  originalDurationMs: number;
  previewDurationMs: number;
  maxDurationMs: number;
  hasMoved: boolean;
}

interface ClipInteraction {
  clipId: string;
  mode: ClipInteractionMode;
  pointerId: number;
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
  onToggleTrackMute,
  onUpdateTrackVolume,
  onAddAssetToTrack,
  onAddTrack,
  onRemoveTrack,
  onRemoveTransformKeyframe,
  onMoveTransformKeyframe,
  onUpdateClipTransition,
  zoom = DEFAULT_TIMELINE_ZOOM,
  onZoomChange,
}: TimelineProps) {
  const [interaction, setInteraction] = useState<ClipInteraction | null>(null);
  const [audioFadeInteraction, setAudioFadeInteraction] =
    useState<AudioFadeInteraction | null>(null);
  const audioFadeInteractionTargetRef = useRef<HTMLElement | null>(null);
  const clipInteractionTargetRef = useRef<HTMLElement | null>(null);
  const [transitionInteraction, setTransitionInteraction] =
    useState<TransitionInteraction | null>(null);
  const transitionInteractionTargetRef = useRef<HTMLElement | null>(null);
  const [keyframeInteraction, setKeyframeInteraction] =
    useState<KeyframeInteraction | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);
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

  function handleTrackDragOver(event: DragEvent<HTMLDivElement>, trackId: string) {
    if (!onAddAssetToTrack) {
      return;
    }

    if (event.dataTransfer.types.includes("application/x-frameflow-asset-id")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDragOverTrackId(trackId);
    }
  }

  function handleTrackDrop(event: DragEvent<HTMLDivElement>, trackId: string) {
    if (!onAddAssetToTrack) {
      return;
    }

    event.preventDefault();
    setDragOverTrackId(null);

    const assetId = event.dataTransfer.getData(
      "application/x-frameflow-asset-id",
    );

    if (!assetId) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const clientX = Number.isFinite(event.clientX)
      ? event.clientX
      : bounds.left;
    const laneWidth =
      Number.isFinite(bounds.width) && bounds.width > 0
        ? bounds.width
        : timelineWidth(timelineDurationMs, zoom);
    const x = Math.min(
      Math.max(clientX - bounds.left, 0),
      laneWidth,
    );
    const requestedTimeMs = (x / pixelsPerSecond) * 1000;

    onAddAssetToTrack(
      assetId,
      trackId,
      Math.max(0, snapTimelineTime(Math.round(requestedTimeMs))),
    );
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

  function beginKeyframeInteraction(
    event: PointerEvent<HTMLButtonElement>,
    clip: Clip,
    keyframeTimeMs: number,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    onSelectClip?.(clip.id);
    onCurrentTimeChange?.(
      Math.min(
        Math.max(clip.timelineStartMs + keyframeTimeMs, 0),
        timelineDurationMs,
      ),
    );
    if ("setPointerCapture" in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    setKeyframeInteraction({
      clipId: clip.id,
      pointerId: event.pointerId,
      keyframeTimeMs,
      startClientX: event.clientX,
      previewTimeMs: keyframeTimeMs,
      hasMoved: false,
    });
  }

  function updateKeyframeInteraction(event: PointerEvent<HTMLButtonElement>) {
    if (
      !keyframeInteraction ||
      event.buttons !== 1 ||
      event.pointerId !== keyframeInteraction.pointerId
    ) {
      return;
    }

    const clip = project.tracks
      .flatMap((track) => track.clips)
      .find((candidate) => candidate.id === keyframeInteraction.clipId);

    if (!clip) {
      return;
    }

    const deltaPixels = event.clientX - keyframeInteraction.startClientX;
    if (Math.abs(deltaPixels) < 2) {
      return;
    }

    const deltaMs = pixelsToMilliseconds(deltaPixels, pixelsPerSecond);
    const keyframes = [...(clip.transformKeyframes ?? [])].sort(
      (a, b) => a.timeMs - b.timeMs,
    );
    const index = keyframes.findIndex(
      (keyframe) => keyframe.timeMs === keyframeInteraction.keyframeTimeMs,
    );

    if (index === -1) {
      return;
    }

    const previousTimeMs = index > 0 ? keyframes[index - 1].timeMs : 0;
    const nextTimeMs =
      index < keyframes.length - 1
        ? keyframes[index + 1].timeMs
        : getClipDurationMs(clip);

    const frameStepMs = 1000 / project.canvas.frameRate;
    const minimumTimeMs =
      index > 0 ? previousTimeMs + frameStepMs : 0;
    const maximumTimeMs =
      index < keyframes.length - 1
        ? nextTimeMs - frameStepMs
        : nextTimeMs;

    const nextTimeMsClamped = Math.min(
      Math.max(
        Math.round(
          snapTimelineTime(
            keyframeInteraction.keyframeTimeMs + deltaMs,
          ),
        ),
        minimumTimeMs,
      ),
      maximumTimeMs,
    );

    setKeyframeInteraction({
      ...keyframeInteraction,
      hasMoved: true,
      previewTimeMs: nextTimeMsClamped,
    });
  }

  function finishKeyframeInteraction(
    event?: PointerEvent<HTMLButtonElement>,
  ) {
    if (!keyframeInteraction) {
      return;
    }

    if (
      event &&
      "hasPointerCapture" in event.currentTarget &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (
      !keyframeInteraction.hasMoved ||
      keyframeInteraction.previewTimeMs === keyframeInteraction.keyframeTimeMs
    ) {
      setKeyframeInteraction(null);
      return;
    }

    event?.preventDefault();
    onMoveTransformKeyframe?.(
      keyframeInteraction.clipId,
      keyframeInteraction.keyframeTimeMs,
      keyframeInteraction.previewTimeMs,
    );
    onCurrentTimeChange?.(
      Math.min(
        Math.max(
          project.tracks
            .flatMap((track) => track.clips)
            .find((clip) => clip.id === keyframeInteraction.clipId)
            ?.timelineStartMs ?? 0,
          0,
        ) + keyframeInteraction.previewTimeMs,
        timelineDurationMs,
      ),
    );
    setKeyframeInteraction(null);
  }

  function cancelKeyframeInteraction(
    event?: KeyboardEvent<HTMLButtonElement>,
  ) {
    if (event && keyframeInteraction) {
      const target = event.currentTarget;

      if (
        "hasPointerCapture" in target &&
        target.hasPointerCapture(keyframeInteraction.pointerId)
      ) {
        target.releasePointerCapture(keyframeInteraction.pointerId);
      }
    }

    setKeyframeInteraction(null);
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

    if ("setPointerCapture" in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    clipInteractionTargetRef.current = event.currentTarget;

    setInteraction({
      clipId: clip.id,
      mode,
      pointerId: event.pointerId,
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
    if (
      !interaction ||
      event.buttons !== 1 ||
      event.pointerId !== interaction.pointerId
    ) {
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
    const activeTrack = project.tracks.find((track) =>
      track.clips.some((candidate) => candidate.id === interaction.clipId),
    );
    const snapCandidates = buildSnapCandidates(
      project,
      interaction.clipId,
      activeTrack?.id ?? null,
    );

    if (interaction.mode === "move") {
      const snappedStartMs = snapTimelineTime(
        interaction.originalTimelineStartMs + deltaMs,
        snapCandidates,
      );
      const nextStartMs = activeTrack
        ? resolveMoveStartWithoutOverlap(
            activeTrack,
            interaction.clipId,
            snappedStartMs,
            getClipDurationMs(clip),
            deltaPixels,
          )
        : snappedStartMs;

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

  function finishClipInteraction(event?: PointerEvent<HTMLElement>) {
    if (!interaction) {
      return;
    }

    const target = event?.currentTarget ?? clipInteractionTargetRef.current;

    if (
      target &&
      "hasPointerCapture" in target &&
      target.hasPointerCapture(interaction.pointerId)
    ) {
      target.releasePointerCapture(interaction.pointerId);
    }

    if (!interaction.hasMoved) {
      clipInteractionTargetRef.current = null;
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

    clipInteractionTargetRef.current = null;
    setInteraction(null);
  }

  const cancelClipInteraction = useCallback(() => {
    const target = clipInteractionTargetRef.current;

    if (
      target &&
      interaction &&
      "hasPointerCapture" in target &&
      target.hasPointerCapture(interaction.pointerId)
    ) {
      target.releasePointerCapture(interaction.pointerId);
    }

    clipInteractionTargetRef.current = null;
    setInteraction(null);
  }, [interaction]);

  useEffect(() => {
    if (!interaction) {
      return;
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      cancelClipInteraction();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [interaction, cancelClipInteraction]);

  function beginAudioFadeInteraction(
    event: PointerEvent<HTMLButtonElement>,
    clip: Clip,
    mode: "fade-in" | "fade-out",
  ) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    onSelectClip?.(clip.id);
    const fadeDurations = getAudioFadeDurations(clip);

    if ("setPointerCapture" in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    audioFadeInteractionTargetRef.current = event.currentTarget;

    setAudioFadeInteraction({
      clipId: clip.id,
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      originalFadeInMs: fadeDurations.fadeInMs,
      originalFadeOutMs: fadeDurations.fadeOutMs,
      previewFadeInMs: fadeDurations.fadeInMs,
      previewFadeOutMs: fadeDurations.fadeOutMs,
      hasMoved: false,
    });
  }

  function updateAudioFadeInteraction(
    event: PointerEvent<HTMLButtonElement>,
  ) {
    if (
      !audioFadeInteraction ||
      event.buttons !== 1 ||
      event.pointerId !== audioFadeInteraction.pointerId
    ) {
      return;
    }

    const clip = project.tracks
      .flatMap((track) => track.clips)
      .find((candidate) => candidate.id === audioFadeInteraction.clipId);
    if (!clip) {
      return;
    }

    const deltaPixels =
      audioFadeInteraction.mode === "fade-in"
        ? event.clientX - audioFadeInteraction.startClientX
        : audioFadeInteraction.startClientX - event.clientX;
    if (Math.abs(deltaPixels) < 2) {
      return;
    }

    const deltaMs = pixelsToMilliseconds(deltaPixels, pixelsPerSecond);
    const durationMs = getClipDurationMs(clip);

    if (audioFadeInteraction.mode === "fade-in") {
      const maxFadeMs = Math.max(
        0,
        durationMs - audioFadeInteraction.originalFadeOutMs,
      );
      const nextFadeInMs = snapAudioFadeDuration(
        audioFadeInteraction.originalFadeInMs + deltaMs,
        maxFadeMs,
      );
      setAudioFadeInteraction({
        ...audioFadeInteraction,
        hasMoved: true,
        previewFadeInMs: nextFadeInMs,
      });
      return;
    }

    const maxFadeMs = Math.max(
      0,
      durationMs - audioFadeInteraction.originalFadeInMs,
    );
    const nextFadeOutMs = snapAudioFadeDuration(
      audioFadeInteraction.originalFadeOutMs + deltaMs,
      maxFadeMs,
    );
    setAudioFadeInteraction({
      ...audioFadeInteraction,
      hasMoved: true,
      previewFadeOutMs: nextFadeOutMs,
    });
  }

  function finishAudioFadeInteraction(
    event?: PointerEvent<HTMLButtonElement>,
  ) {
    if (!audioFadeInteraction) {
      return;
    }

    const target =
      event?.currentTarget ?? audioFadeInteractionTargetRef.current;
    if (
      target &&
      "hasPointerCapture" in target &&
      target.hasPointerCapture(audioFadeInteraction.pointerId)
    ) {
      target.releasePointerCapture(audioFadeInteraction.pointerId);
    }

    const changed =
      audioFadeInteraction.previewFadeInMs !==
        audioFadeInteraction.originalFadeInMs ||
      audioFadeInteraction.previewFadeOutMs !==
        audioFadeInteraction.originalFadeOutMs;

    if (audioFadeInteraction.hasMoved && changed) {
      onUpdateAudioClipFades?.(
        audioFadeInteraction.clipId,
        audioFadeInteraction.previewFadeInMs,
        audioFadeInteraction.previewFadeOutMs,
      );
    }

    audioFadeInteractionTargetRef.current = null;
    setAudioFadeInteraction(null);
  }

  function cancelAudioFadeInteraction() {
    const target = audioFadeInteractionTargetRef.current;
    if (
      target &&
      audioFadeInteraction &&
      "hasPointerCapture" in target &&
      target.hasPointerCapture(audioFadeInteraction.pointerId)
    ) {
      target.releasePointerCapture(audioFadeInteraction.pointerId);
    }

    audioFadeInteractionTargetRef.current = null;
    setAudioFadeInteraction(null);
  }

  function handleAudioFadeKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    clip: Clip,
    mode: "fade-in" | "fade-out",
  ) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const current = getAudioFadeDurations(clip);
    const durationMs = getClipDurationMs(clip);
    const direction =
      mode === "fade-in"
        ? event.key === "ArrowRight" ? 1 : -1
        : event.key === "ArrowLeft" ? 1 : -1;
    const deltaMs = direction * AUDIO_FADE_HANDLE_STEP_MS;

    if (mode === "fade-in") {
      const nextFadeInMs = snapAudioFadeDuration(
        current.fadeInMs + deltaMs,
        Math.max(0, durationMs - current.fadeOutMs),
      );
      if (nextFadeInMs !== current.fadeInMs) {
        onUpdateAudioClipFades?.(clip.id, nextFadeInMs, current.fadeOutMs);
      }
      return;
    }

    const nextFadeOutMs = snapAudioFadeDuration(
      current.fadeOutMs + deltaMs,
      Math.max(0, durationMs - current.fadeInMs),
    );
    if (nextFadeOutMs !== current.fadeOutMs) {
      onUpdateAudioClipFades?.(clip.id, current.fadeInMs, nextFadeOutMs);
    }
  }

  useEffect(() => {
    if (!audioFadeInteraction) {
      return;
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      cancelAudioFadeInteraction();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [audioFadeInteraction]);

  function beginTransitionInteraction(
    event: PointerEvent<HTMLButtonElement>,
    clip: Clip,
    transition: ClipTransition,
    nextClip: Clip,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    onSelectClip?.(clip.id);

    const maxDurationMs = getTransitionMaxDurationMs(clip, nextClip);
    const durationMs = Math.min(
      Math.max(transition.durationMs, MIN_DISSOLVE_DURATION_MS),
      maxDurationMs,
    );

    if (maxDurationMs < MIN_DISSOLVE_DURATION_MS) {
      return;
    }

    if ("setPointerCapture" in event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    transitionInteractionTargetRef.current = event.currentTarget;

    setTransitionInteraction({
      clipId: clip.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      transitionType: transition.type,
      originalDurationMs: durationMs,
      previewDurationMs: durationMs,
      maxDurationMs,
      hasMoved: false,
    });
  }

  function updateTransitionInteraction(
    event: PointerEvent<HTMLButtonElement>,
  ) {
    if (
      !transitionInteraction ||
      event.buttons !== 1 ||
      event.pointerId !== transitionInteraction.pointerId
    ) {
      return;
    }

    const deltaPixels =
      transitionInteraction.startClientX - event.clientX;

    if (Math.abs(deltaPixels) < 2) {
      return;
    }

    const deltaMs = pixelsToMilliseconds(
      deltaPixels,
      pixelsPerSecond,
    );
    const nextDurationMs = clampTransitionDuration(
      transitionInteraction.originalDurationMs + deltaMs,
      transitionInteraction.maxDurationMs,
    );

    setTransitionInteraction({
      ...transitionInteraction,
      hasMoved: true,
      previewDurationMs: nextDurationMs,
    });
  }

  function finishTransitionInteraction(
    event?: PointerEvent<HTMLButtonElement>,
  ) {
    if (!transitionInteraction) {
      return;
    }

    const target =
      event?.currentTarget ?? transitionInteractionTargetRef.current;

    if (
      target &&
      "hasPointerCapture" in target &&
      target.hasPointerCapture(transitionInteraction.pointerId)
    ) {
      target.releasePointerCapture(transitionInteraction.pointerId);
    }

    if (
      !transitionInteraction.hasMoved ||
      transitionInteraction.previewDurationMs ===
        transitionInteraction.originalDurationMs
    ) {
      transitionInteractionTargetRef.current = null;
      setTransitionInteraction(null);
      return;
    }

    onUpdateClipTransition?.(transitionInteraction.clipId, {
      type: transitionInteraction.transitionType,
      durationMs: transitionInteraction.previewDurationMs,
    });

    transitionInteractionTargetRef.current = null;
    setTransitionInteraction(null);
  }

  const cancelTransitionInteraction = useCallback(() => {
    const target = transitionInteractionTargetRef.current;

    if (
      target &&
      transitionInteraction &&
      "hasPointerCapture" in target &&
      target.hasPointerCapture(transitionInteraction.pointerId)
    ) {
      target.releasePointerCapture(transitionInteraction.pointerId);
    }

    transitionInteractionTargetRef.current = null;
    setTransitionInteraction(null);
  }, [transitionInteraction]);

  useEffect(() => {
    if (!transitionInteraction) {
      return;
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      cancelTransitionInteraction();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [transitionInteraction, cancelTransitionInteraction]);

  function handleKeyframeClick(event: MouseEvent<HTMLButtonElement>, clip: Clip, keyframeTimeMs: number) {
    event.stopPropagation();

    if (!onCurrentTimeChange) {
      return;
    }

    onCurrentTimeChange(
      Math.min(
        Math.max(clip.timelineStartMs + keyframeTimeMs, 0),
        timelineDurationMs,
      ),
    );
  }

  return (
    <section className="timeline-region" aria-label="Timeline">
      <div className="timeline-toolbar">
        <span>Timeline</span>
        <div className="timeline-actions">
          <button
            aria-label="Add video track"
            className="toolbar-button track-add-button"
            onClick={() => onAddTrack?.("video")}
            type="button"
          >
            + V
          </button>
          <button
            aria-label="Add audio track"
            className="toolbar-button track-add-button"
            onClick={() => onAddTrack?.("audio")}
            type="button"
          >
            + A
          </button>
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
            trackLabel={getTrackLabel(project.tracks, track)}
            project={project}
            timelineDurationMs={timelineDurationMs}
            currentTimeMs={clampedCurrentTimeMs}
            selectedClipId={selectedClipId}
            onSelectClip={onSelectClip}
            onToggleTrackMute={onToggleTrackMute}
            onUpdateTrackVolume={onUpdateTrackVolume}
            onRemoveTrack={onRemoveTrack}
            onRemoveTransformKeyframe={onRemoveTransformKeyframe}
            onCurrentTimeChange={onCurrentTimeChange}
            zoom={zoom}
            interaction={interaction}
            dragOverTrackId={dragOverTrackId}
            onDragOverTrack={(event) => handleTrackDragOver(event, track.id)}
            onDragLeaveTrack={() => setDragOverTrackId(null)}
            onDropOnTrack={(event) => handleTrackDrop(event, track.id)}
            getDisplayClip={getDisplayClip}
            onBeginClipInteraction={beginClipInteraction}
            onUpdateClipInteraction={updateClipInteraction}
            onFinishClipInteraction={finishClipInteraction}
            onCancelClipInteraction={cancelClipInteraction}
            onKeyframeClick={handleKeyframeClick}
            onMoveTransformKeyframe={onMoveTransformKeyframe}
            onUpdateClipTransition={onUpdateClipTransition}
            transitionInteraction={transitionInteraction}
            onBeginTransitionInteraction={beginTransitionInteraction}
            onUpdateTransitionInteraction={updateTransitionInteraction}
            onFinishTransitionInteraction={finishTransitionInteraction}
            onCancelTransitionInteraction={cancelTransitionInteraction}
            keyframeInteraction={keyframeInteraction}
            onBeginKeyframeInteraction={beginKeyframeInteraction}
            onUpdateKeyframeInteraction={updateKeyframeInteraction}
            onFinishKeyframeInteraction={finishKeyframeInteraction}
            onCancelKeyframeInteraction={cancelKeyframeInteraction}
          />
        ))}
      </div>
    </section>
  );
}

interface TimelineTrackProps {
  track: Track;
  trackLabel: string;
  project: Project;
  timelineDurationMs: number;
  currentTimeMs: number;
  selectedClipId: string | null;
  onSelectClip?: (clipId: string) => void;
  onToggleTrackMute?: (trackId: string) => void;
  onUpdateTrackVolume?: (trackId: string, volume: number) => void;
  onUpdateAudioClipFades?: (
    clipId: string,
    fadeInMs: number,
    fadeOutMs: number,
  ) => void;
  onRemoveTrack?: (trackId: string) => void;
  onRemoveTransformKeyframe?: (
    clipId: string,
    timeMs: number,
  ) => void;
  onCurrentTimeChange?: (timeMs: number) => void;
  zoom: number;
  dragOverTrackId: string | null;
  onDragOverTrack: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeaveTrack: () => void;
  onDropOnTrack: (event: DragEvent<HTMLDivElement>) => void;
  interaction: ClipInteraction | null;
  getDisplayClip: (clip: Clip) => Clip;
  onBeginClipInteraction: (
    event: PointerEvent<HTMLElement>,
    clip: Clip,
    mode: ClipInteractionMode,
  ) => void;
  onUpdateClipInteraction: (event: PointerEvent<HTMLElement>) => void;
  onFinishClipInteraction: (event?: PointerEvent<HTMLElement>) => void;
  onCancelClipInteraction: () => void;
  onKeyframeClick: (
    event: MouseEvent<HTMLButtonElement>,
    clip: Clip,
    keyframeTimeMs: number,
  ) => void;
  onMoveTransformKeyframe?: (
    clipId: string,
    fromTimeMs: number,
    toTimeMs: number,
  ) => void;
  onUpdateClipTransition?: (
    clipId: string,
    transition: ClipTransition | undefined,
  ) => void;
  transitionInteraction: TransitionInteraction | null;
  onBeginTransitionInteraction: (
    event: PointerEvent<HTMLButtonElement>,
    clip: Clip,
    transition: ClipTransition,
    nextClip: Clip,
  ) => void;
  onUpdateTransitionInteraction: (
    event: PointerEvent<HTMLButtonElement>,
  ) => void;
  onFinishTransitionInteraction: (
    event?: PointerEvent<HTMLButtonElement>,
  ) => void;
  onCancelTransitionInteraction: () => void;
  keyframeInteraction: KeyframeInteraction | null;
  onBeginKeyframeInteraction: (
    event: PointerEvent<HTMLButtonElement>,
    clip: Clip,
    keyframeTimeMs: number,
  ) => void;
  onUpdateKeyframeInteraction: (
    event: PointerEvent<HTMLButtonElement>,
  ) => void;
  onFinishKeyframeInteraction: (
    event?: PointerEvent<HTMLButtonElement>,
  ) => void;
  onCancelKeyframeInteraction: () => void;
}

function TimelineTrack({
  track,
  trackLabel,
  project,
  timelineDurationMs,
  currentTimeMs,
  selectedClipId,
  onSelectClip,
  onToggleTrackMute,
  onUpdateTrackVolume,
  onUpdateAudioClipFades,
  onRemoveTrack,
  onRemoveTransformKeyframe,
  onCurrentTimeChange,
  onMoveTransformKeyframe,
  onUpdateClipTransition,
  transitionInteraction,
  onBeginTransitionInteraction,
  onUpdateTransitionInteraction,
  onFinishTransitionInteraction,
  onCancelTransitionInteraction,
  zoom,
  dragOverTrackId,
  onDragOverTrack,
  onDragLeaveTrack,
  onDropOnTrack,
  interaction,
  getDisplayClip,
  onBeginClipInteraction,
  onUpdateClipInteraction,
  onFinishClipInteraction,
  onCancelClipInteraction,
  onKeyframeClick,
  keyframeInteraction,
  onBeginKeyframeInteraction,
  onUpdateKeyframeInteraction,
  onFinishKeyframeInteraction,
  onCancelKeyframeInteraction,
}: TimelineTrackProps) {
  const pixelsPerSecond = basePixelsPerSecond * zoom;

  return (
    <div className="track">
      <div className="track-label">
        <div className="track-label-main">
          <strong>{trackLabel}</strong>
          <span>{track.name}</span>
          {track.type === "audio" ? (
            <div className="track-volume-control" onClick={(event) => event.stopPropagation()}>
              <input
                aria-label={"Volume " + track.name}
                aria-valuetext={Math.round(getTrackVolume(track) * 100) + "%"}
                className="track-volume-input"
                max="1"
                min="0"
                onChange={(event) => onUpdateTrackVolume?.(track.id, Number(event.target.value))}
                step="0.01"
                type="range"
                value={getTrackVolume(track)}
              />
              <span aria-hidden="true">{Math.round(getTrackVolume(track) * 100)}%</span>
            </div>
          ) : null}
        </div>
        <div className="track-label-actions">
          <button
            aria-label={track.isMuted ? "Unmute " + track.name : "Mute " + track.name}
            aria-pressed={track.isMuted}
            className="track-mute-button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleTrackMute?.(track.id);
            }}
            title={track.isMuted ? "Unmute track" : "Mute track"}
            type="button"
          >
            {track.isMuted ? "🔇" : "🔊"}
          </button>
          <button
            aria-label={"Remove " + track.name + " track"}
            className="track-remove-button"
            disabled={
              track.clips.length > 0 ||
              project.tracks.filter((candidate) => candidate.type === track.type).length <= 1
            }
            onClick={(event) => {
              event.stopPropagation();
              onRemoveTrack?.(track.id);
            }}
            title="Remove track"
            type="button"
          >
            ×
          </button>
        </div>
      </div>
      <div
        className={
          "timeline-lane" +
          (dragOverTrackId === track.id ? " timeline-lane-drop-target" : "")
        }
        onDragOver={onDragOverTrack}
        onDragLeave={onDragLeaveTrack}
        onDrop={onDropOnTrack}
        style={{ width: timelineWidth(timelineDurationMs, zoom) + "px" }}
      >
        {track.clips.map((sourceClip) => {
          const clip = getDisplayClip(sourceClip);
          const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
          const durationMs = getClipDurationMs(clip);
          const width = Math.max(72, durationMs / 1000 * pixelsPerSecond);
          const isSelected = clip.id === selectedClipId;
          const isInteracting = interaction?.clipId === clip.id;
          const isAudioClip =
            track.type === "audio" && asset?.mediaType === "audio";
          const audioFadeDurations = getAudioFadeDurations(clip);
          const displayAudioFadeDurations =
            audioFadeInteraction?.clipId === clip.id
              ? {
                  fadeInMs: audioFadeInteraction.previewFadeInMs,
                  fadeOutMs: audioFadeInteraction.previewFadeOutMs,
                }
              : audioFadeDurations;
          const fadeInWidthPx = Math.min(
            width,
            displayAudioFadeDurations.fadeInMs / 1000 * pixelsPerSecond,
          );
          const fadeOutWidthPx = Math.min(
            width,
            displayAudioFadeDurations.fadeOutMs / 1000 * pixelsPerSecond,
          );

          function handleClipKeyDown(event: KeyboardEvent<HTMLDivElement>) {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectClip?.(clip.id);
            }
          }

          const keyframes = clip.transformKeyframes ?? [];
          const assetSupportsTransformKeyframes =
            asset?.mediaType === "video" || asset?.mediaType === "image";

          return (
            <Fragment key={clip.id}>
              <div
                aria-label={"Select " + (asset?.name ?? "Missing media") + " clip"}
                aria-pressed={isSelected}
                className={
                  "timeline-clip timeline-clip-" +
                  track.type +
                  (isSelected ? " timeline-clip-selected" : "") +
                  (isInteracting ? " timeline-clip-interacting" : "")
                }
                style={{
                  left: clip.timelineStartMs / 1000 * pixelsPerSecond + "px",
                  width: width + "px",
                }}
                onClick={() => onSelectClip?.(clip.id)}
                onKeyDown={handleClipKeyDown}
                onPointerDown={(event) =>
                  onBeginClipInteraction(event, sourceClip, "move")
                }
                onPointerMove={onUpdateClipInteraction}
                onPointerUp={onFinishClipInteraction}
                onPointerCancel={onCancelClipInteraction}
                role="button"
                tabIndex={0}
                title={
                  asset
                    ? asset.name + " · " + formatTimecode(durationMs)
                    : "Missing media"
                }
              >
                <span
                  aria-label="Trim clip start"
                  className="timeline-trim-handle timeline-trim-handle-start"
                  onPointerDown={(event) =>
                    onBeginClipInteraction(event, sourceClip, "trim-start")
                  }
                  role="presentation"
                />
                <span className="timeline-clip-name">
                  {asset?.name ?? "Missing media"}
                </span>
                <small>{formatTimecode(durationMs)}</small>
                {isAudioClip ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="timeline-audio-fade-region timeline-audio-fade-in-region"
                      style={{ width: fadeInWidthPx + "px" }}
                    />
                    <span
                      aria-hidden="true"
                      className="timeline-audio-fade-region timeline-audio-fade-out-region"
                      style={{ width: fadeOutWidthPx + "px" }}
                    />
                    <button
                      aria-label={
                        "Adjust audio fade in for " +
                        (asset?.name ?? "Missing media") +
                        " to " +
                        displayAudioFadeDurations.fadeInMs +
                        " ms"
                      }
                      className="timeline-audio-fade-handle timeline-audio-fade-handle-in"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) =>
                        handleAudioFadeKeyDown(event, sourceClip, "fade-in")
                      }
                      onPointerDown={(event) =>
                        beginAudioFadeInteraction(event, sourceClip, "fade-in")
                      }
                      onPointerMove={updateAudioFadeInteraction}
                      onPointerUp={finishAudioFadeInteraction}
                      onPointerCancel={cancelAudioFadeInteraction}
                      style={{ left: fadeInWidthPx + "px" }}
                      title="Drag to change audio fade in"
                      type="button"
                    >
                      <span aria-hidden="true" />
                    </button>
                    <button
                      aria-label={
                        "Adjust audio fade out for " +
                        (asset?.name ?? "Missing media") +
                        " to " +
                        displayAudioFadeDurations.fadeOutMs +
                        " ms"
                      }
                      className="timeline-audio-fade-handle timeline-audio-fade-handle-out"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) =>
                        handleAudioFadeKeyDown(event, sourceClip, "fade-out")
                      }
                      onPointerDown={(event) =>
                        beginAudioFadeInteraction(event, sourceClip, "fade-out")
                      }
                      onPointerMove={updateAudioFadeInteraction}
                      onPointerUp={finishAudioFadeInteraction}
                      onPointerCancel={cancelAudioFadeInteraction}
                      style={{ right: fadeOutWidthPx + "px" }}
                      title="Drag to change audio fade out"
                      type="button"
                    >
                      <span aria-hidden="true" />
                    </button>
                  </>
                ) : null}
                <span
                  aria-label="Trim clip end"
                  className="timeline-trim-handle timeline-trim-handle-end"
                  onPointerDown={(event) =>
                    onBeginClipInteraction(event, sourceClip, "trim-end")
                  }
                  role="presentation"
                />
              </div>

              {(() => {
                const transition = getClipTransition(sourceClip.transitionOut);
                const nextClip = getNextClipForTransition(track, sourceClip.id);
                const nextAsset = nextClip
                  ? project.assets.find(
                      (candidate) => candidate.id === nextClip.assetId,
                    )
                  : null;
                const canShowTransition =
                  Boolean(transition) &&
                  Boolean(nextClip) &&
                  Boolean(nextAsset) &&
                  (asset?.mediaType === "video" || asset?.mediaType === "image") &&
                  (nextAsset?.mediaType === "video" ||
                    nextAsset?.mediaType === "image") &&
                  Boolean(nextClip && isTransitionAdjacent(sourceClip, nextClip));

                if (!canShowTransition || !transition || !nextClip || !nextAsset) {
                  return null;
                }

                const boundaryLeftPx =
                  sourceClip.timelineStartMs / 1000 * pixelsPerSecond + width;
                const activeInteraction =
                  transitionInteraction?.clipId === sourceClip.id
                    ? transitionInteraction
                    : null;
                const displayDurationMs =
                  activeInteraction?.previewDurationMs ?? transition.durationMs;
                const displayDurationWidthPx =
                  displayDurationMs / 1000 * pixelsPerSecond;

                return (
                  <div
                    className="timeline-transition-region"
                    style={{
                      left:
                        boundaryLeftPx - displayDurationWidthPx + "px",
                      width: displayDurationWidthPx + "px",
                    }}
                  >
                    <button
                      aria-label={
                        "Adjust " +
                        getTransitionLabel(transition).toLowerCase() +
                        " duration for " +
                        (asset?.name ?? "Missing media") +
                        " to " +
                        displayDurationMs +
                        " ms"
                      }
                      className="timeline-transition-duration-handle"
                      onKeyDown={(event) => {
                        if (
                          event.key !== "ArrowLeft" &&
                          event.key !== "ArrowRight"
                        ) {
                          return;
                        }

                        event.preventDefault();
                        event.stopPropagation();

                        const maxDurationMs = getTransitionMaxDurationMs(
                          sourceClip,
                          nextClip,
                        );
                        const stepMs = 50;
                        const deltaMs =
                          event.key === "ArrowLeft" ? stepMs : -stepMs;
                        const nextDurationMs = clampTransitionDuration(
                          transition.durationMs + deltaMs,
                          maxDurationMs,
                        );

                        if (nextDurationMs !== transition.durationMs) {
                          onUpdateClipTransition?.(sourceClip.id, {
                            type: transition.type,
                            durationMs: nextDurationMs,
                          });
                        }
                      }}
                      onPointerDown={(event) =>
                        onBeginTransitionInteraction(
                          event,
                          sourceClip,
                          transition,
                          nextClip,
                        )
                      }
                      onPointerMove={onUpdateTransitionInteraction}
                      onPointerUp={onFinishTransitionInteraction}
                      onPointerCancel={onCancelTransitionInteraction}
                      style={{ left: "0px" }}
                      title={
                        "Drag to change " +
                        getTransitionLabel(transition).toLowerCase() +
                        " duration"
                      }
                      type="button"
                    >
                      <span aria-hidden="true" />
                    </button>
                    <button
                      aria-label={
                        "Select " +
                        (asset?.name ?? "Missing media") +
                        " " +
                        getTransitionLabel(transition).toLowerCase() +
                        " transition to " +
                        nextAsset.name
                      }
                      className="timeline-transition-indicator"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectClip?.(sourceClip.id);
                      }}
                      style={{ right: "0px" }}
                      title={
                        getTransitionLabel(transition) +
                        " · " +
                        displayDurationMs +
                        " ms"
                      }
                      type="button"
                    >
                      <span aria-hidden="true">◆</span>
                    </button>
                  </div>
                );
              })()}

              {assetSupportsTransformKeyframes ? (
                <div
                  aria-label={
                    "Transform keyframes for " +
                    (asset?.name ?? "Missing media")
                  }
                  className="timeline-clip-keyframes"
                  style={{
                    left:
                      clip.timelineStartMs / 1000 * pixelsPerSecond +
                      "px",
                    width: width + "px",
                  }}
                >
                  {keyframes.map((keyframe, keyframeIndex) => {
                    const displayTimeMs =
                      keyframeInteraction?.clipId === clip.id &&
                      keyframeInteraction.keyframeTimeMs === keyframe.timeMs
                        ? keyframeInteraction.previewTimeMs
                        : keyframe.timeMs;
                    const absoluteTimeMs =
                      clip.timelineStartMs + displayTimeMs;
                    const isActive =
                      Math.abs(currentTimeMs - absoluteTimeMs) <=
                      500 / project.canvas.frameRate;

                    function handleKeyframeKeyDown(
                      event: KeyboardEvent<HTMLButtonElement>,
                    ) {
                      if (event.key === "Delete" || event.key === "Backspace") {
                        event.preventDefault();
                        event.stopPropagation();
                        onRemoveTransformKeyframe?.(clip.id, keyframe.timeMs);
                        return;
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        onCancelKeyframeInteraction();
                        return;
                      }

                      if (
                        event.key !== "ArrowLeft" &&
                        event.key !== "ArrowRight"
                      ) {
                        return;
                      }

                      const stepMs = event.shiftKey
                        ? 500
                        : 1000 / project.canvas.frameRate;
                      const deltaMs =
                        event.key === "ArrowLeft" ? -stepMs : stepMs;
                      const keyframes = [...(clip.transformKeyframes ?? [])].sort(
                        (a, b) => a.timeMs - b.timeMs,
                      );
                      const keyframeIndex = keyframes.findIndex(
                        (candidate) => candidate.timeMs === keyframe.timeMs,
                      );

                      if (keyframeIndex === -1) {
                        return;
                      }

                      const previousTimeMs =
                        keyframeIndex > 0
                          ? keyframes[keyframeIndex - 1].timeMs
                          : 0;
                      const nextTimeMs =
                        keyframeIndex < keyframes.length - 1
                          ? keyframes[keyframeIndex + 1].timeMs
                          : getClipDurationMs(clip);
                      const frameStepMs = 1000 / project.canvas.frameRate;
                      const minimumTimeMs =
                        keyframeIndex > 0
                          ? previousTimeMs + frameStepMs
                          : 0;
                      const maximumTimeMs =
                        keyframeIndex < keyframes.length - 1
                          ? nextTimeMs - frameStepMs
                          : nextTimeMs;
                      const targetTimeMs = Math.min(
                        Math.max(
                          Math.round(keyframe.timeMs + deltaMs),
                          minimumTimeMs,
                        ),
                        maximumTimeMs,
                      );

                      if (targetTimeMs === keyframe.timeMs) {
                        return;
                      }

                      event.preventDefault();
                      event.stopPropagation();
                      onMoveTransformKeyframe?.(
                        clip.id,
                        keyframe.timeMs,
                        targetTimeMs,
                      );
                      onCurrentTimeChange?.(
                        Math.min(
                          Math.max(
                            clip.timelineStartMs + targetTimeMs,
                            0,
                          ),
                          timelineDurationMs,
                        ),
                      );
                    }

                    return (
                      <button
                        aria-label={
                          "Go to transform keyframe for " +
                          (asset?.name ?? "Missing media") +
                          " at " +
                          formatKeyframeTime(keyframe.timeMs)
                        }
                        className={
                          "timeline-keyframe-marker" +
                          (isActive ? " timeline-keyframe-marker-active" : "")
                        }
                        key={clip.id + "-keyframe-" + keyframeIndex}
                        aria-current={isActive ? "time" : undefined}
                        onFocus={() => onSelectClip?.(clip.id)}
                        onClick={(event) =>
                          onKeyframeClick(event, clip, keyframe.timeMs)
                        }
                        onKeyDown={handleKeyframeKeyDown}
                        onPointerDown={(event) =>
                          onBeginKeyframeInteraction(event, clip, keyframe.timeMs)
                        }
                        onPointerMove={onUpdateKeyframeInteraction}
                        onPointerUp={onFinishKeyframeInteraction}
                        onPointerCancel={onCancelKeyframeInteraction}
                        style={{
                          left:
                            durationMs > 0
                              ? keyframe.timeMs / durationMs * 100 + "%"
                              : "0%",
                        }}
                        title={formatKeyframeTime(keyframe.timeMs)}
                        type="button"
                      >
                        <span aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </Fragment>
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

function clampTransitionDuration(
  durationMs: number,
  maxDurationMs: number,
): number {
  const safeMax = Math.max(MIN_DISSOLVE_DURATION_MS, maxDurationMs);
  const snapped = Math.round(durationMs / 50) * 50;

  return Math.min(
    safeMax,
    Math.max(MIN_DISSOLVE_DURATION_MS, snapped),
  );
}

function getTransitionMaxDurationMs(
  outgoingClip: Clip,
  incomingClip: Clip,
): number {
  return Math.min(
    MAX_DISSOLVE_DURATION_MS,
    getClipDurationMs(outgoingClip),
    getClipDurationMs(incomingClip),
  );
}

function resolveMoveStartWithoutOverlap(
  track: Track,
  clipId: string,
  candidateStartMs: number,
  durationMs: number,
  deltaPixels: number,
): number {
  let resolvedStartMs = Math.max(0, candidateStartMs);
  const movingRight = deltaPixels >= 0;

  const otherClips = track.clips
    .filter((clip) => clip.id !== clipId)
    .sort((a, b) => a.timelineStartMs - b.timelineStartMs);

  for (const clip of otherClips) {
    const existingStartMs = clip.timelineStartMs;
    const existingEndMs = existingStartMs + getClipDurationMs(clip);

    if (
      resolvedStartMs >= existingEndMs ||
      resolvedStartMs + durationMs <= existingStartMs
    ) {
      continue;
    }

    resolvedStartMs = movingRight
      ? Math.max(0, existingStartMs - durationMs)
      : existingEndMs;
  }

  return Math.max(0, resolvedStartMs);
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

function getTrackLabel(tracks: Track[], track: Track): string {
  const sameTypeTracks = tracks.filter((candidate) => candidate.type === track.type);
  const typeIndex = sameTypeTracks.findIndex((candidate) => candidate.id === track.id);

  return (track.type === "video" ? "V" : "A") + (typeIndex + 1);
}

function timelineWidth(durationMs: number, zoom: number): number {
  return durationMs / 1000 * basePixelsPerSecond * zoom;
}

function snapAudioFadeDuration(durationMs: number, maxDurationMs: number): number {
  const safeMaxMs =
    Math.max(0, Math.floor(maxDurationMs / AUDIO_FADE_HANDLE_STEP_MS)) *
    AUDIO_FADE_HANDLE_STEP_MS;
  const safeDurationMs =
    Math.round(durationMs / AUDIO_FADE_HANDLE_STEP_MS) *
    AUDIO_FADE_HANDLE_STEP_MS;
  return Math.min(safeMaxMs, Math.max(0, safeDurationMs));
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

function formatKeyframeTime(timeMs: number): string {
  const safeMs = Math.max(0, Math.round(timeMs));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = safeMs % 1000;

  return (
    minutes.toString().padStart(2, "0") +
    ":" +
    seconds.toString().padStart(2, "0") +
    "." +
    milliseconds.toString().padStart(3, "0")
  );
}

