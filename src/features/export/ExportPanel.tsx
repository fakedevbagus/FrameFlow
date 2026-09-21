import { useMemo, useState } from "react";
import { chooseExportOutputPath } from "./export-dialog";
import type { Project } from "../project/domain";
import {
  createDefaultExportSettings,
  getExportDimensions,
  normalizeExportSettings,
  sanitizeExportFileName,
  type ExportQuality,
} from "./export";

interface ExportPanelProps {
  project: Project;
  onClose: () => void;
}

export function ExportPanel({ project, onClose }: ExportPanelProps) {
  const [quality, setQuality] = useState<ExportQuality>("source");
  const [fileName, setFileName] = useState(
    () => createDefaultExportSettings(project).fileName,
  );
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [isChoosingOutput, setIsChoosingOutput] = useState(false);

  const dimensions = useMemo(
    () => getExportDimensions(quality, project),
    [project, quality],
  );

  const settings = useMemo(
    () =>
      normalizeExportSettings(
        {
          ...createDefaultExportSettings(project),
          quality,
          width: dimensions.width,
          height: dimensions.height,
          fileName,
        },
        project,
      ),
    [dimensions, fileName, project, quality],
  );

  return (
    <div
      aria-label="Export settings"
      className="export-panel"
      role="dialog"
    >
      <div className="export-panel-header">
        <div>
          <p className="eyebrow">Output</p>
          <h2>Export video</h2>
        </div>
        <button
          aria-label="Close export settings"
          className="toolbar-button"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>

      <div className="export-panel-content">
        <div className="export-setting-group">
          <span className="export-setting-label">Format</span>
          <strong>MP4 (H.264)</strong>
          <small>Planned renderer target for the first export pipeline.</small>
        </div>

        <label className="export-setting-group">
          <span className="export-setting-label">Quality</span>
          <select
            aria-label="Export quality"
            value={quality}
            onChange={(event) => setQuality(event.currentTarget.value as ExportQuality)}
          >
            <option value="source">
              Source — {project.canvas.width} × {project.canvas.height}
            </option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
          </select>
        </label>

        <div className="export-setting-grid">
          <div className="export-setting-group">
            <span className="export-setting-label">Resolution</span>
            <strong>
              {settings.width} × {settings.height}
            </strong>
          </div>
          <div className="export-setting-group">
            <span className="export-setting-label">Frame rate</span>
            <strong>{settings.frameRate} fps</strong>
          </div>
        </div>

        <label className="export-setting-group">
          <span className="export-setting-label">File name</span>
          <input
            aria-label="Export file name"
            value={fileName}
            onChange={(event) => setFileName(event.currentTarget.value)}
            onBlur={(event) =>
              setFileName(sanitizeExportFileName(event.currentTarget.value))
            }
          />
          <small>Output path selection and rendering are introduced in the export pipeline milestone.</small>
        </label>

        <div className="export-destination">
          <div>
            <span className="export-setting-label">Output destination</span>
            <strong>
              {outputPath ?? "No output file selected"}
            </strong>
          </div>
          <button
            aria-label="Choose export destination"
            className="toolbar-button"
            disabled={isChoosingOutput}
            onClick={() => {
              setIsChoosingOutput(true);
              void chooseExportOutputPath(settings.fileName)
                .then((path) => {
                  if (path) {
                    setOutputPath(path);
                  }
                })
                .finally(() => setIsChoosingOutput(false));
            }}
            type="button"
          >
            {isChoosingOutput ? "Choosing…" : "Choose file"}
          </button>
        </div>

        <div className="export-panel-summary">
          <span>Project</span>
          <strong>{project.name}</strong>
          <span>Canvas</span>
          <strong>
            {project.canvas.width} × {project.canvas.height} @ {project.canvas.frameRate} fps
          </strong>
          <span>Output</span>
          <strong>
            {settings.fileName} · {settings.width} × {settings.height} · {settings.frameRate} fps
          </strong>
        </div>

        <button
          aria-disabled="true"
          className="primary-button"
          disabled
          type="button"
        >
          {outputPath
            ? "Export renderer not connected yet"
            : "Choose an output file first"} 
        </button>
      </div>
    </div>
  );
}
