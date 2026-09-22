import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { MediaBin } from "./features/media/MediaBin";
import {
  getAudioVolumeAtTime,
  getAudioVolumeKeyframeAtTime,
} from "./features/audio/automation";
import {
  DEFAULT_TEXT_OVERLAY_ALIGNMENT,
  DEFAULT_TEXT_OVERLAY_COLOR,
  DEFAULT_TEXT_OVERLAY_FONT_SIZE,
  DEFAULT_TEXT_OVERLAY_X,
  DEFAULT_TEXT_OVERLAY_Y,
  getAudioCompressor,
  getAudioEq,
  getTextOverlay,
  getVisualEffects,
} from "./features/project/domain";
import type {
  AudioCompressor,
  AudioEq,
  VisualEffects,
  TextOverlay,
  Clip,
  ClipCrop,
  ClipTransform,
  CropPosition,
  TransformEasing,
  TransformAnchor,
  ClipTransition,
} from "./features/project/domain";
import {
  addAssetToTimeline,
  addAssetToTrack,
  addTrack,
  moveClipOnTimeline,
  removeClipFromTimeline,
  removeTrack,
  addTransformKeyframe,
  moveTransformKeyframe,
  updateTransformKeyframeEasing,
  resetClipTransform,
  removeTransformKeyframe,
  toggleTrackMute,
  updateTrackVolume,
  updateTrackPan,
  updateAudioClipFades,
  updateAudioClipEq,
  updateAudioClipCompressor,
  updateClipVisualEffects,
  updateClipTextOverlay,
  updateAudioClipVolumeAtTime,
  removeAudioClipVolumeKeyframe,
  moveAudioClipVolumeKeyframe,
  updateClipTransformAtTime,
  updateClipTransformAnchor,
  updateClipTransformAnchorWithCompensation,
  updateClipCrop,
  updateClipCropPosition,
  updateClipCropWithPosition,
  updateCanvasDimensions,
  splitClipAtTime,
  trimClipEnd,
  trimClipStart,
  updateClipTransition,
} from "./features/timeline/commands";
import { Timeline } from "./features/timeline/Timeline";
import { Preview } from "./features/preview/Preview";
import { getContainedContentPercentageBounds } from "./features/preview/canvasManipulation";
import { DEFAULT_TIMELINE_ZOOM } from "./features/timeline/constants";
import { getTimelineDurationMs } from "./features/timeline/metrics";
import {
  CROP_ASPECT_RATIO_PRESETS,
  getClipCrop,
  getClipCropPosition,
  getClipTransformAnchor,
  getClipTransformAtTime,
  getCropForAspectRatio,
  getTransformKeyframeAtTime,
  normalizeClipCrop,
  normalizeClipTransform,
} from "./features/transform/transform";
import {
  shouldPublishPlaybackTime,
  stepFrame,
  stepPlaybackTime,
} from "./features/playback/playback";
import {
  commitHistory,
  createHistoryState,
  redoHistory,
  resetHistory,
  undoHistory,
} from "./features/history/history";
import { importMediaFiles } from "./features/media/import";
import { loadWorkspaceProject, saveWorkspaceProject } from "./features/project/workspace";
import { openProjectFromDialog, saveProjectFromDialog } from "./features/project/file-dialog";
import { TransitionInspector } from "./features/transition/TransitionInspector";
import { ExportPanel } from "./features/export/ExportPanel";
import {
  getClipTransition,
  getNextClipForTransition,
  isTransitionAdjacent,
} from "./features/transition/transition";
import "./App.css";

type WorkspaceView = "media" | "editor" | "export";
type TransformField = "x" | "y" | "scale" | "rotation" | "opacity";
type CropField = keyof ClipCrop;

const transformAnchorPresets: Array<{
  id: string;
  label: string;
  anchor: TransformAnchor;
}> = [
  { id: "top-left", label: "Top left", anchor: { x: 0, y: 0 } },
  { id: "top-center", label: "Top center", anchor: { x: 0.5, y: 0 } },
  { id: "top-right", label: "Top right", anchor: { x: 1, y: 0 } },
  { id: "middle-left", label: "Middle left", anchor: { x: 0, y: 0.5 } },
  { id: "center", label: "Center", anchor: { x: 0.5, y: 0.5 } },
  { id: "middle-right", label: "Middle right", anchor: { x: 1, y: 0.5 } },
  { id: "bottom-left", label: "Bottom left", anchor: { x: 0, y: 1 } },
  { id: "bottom-center", label: "Bottom center", anchor: { x: 0.5, y: 1 } },
  { id: "bottom-right", label: "Bottom right", anchor: { x: 1, y: 1 } },
];

const navigation: Array<{ id: WorkspaceView; label: string }> = [
  { id: "media", label: "Media" },
  { id: "editor", label: "Editor" },
  { id: "export", label: "Export" },
];

const canvasAspectRatioPresets = [
  { id: "16-9", label: "16:9", width: 1920, height: 1080 },
  { id: "9-16", label: "9:16", width: 1080, height: 1920 },
  { id: "1-1", label: "1:1", width: 1080, height: 1080 },
  { id: "4-5", label: "4:5", width: 1080, height: 1350 },
  { id: "4-3", label: "4:3", width: 1440, height: 1080 },
] as const;

function isAbortError(error: unknown): boolean {
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return true;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>("editor");
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  const [history, setHistory] = useState(() =>
    createHistoryState(loadWorkspaceProject()),
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [textOverlayDraft, setTextOverlayDraft] = useState<{
    clipId: string;
    overlay: TextOverlay;
  } | null>(null);
  const textOverlayAutoCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(DEFAULT_TIMELINE_ZOOM);
  const playbackTimeRef = useRef(0);
  const playbackUiLastPublishedTimestampRef = useRef<number | null>(null);
  const playbackRequestIdRef = useRef(0);
  const timelineDurationRef = useRef(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const [visualMediaDimensions, setVisualMediaDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const visualMediaDimensionsRef = useRef<
    Record<string, { width: number; height: number }>
  >({});
  const project = history.present;
  useEffect(() => {
    if (textOverlayAutoCommitTimerRef.current !== null) {
      clearTimeout(textOverlayAutoCommitTimerRef.current);
      textOverlayAutoCommitTimerRef.current = null;
    }

    setTextOverlayDraft(null);
  }, [selectedClipId, project.updatedAt]);

  useEffect(() => {
    if (!textOverlayDraft) {
      return;
    }

    if (textOverlayAutoCommitTimerRef.current !== null) {
      clearTimeout(textOverlayAutoCommitTimerRef.current);
    }

    textOverlayAutoCommitTimerRef.current = setTimeout(() => {
      textOverlayAutoCommitTimerRef.current = null;

      setHistory((currentHistory) => {
        try {
          const nextProject = updateClipTextOverlay(
            currentHistory.present,
            textOverlayDraft.clipId,
            textOverlayDraft.overlay,
          );

          setProjectNotice("Text overlay autosaved.");
          return commitHistory(currentHistory, nextProject);
        } catch (error) {
          setProjectNotice(
            error instanceof Error
              ? error.message
              : "Text overlay could not be autosaved.",
          );
          return currentHistory;
        }
      });

      setTextOverlayDraft(null);
    }, 400);

    return () => {
      if (textOverlayAutoCommitTimerRef.current !== null) {
        clearTimeout(textOverlayAutoCommitTimerRef.current);
        textOverlayAutoCommitTimerRef.current = null;
      }
    };
  }, [textOverlayDraft]);
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const assets = project.assets;
  const selectedClipContext = findClipContext(project, selectedClipId);
  const selectedClipLocalTimeMs = selectedClipContext
    ? Math.min(
        Math.max(
          currentTimeMs - selectedClipContext.clip.timelineStartMs,
          0,
        ),
        getClipDurationMs(selectedClipContext.clip),
      )
    : 0;
  const selectedAnchor = selectedClipContext
    ? getClipTransformAnchor(selectedClipContext.clip.transformAnchor)
    : null;
  const selectedCrop = selectedClipContext
    ? getClipCrop(selectedClipContext.clip.crop)
    : null;
  const selectedCropPosition = selectedClipContext
    ? getClipCropPosition(
        selectedCrop ?? undefined,
        selectedClipContext.clip.cropPosition,
      )
    : null;
  const selectedTransform = selectedClipContext
    ? getClipTransformAtTime(
        selectedClipContext.clip.transform,
        selectedClipContext.clip.transformKeyframes,
        selectedClipLocalTimeMs,
      )
    : null;
  const selectedKeyframe = selectedClipContext
    ? getTransformKeyframeAtTime(
        selectedClipContext.clip.transformKeyframes,
        selectedClipLocalTimeMs,
      )
    : null;
  const selectedKeyframeCount = selectedClipContext?.clip.transformKeyframes?.length ?? 0;
  const selectedVisualEffects = selectedClipContext
    ? getVisualEffects(selectedClipContext.clip)
    : null;
  const selectedTextOverlay = selectedClipContext
    ? getTextOverlay(selectedClipContext.clip)
    : null;
  const activeTextOverlay =
    textOverlayDraft?.clipId === selectedClipId
      ? textOverlayDraft.overlay
      : selectedTextOverlay;
  const selectedAudioVolume = selectedClipContext
    ? getAudioVolumeAtTime(selectedClipContext.clip, selectedClipLocalTimeMs)
    : 1;
  const selectedAudioVolumeKeyframe = selectedClipContext
    ? getAudioVolumeKeyframeAtTime(
        selectedClipContext.clip.audioVolumeKeyframes,
        selectedClipLocalTimeMs,
      )
    : null;
  const selectedTransition = selectedClipContext
    ? getClipTransition(selectedClipContext.clip.transitionOut)
    : undefined;
  const selectedTransitionTarget = selectedClipContext
    ? getNextClipForTransition(
        selectedClipContext.track,
        selectedClipContext.clip.id,
      )
    : null;
  const selectedTransitionTargetAsset = selectedTransitionTarget
    ? project.assets.find(
        (asset) => asset.id === selectedTransitionTarget.assetId,
      )
    : null;
  const canTransitionToNextVisual =
    Boolean(selectedClipContext) &&
    (selectedClipContext?.asset?.mediaType === "video" ||
      selectedClipContext?.asset?.mediaType === "image") &&
    Boolean(
      selectedTransitionTarget &&
        selectedTransitionTargetAsset &&
        (selectedTransitionTargetAsset.mediaType === "video" ||
          selectedTransitionTargetAsset.mediaType === "image") &&
        selectedClipContext &&
        isTransitionAdjacent(
          selectedClipContext.clip,
          selectedTransitionTarget,
        ),
    );
  const timelineDurationMs = getTimelineDurationMs(project);
  const displayedCurrentTimeMs = Math.min(
    Math.max(currentTimeMs, 0),
    timelineDurationMs,
  );

  const selectedCanvasPresetId =
    canvasAspectRatioPresets.find(
      (preset) =>
        preset.width === project.canvas.width &&
        preset.height === project.canvas.height,
    )?.id ?? "custom";

  useEffect(() => {
    saveWorkspaceProject(project);
  }, [project]);

  const setPlaybackTime = useCallback((timeMs: number) => {
    const safeTimeMs = Math.min(
      Math.max(timeMs, 0),
      timelineDurationRef.current,
    );
    playbackTimeRef.current = safeTimeMs;
    playbackUiLastPublishedTimestampRef.current = null;
    setCurrentTimeMs(safeTimeMs);
  }, []);

  useEffect(() => {
    timelineDurationRef.current = timelineDurationMs;
  }, [timelineDurationMs]);

  const handleStepFrame = useCallback((direction: -1 | 1) => {
    playbackRequestIdRef.current += 1;
    setIsPlaying(false);
    setPlaybackTime(
      stepFrame(
        playbackTimeRef.current,
        project.canvas.frameRate,
        timelineDurationRef.current,
        direction,
      ),
    );
  }, [project.canvas.frameRate, setPlaybackTime]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let animationFrameId = 0;
    let lastTimestamp: number | null = null;

    const tick = (timestamp: number) => {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }

      const elapsedMs = Math.max(0, timestamp - lastTimestamp);
      lastTimestamp = timestamp;

      const next = stepPlaybackTime(
        playbackTimeRef.current,
        elapsedMs,
        timelineDurationMs,
      );

      playbackTimeRef.current = next.timeMs;

      if (next.reachedEnd) {
        setPlaybackTime(next.timeMs);
        setIsPlaying(false);
        return;
      }

      if (
        shouldPublishPlaybackTime(
          timestamp,
          playbackUiLastPublishedTimestampRef.current,
        )
      ) {
        playbackUiLastPublishedTimestampRef.current = timestamp;
        setCurrentTimeMs(next.timeMs);
      }

      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isPlaying, setPlaybackTime, timelineDurationMs]);

  function handleCurrentTimeChange(timeMs: number) {
    playbackRequestIdRef.current += 1;
    setIsPlaying(false);
    setPlaybackTime(timeMs);
  }

  function handleSetCanvasAspectRatio(presetId: string) {
    const preset = canvasAspectRatioPresets.find(
      (candidate) => candidate.id === presetId,
    );

    if (!preset) {
      return;
    }

    if (
      project.canvas.width === preset.width &&
      project.canvas.height === preset.height
    ) {
      return;
    }

    applyProjectChange(
      (currentProject) =>
        updateCanvasDimensions(
          currentProject,
          preset.width,
          preset.height,
        ),
      "Canvas aspect ratio updated.",
    );
  }

  async function handleOpenProject() {
    try {
      const result = await openProjectFromDialog();
      if (result) {
        setHistory(resetHistory(result.project));
        setSelectedClipId(null);
        setVisualMediaDimensions({});
        visualMediaDimensionsRef.current = {};
        setPlaybackTime(0);
        setIsPlaying(false);
        setProjectNotice("Project opened.");
      }
    } catch (error) {
      setProjectNotice(
        error instanceof Error ? error.message : "Project could not be opened.",
      );
    }
  }

  async function handleSaveProject() {
    try {
      const path = await saveProjectFromDialog(project);
      if (path) setProjectNotice("Project saved.");
    } catch (error) {
      setProjectNotice(
        error instanceof Error ? error.message : "Project could not be saved.",
      );
    }
  }

  function handleAddAsset(assetId: string) {
    applyProjectChange(
      (currentProject) => addAssetToTimeline(currentProject, assetId),
      "Media added to timeline.",
    );
  }

  function handleSelectClip(clipId: string) {
    setSelectedClipId(clipId);
    setProjectNotice(null);
  }

  function handleFocusColorAdjustments() {
    colorAdjustmentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleFocusTextOverlay() {
    textOverlayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleAddAssetToTrack(
    assetId: string,
    trackId: string,
    timelineStartMs: number,
  ) {
    applyProjectChange(
      (currentProject) =>
        addAssetToTrack(currentProject, assetId, trackId, timelineStartMs),
      "Media added to selected track.",
    );
  }

  function handleAddTrack(type: "audio" | "video") {
    applyProjectChange(
      (currentProject) => addTrack(currentProject, type),
      type === "video" ? "Video track added." : "Audio track added.",
    );
  }

  function handleRemoveTrack(trackId: string) {
    applyProjectChange(
      (currentProject) => removeTrack(currentProject, trackId),
      "Track removed.",
    );
  }

  const colorAdjustmentsRef = useRef<HTMLDivElement | null>(null);
  const textOverlayRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const previewStageRegionRef = useRef<HTMLDivElement | null>(null);
  const [previewCanvasSize, setPreviewCanvasSize] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const stageRegion = previewStageRegionRef.current;

    if (!stageRegion) {
      return;
    }

    const updatePreviewCanvasSize = () => {
      const { width, height } = stageRegion.getBoundingClientRect();

      if (width <= 0 || height <= 0) {
        setPreviewCanvasSize({ width: 0, height: 0 });
        return;
      }

      const aspectRatio = project.canvas.width / project.canvas.height;
      const fittedWidth = Math.min(width, height * aspectRatio);
      const fittedHeight = fittedWidth / aspectRatio;

      setPreviewCanvasSize({
        width: fittedWidth,
        height: fittedHeight,
      });
    };

    updatePreviewCanvasSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updatePreviewCanvasSize);
      observer.observe(stageRegion);

      return () => observer.disconnect();
    }

    window.addEventListener("resize", updatePreviewCanvasSize);
    return () => window.removeEventListener("resize", updatePreviewCanvasSize);
  }, [project.canvas.height, project.canvas.width]);

  const getPreviewMediaElements = useCallback((): HTMLMediaElement[] => {
    const container = previewCanvasRef.current;

    if (!container) {
      return [];
    }

    return Array.from(
      container.querySelectorAll<HTMLVideoElement | HTMLAudioElement>("video, audio"),
    ).filter((media) => Boolean(media.getAttribute("src"))) as HTMLMediaElement[];
  }, []);

  const handleTogglePlayback = useCallback(() => {
    const mediaElements = getPreviewMediaElements();

    if (isPlaying) {
      playbackRequestIdRef.current += 1;
      for (const media of mediaElements) {
        media.pause();
      }
      setIsPlaying(false);
      return;
    }

    const playbackRequestId = ++playbackRequestIdRef.current;

    const targetTimeMs =
      playbackTimeRef.current >= timelineDurationRef.current
        ? 0
        : playbackTimeRef.current;

    if (targetTimeMs !== playbackTimeRef.current) {
      setPlaybackTime(targetTimeMs);
    }

    if (mediaElements.length === 0) {
      setIsPlaying(true);
      return;
    }

    const playPromises = mediaElements.map((media) => {
      const clipId = media.getAttribute("data-clip-id");
      const clipContext = clipId ? findClipContext(project, clipId) : null;

      if (clipContext) {
        const localTimeMs =
          Math.min(
            Math.max(
              targetTimeMs - clipContext.clip.timelineStartMs,
              0,
            ),
            getClipDurationMs(clipContext.clip),
          ) + clipContext.clip.sourceStartMs;

        try {
          media.currentTime = Math.max(0, localTimeMs / 1000);
        } catch {
          // Some WebView/media implementations reject seeking before metadata is ready.
        }
      }

      // Call play() directly from the user-triggered handler so WebKit can
      // associate playback with the user's activation gesture.
      return media.play();
    });

    setIsPlaying(true);

    void Promise.allSettled(playPromises).then((results) => {
      if (playbackRequestIdRef.current !== playbackRequestId) {
        return;
      }

      const rejected = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );

      if (!rejected) {
        return;
      }

      const error = rejected.reason;

      if (isAbortError(error)) {
        setIsPlaying(false);
        return;
      }

      const name =
        typeof DOMException !== "undefined" &&
        error instanceof DOMException
          ? error.name
          : error instanceof Error
            ? error.name
            : typeof error === "object" &&
                error !== null &&
                "name" in error
              ? String((error as { name?: unknown }).name ?? "")
              : "";
      const message =
        name === "NotSupportedError"
          ? "Preview media format is not supported by the Linux WebView."
          : name === "NotAllowedError"
            ? "Preview playback was blocked by the WebView."
            : error instanceof Error && error.message
              ? error.message
              : "Preview playback could not start.";

      setProjectNotice(message);
      setIsPlaying(false);
    });
  }, [getPreviewMediaElements, isPlaying, project, setPlaybackTime]);

  function handleUpdateAudioClipFades(
    clipId: string,
    fadeInMs: number,
    fadeOutMs: number,
  ) {
    const clipContext = findClipContext(project, clipId);
    if (
      !clipContext ||
      clipContext.track.type !== "audio" ||
      clipContext.asset?.mediaType !== "audio"
    ) {
      return;
    }

    const durationMs = getClipDurationMs(clipContext.clip);
    const safeFadeInMs = Math.min(
      durationMs,
      Math.max(0, Math.round(fadeInMs)),
    );
    const safeFadeOutMs = Math.min(
      Math.max(0, durationMs - safeFadeInMs),
      Math.max(0, Math.round(fadeOutMs)),
    );

    applyProjectChange(
      (currentProject) =>
        updateAudioClipFades(
          currentProject,
          clipId,
          safeFadeInMs,
          safeFadeOutMs,
        ),
      "Audio fades updated.",
    );
  }

  function handleUpdateSelectedAudioFades(
    fadeInMs: number,
    fadeOutMs: number,
  ) {
    if (!selectedClipContext) {
      return;
    }

    handleUpdateAudioClipFades(
      selectedClipContext.clip.id,
      fadeInMs,
      fadeOutMs,
    );
  }
  function handleUpdateAudioClipEq(
    clipId: string,
    eq: AudioEq,
  ) {
    const clipContext = findClipContext(project, clipId);

    if (
      !clipContext ||
      clipContext.track.type !== "audio" ||
      clipContext.asset?.mediaType !== "audio"
    ) {
      return;
    }

    applyProjectChange(
      (currentProject) => updateAudioClipEq(currentProject, clipId, eq),
      "Audio EQ updated.",
    );
  }

  function handleUpdateSelectedAudioEq(changes: Partial<AudioEq>) {
    if (!selectedClipContext) {
      return;
    }

    const nextEq = {
      ...getAudioEq(selectedClipContext.clip),
      ...changes,
    };

    handleUpdateAudioClipEq(selectedClipContext.clip.id, nextEq);
  }

  function handleUpdateVisualEffects(
    clipId: string,
    effects: VisualEffects,
  ) {
    const clipContext = findClipContext(project, clipId);

    if (
      !clipContext ||
      clipContext.track.type !== "video" ||
      (clipContext.asset?.mediaType !== "video" &&
        clipContext.asset?.mediaType !== "image")
    ) {
      return;
    }

    applyProjectChange(
      (currentProject) =>
        updateClipVisualEffects(currentProject, clipId, effects),
      "Visual adjustments updated.",
    );
  }

  function handleUpdateSelectedVisualEffects(
    changes: Partial<VisualEffects>,
  ) {
    if (!selectedClipContext) {
      return;
    }

    const nextEffects = {
      ...getVisualEffects(selectedClipContext.clip),
      ...changes,
    };

    handleUpdateVisualEffects(selectedClipContext.clip.id, nextEffects);
  }

  function getSelectedTextOverlayValue(): TextOverlay {
    if (textOverlayDraft?.clipId === selectedClipContext?.clip.id) {
      return textOverlayDraft.overlay;
    }

    return (
      selectedTextOverlay ?? {
        text: "",
        x: DEFAULT_TEXT_OVERLAY_X,
        y: DEFAULT_TEXT_OVERLAY_Y,
        fontSize: DEFAULT_TEXT_OVERLAY_FONT_SIZE,
        color: DEFAULT_TEXT_OVERLAY_COLOR,
        alignment: DEFAULT_TEXT_OVERLAY_ALIGNMENT,
      }
    );
  }

  function handleUpdateTextOverlayDraft(changes: Partial<TextOverlay>) {
    if (!selectedClipContext) {
      return;
    }

    setTextOverlayDraft({
      clipId: selectedClipContext.clip.id,
      overlay: {
        ...getSelectedTextOverlayValue(),
        ...changes,
      },
    });
  }

  function clearTextOverlayAutoCommitTimer() {
    if (textOverlayAutoCommitTimerRef.current !== null) {
      clearTimeout(textOverlayAutoCommitTimerRef.current);
      textOverlayAutoCommitTimerRef.current = null;
    }
  }

  function handleCommitSelectedTextOverlayDraft() {
    if (
      !selectedClipContext ||
      textOverlayDraft?.clipId !== selectedClipContext.clip.id
    ) {
      return;
    }

    clearTextOverlayAutoCommitTimer();

    applyProjectChange(
      (currentProject) =>
        updateClipTextOverlay(
          currentProject,
          selectedClipContext.clip.id,
          textOverlayDraft.overlay,
        ),
      "Text overlay updated.",
    );
    setTextOverlayDraft(null);
  }

  function handleCommitSelectedTextOverlayChange(
    changes: Partial<TextOverlay>,
  ) {
    if (!selectedClipContext) {
      return;
    }

    clearTextOverlayAutoCommitTimer();

    applyProjectChange(
      (currentProject) =>
        updateClipTextOverlay(
          currentProject,
          selectedClipContext.clip.id,
          {
            ...getSelectedTextOverlayValue(),
            ...changes,
          },
        ),
      "Text overlay updated.",
    );
    setTextOverlayDraft(null);
  }

  function handleResetSelectedTextOverlay() {
    if (!selectedClipContext) {
      return;
    }

    clearTextOverlayAutoCommitTimer();

    applyProjectChange(
      (currentProject) =>
        updateClipTextOverlay(currentProject, selectedClipContext.clip.id, undefined),
      "Text overlay reset.",
    );
    setTextOverlayDraft(null);
  }

  function handleUpdateAudioClipCompressor(
    clipId: string,
    compressor: AudioCompressor,
  ) {
    const clipContext = findClipContext(project, clipId);

    if (
      !clipContext ||
      clipContext.track.type !== "audio" ||
      clipContext.asset?.mediaType !== "audio"
    ) {
      return;
    }

    applyProjectChange(
      (currentProject) =>
        updateAudioClipCompressor(currentProject, clipId, compressor),
      "Audio compressor updated.",
    );
  }

  function handleUpdateSelectedAudioCompressor(
    changes: Partial<AudioCompressor>,
  ) {
    if (!selectedClipContext) {
      return;
    }

    const nextCompressor = {
      ...getAudioCompressor(selectedClipContext.clip),
      ...changes,
    };

    handleUpdateAudioClipCompressor(
      selectedClipContext.clip.id,
      nextCompressor,
    );
  }

  function handleUpdateAudioClipVolumeAtTime(
    clipId: string,
    timeMs: number,
    volume: number,
  ) {
    const clipContext = findClipContext(project, clipId);

    if (
      !clipContext ||
      clipContext.track.type !== "audio" ||
      clipContext.asset?.mediaType !== "audio"
    ) {
      return;
    }

    applyProjectChange(
      (currentProject) =>
        updateAudioClipVolumeAtTime(
          currentProject,
          clipId,
          timeMs,
          volume,
        ),
      "Audio volume keyframe updated.",
    );
  }

  function handleUpdateSelectedAudioVolume() {
    if (!selectedClipContext) {
      return;
    }

    handleUpdateAudioClipVolumeAtTime(
      selectedClipContext.clip.id,
      selectedClipLocalTimeMs,
      selectedAudioVolume,
    );
  }

  function handleSetSelectedAudioVolume(volume: number) {
    if (!selectedClipContext) {
      return;
    }

    handleUpdateAudioClipVolumeAtTime(
      selectedClipContext.clip.id,
      selectedClipLocalTimeMs,
      volume,
    );
  }

  function handleMoveAudioClipVolumeKeyframe(
    clipId: string,
    fromTimeMs: number,
    toTimeMs: number,
  ) {
    applyProjectChange(
      (currentProject) =>
        moveAudioClipVolumeKeyframe(
          currentProject,
          clipId,
          fromTimeMs,
          toTimeMs,
        ),
      "Audio volume keyframe moved.",
    );
  }

  function handleRemoveAudioVolumeKeyframe(
    clipId: string,
    timeMs: number,
  ) {
    applyProjectChange(
      (currentProject) =>
        removeAudioClipVolumeKeyframe(
          currentProject,
          clipId,
          timeMs,
        ),
      "Audio volume keyframe removed.",
    );
  }

  function handleRemoveSelectedAudioVolumeKeyframe() {
    if (!selectedClipContext || !selectedAudioVolumeKeyframe) {
      return;
    }

    handleRemoveAudioVolumeKeyframe(
      selectedClipContext.clip.id,
      selectedAudioVolumeKeyframe.timeMs,
    );
  }

  function handleToggleTrackMute(trackId: string) {
    applyProjectChange(
      (currentProject) => toggleTrackMute(currentProject, trackId),
      "Track mute updated.",
    );
  }

  function handleUpdateTrackVolume(trackId: string, volume: number) {
    applyProjectChange(
      (currentProject) => updateTrackVolume(currentProject, trackId, volume),
      "Track volume updated.",
    );
  }

  function handleUpdateTrackPan(trackId: string, pan: number) {
    applyProjectChange(
      (currentProject) => updateTrackPan(currentProject, trackId, pan),
      "Track pan updated.",
    );
  }

  function handleUpdateClipTransition(
    clipId: string,
    transition: ClipTransition | undefined,
  ) {
    applyProjectChange(
      (currentProject) =>
        updateClipTransition(currentProject, clipId, transition),
      transition ? "Transition updated." : "Transition removed.",
    );
  }

  function handleUpdateSelectedTransition(
    transition: ClipTransition | undefined,
  ) {
    if (!selectedClipContext) {
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        updateClipTransition(
          currentProject,
          selectedClipContext.clip.id,
          transition,
        ),
      transition ? "Transition updated." : "Transition removed.",
    );
  }

  const handleDeleteSelectedClip = useCallback(() => {
    if (!selectedClipId) {
      return;
    }

    setHistory((currentHistory) => {
      try {
        const nextProject = removeClipFromTimeline(
          currentHistory.present,
          selectedClipId,
        );
        setSelectedClipId(null);
        setProjectNotice("Clip deleted.");
        return commitHistory(currentHistory, nextProject);
      } catch (error) {
        setProjectNotice(
          error instanceof Error ? error.message : "Clip could not be deleted.",
        );
        return currentHistory;
      }
    });
  }, [selectedClipId]);

  const handleUndo = useCallback(() => {
    setHistory((currentHistory) => {
      if (!currentHistory.past.length) {
        return currentHistory;
      }

      setProjectNotice("Undo.");
      return undoHistory(currentHistory);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((currentHistory) => {
      if (!currentHistory.future.length) {
        return currentHistory;
      }

      setProjectNotice("Redo.");
      return redoHistory(currentHistory);
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      const modifierPressed = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (modifierPressed && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (modifierPressed && key === "y") {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (key === " " && !modifierPressed) {
        event.preventDefault();
        handleTogglePlayback();
        return;
      }

      if (!selectedClipId) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        handleDeleteSelectedClip();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleDeleteSelectedClip,
    handleRedo,
    handleTogglePlayback,
    handleUndo,
    selectedClipId,
  ]);

  function applyProjectChange(
    operation: (
      currentProject: ReturnType<typeof loadWorkspaceProject>,
    ) => ReturnType<typeof loadWorkspaceProject>,
    notice: string,
  ) {
    setHistory((currentHistory) => {
      try {
        const nextProject = operation(currentHistory.present);
        setProjectNotice(notice);
        return commitHistory(currentHistory, nextProject);
      } catch (error) {
        setProjectNotice(
          error instanceof Error ? error.message : "Project edit could not be applied.",
        );
        return currentHistory;
      }
    });
  }

  function updateSelectedClip(
    operation: (project: ReturnType<typeof loadWorkspaceProject>) => ReturnType<typeof loadWorkspaceProject>,
    notice: string,
  ) {
    if (!selectedClipId) {
      return;
    }

    applyProjectChange(operation, notice);
  }

  function handleMoveSelectedClip(deltaMs: number) {
    if (!selectedClipContext) {
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        moveClipOnTimeline(
          currentProject,
          selectedClipContext.clip.id,
          Math.max(0, selectedClipContext.clip.timelineStartMs + deltaMs),
        ),
      deltaMs < 0 ? "Clip moved earlier." : "Clip moved later.",
    );
  }

  function handleTrimSelectedClipStart(deltaMs: number) {
    if (!selectedClipContext) {
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        trimClipStart(
          currentProject,
          selectedClipContext.clip.id,
          selectedClipContext.clip.sourceStartMs + deltaMs,
        ),
      deltaMs < 0 ? "Clip start extended." : "Clip start trimmed.",
    );
  }

  function handleTrimSelectedClipEnd(deltaMs: number) {
    if (!selectedClipContext || selectedClipContext.clip.sourceEndMs === null) {
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        trimClipEnd(
          currentProject,
          selectedClipContext.clip.id,
          selectedClipContext.clip.sourceEndMs! + deltaMs,
        ),
      deltaMs < 0 ? "Clip end trimmed." : "Clip end extended.",
    );
  }

  function handleSplitSelectedClip() {
    if (!selectedClipContext) {
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        splitClipAtTime(
          currentProject,
          selectedClipContext.clip.id,
          currentTimeMs,
        ),
      "Clip split.",
    );
  }

  const handleVisualMediaDimensionsChange = useCallback(
    (clipId: string, dimensions: { width: number; height: number }) => {
      visualMediaDimensionsRef.current = {
        ...visualMediaDimensionsRef.current,
        [clipId]: dimensions,
      };

      setVisualMediaDimensions((current) => {
        const previous = current[clipId];

        if (
          previous?.width === dimensions.width &&
          previous?.height === dimensions.height
        ) {
          return current;
        }

        return {
          ...current,
          [clipId]: dimensions,
        };
      });
    },
    [],
  );

  function handleSetSelectedTransformAnchor(anchor: TransformAnchor) {
    if (!selectedClipContext) {
      return;
    }

    const currentAnchor = getClipTransformAnchor(
      selectedClipContext.clip.transformAnchor,
    );

    if (currentAnchor.x === anchor.x && currentAnchor.y === anchor.y) {
      return;
    }

    const dimensions = getSelectedVisualMediaDimensions();
    const contentBounds = dimensions
      ? getContainedContentPercentageBounds(
          project.canvas.width,
          project.canvas.height,
          dimensions.width,
          dimensions.height,
        )
      : {
          width: 100,
          height: 100,
        };

    updateSelectedClip(
      (currentProject) =>
        dimensions
          ? updateClipTransformAnchorWithCompensation(
              currentProject,
              selectedClipContext.clip.id,
              anchor,
              {
                widthPercent: contentBounds.width,
                heightPercent: contentBounds.height,
              },
            )
          : updateClipTransformAnchor(
              currentProject,
              selectedClipContext.clip.id,
              anchor,
            ),
      "Transform anchor updated.",
    );
  }

  function handleResetSelectedCrop() {
    if (!selectedClipContext) {
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        updateClipCrop(
          currentProject,
          selectedClipContext.clip.id,
          { top: 0, right: 0, bottom: 0, left: 0 },
        ),
      "Crop reset.",
    );
  }

  function getSelectedVisualMediaDimensions(): { width: number; height: number } | null {
    if (!selectedClipContext) {
      return null;
    }

    const cached =
      visualMediaDimensionsRef.current[selectedClipContext.clip.id] ??
      visualMediaDimensions[selectedClipContext.clip.id];

    if (cached) {
      return cached;
    }

    if (!previewCanvasRef.current) {
      return null;
    }

    const media = Array.from(
      previewCanvasRef.current.querySelectorAll<
        HTMLVideoElement | HTMLImageElement
      >("video, img"),
    ).find(
      (candidate) =>
        candidate.getAttribute("data-clip-id") === selectedClipContext.clip.id,
    );

    if (!media) {
      return null;
    }

    const dataWidth = Number.parseFloat(
      media.getAttribute("data-media-width") ?? "",
    );
    const dataHeight = Number.parseFloat(
      media.getAttribute("data-media-height") ?? "",
    );

    if (
      Number.isFinite(dataWidth) &&
      dataWidth > 0 &&
      Number.isFinite(dataHeight) &&
      dataHeight > 0
    ) {
      return { width: dataWidth, height: dataHeight };
    }

    if ("videoWidth" in media) {
      return media.videoWidth > 0 && media.videoHeight > 0
        ? { width: media.videoWidth, height: media.videoHeight }
        : null;
    }

    if ("naturalWidth" in media) {
      return media.naturalWidth > 0 && media.naturalHeight > 0
        ? { width: media.naturalWidth, height: media.naturalHeight }
        : null;
    }

    return null;
  }

  function handleSetSelectedCropAspectPreset(
    preset: (typeof CROP_ASPECT_RATIO_PRESETS)[number],
  ) {
    if (!selectedClipContext) {
      return;
    }

    if (preset.ratio === null) {
      updateSelectedClip(
        (currentProject) =>
          updateClipCropWithPosition(
            currentProject,
            selectedClipContext.clip.id,
            { top: 0, right: 0, bottom: 0, left: 0 },
            undefined,
          ),
        "Crop aspect ratio updated.",
      );
      return;
    }

    const dimensions = getSelectedVisualMediaDimensions();

    if (!dimensions) {
      setProjectNotice("Media dimensions are not available yet.");
      return;
    }

    const result = getCropForAspectRatio(
      preset.ratio,
      dimensions.width,
      dimensions.height,
      selectedCropPosition ?? undefined,
    );

    const currentCrop = selectedCrop ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const currentPosition = selectedCropPosition ?? { x: 0.5, y: 0.5 };

    if (
      result.crop.top === currentCrop.top &&
      result.crop.right === currentCrop.right &&
      result.crop.bottom === currentCrop.bottom &&
      result.crop.left === currentCrop.left &&
      result.cropPosition?.x === currentPosition.x &&
      result.cropPosition?.y === currentPosition.y
    ) {
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        updateClipCropWithPosition(
          currentProject,
          selectedClipContext.clip.id,
          result.crop,
          result.cropPosition,
        ),
      "Crop aspect ratio updated.",
    );
  }

  function handleSetSelectedCropPosition(position: CropPosition) {
    if (!selectedClipContext || !selectedCropPosition) {
      return;
    }

    if (
      position.x === selectedCropPosition.x &&
      position.y === selectedCropPosition.y
    ) {
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        updateClipCropPosition(
          currentProject,
          selectedClipContext.clip.id,
          position,
        ),
      "Crop position updated.",
    );
  }

  function handleCenterSelectedCropContent() {
    handleSetSelectedCropPosition({ x: 0.5, y: 0.5 });
  }

  function commitCropInput(
    field: CropField,
    rawValue: string,
    input: HTMLInputElement,
  ) {
    if (!selectedClipContext || !selectedCrop) {
      return;
    }

    const restoreValue = getCropInputValue(field, selectedCrop);
    const value = rawValue.trim();

    if (!value) {
      input.value = restoreValue;
      return;
    }

    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 99) {
      input.value = restoreValue;
      setProjectNotice("Crop values must be between 0% and 99%.");
      return;
    }

    const nextCrop = normalizeClipCrop({
      ...selectedCrop,
      [field]: parsedValue / 100,
    });

    const horizontalTotal = nextCrop.left + nextCrop.right;
    const verticalTotal = nextCrop.top + nextCrop.bottom;

    if (horizontalTotal >= 1 || verticalTotal >= 1) {
      input.value = restoreValue;
      setProjectNotice("Crop cannot remove the entire visual content.");
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        updateClipCrop(
          currentProject,
          selectedClipContext.clip.id,
          nextCrop,
        ),
      "Crop updated.",
    );
  }

  function handleAdjustSelectedTransform(
    field: "x" | "y" | "scale" | "rotation" | "opacity",
    delta: number,
  ) {
    if (
      !selectedClipContext ||
      !selectedClipContext.asset ||
      (selectedClipContext.asset.mediaType !== "video" &&
        selectedClipContext.asset.mediaType !== "image")
    ) {
      return;
    }

    const currentTransform = selectedTransform;

    if (!currentTransform) {
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        updateClipTransformAtTime(
          currentProject,
          selectedClipContext.clip.id,
          selectedClipLocalTimeMs,
          {
            [field]: currentTransform[field] + delta,
          },
        ),
      selectedKeyframe ? "Keyframe updated." : "Transform updated.",
    );
  }

  function handleTransformInputKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }

  function commitTransformInput(
    field: TransformField,
    rawValue: string,
    input: HTMLInputElement,
  ) {
    if (!selectedClipContext || !selectedTransform) {
      return;
    }

    const value = rawValue.trim();
    const restoreValue = getTransformInputValue(field, selectedTransform);

    if (!value) {
      input.value = restoreValue;
      return;
    }

    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue)) {
      input.value = restoreValue;
      return;
    }

    const modelValue = field === "opacity" ? parsedValue / 100 : parsedValue;
    const nextTransform = normalizeClipTransform({
      ...selectedTransform,
      [field]: modelValue,
    });

    if (nextTransform[field] === selectedTransform[field]) {
      input.value = getTransformInputValue(field, nextTransform);
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        updateClipTransformAtTime(
          currentProject,
          selectedClipContext.clip.id,
          selectedClipLocalTimeMs,
          {
            [field]: nextTransform[field],
          },
        ),
      selectedKeyframe ? "Keyframe updated." : "Transform updated.",
    );
  }

  function handleResetSelectedTransform() {
    if (
      !selectedClipContext ||
      !selectedClipContext.asset ||
      (selectedClipContext.asset.mediaType !== "video" &&
        selectedClipContext.asset.mediaType !== "image")
    ) {
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        resetClipTransform(currentProject, selectedClipContext.clip.id),
      "Transform reset.",
    );
  }

  function handleCanvasTransformCommit(
    clipId: string,
    transform: ClipTransform,
  ) {
    const clipContext = findClipContext(project, clipId);
    const localTimeMs = clipContext
      ? Math.min(
          Math.max(currentTimeMs - clipContext.clip.timelineStartMs, 0),
          getClipDurationMs(clipContext.clip),
        )
      : 0;

    applyProjectChange(
      (currentProject) =>
        updateClipTransformAtTime(
          currentProject,
          clipId,
          localTimeMs,
          transform,
        ),
      "Canvas transform updated.",
    );
  }

  function handleCanvasCropPositionCommit(
    clipId: string,
    position: CropPosition,
  ) {
    applyProjectChange(
      (currentProject) =>
        updateClipCropPosition(
          currentProject,
          clipId,
          position,
        ),
      "Crop content position updated.",
    );
  }

  function handleCanvasCropCommit(
    clipId: string,
    crop: ClipCrop,
  ) {
    applyProjectChange(
      (currentProject) =>
        updateClipCrop(
          currentProject,
          clipId,
          crop,
        ),
      "Canvas crop updated.",
    );
  }



  function handleAddTransformKeyframe() {
    if (!selectedClipContext || !selectedTransform) {
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        addTransformKeyframe(
          currentProject,
          selectedClipContext.clip.id,
          selectedClipLocalTimeMs,
        ),
      selectedKeyframe ? "Keyframe updated." : "Keyframe added.",
    );
  }

  function handleMoveTransformKeyframe(
    clipId: string,
    fromTimeMs: number,
    toTimeMs: number,
  ) {
    applyProjectChange(
      (currentProject) =>
        moveTransformKeyframe(
          currentProject,
          clipId,
          fromTimeMs,
          toTimeMs,
        ),
      "Keyframe moved.",
    );
  }

  function handleUpdateTransformKeyframeEasing(
    clipId: string,
    timeMs: number,
    easing: TransformEasing,
  ) {
    updateSelectedClip(
      (currentProject) =>
        updateTransformKeyframeEasing(
          currentProject,
          clipId,
          timeMs,
          easing,
        ),
      "Keyframe easing updated.",
    );
  }

  function handleRemoveTransformKeyframeAt(
    clipId: string,
    timeMs: number,
  ) {
    applyProjectChange(
      (currentProject) =>
        removeTransformKeyframe(
          currentProject,
          clipId,
          timeMs,
        ),
      "Keyframe removed.",
    );
  }

  function handleRemoveTransformKeyframe() {
    if (!selectedClipContext || !selectedKeyframe) {
      return;
    }

    updateSelectedClip(
      (currentProject) =>
        removeTransformKeyframe(
          currentProject,
          selectedClipContext.clip.id,
          selectedClipLocalTimeMs,
        ),
      "Keyframe removed.",
    );
  }

  function canSplitSelectedClip(): boolean {
    if (!selectedClipContext || selectedClipContext.clip.sourceEndMs === null) {
      return false;
    }

    const clip = selectedClipContext.clip;
    const sourceEndMs = clip.sourceEndMs;

    if (sourceEndMs === null) {
      return false;
    }

    const clipEndMs = clip.timelineStartMs + (sourceEndMs - clip.sourceStartMs);

    return currentTimeMs > clip.timelineStartMs && currentTimeMs < clipEndMs;
  }

  function canExtendSelectedClipEnd(): boolean {
    if (
      !selectedClipContext ||
      selectedClipContext.clip.sourceEndMs === null ||
      selectedClipContext.asset?.durationMs === null ||
      selectedClipContext.asset?.durationMs === undefined
    ) {
      return false;
    }

    return selectedClipContext.clip.sourceEndMs < selectedClipContext.asset.durationMs;
  }

  function handleDirectMoveClip(clipId: string, timelineStartMs: number) {
    updateClipById(
      (currentProject) => moveClipOnTimeline(currentProject, clipId, timelineStartMs),
      "Clip moved.",
    );
  }

  function handleDirectTrimClipStart(clipId: string, sourceStartMs: number) {
    updateClipById(
      (currentProject) => trimClipStart(currentProject, clipId, sourceStartMs),
      "Clip start trimmed.",
    );
  }

  function handleDirectTrimClipEnd(clipId: string, sourceEndMs: number) {
    updateClipById(
      (currentProject) => trimClipEnd(currentProject, clipId, sourceEndMs),
      "Clip end trimmed.",
    );
  }

  function updateClipById(
    operation: (project: ReturnType<typeof loadWorkspaceProject>) => ReturnType<typeof loadWorkspaceProject>,
    notice: string,
  ) {
    applyProjectChange(operation, notice);
  }

  async function handleImport() {
    setImportError(null);
    setIsImporting(true);

    try {
      const importedAssets = await importMediaFiles();

      setHistory((currentHistory) => {
        const currentProject = currentHistory.present;
        const existingPaths = new Set(
          currentProject.assets.map((asset) => asset.sourcePath),
        );
        const newAssets = importedAssets.filter(
          (asset) => !existingPaths.has(asset.sourcePath),
        );

        if (!newAssets.length) {
          return currentHistory;
        }

        return commitHistory(currentHistory, {
          ...currentProject,
          assets: [...currentProject.assets, ...newAssets],
          updatedAt: new Date().toISOString(),
        });
      });
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Media could not be imported.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span>FrameFlow</span>
        </div>
        <nav className="workspace-nav" aria-label="Workspace">
          {navigation.map((item) => (
            <button
              aria-pressed={activeView === item.id}
              className="nav-button"
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                setIsExportPanelOpen(item.id === "export");
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="project-status">
          <span className="status-dot" aria-hidden="true" />
          <span>Project tersimpan lokal</span>
        </div>
      </header>

      <section className="workspace">
        <aside className="panel media-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Library</p>
              <h1>Media</h1>
            </div>
            <button
              aria-label="Import media"
              className="icon-button"
              disabled={isImporting}
              onClick={handleImport}
              type="button"
            >
              +
            </button>
          </div>

          <MediaBin
            assets={assets}
            isImporting={isImporting}
            importError={importError}
            onImport={handleImport}
            onAddAsset={handleAddAsset}
          />
        </aside>

        <section className="editor-area">
          <div className="editor-toolbar">
            <div>
              <p className="eyebrow">Project</p>
              <h2>{project.name}</h2>
            </div>
            <div className="toolbar-actions">
              <button
                aria-label="Undo"
                className="toolbar-button"
                disabled={!canUndo}
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
                type="button"
              >
                ↶
              </button>
              <button
                aria-label="Redo"
                className="toolbar-button"
                disabled={!canRedo}
                onClick={handleRedo}
                title="Redo (Ctrl+Y)"
                type="button"
              >
                ↷
              </button>
              <button className="toolbar-button" onClick={handleOpenProject} type="button">
                Open
              </button>
              <button className="toolbar-button" onClick={handleSaveProject} type="button">
                Save
              </button>
              <select
                aria-label="Canvas aspect ratio"
                className="canvas-preset-select"
                value={selectedCanvasPresetId}
                onChange={(event) =>
                  handleSetCanvasAspectRatio(event.currentTarget.value)
                }
              >
                {selectedCanvasPresetId === "custom" ? (
                  <option value="custom">Custom</option>
                ) : null}
                {canvasAspectRatioPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <button
                aria-label="Open export settings"
                className="primary-button"
                onClick={() => {
                  setActiveView("export");
                  setIsExportPanelOpen(true);
                }}
                type="button"
              >
                Export
              </button>
            </div>
            {projectNotice ? (
              <p className="project-notice" role="status">
                {projectNotice}
              </p>
            ) : null}
          </div>

          <div className="preview-region">
            <div className="preview-stage-region" ref={previewStageRegionRef}>
              <div
                className="preview-canvas"
                ref={previewCanvasRef}
                style={{
                  aspectRatio:
                    project.canvas.width + " / " + project.canvas.height,
                  width:
                    previewCanvasSize.width > 0
                      ? previewCanvasSize.width + "px"
                      : undefined,
                  height:
                    previewCanvasSize.height > 0
                      ? previewCanvasSize.height + "px"
                      : undefined,
                }}
              >
                <Preview
                project={project}
                currentTimeMs={displayedCurrentTimeMs}
                isPlaying={isPlaying}
                selectedClipId={selectedClipId}
                onSelectClip={handleSelectClip}
                onTransformCommit={handleCanvasTransformCommit}
                onTransformAnchorCommit={(_, anchor) =>
                  handleSetSelectedTransformAnchor(anchor)
                }
                onVisualMediaDimensionsChange={
                  handleVisualMediaDimensionsChange
                }
                onCropCommit={handleCanvasCropCommit}
                onCropPositionCommit={handleCanvasCropPositionCommit}
                textOverlayOverride={
                  textOverlayDraft
                    ? {
                        clipId: textOverlayDraft.clipId,
                        overlay: textOverlayDraft.overlay.text.trim()
                          ? textOverlayDraft.overlay
                          : undefined,
                      }
                    : null
                }
                />
              </div>
            </div>
            <div className="transport-controls" aria-label="Playback controls">
              <button
                aria-label="Previous frame"
                className="transport-button"
                onClick={() => handleStepFrame(-1)}
                type="button"
              >
                ◀
              </button>
              <button
                aria-label={isPlaying ? "Pause" : "Play"}
                className="play-button"
                onClick={handleTogglePlayback}
                type="button"
              >
                {isPlaying ? "Ⅱ" : "▶"}
              </button>
              <button
                aria-label="Next frame"
                className="transport-button"
                onClick={() => handleStepFrame(1)}
                type="button"
              >
                ▶
              </button>
              <span className="timecode">
                {formatTimecode(displayedCurrentTimeMs, project.canvas.frameRate)}
              </span>
            </div>
          </div>

          <Timeline
            project={project}
            currentTimeMs={displayedCurrentTimeMs}
            onCurrentTimeChange={handleCurrentTimeChange}
            selectedClipId={selectedClipId}
            onSelectClip={handleSelectClip}
            onMoveClip={handleDirectMoveClip}
            onTrimClipStart={handleDirectTrimClipStart}
            onTrimClipEnd={handleDirectTrimClipEnd}
            onToggleTrackMute={handleToggleTrackMute}
            onUpdateTrackVolume={handleUpdateTrackVolume}
            onUpdateTrackPan={handleUpdateTrackPan}
            onUpdateAudioClipFades={handleUpdateAudioClipFades}
            onAddAssetToTrack={handleAddAssetToTrack}
            onAddTrack={handleAddTrack}
            onRemoveTrack={handleRemoveTrack}
            onRemoveTransformKeyframe={handleRemoveTransformKeyframeAt}
            onMoveTransformKeyframe={handleMoveTransformKeyframe}
            onRemoveAudioVolumeKeyframe={handleRemoveAudioVolumeKeyframe}
            onMoveAudioVolumeKeyframe={handleMoveAudioClipVolumeKeyframe}
            onUpdateClipTransition={handleUpdateClipTransition}
            zoom={timelineZoom}
            onZoomChange={setTimelineZoom}
          />
        </section>

        <aside className="panel inspector-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Properties</p>
              <h2>Inspector</h2>
            </div>
            {selectedClipContext &&
            (selectedClipContext.asset?.mediaType === "video" ||
              selectedClipContext.asset?.mediaType === "image") ? (
              <button
                aria-label="Show color adjustments"
                className="inspector-quick-button"
                onClick={handleFocusColorAdjustments}
                type="button"
              >
                Color adjustments
              </button>
            ) : null}
            {selectedClipContext &&
            (selectedClipContext.asset?.mediaType === "video" ||
              selectedClipContext.asset?.mediaType === "image") ? (
              <button
                aria-label="Show text overlay"
                className="inspector-quick-button"
                onClick={handleFocusTextOverlay}
                type="button"
              >
                Text
              </button>
            ) : null}
          </div>

          {selectedClipContext ? (
            <div className="inspector-content">
              <div className="inspector-summary">
                <span className="inspector-type">{selectedClipContext.asset?.mediaType ?? "media"}</span>
                <strong>{selectedClipContext.asset?.name ?? "Missing media"}</strong>
              </div>

                  <div
                    data-testid="color-adjustments"
                    ref={colorAdjustmentsRef}
                    className={
                      "inspector-section inspector-color-adjustments" +
                      (selectedVisualEffects &&
                      (selectedVisualEffects.brightness !== 0 ||
                        selectedVisualEffects.contrast !== 0 ||
                        selectedVisualEffects.saturation !== 0)
                        ? " inspector-color-adjustments-active"
                        : "")
                    }
                  >
                    <div className="inspector-section-header">
                      <span className="inspector-section-title">Color adjustments</span>
                      <button
                        aria-label="Reset color adjustments"
                        className="inspector-inline-button"
                        onClick={() =>
                          handleUpdateSelectedVisualEffects({
                            brightness: 0,
                            contrast: 0,
                            saturation: 0,
                          })
                        }
                        type="button"
                      >
                        Reset
                      </button>
                    </div>
                    <p className="inspector-help">
                      Non-destructive per-clip brightness, contrast, and saturation.
                    </p>
                    <div
                      className="inspector-transform-input-grid"
                      key={
                        selectedVisualEffects
                          ? [
                              selectedVisualEffects.brightness,
                              selectedVisualEffects.contrast,
                              selectedVisualEffects.saturation,
                            ].join("|")
                          : "none"
                      }
                    >
                      {([
                        ["brightness", "Brightness"],
                        ["contrast", "Contrast"],
                        ["saturation", "Saturation"],
                      ] as Array<[keyof VisualEffects, string]>).map(
                        ([field, label]) => (
                          <label className="inspector-transform-field" key={field}>
                            <span>{label}</span>
                            <div className="inspector-transform-input-wrap">
                              <input
                                aria-label={label}
                                className="inspector-transform-input"
                                max="100"
                                min="-100"
                                step="1"
                                type="number"
                                defaultValue={Math.round(
                                  (selectedVisualEffects?.[field] ?? 0) * 100,
                                )}
                            onBlur={(event) => {
                                  const rawValue = event.currentTarget.value.trim();
                                  const fallback = Math.round(
                                    (selectedVisualEffects?.[field] ?? 0) * 100,
                                  );

                                  if (!rawValue) {
                                    event.currentTarget.value = String(fallback);
                                    return;
                                  }

                                  const parsedValue = Number(rawValue);

                                  if (
                                    !Number.isFinite(parsedValue) ||
                                    parsedValue < -100 ||
                                    parsedValue > 100
                                  ) {
                                    event.currentTarget.value = String(fallback);
                                    setProjectNotice(
                                      label + " must be between -100% and 100%.",
                                    );
                                    return;
                                  }

                                  handleUpdateSelectedVisualEffects({
                                    [field]: parsedValue / 100,
                                  });
                                }}
                                onKeyDown={handleTransformInputKeyDown}
                              />
                              <span>%</span>
                            </div>
                          </label>
                        ),
                      )}
                    </div>
                  </div>



              {(selectedClipContext.asset?.mediaType === "video" ||
                selectedClipContext.asset?.mediaType === "image") ? (
                <div className="inspector-section">
                  <div className="inspector-section-header">
                    <div className="inspector-section-title-group">
                      <span className="inspector-section-title">Transform</span>
                      {selectedKeyframeCount > 0 ? (
                        <span className="inspector-keyframe-count">
                          {selectedKeyframeCount} keyframe{selectedKeyframeCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                    <div className="inspector-section-actions">
                      <button
                        aria-label={selectedKeyframe ? "Update keyframe" : "Add keyframe"}
                        className="inspector-inline-button"
                        onClick={handleAddTransformKeyframe}
                        type="button"
                      >
                        {selectedKeyframe ? "Update keyframe" : "Add keyframe"}
                      </button>
                      {selectedKeyframe ? (
                        <button
                          aria-label="Remove keyframe"
                          className="inspector-inline-button"
                          onClick={handleRemoveTransformKeyframe}
                          type="button"
                        >
                          Remove
                        </button>
                      ) : null}
                      <button
                        aria-label="Reset transform"
                        className="inspector-inline-button"
                        onClick={handleResetSelectedTransform}
                        type="button"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {selectedKeyframe ? (
                    <label className="inspector-keyframe-easing">
                      <span>Interpolation</span>
                      <select
                        aria-label="Keyframe interpolation"
                        value={selectedKeyframe.easing ?? "linear"}
                        onChange={(event) =>
                          handleUpdateTransformKeyframeEasing(
                            selectedClipContext.clip.id,
                            selectedKeyframe.timeMs,
                            event.currentTarget.value as TransformEasing,
                          )
                        }
                      >
                        <option value="linear">Linear</option>
                        <option value="ease-in">Ease in</option>
                        <option value="ease-out">Ease out</option>
                        <option value="ease-in-out">Ease in-out</option>
                      </select>
                    </label>
                  ) : null}

                  <div className="inspector-anchor-section">
                    <div className="inspector-anchor-header">
                      <span>Anchor point</span>
                      <small>
                        {selectedAnchor
                          ? Math.round(selectedAnchor.x * 100) + "%, " +
                            Math.round(selectedAnchor.y * 100) + "%"
                          : "50%, 50%"}
                      </small>
                    </div>
                    <div
                      aria-label="Transform anchor point"
                      className="inspector-anchor-grid"
                    >
                      {transformAnchorPresets.map((preset) => {
                        const isActive =
                          selectedAnchor?.x === preset.anchor.x &&
                          selectedAnchor?.y === preset.anchor.y;

                        return (
                          <button
                            aria-label={"Set anchor " + preset.label}
                            aria-pressed={isActive}
                            className={
                              "inspector-anchor-button" +
                              (isActive ? " inspector-anchor-button-active" : "")
                            }
                            key={preset.id}
                            onClick={() =>
                              handleSetSelectedTransformAnchor(preset.anchor)
                            }
                            title={preset.label}
                            type="button"
                          >
                            <span aria-hidden="true">•</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="inspector-crop-section">
                    <div className="inspector-anchor-header">
                      <span>Crop</span>
                      <small>Per-clip, not keyframed</small>
                    </div>
                    <div
                      className="inspector-crop-grid"
                      key={
                        selectedCrop
                          ? [
                              selectedCrop.top,
                              selectedCrop.right,
                              selectedCrop.bottom,
                              selectedCrop.left,
                            ].join("|")
                          : "none"
                      }
                    >
                      {([
                        ["top", "Top"],
                        ["right", "Right"],
                        ["bottom", "Bottom"],
                        ["left", "Left"],
                      ] as Array<[CropField, string]>).map(([field, label]) => (
                        <label className="inspector-transform-field" key={field}>
                          <span>{label}</span>
                          <div className="inspector-transform-input-wrap">
                            <input
                              aria-label={"Crop " + field}
                              className="inspector-transform-input"
                              max="99"
                              min="0"
                              step="1"
                              type="number"
                              defaultValue={
                                selectedCrop
                                  ? Math.round(selectedCrop[field] * 100)
                                  : 0
                              }
                              onBlur={(event) =>
                                commitCropInput(
                                  field,
                                  event.currentTarget.value,
                                  event.currentTarget,
                                )
                              }
                              onKeyDown={handleTransformInputKeyDown}
                            />
                            <span>%</span>
                          </div>
                        </label>
                      ))}
                    </div>
                    <button
                      aria-label="Reset crop"
                      className="inspector-inline-button"
                      onClick={handleResetSelectedCrop}
                      type="button"
                    >
                      Reset crop
                    </button>
                    <div className="inspector-crop-aspect-presets">
                      <div className="inspector-section-header">
                        <span className="inspector-section-title">Aspect ratio</span>
                        <span className="inspector-keyframe-count">Crop viewport</span>
                      </div>
                      <div className="inspector-crop-aspect-grid">
                        {CROP_ASPECT_RATIO_PRESETS.map((preset) => (
                          <button
                            aria-label={"Set crop aspect ratio " + preset.label}
                            className="inspector-inline-button"
                            key={preset.id}
                            onClick={() => handleSetSelectedCropAspectPreset(preset)}
                            type="button"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div
                      className="inspector-crop-position"
                      key={
                        selectedCropPosition
                          ? [
                              selectedCropPosition.x,
                              selectedCropPosition.y,
                            ].join("|")
                          : "none"
                      }
                    >
                      <div className="inspector-section-header">
                        <span className="inspector-section-title">Crop position</span>
                        <span className="inspector-keyframe-count">Content anchor</span>
                      </div>
                      <div className="inspector-crop-grid">
                        {([
                          ["x", "X"],
                          ["y", "Y"],
                        ] as Array<[keyof CropPosition, string]>).map(
                          ([field, label]) => (
                            <label className="inspector-transform-field" key={field}>
                              <span>{label}</span>
                              <div className="inspector-transform-input-wrap">
                                <input
                                  aria-label={"Crop position " + label}
                                  className="inspector-transform-input"
                                  max="100"
                                  min="0"
                                  step="1"
                                  type="number"
                                  defaultValue={
                                    selectedCropPosition
                                      ? Math.round(
                                          selectedCropPosition[field] * 100,
                                        )
                                      : 50
                                  }
                                  onBlur={(event) => {
                                    const rawValue = event.currentTarget.value.trim();
                                    const fallback =
                                      selectedCropPosition?.[field] ?? 0.5;

                                    if (!rawValue) {
                                      event.currentTarget.value = String(
                                        Math.round(fallback * 100),
                                      );
                                      return;
                                    }

                                    const parsedValue = Number(rawValue);

                                    if (
                                      !Number.isFinite(parsedValue) ||
                                      parsedValue < 0 ||
                                      parsedValue > 100
                                    ) {
                                      event.currentTarget.value = String(
                                        Math.round(fallback * 100),
                                      );
                                      setProjectNotice(
                                        "Crop position must be between 0% and 100%.",
                                      );
                                      return;
                                    }

                                    const position =
                                      selectedCropPosition ?? {
                                        x: 0.5,
                                        y: 0.5,
                                      };

                                    handleSetSelectedCropPosition({
                                      ...position,
                                      [field]: parsedValue / 100,
                                    });
                                  }}
                                  onKeyDown={handleTransformInputKeyDown}
                                />
                                <span>%</span>
                              </div>
                            </label>
                          ),
                        )}
                      </div>
                      <button
                        aria-label="Center crop content"
                        className="inspector-inline-button"
                        onClick={handleCenterSelectedCropContent}
                        type="button"
                      >
                        Center content
                      </button>
                    </div>
                  </div>



              <div className="inspector-fields">
                <span>Track</span>
                <strong>{selectedClipContext.track.name}</strong>
                <span>Start</span>
                <strong>{formatDuration(selectedClipContext.clip.timelineStartMs)}</strong>
                <span>Duration</span>
                <strong>{formatDuration(getClipDurationMs(selectedClipContext.clip))}</strong>
                <span>Source</span>
                <strong>
                  {formatDuration(selectedClipContext.clip.sourceStartMs)} –{" "}
                  {formatDuration(selectedClipContext.clip.sourceEndMs)}
                </strong>
              </div>

                  <div
                    data-testid="text-overlay"
                    ref={textOverlayRef}
                    className="inspector-section inspector-text-overlay"
                  >
                    <div className="inspector-section-header">
                      <span className="inspector-section-title">Text overlay</span>
                      <button
                        aria-label="Reset text overlay"
                        className="inspector-inline-button"
                        onClick={handleResetSelectedTextOverlay}
                        type="button"
                      >
                        Reset
                      </button>
                    </div>
                    <textarea
                      aria-label="Text overlay content"
                      className="inspector-textarea"
                      value={activeTextOverlay?.text ?? ""}
                      maxLength={500}
                      placeholder="Type text…"
                      rows={3}
                      onChange={(event) =>
                        handleUpdateTextOverlayDraft({
                          text: event.currentTarget.value,
                        })
                      }
                      onBlur={handleCommitSelectedTextOverlayDraft}
                    />
                    <div className="inspector-transform-input-grid">
                      <label className="inspector-transform-field">
                        <span>X</span>
                        <div className="inspector-transform-input-wrap">
                          <input
                            aria-label="Text overlay X position"
                            className="inspector-transform-input"
                            value={Math.round(
                              (activeTextOverlay?.x ?? DEFAULT_TEXT_OVERLAY_X) * 100,
                            )}
                            max="100"
                            min="0"
                            step="1"
                            type="number"
                            onChange={(event) => {
                              const rawValue = event.currentTarget.value.trim();
                              const value = Number(rawValue);
                              if (
                                !rawValue ||
                                !Number.isFinite(value) ||
                                value < 0 ||
                                value > 100
                              ) {
                                return;
                              }
                              handleUpdateTextOverlayDraft({ x: value / 100 });
                            }}
                            onBlur={(event) => {
                              const value = Number(event.currentTarget.value);
                              if (!Number.isFinite(value) || value < 0 || value > 100) {
                                event.currentTarget.value = String(
                                  Math.round(
                                    (activeTextOverlay?.x ?? DEFAULT_TEXT_OVERLAY_X) * 100,
                                  ),
                                );
                                return;
                              }
                              handleCommitSelectedTextOverlayDraft();
                            }}
                            onKeyDown={handleTransformInputKeyDown}
                          />
                          <span>%</span>
                        </div>
                      </label>
                      <label className="inspector-transform-field">
                        <span>Y</span>
                        <div className="inspector-transform-input-wrap">
                          <input
                            aria-label="Text overlay Y position"
                            className="inspector-transform-input"
                            value={Math.round(
                              (activeTextOverlay?.y ?? DEFAULT_TEXT_OVERLAY_Y) * 100,
                            )}
                            max="100"
                            min="0"
                            step="1"
                            type="number"
                            onChange={(event) => {
                              const rawValue = event.currentTarget.value.trim();
                              const value = Number(rawValue);
                              if (
                                !rawValue ||
                                !Number.isFinite(value) ||
                                value < 0 ||
                                value > 100
                              ) {
                                return;
                              }
                              handleUpdateTextOverlayDraft({ y: value / 100 });
                            }}
                            onBlur={(event) => {
                              const value = Number(event.currentTarget.value);
                              if (!Number.isFinite(value) || value < 0 || value > 100) {
                                event.currentTarget.value = String(
                                  Math.round(
                                    (activeTextOverlay?.y ?? DEFAULT_TEXT_OVERLAY_Y) * 100,
                                  ),
                                );
                                return;
                              }
                              handleCommitSelectedTextOverlayDraft();
                            }}
                            onKeyDown={handleTransformInputKeyDown}
                          />
                          <span>%</span>
                        </div>
                      </label>
                      <label className="inspector-transform-field">
                        <span>Size</span>
                        <div className="inspector-transform-input-wrap">
                          <input
                            aria-label="Text overlay font size"
                            className="inspector-transform-input"
                            value={
                              activeTextOverlay?.fontSize ??
                              DEFAULT_TEXT_OVERLAY_FONT_SIZE
                            }
                            max="240"
                            min="12"
                            step="1"
                            type="number"
                            onChange={(event) => {
                              const rawValue = event.currentTarget.value.trim();
                              const value = Number(rawValue);
                              if (
                                !rawValue ||
                                !Number.isFinite(value) ||
                                value < 12 ||
                                value > 240
                              ) {
                                return;
                              }
                              handleUpdateTextOverlayDraft({
                                fontSize: Math.round(value),
                              });
                            }}
                            onBlur={(event) => {
                              const value = Number(event.currentTarget.value);
                              if (!Number.isFinite(value) || value < 12 || value > 240) {
                                event.currentTarget.value = String(
                                  activeTextOverlay?.fontSize ??
                                    DEFAULT_TEXT_OVERLAY_FONT_SIZE,
                                );
                                return;
                              }
                              handleCommitSelectedTextOverlayDraft();
                            }}
                            onKeyDown={handleTransformInputKeyDown}
                          />
                          <span>px</span>
                        </div>
                      </label>
                      <label className="inspector-transform-field">
                        <span>Color</span>
                        <div className="inspector-color-input-wrap">
                          <input
                            aria-label="Text overlay color"
                            defaultValue={
                              selectedTextOverlay?.color ?? DEFAULT_TEXT_OVERLAY_COLOR
                            }
                            key={"color-" + (selectedTextOverlay?.color ?? DEFAULT_TEXT_OVERLAY_COLOR)}
                            type="color"
                            onChange={(event) =>
                              handleCommitSelectedTextOverlayChange({
                                color: event.currentTarget.value,
                              })
                            }
                          />
                        </div>
                      </label>
                    </div>
                    <div
                      className="inspector-text-alignment"
                      role="group"
                      aria-label="Text overlay alignment"
                    >
                      {(["left", "center", "right"] as const).map((alignment) => {
                        const active =
                          (activeTextOverlay?.alignment ??
                            DEFAULT_TEXT_OVERLAY_ALIGNMENT) === alignment;

                        return (
                          <button
                            aria-label={"Align text " + alignment}
                            aria-pressed={active}
                            className="inspector-inline-button"
                            key={alignment}
                            onClick={() =>
                              handleCommitSelectedTextOverlayChange({ alignment })
                            }
                            type="button"
                          >
                            {alignment}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="inspector-keyframe-status">
                    <span>
                      {selectedKeyframe
                        ? "Keyframe active at "
                        : selectedKeyframeCount > 0
                          ? "Animated transform at "
                          : "Static transform at "}
                      {formatKeyframeTime(selectedClipLocalTimeMs)}
                    </span>
                  </div>

                  <div
                    key={
                      selectedTransform
                        ? [
                            selectedTransform.x,
                            selectedTransform.y,
                            selectedTransform.scale,
                            selectedTransform.rotation,
                            selectedTransform.opacity,
                          ].join("|")
                        : "none"
                    }
                    className="inspector-transform-input-grid"
                  >
                    <label className="inspector-transform-field">
                      <span>X</span>
                      <div className="inspector-transform-input-wrap">
                        <input
                          aria-label="X position"
                          className="inspector-transform-input"
                          max="100"
                          min="-100"
                          step="0.5"
                          type="number"
                          defaultValue={selectedTransform?.x ?? 0}
                          onBlur={(event) =>
                            commitTransformInput(
                              "x",
                              event.currentTarget.value,
                              event.currentTarget,
                            )
                          }
                          onKeyDown={handleTransformInputKeyDown}
                        />
                        <span>%</span>
                      </div>
                    </label>
                    <label className="inspector-transform-field">
                      <span>Y</span>
                      <div className="inspector-transform-input-wrap">
                        <input
                          aria-label="Y position"
                          className="inspector-transform-input"
                          max="100"
                          min="-100"
                          step="0.5"
                          type="number"
                          defaultValue={selectedTransform?.y ?? 0}
                          onBlur={(event) =>
                            commitTransformInput(
                              "y",
                              event.currentTarget.value,
                              event.currentTarget,
                            )
                          }
                          onKeyDown={handleTransformInputKeyDown}
                        />
                        <span>%</span>
                      </div>
                    </label>
                    <label className="inspector-transform-field">
                      <span>Scale</span>
                      <div className="inspector-transform-input-wrap">
                        <input
                          aria-label="Scale"
                          className="inspector-transform-input"
                          max="10"
                          min="0.05"
                          step="0.05"
                          type="number"
                          defaultValue={selectedTransform?.scale ?? 1}
                          onBlur={(event) =>
                            commitTransformInput(
                              "scale",
                              event.currentTarget.value,
                              event.currentTarget,
                            )
                          }
                          onKeyDown={handleTransformInputKeyDown}
                        />
                        <span>×</span>
                      </div>
                    </label>
                    <label className="inspector-transform-field">
                      <span>Rotation</span>
                      <div className="inspector-transform-input-wrap">
                        <input
                          aria-label="Rotation"
                          className="inspector-transform-input"
                          max="180"
                          min="-180"
                          step="1"
                          type="number"
                          defaultValue={selectedTransform?.rotation ?? 0}
                          onBlur={(event) =>
                            commitTransformInput(
                              "rotation",
                              event.currentTarget.value,
                              event.currentTarget,
                            )
                          }
                          onKeyDown={handleTransformInputKeyDown}
                        />
                        <span>°</span>
                      </div>
                    </label>
                    <label className="inspector-transform-field">
                      <span>Opacity</span>
                      <div className="inspector-transform-input-wrap">
                        <input
                          aria-label="Opacity"
                          className="inspector-transform-input"
                          max="100"
                          min="0"
                          step="1"
                          type="number"
                          defaultValue={Math.round(
                            (selectedTransform?.opacity ?? 1) * 100,
                          )}
                          onBlur={(event) =>
                            commitTransformInput(
                              "opacity",
                              event.currentTarget.value,
                              event.currentTarget,
                            )
                          }
                          onKeyDown={handleTransformInputKeyDown}
                        />
                        <span>%</span>
                      </div>
                    </label>
                  </div>

                  <div className="inspector-transform-grid">
                    <button
                      aria-label="Move visual left"
                      className="toolbar-button"
                      onClick={() => handleAdjustSelectedTransform("x", -5)}
                      type="button"
                    >
                      X −5%
                    </button>
                    <button
                      aria-label="Move visual right"
                      className="toolbar-button"
                      onClick={() => handleAdjustSelectedTransform("x", 5)}
                      type="button"
                    >
                      X +5%
                    </button>
                    <button
                      aria-label="Move visual up"
                      className="toolbar-button"
                      onClick={() => handleAdjustSelectedTransform("y", -5)}
                      type="button"
                    >
                      Y −5%
                    </button>
                    <button
                      aria-label="Move visual down"
                      className="toolbar-button"
                      onClick={() => handleAdjustSelectedTransform("y", 5)}
                      type="button"
                    >
                      Y +5%
                    </button>
                    <button
                      aria-label="Scale visual down"
                      className="toolbar-button"
                      onClick={() => handleAdjustSelectedTransform("scale", -0.1)}
                      type="button"
                    >
                      Scale −
                    </button>
                    <button
                      aria-label="Scale visual up"
                      className="toolbar-button"
                      onClick={() => handleAdjustSelectedTransform("scale", 0.1)}
                      type="button"
                    >
                      Scale +
                    </button>
                    <button
                      aria-label="Rotate visual left"
                      className="toolbar-button"
                      onClick={() => handleAdjustSelectedTransform("rotation", -15)}
                      type="button"
                    >
                      ↺ 15°
                    </button>
                    <button
                      aria-label="Rotate visual right"
                      className="toolbar-button"
                      onClick={() => handleAdjustSelectedTransform("rotation", 15)}
                      type="button"
                    >
                      ↻ 15°
                    </button>
                    <button
                      aria-label="Decrease visual opacity"
                      className="toolbar-button"
                      onClick={() => handleAdjustSelectedTransform("opacity", -0.1)}
                      type="button"
                    >
                      Opacity −
                    </button>
                    <button
                      aria-label="Increase visual opacity"
                      className="toolbar-button"
                      onClick={() => handleAdjustSelectedTransform("opacity", 0.1)}
                      type="button"
                    >
                      Opacity +
                    </button>
                  </div>
                </div>
              ) : null}

              {selectedClipContext.asset?.mediaType === "audio" &&
              selectedClipContext.track.type === "audio" ? (
                <>
                  <AudioFadeInspector
                    clip={selectedClipContext.clip}
                    durationMs={getClipDurationMs(selectedClipContext.clip)}
                    onCommit={handleUpdateSelectedAudioFades}
                    onKeyDown={handleTransformInputKeyDown}
                  />
                  <AudioEqInspector
                    clip={selectedClipContext.clip}
                    onCommit={handleUpdateSelectedAudioEq}
                    onKeyDown={handleTransformInputKeyDown}
                  />
                  <AudioVolumeAutomationInspector
                    clip={selectedClipContext.clip}
                    localTimeMs={selectedClipLocalTimeMs}
                    durationMs={getClipDurationMs(selectedClipContext.clip)}
                    onSetVolume={handleSetSelectedAudioVolume}
                    onAddOrUpdateKeyframe={handleUpdateSelectedAudioVolume}
                    onRemoveKeyframe={handleRemoveSelectedAudioVolumeKeyframe}
                    onKeyDown={handleTransformInputKeyDown}
                  />
                  <AudioCompressorInspector
                    clip={selectedClipContext.clip}
                    onCommit={handleUpdateSelectedAudioCompressor}
                    onKeyDown={handleTransformInputKeyDown}
                  />
                </>
              ) : null}
              {(selectedClipContext.asset?.mediaType === "video" ||
                selectedClipContext.asset?.mediaType === "image") ? (
                <TransitionInspector
                  canTransition={canTransitionToNextVisual}
                  transition={selectedTransition}
                  onChange={handleUpdateSelectedTransition}
                />
              ) : null}

              <div className="inspector-section">
                <span className="inspector-section-title">Move</span>
                <div className="inspector-button-grid">
                  <button
                    aria-label="Move clip -1s"
                    className="toolbar-button"
                    disabled={selectedClipContext.clip.timelineStartMs === 0}
                    onClick={() => handleMoveSelectedClip(-1000)}
                    type="button"
                  >
                    −1s
                  </button>
                  <button
                    aria-label="Move clip +1s"
                    className="toolbar-button"
                    onClick={() => handleMoveSelectedClip(1000)}
                    type="button"
                  >
                    +1s
                  </button>
                </div>
              </div>

              <div className="inspector-section">
                <span className="inspector-section-title">Trim start</span>
                <div className="inspector-button-grid">
                  <button
                    aria-label="Extend clip start -1s"
                    className="toolbar-button"
                    disabled={selectedClipContext.clip.sourceStartMs === 0}
                    onClick={() => handleTrimSelectedClipStart(-1000)}
                    type="button"
                  >
                    −1s
                  </button>
                  <button
                    aria-label="Trim clip start +1s"
                    className="toolbar-button"
                    disabled={
                      selectedClipContext.clip.sourceEndMs === null ||
                      selectedClipContext.clip.sourceStartMs + 1000 >= selectedClipContext.clip.sourceEndMs
                    }
                    onClick={() => handleTrimSelectedClipStart(1000)}
                    type="button"
                  >
                    +1s
                  </button>
                </div>
              </div>

              <div className="inspector-section">
                <span className="inspector-section-title">Trim end</span>
                <div className="inspector-button-grid">
                  <button
                    aria-label="Trim clip end -1s"
                    className="toolbar-button"
                    disabled={
                      selectedClipContext.clip.sourceEndMs === null ||
                      selectedClipContext.clip.sourceEndMs - 1000 <= selectedClipContext.clip.sourceStartMs
                    }
                    onClick={() => handleTrimSelectedClipEnd(-1000)}
                    type="button"
                  >
                    −1s
                  </button>
                  <button
                    aria-label="Extend clip end +1s"
                    className="toolbar-button"
                    disabled={!canExtendSelectedClipEnd()}
                    onClick={() => handleTrimSelectedClipEnd(1000)}
                    type="button"
                  >
                    +1s
                  </button>
                </div>
              </div>

              <div className="inspector-section">
                <span className="inspector-section-title">Split</span>
                <button
                  className="toolbar-button split-button"
                  disabled={!canSplitSelectedClip()}
                  onClick={handleSplitSelectedClip}
                  type="button"
                >
                  Split at playhead
                </button>
              </div>

              <button
                className="danger-button"
                onClick={handleDeleteSelectedClip}
                type="button"
              >
                Delete clip
              </button>
            </div>
          ) : (
            <div className="inspector-empty">
              <strong>Pilih sebuah clip</strong>
              <span>
                Posisi, ukuran, audio, dan properti lainnya akan muncul di sini.
              </span>
            </div>
          )}

          <div className="project-details">
            <span>Canvas</span>
            <strong>{project.canvas.width} × {project.canvas.height}</strong>
            <span>Frame rate</span>
            <strong>{project.canvas.frameRate} fps</strong>
          </div>
        </aside>
      </section>

      {isExportPanelOpen ? (
        <ExportPanel
          project={project}
          onClose={() => {
            setIsExportPanelOpen(false);
            setActiveView("editor");
          }}
        />
      ) : null}

      <footer className="statusbar">
        <span>FrameFlow alpha</span>
        <span>Offline-first video editor</span>
      </footer>
    </main>
  );
}

function findClipContext(
  project: ReturnType<typeof loadWorkspaceProject>,
  clipId: string | null,
) {
  if (!clipId) {
    return null;
  }

  for (const track of project.tracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);

    if (clip) {
      return {
        asset: project.assets.find((asset) => asset.id === clip.assetId) ?? null,
        clip,
        track,
      };
    }
  }

  return null;
}

function getClipDurationMs(clip: { sourceStartMs: number; sourceEndMs: number | null }): number {
  if (clip.sourceEndMs === null) {
    return 0;
  }

  return Math.max(0, clip.sourceEndMs - clip.sourceStartMs);
}

function AudioFadeInspector({
  clip,
  durationMs,
  onCommit,
  onKeyDown,
}: {
  clip: Clip;
  durationMs: number;
  onCommit: (fadeInMs: number, fadeOutMs: number) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}) {
  const fadeInInputRef = useRef<HTMLInputElement>(null);
  const fadeOutInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fadeInInputRef.current) {
      fadeInInputRef.current.value = String(clip.audioFadeInMs ?? 0);
    }
    if (fadeOutInputRef.current) {
      fadeOutInputRef.current.value = String(clip.audioFadeOutMs ?? 0);
    }
  }, [clip.id, clip.audioFadeInMs, clip.audioFadeOutMs]);

  function commit(which: "in" | "out") {
    const rawFadeIn = fadeInInputRef.current?.value.trim() ?? "";
    const rawFadeOut = fadeOutInputRef.current?.value.trim() ?? "";

    if (!rawFadeIn || !rawFadeOut) {
      if (!rawFadeIn && fadeInInputRef.current) {
        fadeInInputRef.current.value = String(clip.audioFadeInMs ?? 0);
      }
      if (!rawFadeOut && fadeOutInputRef.current) {
        fadeOutInputRef.current.value = String(clip.audioFadeOutMs ?? 0);
      }
      return;
    }

    const fadeInMs = Number(rawFadeIn);
    const fadeOutMs = Number(rawFadeOut);

    if (!Number.isFinite(fadeInMs) || !Number.isFinite(fadeOutMs)) {
      if (which === "in" && fadeInInputRef.current) {
        fadeInInputRef.current.value = String(clip.audioFadeInMs ?? 0);
      } else if (which === "out" && fadeOutInputRef.current) {
        fadeOutInputRef.current.value = String(clip.audioFadeOutMs ?? 0);
      }
      return;
    }

    onCommit(
      Math.max(0, Math.round(fadeInMs)),
      Math.max(0, Math.round(fadeOutMs)),
    );
  }

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">
        <span className="inspector-section-title">Audio fades</span>
        <span className="inspector-keyframe-count">Per clip</span>
      </div>
      <div className="inspector-transform-input-grid">
        <label className="inspector-transform-field">
          <span>Fade in</span>
          <div className="inspector-transform-input-wrap">
            <input
              ref={fadeInInputRef}
              aria-label="Audio fade in"
              className="inspector-transform-input"
              defaultValue={clip.audioFadeInMs ?? 0}
              max={Math.max(0, durationMs)}
              min="0"
              step="100"
              type="number"
              onBlur={() => commit("in")}
              onKeyDown={onKeyDown}
            />
            <span>ms</span>
          </div>
        </label>
        <label className="inspector-transform-field">
          <span>Fade out</span>
          <div className="inspector-transform-input-wrap">
            <input
              ref={fadeOutInputRef}
              aria-label="Audio fade out"
              className="inspector-transform-input"
              defaultValue={clip.audioFadeOutMs ?? 0}
              max={Math.max(0, durationMs)}
              min="0"
              step="100"
              type="number"
              onBlur={() => commit("out")}
              onKeyDown={onKeyDown}
            />
            <span>ms</span>
          </div>
        </label>
      </div>
    </div>
  );
}

function AudioEqInspector({
  clip,
  onCommit,
  onKeyDown,
}: {
  clip: Clip;
  onCommit: (changes: Partial<AudioEq>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}) {
  const enabledRef = useRef<HTMLInputElement>(null);
  const lowRef = useRef<HTMLInputElement>(null);
  const midRef = useRef<HTMLInputElement>(null);
  const highRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const eq = getAudioEq(clip);

    if (enabledRef.current) {
      enabledRef.current.checked = eq.enabled;
    }
    if (lowRef.current) {
      lowRef.current.value = String(eq.lowGainDb);
    }
    if (midRef.current) {
      midRef.current.value = String(eq.midGainDb);
    }
    if (highRef.current) {
      highRef.current.value = String(eq.highGainDb);
    }
  }, [clip]);

  function commit(which: "low" | "mid" | "high") {
    const current = getAudioEq(clip);
    const refs = { low: lowRef, mid: midRef, high: highRef };
    const rawValues = {
      low: lowRef.current?.value.trim() ?? "",
      mid: midRef.current?.value.trim() ?? "",
      high: highRef.current?.value.trim() ?? "",
    };

    if (!rawValues.low || !rawValues.mid || !rawValues.high) {
      if (which === "low" && lowRef.current) {
        lowRef.current.value = String(current.lowGainDb);
      }
      if (which === "mid" && midRef.current) {
        midRef.current.value = String(current.midGainDb);
      }
      if (which === "high" && highRef.current) {
        highRef.current.value = String(current.highGainDb);
      }
      return;
    }

    const values = {
      low: Number(rawValues.low),
      mid: Number(rawValues.mid),
      high: Number(rawValues.high),
    };

    if (
      !Number.isFinite(values.low) ||
      !Number.isFinite(values.mid) ||
      !Number.isFinite(values.high) ||
      values.low < -12 ||
      values.low > 12 ||
      values.mid < -12 ||
      values.mid > 12 ||
      values.high < -12 ||
      values.high > 12
    ) {
      refs[which].current?.focus();
      if (which === "low" && lowRef.current) {
        lowRef.current.value = String(current.lowGainDb);
      }
      if (which === "mid" && midRef.current) {
        midRef.current.value = String(current.midGainDb);
      }
      if (which === "high" && highRef.current) {
        highRef.current.value = String(current.highGainDb);
      }
      return;
    }

    onCommit({
      lowGainDb: Math.round(values.low * 10) / 10,
      midGainDb: Math.round(values.mid * 10) / 10,
      highGainDb: Math.round(values.high * 10) / 10,
    });
  }

  function toggleEnabled() {
    onCommit({
      enabled: enabledRef.current?.checked ?? false,
    });
  }

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">
        <span className="inspector-section-title">Audio EQ</span>
        <span className="inspector-keyframe-count">3-band</span>
      </div>
      <label className="inspector-toggle-field">
        <input
          ref={enabledRef}
          aria-label="Enable audio EQ"
          defaultChecked={getAudioEq(clip).enabled}
          type="checkbox"
          onChange={toggleEnabled}
        />
        <span>Enable EQ</span>
      </label>
      <div className="inspector-transform-input-grid">
        <label className="inspector-transform-field">
          <span>Low</span>
          <div className="inspector-transform-input-wrap">
            <input
              ref={lowRef}
              aria-label="Audio EQ low gain"
              className="inspector-transform-input"
              defaultValue={getAudioEq(clip).lowGainDb}
              max="12"
              min="-12"
              step="0.5"
              type="number"
              onBlur={() => commit("low")}
              onKeyDown={onKeyDown}
            />
            <span>dB</span>
          </div>
        </label>
        <label className="inspector-transform-field">
          <span>Mid</span>
          <div className="inspector-transform-input-wrap">
            <input
              ref={midRef}
              aria-label="Audio EQ mid gain"
              className="inspector-transform-input"
              defaultValue={getAudioEq(clip).midGainDb}
              max="12"
              min="-12"
              step="0.5"
              type="number"
              onBlur={() => commit("mid")}
              onKeyDown={onKeyDown}
            />
            <span>dB</span>
          </div>
        </label>
        <label className="inspector-transform-field">
          <span>High</span>
          <div className="inspector-transform-input-wrap">
            <input
              ref={highRef}
              aria-label="Audio EQ high gain"
              className="inspector-transform-input"
              defaultValue={getAudioEq(clip).highGainDb}
              max="12"
              min="-12"
              step="0.5"
              type="number"
              onBlur={() => commit("high")}
              onKeyDown={onKeyDown}
            />
            <span>dB</span>
          </div>
        </label>
      </div>
    </div>
  );
}

function AudioVolumeAutomationInspector({
  clip,
  localTimeMs,
  durationMs,
  onSetVolume,
  onAddOrUpdateKeyframe,
  onRemoveKeyframe,
  onKeyDown,
}: {
  clip: Clip;
  localTimeMs: number;
  durationMs: number;
  onSetVolume: (volume: number) => void;
  onAddOrUpdateKeyframe: () => void;
  onRemoveKeyframe: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}) {
  const volumeRef = useRef<HTMLInputElement>(null);
  const keyframe = getAudioVolumeKeyframeAtTime(
    clip.audioVolumeKeyframes,
    localTimeMs,
  );

  useEffect(() => {
    if (volumeRef.current) {
      volumeRef.current.value = String(
        Math.round(getAudioVolumeAtTime(clip, localTimeMs) * 100),
      );
    }
  }, [clip, localTimeMs]);

  function commitVolume() {
    const input = volumeRef.current;
    const fallback = Math.round(getAudioVolumeAtTime(clip, localTimeMs) * 100);
    if (!input) return;

    const rawValue = input.value.trim();
    if (!rawValue) {
      input.value = String(fallback);
      return;
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      input.value = String(fallback);
      return;
    }

    const normalized = Math.round(value) / 100;
    onSetVolume(normalized);
  }

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">
        <div className="inspector-section-title-group">
          <span className="inspector-section-title">Audio Volume Automation</span>
          {clip.audioVolumeKeyframes?.length ? (
            <span className="inspector-keyframe-count">
              {clip.audioVolumeKeyframes.length} keyframe{clip.audioVolumeKeyframes.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div className="inspector-section-actions">
          <button
            aria-label={keyframe ? "Update audio volume keyframe" : "Add audio volume keyframe"}
            className="inspector-inline-button"
            onClick={onAddOrUpdateKeyframe}
            type="button"
          >
            {keyframe ? "Update keyframe" : "Add keyframe"}
          </button>
          {keyframe ? (
            <button
              aria-label="Remove audio volume keyframe"
              className="inspector-inline-button"
              onClick={onRemoveKeyframe}
              type="button"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <div className="inspector-keyframe-status">
        <span>
          {keyframe ? "Keyframe active at " : "Automation at "}
          {formatKeyframeTime(Math.min(Math.max(localTimeMs, 0), durationMs))}
        </span>
      </div>
      <label className="inspector-transform-field">
        <span>Volume</span>
        <div className="inspector-transform-input-wrap">
          <input
            ref={volumeRef}
            aria-label="Audio volume automation"
            className="inspector-transform-input"
            max="100"
            min="0"
            step="1"
            type="number"
            defaultValue={Math.round(getAudioVolumeAtTime(clip, localTimeMs) * 100)}
            onBlur={commitVolume}
            onKeyDown={onKeyDown}
          />
          <span>%</span>
        </div>
      </label>
      <small className="inspector-help-text">
        Volume is automated between keyframes and remains independent from track volume.
      </small>
    </div>
  );
}

function AudioCompressorInspector({
  clip,
  onCommit,
  onKeyDown,
}: {
  clip: Clip;
  onCommit: (changes: Partial<AudioCompressor>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}) {
  const enabledRef = useRef<HTMLInputElement>(null);
  const thresholdRef = useRef<HTMLInputElement>(null);
  const ratioRef = useRef<HTMLInputElement>(null);
  const attackRef = useRef<HTMLInputElement>(null);
  const releaseRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const compressor = getAudioCompressor(clip);

    if (enabledRef.current) {
      enabledRef.current.checked = compressor.enabled;
    }
    if (thresholdRef.current) {
      thresholdRef.current.value = String(compressor.thresholdDb);
    }
    if (ratioRef.current) {
      ratioRef.current.value = String(compressor.ratio);
    }
    if (attackRef.current) {
      attackRef.current.value = String(compressor.attackMs);
    }
    if (releaseRef.current) {
      releaseRef.current.value = String(compressor.releaseMs);
    }
  }, [clip]);

  function commit(which: "threshold" | "ratio" | "attack" | "release") {
    const current = getAudioCompressor(clip);
    const rawValues = {
      threshold: thresholdRef.current?.value.trim() ?? "",
      ratio: ratioRef.current?.value.trim() ?? "",
      attack: attackRef.current?.value.trim() ?? "",
      release: releaseRef.current?.value.trim() ?? "",
    };

    if (
      !rawValues.threshold ||
      !rawValues.ratio ||
      !rawValues.attack ||
      !rawValues.release
    ) {
      if (which === "threshold" && thresholdRef.current) {
        thresholdRef.current.value = String(current.thresholdDb);
      }
      if (which === "ratio" && ratioRef.current) {
        ratioRef.current.value = String(current.ratio);
      }
      if (which === "attack" && attackRef.current) {
        attackRef.current.value = String(current.attackMs);
      }
      if (which === "release" && releaseRef.current) {
        releaseRef.current.value = String(current.releaseMs);
      }
      return;
    }

    const values = {
      threshold: Number(rawValues.threshold),
      ratio: Number(rawValues.ratio),
      attack: Number(rawValues.attack),
      release: Number(rawValues.release),
    };

    if (
      !Number.isFinite(values.threshold) ||
      values.threshold < -60 ||
      values.threshold > 0 ||
      !Number.isFinite(values.ratio) ||
      values.ratio < 1 ||
      values.ratio > 20 ||
      !Number.isFinite(values.attack) ||
      values.attack < 0.01 ||
      values.attack > 2000 ||
      !Number.isFinite(values.release) ||
      values.release < 0.01 ||
      values.release > 9000
    ) {
      const refs = {
        threshold: thresholdRef,
        ratio: ratioRef,
        attack: attackRef,
        release: releaseRef,
      };
      refs[which].current?.focus();
      if (which === "threshold" && thresholdRef.current) {
        thresholdRef.current.value = String(current.thresholdDb);
      }
      if (which === "ratio" && ratioRef.current) {
        ratioRef.current.value = String(current.ratio);
      }
      if (which === "attack" && attackRef.current) {
        attackRef.current.value = String(current.attackMs);
      }
      if (which === "release" && releaseRef.current) {
        releaseRef.current.value = String(current.releaseMs);
      }
      return;
    }

    onCommit({
      thresholdDb: Math.round(values.threshold * 10) / 10,
      ratio: Math.round(values.ratio * 10) / 10,
      attackMs: Math.round(values.attack * 100) / 100,
      releaseMs: Math.round(values.release * 100) / 100,
    });
  }

  function toggleEnabled() {
    onCommit({
      enabled: enabledRef.current?.checked ?? false,
    });
  }

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">
        <span className="inspector-section-title">Audio Compressor</span>
        <span className="inspector-keyframe-count">Dynamics</span>
      </div>
      <label className="inspector-toggle-field">
        <input
          ref={enabledRef}
          aria-label="Enable audio compressor"
          defaultChecked={getAudioCompressor(clip).enabled}
          type="checkbox"
          onChange={toggleEnabled}
        />
        <span>Enable compressor</span>
      </label>
      <div className="inspector-transform-input-grid">
        <label className="inspector-transform-field">
          <span>Threshold</span>
          <div className="inspector-transform-input-wrap">
            <input
              ref={thresholdRef}
              aria-label="Audio compressor threshold"
              className="inspector-transform-input"
              defaultValue={getAudioCompressor(clip).thresholdDb}
              max="0"
              min="-60"
              step="0.5"
              type="number"
              onBlur={() => commit("threshold")}
              onKeyDown={onKeyDown}
            />
            <span>dB</span>
          </div>
        </label>
        <label className="inspector-transform-field">
          <span>Ratio</span>
          <div className="inspector-transform-input-wrap">
            <input
              ref={ratioRef}
              aria-label="Audio compressor ratio"
              className="inspector-transform-input"
              defaultValue={getAudioCompressor(clip).ratio}
              max="20"
              min="1"
              step="0.5"
              type="number"
              onBlur={() => commit("ratio")}
              onKeyDown={onKeyDown}
            />
            <span>:1</span>
          </div>
        </label>
        <label className="inspector-transform-field">
          <span>Attack</span>
          <div className="inspector-transform-input-wrap">
            <input
              ref={attackRef}
              aria-label="Audio compressor attack"
              className="inspector-transform-input"
              defaultValue={getAudioCompressor(clip).attackMs}
              max="2000"
              min="0.01"
              step="1"
              type="number"
              onBlur={() => commit("attack")}
              onKeyDown={onKeyDown}
            />
            <span>ms</span>
          </div>
        </label>
        <label className="inspector-transform-field">
          <span>Release</span>
          <div className="inspector-transform-input-wrap">
            <input
              ref={releaseRef}
              aria-label="Audio compressor release"
              className="inspector-transform-input"
              defaultValue={getAudioCompressor(clip).releaseMs}
              max="9000"
              min="0.01"
              step="1"
              type="number"
              onBlur={() => commit("release")}
              onKeyDown={onKeyDown}
            />
            <span>ms</span>
          </div>
        </label>
      </div>
    </div>
  );
}

function formatTimecode(durationMs: number, frameRate: number): string {
  const totalMilliseconds = Math.max(0, durationMs);
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const frame = Math.floor((totalMilliseconds % 1000) * frameRate / 1000);

  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0"),
    frame.toString().padStart(2, "0"),
  ].join(":");
}

function getCropInputValue(
  field: CropField,
  crop: ClipCrop,
): string {
  return String(Math.round(crop[field] * 100));
}

function getTransformInputValue(
  field: TransformField,
  transform: ClipTransform,
): string {
  if (field === "opacity") {
    return String(Math.round(transform.opacity * 100));
  }

  return String(transform[field]);
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return "—";
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0");
}

export default App;


function formatKeyframeTime(timeMs: number): string {
  const safeMs = Math.max(0, Math.round(timeMs));
  const totalSeconds = Math.floor(safeMs / 1000);
  const milliseconds = safeMs % 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    minutes.toString().padStart(2, "0") +
    ":" +
    seconds.toString().padStart(2, "0") +
    "." +
    milliseconds.toString().padStart(3, "0")
  );
}
