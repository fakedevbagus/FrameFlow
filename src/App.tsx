import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { MediaBin } from "./features/media/MediaBin";
import type { ClipTransform } from "./features/project/domain";
import {
  addAssetToTimeline,
  addAssetToTrack,
  addTrack,
  moveClipOnTimeline,
  removeClipFromTimeline,
  removeTrack,
  addTransformKeyframe,
  resetClipTransform,
  removeTransformKeyframe,
  toggleTrackMute,
  updateClipTransformAtTime,
  splitClipAtTime,
  trimClipEnd,
  trimClipStart,
} from "./features/timeline/commands";
import { Timeline } from "./features/timeline/Timeline";
import { Preview } from "./features/preview/Preview";
import { DEFAULT_TIMELINE_ZOOM } from "./features/timeline/constants";
import { getTimelineDurationMs } from "./features/timeline/metrics";
import {
  getClipTransformAtTime,
  getTransformKeyframeAtTime,
  normalizeClipTransform,
} from "./features/transform/transform";
import { stepFrame, stepPlaybackTime } from "./features/playback/playback";
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
import "./App.css";

type WorkspaceView = "media" | "editor" | "export";
type TransformField = "x" | "y" | "scale" | "rotation" | "opacity";

const navigation: Array<{ id: WorkspaceView; label: string }> = [
  { id: "media", label: "Media" },
  { id: "editor", label: "Editor" },
  { id: "export", label: "Export" },
];

function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>("editor");
  const [history, setHistory] = useState(() =>
    createHistoryState(loadWorkspaceProject()),
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(DEFAULT_TIMELINE_ZOOM);
  const playbackTimeRef = useRef(0);
  const timelineDurationRef = useRef(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const project = history.present;
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
  const timelineDurationMs = getTimelineDurationMs(project);
  const displayedCurrentTimeMs = Math.min(
    Math.max(currentTimeMs, 0),
    timelineDurationMs,
  );

  useEffect(() => {
    saveWorkspaceProject(project);
  }, [project]);

  const setPlaybackTime = useCallback((timeMs: number) => {
    const safeTimeMs = Math.min(
      Math.max(timeMs, 0),
      timelineDurationRef.current,
    );
    playbackTimeRef.current = safeTimeMs;
    setCurrentTimeMs(safeTimeMs);
  }, []);

  useEffect(() => {
    timelineDurationRef.current = timelineDurationMs;
  }, [timelineDurationMs]);

  const handleStepFrame = useCallback((direction: -1 | 1) => {
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

      setPlaybackTime(next.timeMs);

      if (next.reachedEnd) {
        setIsPlaying(false);
        return;
      }

      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isPlaying, setPlaybackTime, timelineDurationMs]);

  function handleCurrentTimeChange(timeMs: number) {
    setIsPlaying(false);
    setPlaybackTime(timeMs);
  }

  async function handleOpenProject() {
    try {
      const result = await openProjectFromDialog();
      if (result) {
        setHistory(resetHistory(result.project));
        setSelectedClipId(null);
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

  const previewCanvasRef = useRef<HTMLDivElement | null>(null);

  const getPreviewMediaElements = useCallback((): HTMLMediaElement[] => {
    const container = previewCanvasRef.current;

    if (!container) {
      return [];
    }

    return Array.from(
      container.querySelectorAll<HTMLVideoElement | HTMLAudioElement>("video, audio"),
    ).filter((media) => Boolean(media.getAttribute("src"))) as HTMLMediaElement[];
  }, []);

  const handleTogglePlayback = useCallback(async () => {
    const mediaElements = getPreviewMediaElements();

    if (isPlaying) {
      for (const media of mediaElements) {
        media.pause();
      }
      setIsPlaying(false);
      return;
    }

    if (playbackTimeRef.current >= timelineDurationRef.current) {
      setPlaybackTime(0);
    }

    if (mediaElements.length === 0) {
      setIsPlaying(true);
      return;
    }

    try {
      // Call play() synchronously from the user-triggered handler so WebKit can
      // associate playback with the user's activation gesture.
      await Promise.all(mediaElements.map((media) => media.play()));
      setIsPlaying(true);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
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
    }
  }, [getPreviewMediaElements, isPlaying, setPlaybackTime]);

  function handleToggleTrackMute(trackId: string) {
    applyProjectChange(
      (currentProject) => toggleTrackMute(currentProject, trackId),
      "Track mute updated.",
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
              onClick={() => setActiveView(item.id)}
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
              <button className="toolbar-button" type="button">
                9:16
              </button>
              <button className="primary-button" type="button">
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
            <div className="preview-canvas" ref={previewCanvasRef}>
              <Preview
                project={project}
                currentTimeMs={displayedCurrentTimeMs}
                isPlaying={isPlaying}
                selectedClipId={selectedClipId}
                onSelectClip={handleSelectClip}
                onTransformCommit={handleCanvasTransformCommit}
              />
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
            onAddAssetToTrack={handleAddAssetToTrack}
            onAddTrack={handleAddTrack}
            onRemoveTrack={handleRemoveTrack}
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
          </div>

          {selectedClipContext ? (
            <div className="inspector-content">
              <div className="inspector-summary">
                <span className="inspector-type">{selectedClipContext.asset?.mediaType ?? "media"}</span>
                <strong>{selectedClipContext.asset?.name ?? "Missing media"}</strong>
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
