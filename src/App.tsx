import { useEffect, useState } from "react";
import type { MediaAsset } from "./features/project/domain";
import { importMediaFiles } from "./features/media/import";
import { loadWorkspaceProject, saveWorkspaceProject } from "./features/project/workspace";
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
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const assets = project.assets;

  useEffect(() => {
    saveWorkspaceProject(project);
  }, [project]);

  async function handleImport() {
    setImportError(null);
    setIsImporting(true);

    try {
      const importedAssets = await importMediaFiles();

      setProject((currentProject) => {
        const existingPaths = new Set(currentProject.assets.map((asset) => asset.sourcePath));
        const newAssets = importedAssets.filter((asset) => !existingPaths.has(asset.sourcePath));

        return {
          ...currentProject,
          assets: [...currentProject.assets, ...newAssets],
          updatedAt: new Date().toISOString(),
        };
      });
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : typeof error === "string" ? error : "Media could not be imported.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">F</span>
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
            <button aria-label="Import media" className="icon-button" disabled={isImporting} onClick={handleImport} type="button">+</button>
          </div>

          {assets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">⬡</div>
              <strong>Belum ada media</strong>
              <span>Import video, audio, atau gambar untuk memulai.</span>
              <button className="secondary-button" disabled={isImporting} onClick={handleImport} type="button">
                {isImporting ? "Mengimpor…" : "Import media"}
              </button>
              {importError ? <p className="import-error" role="alert">{importError}</p> : null}
            </div>
          ) : (
            <div className="media-library">
              <button className="secondary-button import-more-button" disabled={isImporting} onClick={handleImport} type="button">
                {isImporting ? "Mengimpor…" : "Import media"}
              </button>
              {importError ? <p className="import-error" role="alert">{importError}</p> : null}
              <ul className="media-list">
                {assets.map((asset) => (
                  <li className="media-item" key={asset.id}>
                    <span className={`media-kind media-kind-${asset.mediaType}`}>{asset.mediaType.slice(0, 1).toUpperCase()}</span>
                    <span className="media-item-details">
                      <strong>{asset.name}</strong>
                      <small>{formatAssetDetail(asset)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <section className="editor-area">
          <div className="editor-toolbar">
            <div><p className="eyebrow">Project</p><h2>Untitled project</h2></div>
            <div className="toolbar-actions"><button className="toolbar-button" type="button">9:16</button><button className="primary-button" type="button">Export</button></div>
          </div>
          <div className="preview-region">
            <div className="preview-canvas"><div className="preview-content"><span>Preview</span><small>Tambahkan media ke timeline untuk mulai mengedit.</small></div></div>
            <div className="transport-controls" aria-label="Playback controls"><button aria-label="Previous frame" className="transport-button" type="button">◀</button><button aria-label="Play" className="play-button" type="button">▶</button><button aria-label="Next frame" className="transport-button" type="button">▶</button><span className="timecode">00:00:00:00</span></div>
          </div>
          <section className="timeline-region" aria-label="Timeline">
            <div className="timeline-toolbar"><span>Timeline</span><div className="timeline-actions"><button className="toolbar-button" type="button">−</button><span>100%</span><button className="toolbar-button" type="button">+</button></div></div>
            <div className="timeline-ruler"><span>00:00</span><span>00:05</span><span>00:10</span><span>00:15</span><span>00:20</span></div>
            <div className="track"><div className="track-label"><strong>V1</strong><span>Video</span></div><div className="track-empty">Drag media ke sini</div></div>
            <div className="track"><div className="track-label"><strong>A1</strong><span>Audio</span></div><div className="track-empty">Drag audio ke sini</div></div>
          </section>
        </section>

        <aside className="panel inspector-panel">
          <div className="panel-heading"><div><p className="eyebrow">Properties</p><h2>Inspector</h2></div></div>
          <div className="inspector-empty"><strong>Pilih sebuah clip</strong><span>Posisi, ukuran, audio, dan properti lainnya akan muncul di sini.</span></div>
          <div className="project-details"><span>Canvas</span><strong>1080 × 1920</strong><span>Frame rate</span><strong>30 fps</strong></div>
        </aside>
      </section>
      <footer className="statusbar"><span>FrameFlow alpha</span><span>Offline-first video editor</span></footer>
    </main>
  );
}

function formatAssetDetail(asset: MediaAsset): string {
  if (asset.durationMs === null) {
    return "Image";
  }

  const totalSeconds = Math.floor(asset.durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${asset.mediaType} · ${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default App;
