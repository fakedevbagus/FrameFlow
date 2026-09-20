import { convertFileSrc } from "@tauri-apps/api/core";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import type { ClipTransform, Project } from "../project/domain";
import { getClipTransform, normalizeClipTransform } from "../transform/transform";
import {
  getContainedContentBounds,
  getContainedContentPercentageBounds,
  transformFromPointer,
  type CanvasManipulationMode,
  type ContentBounds,
} from "./canvasManipulation";
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
  selectedClipId?: string | null;
  onSelectClip?: (clipId: string) => void;
  onTransformCommit?: (clipId: string, transform: ClipTransform) => void;
}

interface PreviewError {
  assetId: string;
  message: string;
}

export function Preview({
  project,
  currentTimeMs,
  isPlaying,
  selectedClipId = null,
  onSelectClip,
  onTransformCommit,
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
      data-testid="preview-stage"
    >
      {visualClips.map((layer, index) => (
        <PreviewVisualLayer
          key={layer.clip.id}
          layer={layer}
          currentTimeMs={currentTimeMs}
          isPlaying={isPlaying}
          zIndex={index + 1}
          canvasWidth={project.canvas.width}
          canvasHeight={project.canvas.height}
          isSelected={selectedClipId === layer.clip.id}
          onSelectClip={onSelectClip}
          onTransformCommit={onTransformCommit}
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

interface PreviewVisualLayerProps extends PreviewLayerProps {
  canvasWidth: number;
  canvasHeight: number;
  isSelected: boolean;
  onSelectClip?: (clipId: string) => void;
  onTransformCommit?: (clipId: string, transform: ClipTransform) => void;
}

interface CanvasGesture {
  mode: CanvasManipulationMode;
  pointerId: number;
  startPointer: { x: number; y: number };
  baseTransform: ClipTransform;
  transform: ClipTransform;
  manipulationBounds: ContentBounds;
  hasMoved: boolean;
}

function PreviewVisualLayer({
  layer,
  currentTimeMs,
  isPlaying,
  zIndex = 1,
  canvasWidth,
  canvasHeight,
  isSelected,
  onSelectClip,
  onTransformCommit,
  onError,
}: PreviewVisualLayerProps) {
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const interactionRef = useRef<HTMLDivElement | null>(null);
  const [gesture, setGesture] = useState<CanvasGesture | null>(null);
  const [mediaSize, setMediaSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const localTimeMs = getClipLocalTimeMs(layer.clip, currentTimeMs);
  const mediaUrl = tryConvertFileSrc(layer.asset.sourcePath);
  const baseTransform = getClipTransform(layer.clip.transform);
  const activeTransform = gesture?.transform ?? baseTransform;
  const mediaWidth = mediaSize?.width ?? 0;
  const mediaHeight = mediaSize?.height ?? 0;
  const contentBoundsPercent = getContainedContentPercentageBounds(
    canvasWidth,
    canvasHeight,
    mediaWidth,
    mediaHeight,
  );
  const translateXPercent =
    contentBoundsPercent.width > 0
      ? (activeTransform.x * 100) / contentBoundsPercent.width
      : activeTransform.x;
  const translateYPercent =
    contentBoundsPercent.height > 0
      ? (activeTransform.y * 100) / contentBoundsPercent.height
      : activeTransform.y;
  const layerStyle = {
    zIndex,
    transform: `translate(${translateXPercent}%, ${translateYPercent}%) scale(${activeTransform.scale}) rotate(${activeTransform.rotation}deg)`,
    opacity: activeTransform.opacity,
  };
  const contentLayerStyle = {
    position: "absolute" as const,
    left: `${contentBoundsPercent.left}%`,
    top: `${contentBoundsPercent.top}%`,
    width: `${contentBoundsPercent.width}%`,
    height: `${contentBoundsPercent.height}%`,
    transformOrigin: "center center",
  };

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

    setMediaSize({
      width: media.videoWidth,
      height: media.videoHeight,
    });

    try {
      media.currentTime = Math.max(0, localTimeMs / 1000);
    } catch {
      // Metadata can still be settling in some WebView implementations.
    }
  }

  function handleImageLoad() {
    const image = imageRef.current;

    if (!image) {
      return;
    }

    setMediaSize({
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
  }

  function getInteractionContentBounds(
    interactionBounds: DOMRect,
  ): ContentBounds {
    const measured = getContainedContentBounds(
      {
        width: interactionBounds.width,
        height: interactionBounds.height,
      },
      mediaSize?.width ?? interactionBounds.width,
      mediaSize?.height ?? interactionBounds.height,
    );

    return {
      left: interactionBounds.left + measured.left,
      top: interactionBounds.top + measured.top,
      width: measured.width,
      height: measured.height,
    };
  }

  function beginGesture(
    mode: CanvasManipulationMode,
    event: PointerEvent<HTMLDivElement | HTMLButtonElement>,
  ) {
    if (event.button !== 0) {
      return;
    }

    onSelectClip?.(layer.clip.id);

    if (isPlaying || !interactionRef.current) {
      return;
    }

    const bounds = interactionRef.current.getBoundingClientRect();

    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const contentBounds = getInteractionContentBounds(bounds);

    event.preventDefault();
    event.stopPropagation();

    try {
      interactionRef.current.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is not implemented in every runtime.
    }

    setGesture({
      mode,
      pointerId: event.pointerId,
      startPointer: {
        x: event.clientX,
        y: event.clientY,
      },
      baseTransform,
      transform: baseTransform,
      manipulationBounds: mode === "move" ? {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      } : contentBounds,
      hasMoved: false,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    setGesture((currentGesture) => {
      if (
        !currentGesture ||
        currentGesture.pointerId !== event.pointerId ||
        !interactionRef.current
      ) {
        return currentGesture;
      }

      const nextTransform = transformFromPointer(
        currentGesture.mode,
        currentGesture.baseTransform,
        currentGesture.startPointer,
        {
          x: event.clientX,
          y: event.clientY,
        },
        currentGesture.manipulationBounds,
      );

      const moved =
        Math.hypot(
          event.clientX - currentGesture.startPointer.x,
          event.clientY - currentGesture.startPointer.y,
        ) >= 2;

      return {
        ...currentGesture,
        transform: normalizeClipTransform(nextTransform),
        hasMoved: currentGesture.hasMoved || moved,
      };
    });
  }

  function finishGesture(event: PointerEvent<HTMLDivElement>) {
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    try {
      interactionRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may be unavailable in tests.
    }

    const shouldCommit = gesture.hasMoved;
    const nextTransform = gesture.transform;

    setGesture(null);

    if (shouldCommit) {
      onTransformCommit?.(layer.clip.id, nextTransform);
    }
  }

  function cancelGesture(event: PointerEvent<HTMLDivElement>) {
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    setGesture(null);

    try {
      interactionRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may be unavailable in tests.
    }
  }

  function renderManipulationControls() {
    if (!isSelected || isPlaying) {
      return null;
    }

    return (
      <div
        className="preview-transform-controls"
        data-testid="preview-transform-controls"
        aria-label="Transform controls"
      >
        <div className="preview-transform-bounds" />
        <button
          aria-label="Rotate selected visual"
          className="preview-transform-handle preview-transform-rotate-handle"
          onPointerDown={(event) => beginGesture("rotate", event)}
          type="button"
        >
          ↻
        </button>
        <button
          aria-label="Scale selected visual"
          className="preview-transform-handle preview-transform-scale-handle"
          onPointerDown={(event) => beginGesture("scale", event)}
          type="button"
        >
          ◩
        </button>
      </div>
    );
  }

  if (!mediaUrl) {
    return (
      <div
        className="preview-interaction-layer preview-layer-error"
        role="status"
        style={{ zIndex }}
      >
        Preview unavailable
      </div>
    );
  }

  if (layer.asset.mediaType === "image") {
    return (
      <div
        className="preview-interaction-layer"
        data-testid={`preview-hit-area-${layer.clip.id}`}
        data-selected={isSelected}
        ref={interactionRef}
        style={{ zIndex: zIndex + 10 }}
        onPointerDown={(event) => beginGesture("move", event)}
        onPointerMove={handlePointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={cancelGesture}
      >
        <div
          className="preview-content-layer"
          style={{
            ...contentLayerStyle,
            transform: layerStyle.transform,
          }}
        >
          <img
            alt={layer.asset.name}
            className="preview-layer preview-image-layer"
            data-preview-state="image"
            ref={imageRef}
            src={mediaUrl}
            onLoad={handleImageLoad}
            style={{ width: "100%", height: "100%", objectFit: "fill", zIndex }}
          />
          {renderManipulationControls()}
        </div>
      </div>
    );
  }

  return (
    <div
      className="preview-interaction-layer"
      data-testid={`preview-hit-area-${layer.clip.id}`}
      data-selected={isSelected}
      ref={interactionRef}
      style={{ zIndex: zIndex + 10 }}
      onPointerDown={(event) => beginGesture("move", event)}
      onPointerMove={handlePointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={cancelGesture}
    >
      <div
        className="preview-content-layer"
        style={{
          ...contentLayerStyle,
          transform: layerStyle.transform,
          opacity: layerStyle.opacity,
        }}
      >
        <video
          className="preview-layer preview-video-layer"
          data-preview-state="video"
          data-testid="preview-video"
          playsInline
          preload="auto"
          ref={mediaRef}
          src={mediaUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "fill",
            zIndex,
          }}
          onLoadedMetadata={handleLoadedMetadata}
          onError={() =>
            onError(layer.asset.id, "Video could not be loaded.")
          }
        />
        {renderManipulationControls()}
      </div>
    </div>
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

  if (!mediaUrl) {
    return (
      <div
        className="preview-layer-error"
        role="status"
      >
        Audio preview unavailable
      </div>
    );
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
      src={mediaUrl}
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
