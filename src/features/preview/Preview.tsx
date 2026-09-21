import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { getTrackPan, getTrackVolume, type 
  ClipCrop,
  ClipTransform,
  CropPosition,
  Project,
  TransformAnchor,
} from "../project/domain";
import {
  getClipCrop,
  getClipCropPosition,
  getClipTransformAnchor,
  getClipTransformAtTime,
  compensateTransformForAnchorChange,
  normalizeClipTransform,
  normalizeClipCrop,
} from "../transform/transform";
import {
  getContainedContentBounds,
  getContainedContentPercentageBounds,
  transformFromPointer,
  cropFromPointer,
  cropPositionFromPointer,
  transformAnchorFromPointer,
  type CanvasManipulationMode,
  type ContentBounds,
  type CropEdge,
} from "./canvasManipulation";
import {
  getActiveAudioPreviewClips,
  getActiveVisualPreviewClips,
  getAudioFadeGain,
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
  onTransformAnchorCommit?: (clipId: string, anchor: TransformAnchor) => void;
  onVisualMediaDimensionsChange?: (
    clipId: string,
    dimensions: { width: number; height: number },
  ) => void;
  onCropCommit?: (clipId: string, crop: ClipCrop) => void;
  onCropPositionCommit?: (clipId: string, position: CropPosition) => void;
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
  onTransformAnchorCommit,
  onVisualMediaDimensionsChange,
  onCropCommit,
  onCropPositionCommit,
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
          onTransformAnchorCommit={onTransformAnchorCommit}
          onVisualMediaDimensionsChange={onVisualMediaDimensionsChange}
          onCropCommit={onCropCommit}
          onCropPositionCommit={onCropPositionCommit}
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
  onTransformAnchorCommit?: (clipId: string, anchor: TransformAnchor) => void;
  onVisualMediaDimensionsChange?: (
    clipId: string,
    dimensions: { width: number; height: number },
  ) => void;
  onCropCommit?: (clipId: string, crop: ClipCrop) => void;
  onCropPositionCommit?: (clipId: string, position: CropPosition) => void;
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

interface CropPositionGesture {
  pointerId: number;
  startPointer: { x: number; y: number };
  basePosition: CropPosition;
  position: CropPosition;
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

interface AnchorGesture {
  pointerId: number;
  startAnchor: TransformAnchor;
  anchor: TransformAnchor;
  manipulationBounds: ContentBounds;
  baseTransform: ClipTransform;
  transform: ClipTransform;
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
  onTransformAnchorCommit,
  onVisualMediaDimensionsChange,
  onCropCommit,
  onCropPositionCommit,
  onError,
}: PreviewVisualLayerProps) {
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const interactionRef = useRef<HTMLDivElement | null>(null);
  const mediaUrl = tryConvertFileSrc(layer.asset.sourcePath);
  const [videoSourceUrl, setVideoSourceUrl] = useState<string | null>(null);
  const [gesture, setGesture] = useState<CanvasGesture | null>(null);
  const [cropGesture, setCropGesture] = useState<CropGesture | null>(null);
  const [cropPositionGesture, setCropPositionGesture] =
    useState<CropPositionGesture | null>(null);
  const [anchorGesture, setAnchorGesture] =
    useState<AnchorGesture | null>(null);
  const cropPositionGestureRef = useRef<CropPositionGesture | null>(null);
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
  const cropPosition =
    cropPositionGesture?.position ??
    getClipCropPosition(activeCrop, layer.clip.cropPosition);
  const hasCrop =
    activeCrop.top > 0.0001 ||
    activeCrop.right > 0.0001 ||
    activeCrop.bottom > 0.0001 ||
    activeCrop.left > 0.0001;
  const activeAnchor = anchorGesture?.anchor ?? anchor;
  const activeTransform =
    anchorGesture?.transform ?? gesture?.transform ?? currentTransform;
  const transitionOpacity = layer.transitionOpacity ?? 1;
  const transitionOverlayOpacity = layer.transitionOverlayOpacity ?? 0;
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
    opacity: activeTransform.opacity * transitionOpacity,
  };
  const contentLayerStyle = {
    position: "absolute" as const,
    left: `${contentBoundsPercent.left}%`,
    top: `${contentBoundsPercent.top}%`,
    width: `${contentBoundsPercent.width}%`,
    height: `${contentBoundsPercent.height}%`,
    transformOrigin: `${activeAnchor.x * 100}% ${activeAnchor.y * 100}%`,
  };
  const visibleWidth = Math.max(
    0.001,
    1 - activeCrop.left - activeCrop.right,
  );
  const visibleHeight = Math.max(
    0.001,
    1 - activeCrop.top - activeCrop.bottom,
  );
  const cropViewportStyle = {
    position: "absolute" as const,
    left: `${activeCrop.left * 100}%`,
    top: `${activeCrop.top * 100}%`,
    width: `${visibleWidth * 100}%`,
    height: `${visibleHeight * 100}%`,
    overflow: "hidden" as const,
  };
  const cropMediaStyle = {
    position: "absolute" as const,
    left: `${50 - (cropPosition.x / visibleWidth) * 100}%`,
    top: `${50 - (cropPosition.y / visibleHeight) * 100}%`,
    width: `${(1 / visibleWidth) * 100}%`,
    height: `${(1 / visibleHeight) * 100}%`,
    objectFit: "fill" as const,
  };

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!gesture && !cropGesture && !cropPositionGesture && !anchorGesture) {
      return;
    }

    function handleCancel(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();

      for (const pointerId of [
        gesture?.pointerId,
        cropGesture?.pointerId,
        cropPositionGesture?.pointerId,
        anchorGesture?.pointerId,
      ]) {
        if (typeof pointerId !== "number") {
          continue;
        }

        try {
          interactionRef.current?.releasePointerCapture(pointerId);
        } catch {
          // Pointer capture may be unavailable in tests.
        }
      }

      cropPositionGestureRef.current = null;
      setGesture(null);
      setCropGesture(null);
      setCropPositionGesture(null);
      setAnchorGesture(null);
    }

    window.addEventListener("keydown", handleCancel);
    return () => window.removeEventListener("keydown", handleCancel);
  }, [anchorGesture, cropGesture, cropPositionGesture, gesture]);

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

    const dimensions = {
      width: media.videoWidth,
      height: media.videoHeight,
    };

    setMediaSize(dimensions);

    if (dimensions.width > 0 && dimensions.height > 0) {
      onVisualMediaDimensionsChange?.(layer.clip.id, dimensions);
    }

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

    const dimensions = {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };

    setMediaSize(dimensions);

    if (dimensions.width > 0 && dimensions.height > 0) {
      onVisualMediaDimensionsChange?.(layer.clip.id, dimensions);
    }
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

  function beginAnchorGesture(
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

    setAnchorGesture({
      pointerId: event.pointerId,
      startAnchor: anchor,
      anchor,
      manipulationBounds: contentBounds,
      baseTransform: currentTransform,
      transform: currentTransform,
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

  function beginCropPositionGesture(
    event: PointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) {
      return;
    }

    onSelectClip?.(layer.clip.id);

    if (
      isPlaying ||
      !hasCrop ||
      !interactionRef.current
    ) {
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

    const nextGesture = {
      pointerId: event.pointerId,
      startPointer: {
        x: event.clientX,
        y: event.clientY,
      },
      basePosition: cropPosition,
      position: cropPosition,
      manipulationBounds: contentBounds,
      hasMoved: false,
    } satisfies CropPositionGesture;

    cropPositionGestureRef.current = nextGesture;
    setCropPositionGesture(nextGesture);
  }

  function handlePointerMove(
    event: PointerEvent<HTMLDivElement | HTMLButtonElement>,
  ) {
    if (anchorGesture && anchorGesture.pointerId === event.pointerId) {
      const nextAnchor = transformAnchorFromPointer(
        {
          x: event.clientX,
          y: event.clientY,
        },
        anchorGesture.manipulationBounds,
        canvasWidth,
        canvasHeight,
        anchorGesture.baseTransform,
        anchorGesture.startAnchor,
      );
      const nextTransform = compensateTransformForAnchorChange(
        anchorGesture.baseTransform,
        anchorGesture.startAnchor,
        nextAnchor,
        {
          widthPercent: contentBoundsPercent.width,
          heightPercent: contentBoundsPercent.height,
        },
      );

      setAnchorGesture({
        ...anchorGesture,
        anchor: nextAnchor,
        transform: nextTransform,
        hasMoved:
          anchorGesture.hasMoved ||
          Math.abs(nextAnchor.x - anchorGesture.startAnchor.x) > 0.0001 ||
          Math.abs(nextAnchor.y - anchorGesture.startAnchor.y) > 0.0001,
      });
      return;
    }

    const activeCropPositionGesture = cropPositionGestureRef.current;

    if (
      activeCropPositionGesture &&
      activeCropPositionGesture.pointerId === event.pointerId
    ) {
      const nextPosition = cropPositionFromPointer(
        activeCropPositionGesture.basePosition,
        activeCropPositionGesture.startPointer,
        { x: event.clientX, y: event.clientY },
        normalizeClipCrop(crop),
        activeCropPositionGesture.manipulationBounds,
        canvasWidth,
        canvasHeight,
        currentTransform,
        anchor,
      );
      const nextGesture = {
        ...activeCropPositionGesture,
        position: nextPosition,
        hasMoved:
          activeCropPositionGesture.hasMoved ||
          Math.abs(nextPosition.x - activeCropPositionGesture.basePosition.x) >
            0.0001 ||
          Math.abs(nextPosition.y - activeCropPositionGesture.basePosition.y) >
            0.0001,
      };

      cropPositionGestureRef.current = nextGesture;
      setCropPositionGesture(nextGesture);
      return;
    }

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

  function finishGesture(
    event: PointerEvent<HTMLDivElement | HTMLButtonElement>,
  ) {
    if (anchorGesture && anchorGesture.pointerId === event.pointerId) {
      try {
        interactionRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may be unavailable in tests.
      }

      const shouldCommit = anchorGesture.hasMoved;
      const nextAnchor = anchorGesture.anchor;

      setAnchorGesture(null);

      if (shouldCommit) {
        onTransformAnchorCommit?.(layer.clip.id, nextAnchor);
      }
      return;
    }

    const activeCropPositionGesture = cropPositionGestureRef.current;

    if (
      activeCropPositionGesture &&
      activeCropPositionGesture.pointerId === event.pointerId
    ) {
      try {
        interactionRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may be unavailable in tests.
      }

      const shouldCommit = activeCropPositionGesture.hasMoved;
      const nextPosition = activeCropPositionGesture.position;

      cropPositionGestureRef.current = null;
      setCropPositionGesture(null);

      if (shouldCommit) {
        onCropPositionCommit?.(layer.clip.id, nextPosition);
      }
      return;
    }

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

  function cancelGesture(
    event: PointerEvent<HTMLDivElement | HTMLButtonElement>,
  ) {
    if (anchorGesture && anchorGesture.pointerId === event.pointerId) {
      setAnchorGesture(null);

      try {
        interactionRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may be unavailable in tests.
      }
      return;
    }

    const activeCropPositionGesture = cropPositionGestureRef.current;

    if (
      activeCropPositionGesture &&
      activeCropPositionGesture.pointerId === event.pointerId
    ) {
      cropPositionGestureRef.current = null;
      setCropPositionGesture(null);

      try {
        interactionRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may be unavailable in tests.
      }
      return;
    }

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
          aria-label="Move transform anchor"
          className="preview-transform-anchor-handle"
          data-testid="preview-transform-anchor-handle"
          onPointerDown={beginAnchorGesture}
          style={{
            left: activeAnchor.x * 100 + "%",
            top: activeAnchor.y * 100 + "%",
          }}
          type="button"
        >
          +
        </button>
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
        {transitionOverlayOpacity > 0 ? (
          <div
            aria-hidden="true"
            className="preview-transition-overlay"
            data-testid={"preview-transition-overlay-" + layer.clip.id}
            style={{ opacity: transitionOverlayOpacity }}
          />
        ) : null}
        <div
          className="preview-content-layer"
          style={{
            ...contentLayerStyle,
            transform: layerStyle.transform,
          }}
        >
          <div
            className="preview-crop-viewport"
            data-testid={`preview-crop-viewport-${layer.clip.id}`}
            style={cropViewportStyle}
          >
            {isSelected && !isPlaying && hasCrop ? (
              <button
                aria-label="Pan crop content"
                className="preview-crop-pan-surface"
                data-testid={`preview-crop-pan-surface-${layer.clip.id}`}
                onPointerDown={beginCropPositionGesture}
                onPointerMove={handlePointerMove}
                onPointerUp={finishGesture}
                onPointerCancel={cancelGesture}
                type="button"
              />
            ) : null}
            <img
              alt={layer.asset.name}
              className="preview-layer preview-image-layer"
              data-preview-state="image"
              ref={imageRef}
              data-clip-id={layer.clip.id}
              data-media-width={mediaSize?.width || undefined}
              data-media-height={mediaSize?.height || undefined}
              src={mediaUrl ?? undefined}
              onLoad={handleImageLoad}
              style={{
                ...cropMediaStyle,
                zIndex,
              }}
            />
          </div>
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
      {transitionOverlayOpacity > 0 ? (
        <div
          aria-hidden="true"
          className="preview-transition-overlay"
          data-testid={"preview-transition-overlay-" + layer.clip.id}
          style={{ opacity: transitionOverlayOpacity }}
        />
      ) : null}
      <div
        className="preview-content-layer"
        style={{
          ...contentLayerStyle,
          transform: layerStyle.transform,
          opacity: layerStyle.opacity,
        }}
      >
        <div
          className="preview-crop-viewport"
          data-testid={`preview-crop-viewport-${layer.clip.id}`}
          style={cropViewportStyle}
        >
          {isSelected && !isPlaying && hasCrop ? (
            <button
              aria-label="Pan crop content"
              className="preview-crop-pan-surface"
              data-testid={`preview-crop-pan-surface-${layer.clip.id}`}
              onPointerDown={beginCropPositionGesture}
              type="button"
            />
          ) : null}
          <video
            className="preview-layer preview-video-layer"
            data-preview-state="video"
            data-testid="preview-video"
            data-media-width={mediaSize?.width || undefined}
            data-media-height={mediaSize?.height || undefined}
            playsInline
            preload="auto"
            ref={mediaRef}
            data-clip-id={layer.clip.id}
            src={videoSourceUrl ?? undefined}
            style={{
              ...cropMediaStyle,
              zIndex,
            }}
            onLoadedMetadata={handleLoadedMetadata}
            onError={() => void handleVideoError()}
          />
        </div>
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

interface AudioPreviewRouting {
  context: AudioContext;
  panner: StereoPannerNode;
}

const audioPreviewRoutingCache = new WeakMap<
  HTMLAudioElement,
  AudioPreviewRouting
>();

function getAudioPreviewRouting(
  media: HTMLAudioElement,
): AudioPreviewRouting | null {
  const cached = audioPreviewRoutingCache.get(media);

  if (cached) {
    return cached;
  }

  const AudioContextConstructor = globalThis.AudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  try {
    const context = new AudioContextConstructor();
    const source = context.createMediaElementSource(media);
    const panner = context.createStereoPanner();

    source.connect(panner);
    panner.connect(context.destination);

    const routing = { context, panner };
    audioPreviewRoutingCache.set(media, routing);
    return routing;
  } catch {
    return null;
  }
}

function PreviewAudioLayer({
  layer,
  currentTimeMs,
  isPlaying,
  showControls = false,
  onError,
}: PreviewLayerProps) {
  const mediaRef = useRef<HTMLAudioElement | null>(null);
  const audioRoutingRef = useRef<AudioPreviewRouting | null>(null);
  const localTimeMs = getClipLocalTimeMs(layer.clip, currentTimeMs);
  const clipLocalTimeMs = Math.max(
    0,
    currentTimeMs - layer.clip.timelineStartMs,
  );
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

    media.volume =
      getTrackVolume(layer.track) *
      getAudioFadeGain(layer.clip, clipLocalTimeMs);
  }, [
    clipLocalTimeMs,
    layer.clip,
    layer.track,
  ]);

  useEffect(() => {
    const media = mediaRef.current;

    if (!media) {
      return;
    }

    audioRoutingRef.current = getAudioPreviewRouting(media);

    if (audioRoutingRef.current) {
      audioRoutingRef.current.panner.pan.value = getTrackPan(layer.track);
    }
  }, [layer.track]);

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

    const routing = audioRoutingRef.current;

    if (routing && routing.context.state !== "running") {
      void routing.context.resume().catch(() => undefined);
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
      ref={(element) => {
        mediaRef.current = element;
        if (element) {
          const routing = getAudioPreviewRouting(element);
          audioRoutingRef.current = routing;
          if (routing) {
            routing.panner.pan.value = getTrackPan(layer.track);
          }
          element.volume =
            getTrackVolume(layer.track) *
            getAudioFadeGain(layer.clip, clipLocalTimeMs);
        }
      }}
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



