import type { MediaAsset } from "../project/domain";

interface MediaBinProps {
  assets: MediaAsset[];
  isImporting: boolean;
  importError: string | null;
  onImport: () => void;
  onAddAsset: (assetId: string) => void;
}

export function MediaBin({ assets, isImporting, importError, onImport, onAddAsset }: MediaBinProps) {
  return (
    <>
      {assets.length === 0 ? (
        <div className="empty-state">
          <strong>Belum ada media</strong>
          <span>Import video, audio, atau gambar untuk memulai.</span>
          <button className="secondary-button" disabled={isImporting} onClick={onImport} type="button">
            {isImporting ? "Mengimpor…" : "Import media"}
          </button>
          {importError ? <p className="import-error" role="alert">{importError}</p> : null}
        </div>
      ) : (
        <div className="media-library">
          <button className="secondary-button" disabled={isImporting} onClick={onImport} type="button">
            {isImporting ? "Mengimpor…" : "Import media"}
          </button>
          {importError ? <p className="import-error" role="alert">{importError}</p> : null}
          <p className="media-hint">
            Klik + untuk timeline utama atau drag media ke track tertentu.
          </p>
          <ul className="media-list">
            {assets.map((asset) => (
              <li key={asset.id}>
                <button
                  aria-label={`Add ${asset.name} to timeline`}
                  className="media-item"
                  draggable
                  onClick={() => onAddAsset(asset.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(
                      "application/x-frameflow-asset-id",
                      asset.id,
                    );
                  }}
                  type="button"
                >
                  <span className={`media-kind media-kind-${asset.mediaType}`}>
                    {asset.mediaType.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="media-item-details">
                    <strong>{asset.name}</strong>
                    <small>{formatAssetDetail(asset)}</small>
                  </span>
                  <span aria-hidden="true" className="media-item-action">+</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function formatAssetDetail(asset: MediaAsset): string {
  if (asset.durationMs === null) return "Image";
  return `${asset.mediaType} · ${formatDurationMs(asset.durationMs)}`;
}

function formatDurationMs(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
