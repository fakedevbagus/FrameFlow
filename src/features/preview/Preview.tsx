import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import type { Project } from "../project/domain";
import {
  findActivePreviewClip,
  getClipLocalTimeMs,
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
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [mediaError, setMediaError] = useState<PreviewError | null>(null);
  const activePreview = findActivePreviewClip(project, currentTimeMs);
  const asset = activePreview?.asset ?? null;
  const activeAssetId = activePreview?.asset.id ?? null;
  const mediaUrl = asset ? tryConvertFileSrc(asset.sourcePath) : null;
  const localTimeMs = activePreview
    ? getClipLocalTimeMs(activePreview.clip, currentTimeMs)
    : 0;
  const visibleMediaError =
    asset && mediaError?.assetId === asset.id ? mediaError.message : null;

  function setMediaErrorForAsset(message: string) {
    if (asset) {
      setMediaError({ assetId: asset.id, message });
    }
  }

  useEffect(() => {
    const media = mediaRef.current;

    if (!media || !activeAssetId || !asset || asset.mediaType === "image") {
      return;
    }

    if (isPlaying) {
      try {
        const playResult = media.play();

        if (playResult) {
          void playResult.catch(() => {
            setMediaError({
              assetId: activeAssetId,
              message:
                "Preview playback could not start in the current WebView.",
            });
          });
        }
      } catch {
        setMediaError({
          assetId: activeAssetId,
          message: "Preview playback could not start in the current WebView.",
        });
      }
      return;
    }

    if (!media.paused) {
      media.pause();
    }
  }, [activeAssetId, asset?.mediaType, isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      return;
    }

    const media = mediaRef.current;

    if (!media || !activeAssetId || !asset || asset.mediaType === "image") {
      return;
    }

    try {
      media.currentTime = Math.max(0, localTimeMs / 1000);
    } catch {
      // Some WebView/media implementations reject seeking before metadata is ready.
      // Native media error events provide the user-facing failure state.
    }
  }, [activeAssetId, asset?.mediaType, isPlaying, localTimeMs]);

  if (!activePreview || !asset) {
    return (
      <div className="preview-content" data-preview-state="empty">
        <span>Preview</span>
        <small>Tambahkan media ke timeline untuk mulai mengedit.</small>
      </div>
    );
  }

  if (!mediaUrl && asset.mediaType !== "image") {
    return (
      <div className="preview-content" data-preview-state="error">
        <span>Preview unavailable</span>
        <small>Lokasi media tidak dapat dipetakan ke WebView.</small>
      </div>
    );
  }

  if (asset.mediaType === "image") {
    return (
      <img
        alt={asset.name}
        className="preview-media"
        data-preview-state="image"
        src={mediaUrl ?? ""}
      />
    );
  }

  if (asset.mediaType === "audio") {
    return (
      <div className="preview-audio-container" data-preview-state="audio">
        <div className="preview-audio-icon" aria-hidden="true">
          ♪
        </div>
        <strong>{asset.name}</strong>
        <small>Audio preview</small>
        <audio
          aria-label="Audio preview"
          className="preview-audio"
          controls
          data-testid="preview-audio"
          ref={handleMediaRef}
          src={mediaUrl ?? ""}
          onError={() => setMediaErrorForAsset("Audio could not be loaded.")}
        />
        {visibleMediaError ? (
          <small className="preview-error" role="status">
            {visibleMediaError}
          </small>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <video
        className="preview-media"
        data-preview-state="video"
        data-testid="preview-video"
        playsInline
        preload="metadata"
        ref={handleMediaRef}
        src={mediaUrl ?? ""}
        onError={() => setMediaErrorForAsset("Video could not be loaded.")}
      />
      {visibleMediaError ? (
        <div className="preview-error-overlay" role="status">
          {visibleMediaError}
        </div>
      ) : null}
    </>
  );
}

function handleMediaRef(element: HTMLMediaElement | null) {
  mediaRef.current = element;
}

function tryConvertFileSrc(path: string): string | null {
  try {
    return convertFileSrc(path);
  } catch {
    return null;
  }
}
