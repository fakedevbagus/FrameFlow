import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import type { Project } from "../project/domain";
import {
  getActiveAudioPreviewClips,
  getActiveVisualPreviewClips,
  getClipLocalTimeMs,
  type ActivePreviewClip,
} from "./preview";

interface PreviewProps {
  project: Project;
  currentTimeMs: number;
  isPlaying: boolean;
}

interface PreviewError {
  assetId: string;
  message: string;
}

export function Preview({
  project,
  currentTimeMs,
  isPlaying,
}: PreviewProps) {
  const visualClips = getActiveVisualPreviewClips(project, currentTimeMs);
  const audioClips = getActiveAudioPreviewClips(project, currentTimeMs);
  const [mediaError, setMediaError] = useState<PreviewError | null>(null);
  const hasVisualPreview = visualClips.length > 0;
  const hasAudioPreview = audioClips.length > 0;

  function handleMediaError(assetId: string, message: string) {
    setMediaError({ assetId, message });
  }

  if (!hasVisualPreview && !hasAudioPreview) {
    return (
      <div className="preview-content" data-preview-state="empty">
        <span>Preview</span>
        <small>Tambahkan media ke timeline untuk mulai mengedit.</small>
      </div>
    );
  }

  return (
    <div
      className="preview-stage"
      data-preview-state={hasVisualPreview ? "video" : "audio"}
    >
      {visualClips.map((layer, index) => (
        <PreviewVisualLayer
          key={layer.clip.id}
          layer={layer}
          currentTimeMs={currentTimeMs}
          isPlaying={isPlaying}
          zIndex={index + 1}
          onError={handleMediaError}
        />
      ))}

      {audioClips.map((layer) => (
        <PreviewAudioLayer
          key={layer.clip.id}
          layer={layer}
          currentTimeMs={currentTimeMs}
          isPlaying={isPlaying}
          showControls={!hasVisualPreview}
          onError={handleMediaError}
        />
      ))}

      {!hasVisualPreview && hasAudioPreview ? (
        <div className="preview-audio-header">
          <div className="preview-audio-icon" aria-hidden="true">
            ♪
          </div>
          <span>Audio preview</span>
        </div>
      ) : null}

      {mediaError ? (
        <div className="preview-error-overlay" role="status">
          {mediaError.message}
        </div>
      ) : null}
    </div>
  );
}

interface PreviewLayerProps {
  layer: ActivePreviewClip;
  currentTimeMs: number;
  isPlaying: boolean;
  zIndex?: number;
  showControls?: boolean;
  onError: (assetId: string, message: string) => void;
}

function PreviewVisualLayer({
  layer,
  currentTimeMs,
  isPlaying,
  zIndex = 1,
  onError,
}: PreviewLayerProps) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const localTimeMs = getClipLocalTimeMs(layer.clip, currentTimeMs);
  const mediaUrl = tryConvertFileSrc(layer.asset.sourcePath);

  useEffect(() => {
    const media = mediaRef.current;

    if (!media || layer.asset.mediaType === "image") {
      return;
    }

    try {
      media.currentTime = Math.max(0, localTimeMs / 1000);
    } catch {
      // The media element may not accept seeking until metadata is available.
    }
  }, [layer.asset.id, layer.clip.id]);

  useEffect(() => {
    const media = mediaRef.current;

    if (!media || layer.asset.mediaType === "image") {
      return;
    }

    if (!isPlaying) {
      if (!media.paused) {
        media.pause();
      }
      return;
    }

    void media.play().catch(() => undefined);
  }, [isPlaying, layer.asset.id, layer.clip.id]);

  useEffect(() => {
    if (isPlaying) {
      return;
    }

    const media = mediaRef.current;

    if (!media || layer.asset.mediaType === "image") {
      return;
    }

    try {
      media.currentTime = Math.max(0, localTimeMs / 1000);
    } catch {
      // Some WebView/media implementations reject seeking before metadata is ready.
    }
  }, [isPlaying, layer.asset.id, layer.clip.id, localTimeMs]);

  if (layer.asset.mediaType === "image") {
    return (
      <img
        alt={layer.asset.name}
        className="preview-layer preview-image-layer"
        data-preview-state="image"
        src={mediaUrl ?? ""}
        style={{ zIndex }}
      />
    );
  }

  return (
    <video
      className="preview-layer preview-video-layer"
      data-preview-state="video"
      data-testid="preview-video"
      playsInline
      preload="metadata"
      ref={mediaRef}
      src={mediaUrl ?? ""}
      style={{ zIndex }}
      onError={() =>
        onError(layer.asset.id, "Video could not be loaded.")
      }
    />
  );
}

function PreviewAudioLayer({
  layer,
  currentTimeMs,
  isPlaying,
  showControls = false,
  onError,
}: PreviewLayerProps) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const localTimeMs = getClipLocalTimeMs(layer.clip, currentTimeMs);
  const mediaUrl = tryConvertFileSrc(layer.asset.sourcePath);

  useEffect(() => {
    const media = mediaRef.current;

    if (!media) {
      return;
    }

    try {
      media.currentTime = Math.max(0, localTimeMs / 1000);
    } catch {
      // The media element may not accept seeking until metadata is available.
    }
  }, [layer.asset.id, layer.clip.id]);

  useEffect(() => {
    const media = mediaRef.current;

    if (!media) {
      return;
    }

    if (!isPlaying) {
      if (!media.paused) {
        media.pause();
      }
      return;
    }

    void media.play().catch(() => undefined);
  }, [isPlaying, layer.asset.id, layer.clip.id]);

  useEffect(() => {
    if (isPlaying) {
      return;
    }

    const media = mediaRef.current;

    if (!media) {
      return;
    }

    try {
      media.currentTime = Math.max(0, localTimeMs / 1000);
    } catch {
      // Some WebView/media implementations reject seeking before metadata is ready.
    }
  }, [isPlaying, layer.asset.id, layer.clip.id, localTimeMs]);

  return (
    <audio
      aria-label={showControls ? "Audio preview" : layer.asset.name + " audio layer"}
      className={showControls ? "preview-audio-layer preview-audio-layer-controls" : "preview-audio-layer"}
      controls={showControls}
      data-testid="preview-audio"
      ref={mediaRef}
      src={mediaUrl ?? ""}
      onError={() => onError(layer.asset.id, "Audio could not be loaded.")}
    />
  );
}

function tryConvertFileSrc(path: string): string | null {
  try {
    return convertFileSrc(path);
  } catch {
    return null;
  }
}
