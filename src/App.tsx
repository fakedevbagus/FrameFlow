import { useState } from "react";
import "./App.css";

type WorkspaceView = "media" | "editor" | "export";

const navigation: Array<{ id: WorkspaceView; label: string }> = [
  { id: "media", label: "Media" },
  { id: "editor", label: "Editor" },
  { id: "export", label: "Export" },
];

function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>("editor");

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
            <button className="icon-button" type="button" aria-label="Import media">
              +
            </button>
          </div>

          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              ⬡
            </div>
            <strong>Belum ada media</strong>
            <span>Import video, audio, atau gambar untuk memulai.</span>
            <button className="secondary-button" type="button">
              Import media
            </button>
          </div>
        </aside>

        <section className="editor-area">
          <div className="editor-toolbar">
            <div>
              <p className="eyebrow">Project</p>
              <h2>Untitled project</h2>
            </div>

            <div className="toolbar-actions">
              <button className="toolbar-button" type="button">
                9:16
              </button>
              <button className="primary-button" type="button">
                Export
              </button>
            </div>
          </div>

          <div className="preview-region">
            <div className="preview-canvas">
              <div className="preview-content">
                <span>Preview</span>
                <small>Tambahkan media ke timeline untuk mulai mengedit.</small>
              </div>
            </div>

            <div className="transport-controls" aria-label="Playback controls">
              <button className="transport-button" type="button" aria-label="Previous frame">
                ◀
              </button>
              <button className="play-button" type="button" aria-label="Play">
                ▶
              </button>
              <button className="transport-button" type="button" aria-label="Next frame">
                ▶
              </button>
              <span className="timecode">00:00:00:00</span>
            </div>
          </div>

          <section className="timeline-region" aria-label="Timeline">
            <div className="timeline-toolbar">
              <span>Timeline</span>
              <div className="timeline-actions">
                <button className="toolbar-button" type="button">
                  −
                </button>
                <span>100%</span>
                <button className="toolbar-button" type="button">
                  +
                </button>
              </div>
            </div>

            <div className="timeline-ruler">
              <span>00:00</span>
              <span>00:05</span>
              <span>00:10</span>
              <span>00:15</span>
              <span>00:20</span>
            </div>

            <div className="track">
              <div className="track-label">
                <strong>V1</strong>
                <span>Video</span>
              </div>
              <div className="track-empty">Drag media ke sini</div>
            </div>

            <div className="track">
              <div className="track-label">
                <strong>A1</strong>
                <span>Audio</span>
              </div>
              <div className="track-empty">Drag audio ke sini</div>
            </div>
          </section>
        </section>

        <aside className="panel inspector-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Properties</p>
              <h2>Inspector</h2>
            </div>
          </div>

          <div className="inspector-empty">
            <strong>Pilih sebuah clip</strong>
            <span>Posisi, ukuran, audio, dan properti lainnya akan muncul di sini.</span>
          </div>

          <div className="project-details">
            <span>Canvas</span>
            <strong>1080 × 1920</strong>
            <span>Frame rate</span>
            <strong>30 fps</strong>
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

export default App;
