import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import type { ClipCrop, ClipTransform, Project } from "../project/domain";
import {
  getClipCrop,
  getClipTransformAnchor,
  getClipTransformAtTime,
  normalizeClipTransform,
  normalizeClipCrop,
} from "../transform/transform";
import {
  getContainedContentBounds,
  getContainedContentPercentageBounds,
  transformFromPointer,
  cropFromPointer,
  type CanvasManipulationMode,
  type ContentBounds,
  type CropEdge,
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
  onCropCommit?: (clipId: string, crop: ClipCrop) => void;
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
  onCropCommit,
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
          onCropCommit={onCropCommit}
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
  onCropCommit?: (clipId: string, crop: ClipCrop) => void;
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

interface CropGesture {
  edge: CropEdge;
  pointerId: number;
  crop: ClipCrop;
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
  onCropCommit,
  onError,
}: PreviewVisualLayerProps) {
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const interactionRef = useRef<HTMLDivElement | null>(null);
  const mediaUrl = tryConvertFileSrc(layer.asset.sourcePath);
  const [videoSourceUrl, setVideoSourceUrl] = useState<string | null>(null);
  const [gesture, setGesture] = useState<CanvasGesture | null>(null);
  const [cropGesture, setCropGesture] = useState<CropGesture | null>(null);
  const [mediaSize, setMediaSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isPreparingPreview, setIsPreparingPreview] = useState(
    layer.asset.mediaType === "video",
  );
  const onErrorRef = useRef(onError);

  const localTimeMs = getClipLocalTimeMs(layer.clip, currentTimeMs);
  const transformTimeMs = Math.min(
    Math.max(currentTimeMs - layer.clip.timelineStartMs, 0),
    getClipDurationMsForTransform(layer.clip),
  );
  const currentTransform = getClipTransformAtTime(
    layer.clip.transform,
    layer.clip.transformKeyframes,
    transformTimeMs,
  );
  const anchor = getClipTransformAnchor(layer.clip.transformAnchor);
  const crop = getClipCrop(layer.clip.crop);
  const activeCrop = cropGesture?.crop ?? crop;
  const activeTransform = gesture?.transform ?? currentTransform;
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
    transformOrigin: `${anchor.x * 100}% ${anchor.y * 100}%`,
  };
  const cropStyle = {
    clipPath: `inset(${activeCrop.top * 100}% ${activeCrop.right * 100}% ${activeCrop.bottom * 100}% ${activeCrop.left * 100}%)`,
  };

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (layer.asset.mediaType !== "video") {
      return;
    }

    let cancelled = false;

    void invoke<string>("prepare_media_preview", {
      path: layer.asset.sourcePath,
    })
      .then((previewPath) =>
        invoke<string>("get_media_http_url", {
          path: previewPath,
        }),
      )
      .then((url) => {
        if (cancelled) {
          return;
        }

        setVideoSourceUrl(url);
        setIsPreparingPreview(false);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setIsPreparingPreview(false);
        onErrorRef.current(
          layer.asset.id,
          error instanceof Error
            ? error.message
            : "A compatible video preview could not be prepared.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [layer.asset.id, layer.asset.mediaType, layer.asset.sourcePath]);

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

  const localTimeMsRef = useRef(localTimeMs);

  useEffect(() => {
    localTimeMsRef.current = localTimeMs;
  }, [localTimeMs]);

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

    try {
      // Re-align only when playback starts or when the active clip changes.
      // Do not seek on every transport tick because that interrupts media playback.
      media.currentTime = Math.max(0, localTimeMsRef.current / 1000);
    } catch {
      // Some WebView/media implementations reject seeking before metadata is ready.
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

  function handleVideoError() {
    const mediaError = mediaRef.current?.error;
    const errorCode = mediaError?.code
      ? ` (media error code ${mediaError.code})`
      : "";

    onError(
      layer.asset.id,
      `Video preview could not be loaded${errorCode}. The local preview server could not deliver a playable stream.`,
    );
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

    const gestureBaseTransform = getClipTransformAtTime(
      layer.clip.transform,
      layer.clip.transformKeyframes,
      transformTimeMs,
    );

    setGesture({
      mode,
      pointerId: event.pointerId,
      startPointer: {
        x: event.clientX,
        y: event.clientY,
      },
      baseTransform: gestureBaseTransform,
      transform: gestureBaseTransform,
      manipulationBounds: mode === "move" ? {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      } : contentBounds,
      hasMoved: false,
    });
  }

  function beginCropGesture(
    edge: CropEdge,
    event: PointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) {
      return;
    }

    onSelectClip?.(layer.clip.id);

    if (isPlaying || !interactionRef.current) {
      return;
    }

    const bounds = interactionRef.current.getBoundingClientRect();
    const contentBounds = getInteractionContentBounds(bounds);

    if (contentBounds.width <= 0 || contentBounds.height <= 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    try {
      interactionRef.current.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is not implemented in every runtime.
    }

    setCropGesture({
      edge,
      pointerId: event.pointerId,
      crop: normalizeClipCrop(crop),
      manipulationBounds: contentBounds,
      hasMoved: false,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (cropGesture && cropGesture.pointerId === event.pointerId) {
      setCropGesture((currentGesture) => {
        if (
          !currentGesture ||
          currentGesture.pointerId !== event.pointerId
        ) {
          return currentGesture;
        }

        const nextCrop = cropFromPointer(
          currentGesture.edge,
          currentGesture.crop,
          {
            x: event.clientX,
            y: event.clientY,
          },
          currentGesture.manipulationBounds,
          canvasWidth,
          canvasHeight,
          activeTransform,
          anchor,
        );

        const moved =
          Math.abs(nextCrop.top - currentGesture.crop.top) > 0.0001 ||
          Math.abs(nextCrop.right - currentGesture.crop.right) > 0.0001 ||
          Math.abs(nextCrop.bottom - currentGesture.crop.bottom) > 0.0001 ||
          Math.abs(nextCrop.left - currentGesture.crop.left) > 0.0001;

        return {
          ...currentGesture,
          crop: nextCrop,
          hasMoved: currentGesture.hasMoved || moved,
        };
      });
      return;
    }

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
        anchor,
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
    if (cropGesture && cropGesture.pointerId === event.pointerId) {
      try {
        interactionRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may be unavailable in tests.
      }

      const shouldCommit = cropGesture.hasMoved;
      const nextCrop = cropGesture.crop;

      setCropGesture(null);

      if (shouldCommit) {
        onCropCommit?.(layer.clip.id, nextCrop);
      }
      return;
    }

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
    if (cropGesture && cropGesture.pointerId === event.pointerId) {
      setCropGesture(null);

      try {
        interactionRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may be unavailable in tests.
      }
      return;
    }

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

  function renderCropControls() {
    if (!isSelected || isPlaying) {
      return null;
    }

    return (
      <div
        className="preview-crop-controls"
        data-testid="preview-crop-controls"
        aria-label="Crop controls"
      >
        <div
          className="preview-crop-boundary"
          style={{
            top: activeCrop.top * 100 + "%",
            right: activeCrop.right * 100 + "%",
            bottom: activeCrop.bottom * 100 + "%",
            left: activeCrop.left * 100 + "%",
          }}
        />
        <button
          aria-label="Crop top"
          className="preview-crop-handle preview-crop-handle-top"
          data-testid="preview-crop-handle-top"
          onPointerDown={(event) => beginCropGesture("top", event)}
          type="button"
          style={{ top: activeCrop.top * 100 + "%" }}
        />
        <button
          aria-label="Crop right"
          className="preview-crop-handle preview-crop-handle-right"
          data-testid="preview-crop-handle-right"
          onPointerDown={(event) => beginCropGesture("right", event)}
          type="button"
          style={{ right: activeCrop.right * 100 + "%" }}
        />
        <button
          aria-label="Crop bottom"
          className="preview-crop-handle preview-crop-handle-bottom"
          data-testid="preview-crop-handle-bottom"
          onPointerDown={(event) => beginCropGesture("bottom", event)}
          type="button"
          style={{ bottom: activeCrop.bottom * 100 + "%" }}
        />
        <button
          aria-label="Crop left"
          className="preview-crop-handle preview-crop-handle-left"
          data-testid="preview-crop-handle-left"
          onPointerDown={(event) => beginCropGesture("left", event)}
          type="button"
          style={{ left: activeCrop.left * 100 + "%" }}
        />
      </div>
    );
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
        {renderCropControls()}
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

  if (layer.asset.mediaType === "image" && !mediaUrl) {
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
            src={mediaUrl ?? undefined}
            onLoad={handleImageLoad}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
              zIndex,
              ...cropStyle,
            }}
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
          data-clip-id={layer.clip.id}
          src={videoSourceUrl ?? undefined}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "fill",
            zIndex,
            ...cropStyle,
          }}
          onLoadedMetadata={handleLoadedMetadata}
          onError={() => void handleVideoError()}
        />
        {isPreparingPreview ? (
          <div className="preview-transcode-status" role="status">
            Preparing compatible preview…
          </div>
        ) : null}
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
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;

    void invoke<string>("get_media_http_url", {
      path: layer.asset.sourcePath,
    })
      .then((url) => {
        if (!cancelled) {
          setMediaUrl(url);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          onErrorRef.current(
            layer.asset.id,
            error instanceof Error
              ? error.message
              : "Audio preview could not be prepared.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [layer.asset.id, layer.asset.sourcePath]);

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
        Preparing audio preview…
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
      data-clip-id={layer.clip.id}
      src={mediaUrl ?? undefined}
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


function getClipDurationMsForTransform(clip: ActivePreviewClip["clip"]): number {
  if (clip.sourceEndMs === null) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.max(0, clip.sourceEndMs - clip.sourceStartMs);
}



