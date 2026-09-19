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

export function Preview({
  project,
  currentTimeMs,
  isPlaying,
}: PreviewProps) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const activePreview = findActivePreviewClip(project, currentTimeMs);
  const asset = activePreview?.asset ?? null;
  const mediaUrl = asset ? convertFileSrc(asset.sourcePath) : null;
  const localTimeMs = activePreview
    ? getClipLocalTimeMs(activePreview.clip, currentTimeMs)
    : 0;

  useEffect(() => {
    setMediaError(null);
  }, [asset?.id]);

  useEffect(() => {
    const media = mediaRef.current;

    if (!media || !activePreview || !asset || asset.mediaType === "image") {
      return;
    }

    if (isPlaying) {
      const targetSeconds = localTimeMs / 1000;

      try {
        if (Number.isFinite(targetSeconds)) {
          media.currentTime = Math.max(0, targetSeconds);
        }
      } catch {
        setMediaError("Preview media could not be seeked.");
      }

      try {
        const playResult = media.play();

        if (playResult) {
          void playResult.catch(() => {
            setMediaError(
              "Preview playback could not start in the current WebView.",
            );
          });
        }
      } catch {
        setMediaError(
          "Preview playback could not start in the current WebView.",
        );
      }
      return;
    }

    if (!media.paused) {
      media.pause();
    }
  }, [activePreview?.asset.id, activePreview?.clip.id, asset, isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      return;
    }

    const media = mediaRef.current;

    if (!media || !activePreview || !asset || asset.mediaType === "image") {
      return;
    }

    try {
      media.currentTime = Math.max(0, localTimeMs / 1000);
    } catch {
      setMediaError("Preview media could not be seeked.");
    }
  }, [activePreview?.asset.id, activePreview?.clip.id, asset, isPlaying, localTimeMs]);

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
          className="preview-audio"
          controls
          ref={mediaRef}
          src={mediaUrl ?? ""}
          onError={() => setMediaError("Audio could not be loaded.")}
        />
        {mediaError ? (
          <small className="preview-error" role="status">
            {mediaError}
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
        ref={mediaRef}
        src={mediaUrl ?? ""}
        onError={() => setMediaError("Video could not be loaded.")}
      />
      {mediaError ? (
        <div className="preview-error-overlay" role="status">
          {mediaError}
        </div>
      ) : null}
    </>
  );
}
