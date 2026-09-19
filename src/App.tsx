import { useCallback, useEffect, useState } from "react";
import { MediaBin } from "./features/media/MediaBin";
import {
  addAssetToTimeline,
  moveClipOnTimeline,
  removeClipFromTimeline,
  splitClipAtTime,
  trimClipEnd,
  trimClipStart,
} from "./features/timeline/commands";
import { Timeline } from "./features/timeline/Timeline";
import { DEFAULT_TIMELINE_ZOOM } from "./features/timeline/constants";
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
  const [timelineZoom, setTimelineZoom] = useState(DEFAULT_TIMELINE_ZOOM);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const project = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const assets = project.assets;
  const selectedClipContext = findClipContext(project, selectedClipId);

  useEffect(() => {
    saveWorkspaceProject(project);
  }, [project]);

  async function handleOpenProject() {
    try {
      const result = await openProjectFromDialog();
      if (result) {
        setHistory(resetHistory(result.project));
        setSelectedClipId(null);
        setCurrentTimeMs(0);
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
            <div className="preview-canvas">
              <div className="preview-content">
                <span>Preview</span>
                <small>Tambahkan media ke timeline untuk mulai mengedit.</small>
              </div>
            </div>
            <div className="transport-controls" aria-label="Playback controls">
              <button aria-label="Previous frame" className="transport-button" type="button">
                ◀
              </button>
              <button aria-label="Play" className="play-button" type="button">
                ▶
              </button>
              <button aria-label="Next frame" className="transport-button" type="button">
                ▶
              </button>
              <span className="timecode">
                {formatTimecode(currentTimeMs, project.canvas.frameRate)}
              </span>
            </div>
          </div>

          <Timeline
            project={project}
            currentTimeMs={currentTimeMs}
            onCurrentTimeChange={setCurrentTimeMs}
            selectedClipId={selectedClipId}
            onSelectClip={handleSelectClip}
            onMoveClip={handleDirectMoveClip}
            onTrimClipStart={handleDirectTrimClipStart}
            onTrimClipEnd={handleDirectTrimClipEnd}
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
