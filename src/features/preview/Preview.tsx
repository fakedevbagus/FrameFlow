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
          <div className="preview-audio-header-copy">
            <span>Audio preview</span>
            <small>{audioClips.map((clip) => clip.asset.name).join(", ")}</small>
          </div>
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
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const localTimeMs = getClipLocalTimeMs(layer.clip, currentTimeMs);
  const mediaUrl = tryConvertFileSrc(layer.asset.sourcePath);

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
  }, [
    currentTimeMs,
    isPlaying,
    localTimeMs,
  ]);

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

    void Promise.resolve(media.play()).catch(() => undefined);
  }, [isPlaying, layer.asset.id, layer.clip.id]);

  function handleLoadedMetadata() {
    const media = mediaRef.current;

    if (!media) {
      return;
    }

    try {
      media.currentTime = Math.max(0, localTimeMs / 1000);
    } catch {
      // Metadata can still be settling in some WebView implementations.
    }
  }

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
      preload="auto"
      ref={mediaRef}
      src={mediaUrl ?? ""}
      style={{ zIndex }}
      onLoadedMetadata={handleLoadedMetadata}
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
  const mediaRef = useRef<HTMLAudioElement | null>(null);
  const localTimeMs = getClipLocalTimeMs(layer.clip, currentTimeMs);
  const mediaUrl = tryConvertFileSrc(layer.asset.sourcePath);

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
  }, [currentTimeMs, isPlaying, localTimeMs]);

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

    void Promise.resolve(media.play()).catch(() => undefined);
  }, [isPlaying, layer.asset.id, layer.clip.id]);

  function handleLoadedMetadata() {
    const media = mediaRef.current;

    if (!media) {
      return;
    }

    try {
      media.currentTime = Math.max(0, localTimeMs / 1000);
    } catch {
      // Metadata can still be settling in some WebView implementations.
    }
  }

  return (
    <audio
      aria-label={
        showControls
          ? "Audio preview"
          : layer.asset.name + " audio layer"
      }
      className={
        showControls
          ? "preview-audio-layer preview-audio-layer-controls"
          : "preview-audio-layer"
      }
      controls={showControls}
      data-testid="preview-audio"
      preload="auto"
      ref={mediaRef}
      src={mediaUrl ?? ""}
      onLoadedMetadata={handleLoadedMetadata}
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
