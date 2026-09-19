import { useEffect, useState } from "react";
import { MediaBin } from "./features/media/MediaBin";
import { addAssetToTimeline, removeClipFromTimeline } from "./features/timeline/commands";
import { Timeline } from "./features/timeline/Timeline";
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
  const [project, setProject] = useState(loadWorkspaceProject);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);
  const assets = project.assets;
  const selectedClipContext = findClipContext(project, selectedClipId);

  useEffect(() => {
    saveWorkspaceProject(project);
  }, [project]);

  async function handleOpenProject() {
    try {
      const result = await openProjectFromDialog();
      if (result) {
        setProject(result.project);
        setSelectedClipId(null);
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
    setProject((currentProject) => {
      try {
        setProjectNotice(null);
        return addAssetToTimeline(currentProject, assetId);
      } catch (error) {
        setProjectNotice(
          error instanceof Error
            ? error.message
            : "Media could not be added to the timeline.",
        );
        return currentProject;
      }
    });
  }

  function handleSelectClip(clipId: string) {
    setSelectedClipId(clipId);
    setProjectNotice(null);
  }

  function handleDeleteSelectedClip() {
    if (!selectedClipId) {
      return;
    }

    setProject((currentProject) => {
      try {
        const nextProject = removeClipFromTimeline(currentProject, selectedClipId);
        setSelectedClipId(null);
        setProjectNotice("Clip deleted.");
        return nextProject;
      } catch (error) {
        setProjectNotice(
          error instanceof Error ? error.message : "Clip could not be deleted.",
        );
        return currentProject;
      }
    });
  }

  async function handleImport() {
    setImportError(null);
    setIsImporting(true);

    try {
      const importedAssets = await importMediaFiles();

      setProject((currentProject) => {
        const existingPaths = new Set(
          currentProject.assets.map((asset) => asset.sourcePath),
        );
        const newAssets = importedAssets.filter(
          (asset) => !existingPaths.has(asset.sourcePath),
        );

        return {
          ...currentProject,
          assets: [...currentProject.assets, ...newAssets],
          updatedAt: new Date().toISOString(),
        };
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
              <span className="timecode">00:00:00:00</span>
            </div>
          </div>

          <Timeline
            project={project}
            selectedClipId={selectedClipId}
            onSelectClip={handleSelectClip}
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
