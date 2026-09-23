export const M3_38_DIRECT_GRAPH_MARKER = "m3.38-direct-graph-v2";

import { buildVisualEffectsFfmpegFilters } from "../effects/visual-effects";
import {
  getClipCrop,
  getClipCropPosition,
  getClipTransform,
  normalizeClipTransform,
  normalizeTransformKeyframes,
} from "../transform/transform";
import type { ClipTransform } from "../transform/transform";
import {
  DISSOLVE_TRANSITION_TYPE,
  FADE_THROUGH_BLACK_TRANSITION_TYPE,
  MIN_DISSOLVE_DURATION_MS,
  getClipTransition,
} from "../transition/transition";
import type { TransformKeyframe } from "../project/domain";
import type { RenderPlan, RenderSegment } from "./render-plan";

export interface VideoRenderInput {
  inputIndex: number;
  sourcePath: string;
}

export interface VideoRenderGraph {
  inputs: VideoRenderInput[];
  filterComplex: string;
  videoMap: string;
}

export function compileVideoTracksGraph(plan: RenderPlan): VideoRenderGraph {
  const videoSegments = plan.segments.filter(
    (segment) => segment.trackType === "video",
  );

  if (videoSegments.length === 0) {
    throw new Error("Render plan has no video clips.");
  }

  const trackIds = new Set(videoSegments.map((segment) => segment.trackId));

  if (trackIds.size === 1) {
    return compileSingleVideoTrackGraph(plan);
  }

  if (
    plan.segments.some(
      (segment) => segment.trackType === "audio" && segment.durationMs > 0,
    )
  ) {
    throw new Error(
      "Video render graph compilation does not include audio mixing yet.",
    );
  }

  if (
    videoSegments.some(
      (segment) =>
        segment.mediaType !== "video" && segment.mediaType !== "image",
    )
  ) {
    throw new Error(
      "Video render graph supports video and image visual assets only.",
    );
  }

  const inputs = [...videoSegments]
    .sort((left, right) => left.inputIndex - right.inputIndex)
    .map((segment) => ({
      inputIndex: segment.inputIndex,
      sourcePath: segment.sourcePath,
    }));

  const tracks = [...new Set(videoSegments.map((segment) => segment.trackId))]
    .map((trackId) => {
      const segments = videoSegments.filter(
        (segment) => segment.trackId === trackId,
      );
      return {
        trackId,
        trackIndex: Math.min(...segments.map((segment) => segment.trackIndex)),
        segments,
      };
    })
    .sort((left, right) => left.trackIndex - right.trackIndex);

  const graphParts: string[] = [];
  const trackLabels: string[] = [];

  tracks.forEach((track) => {
    if (track.segments.every((segment) => segment.isMuted)) {
      return;
    }

    track.segments.forEach(assertSupportedVisualMetadataForMultiTrack);

    const label = "track_" + track.trackIndex + "_sequence";
    graphParts.push(
      buildVideoTrackSequenceGraph(
        plan,
        track.segments,
        label,
        "track_" + track.trackIndex,
      ),
    );
    trackLabels.push("[" + label + "]");
  });

  const backgroundLabel = "multitrack_bg";
  graphParts.push(
    "color=c=black@0.0:s=" +
      plan.width +
      "x" +
      plan.height +
      ":r=" +
      formatNumber(plan.frameRate) +
      ":d=" +
      formatSeconds(plan.durationMs) +
      ",format=rgba[" +
      backgroundLabel +
      "]",
  );

  let compositeLabel = backgroundLabel;

  trackLabels.forEach((trackLabel, index) => {
    const nextLabel = "multitrack_composite_" + index;
    graphParts.push(
      "[" +
        compositeLabel +
        "]" +
        trackLabel +
        "overlay=x=0:y=0:eof_action=pass:shortest=0,format=rgba[" +
        nextLabel +
        "]",
    );
    compositeLabel = nextLabel;
  });

  graphParts.push(
    "[" +
      compositeLabel +
      "]format=yuv420p,fps=fps=" +
      formatNumber(plan.frameRate) +
      ":round=near,setsar=1[vout]",
  );

  return {
    inputs,
    filterComplex: graphParts.join(";"),
    videoMap: "[vout]",
  };
}

export function compileSingleVideoTrackGraph(
  plan: RenderPlan,
): VideoRenderGraph {
  const videoSegments = plan.segments.filter(
    (segment) => segment.trackType === "video",
  );

  if (videoSegments.length === 0) {
    throw new Error("Render plan has no video clips.");
  }

  const videoTrackIds = new Set(videoSegments.map((segment) => segment.trackId));

  if (videoTrackIds.size !== 1) {
    throw new Error(
      "M3.36 supports one video track at a time; multi-track compositing is deferred.",
    );
  }

  if (
    videoSegments.some(
      (segment) =>
        segment.mediaType !== "video" && segment.mediaType !== "image",
    )
  ) {
    throw new Error(
      "Video render graph supports video and image visual assets only.",
    );
  }

  if (
    plan.segments.some(
      (segment) => segment.trackType === "audio" && segment.durationMs > 0,
    )
  ) {
    throw new Error(
      "M3.36 video graph compilation does not include audio mixing yet.",
    );
  }

  for (const segment of videoSegments) {
    assertSupportedVisualMetadata(segment);
  }

  const ordered = [...videoSegments].sort(
    (left, right) => left.timelineStartMs - right.timelineStartMs,
  );
  const inputs = ordered.map((segment) => ({
    inputIndex: segment.inputIndex,
    sourcePath: segment.sourcePath,
  }));

  const graphParts: string[] = [];
  const concatInputs: string[] = [];
  const hasTransitions = ordered.some((segment) => Boolean(segment.transitionOut));

  if (hasTransitions) {
    const fullLabels = ordered.map((_, index) => "full" + index);

    for (let index = 0; index < ordered.length; index += 1) {
      graphParts.push(
        buildSegmentFilter(
          ordered[index],
          plan,
          fullLabels[index],
          true,
        ),
      );
    }

    let previousEndMs = 0;
    let gapIndex = 0;

    for (let index = 0; index < ordered.length; index += 1) {
      const segment = ordered[index];

      if (segment.timelineStartMs > previousEndMs) {
        const gapDurationMs = segment.timelineStartMs - previousEndMs;
        const gapLabel = "gap" + gapIndex;
        graphParts.push(
          "color=c=black:s=" +
            plan.width +
            "x" +
            plan.height +
            ":r=" +
            formatNumber(plan.frameRate) +
            ":d=" +
            formatSeconds(gapDurationMs) +
            ",setsar=1[" +
            gapLabel +
            "]",
        );
        concatInputs.push("[" + gapLabel + "]");
        gapIndex += 1;
      }

      const transition = getClipTransition(segment.transitionOut);

      if (!transition) {
        concatInputs.push("[" + fullLabels[index] + "]");
        previousEndMs = segment.timelineEndMs;
        continue;
      }

      const next = ordered[index + 1];

      if (!next) {
        throw new Error("Transition requires an adjacent incoming visual clip.");
      }

      assertSupportedTransition(segment, next, transition);

      const durationMs = Math.min(
        transition.durationMs,
        segment.durationMs,
        next.durationMs,
      );

      if (durationMs < MIN_DISSOLVE_DURATION_MS) {
        throw new Error(
          "Transition duration is shorter than the supported minimum.",
        );
      }

      concatInputs.push(
        ...buildTransitionGraphParts(
          segment,
          fullLabels[index],
          fullLabels[index + 1],
          transition,
          graphParts,
          index,
          durationMs,
        ),
      );

      previousEndMs = segment.timelineEndMs;
    }
  } else {
    let previousEndMs = 0;
    let gapIndex = 0;

    for (let index = 0; index < ordered.length; index += 1) {
      const segment = ordered[index];

      if (segment.timelineStartMs > previousEndMs) {
        const gapDurationMs = segment.timelineStartMs - previousEndMs;
        const gapLabel = "gap" + gapIndex;
        graphParts.push(
          "color=c=black:s=" +
            plan.width +
            "x" +
            plan.height +
            ":r=" +
            formatNumber(plan.frameRate) +
            ":d=" +
            formatSeconds(gapDurationMs) +
            ",setsar=1[" +
            gapLabel +
            "]",
        );
        concatInputs.push("[" + gapLabel + "]");
        gapIndex += 1;
      }

      const isDirectSingleClip =
        ordered.length === 1 && segment.timelineStartMs === 0;
      const videoLabel = isDirectSingleClip ? "vout" : "clip" + index;

      graphParts.push(
        buildSegmentFilter(segment, plan, videoLabel, !isDirectSingleClip),
      );

      if (!isDirectSingleClip) {
        concatInputs.push("[" + videoLabel + "]");
      }
      previousEndMs = segment.timelineEndMs;
    }
  }

  const canRenderDirectlyToOutput =
    ordered.length === 1 && ordered[0].timelineStartMs === 0 && !hasTransitions;

  if (!canRenderDirectlyToOutput) {
    const concatCount = concatInputs.length;
    graphParts.push(
      concatInputs.join("") +
        "concat=n=" +
        concatCount +
        ":v=1:a=0,format=yuv420p[vout]",
    );
  }

  return {
    inputs,
    filterComplex: graphParts.join(";"),
    videoMap: "[vout]",
  };
}

function buildVideoTrackSequenceGraph(
  plan: RenderPlan,
  segments: RenderSegment[],
  label: string,
  graphPrefix: string,
): string {
  const ordered = [...segments].sort(
    (left, right) => left.timelineStartMs - right.timelineStartMs,
  );
  const graphParts: string[] = [];
  const concatInputs: string[] = [];
  const hasTransitions = ordered.some((segment) => Boolean(segment.transitionOut));

  if (hasTransitions) {
    const fullLabels = ordered.map(
      (segment) => graphPrefix + "_full_" + segment.inputIndex,
    );

    ordered.forEach((segment, index) => {
      graphParts.push(
        buildSegmentFilter(
          segment,
          plan,
          fullLabels[index],
          true,
          true,
        ),
      );
    });

    let previousEndMs = 0;

    for (let index = 0; index < ordered.length; index += 1) {
      const segment = ordered[index];

      if (segment.timelineStartMs > previousEndMs) {
        const gapLabel = graphPrefix + "_gap_" + index;
        graphParts.push(
          buildTransparentGapFilter(
            plan,
            segment.timelineStartMs - previousEndMs,
            gapLabel,
          ),
        );
        concatInputs.push("[" + gapLabel + "]");
      }

      const transition = getClipTransition(segment.transitionOut);

      if (!transition) {
        concatInputs.push("[" + fullLabels[index] + "]");
        previousEndMs = segment.timelineEndMs;
        continue;
      }

      const next = ordered[index + 1];

      if (!next) {
        throw new Error("Transition requires an adjacent incoming visual clip.");
      }

      assertSupportedTransition(segment, next, transition);

      const durationMs = Math.min(
        transition.durationMs,
        segment.durationMs,
        next.durationMs,
      );

      if (durationMs < MIN_DISSOLVE_DURATION_MS) {
        throw new Error(
          "Transition duration is shorter than the supported minimum.",
        );
      }

      concatInputs.push(
        ...buildTransitionGraphParts(
          segment,
          fullLabels[index],
          fullLabels[index + 1],
          transition,
          graphParts,
          index,
          durationMs,
          graphPrefix,
          true,
        ),
      );

      previousEndMs = segment.timelineEndMs;
    }
  } else {
    let previousEndMs = 0;

    ordered.forEach((segment, index) => {
      if (segment.timelineStartMs > previousEndMs) {
        const gapLabel = graphPrefix + "_gap_" + index;
        graphParts.push(
          buildTransparentGapFilter(
            plan,
            segment.timelineStartMs - previousEndMs,
            gapLabel,
          ),
        );
        concatInputs.push("[" + gapLabel + "]");
      }

      const segmentLabel = graphPrefix + "_clip_" + index;
      graphParts.push(
        buildSegmentFilter(
          segment,
          plan,
          segmentLabel,
          true,
          true,
        ),
      );
      concatInputs.push("[" + segmentLabel + "]");
      previousEndMs = segment.timelineEndMs;
    });
  }

  const lastEndMs = ordered.length
    ? Math.max(...ordered.map((segment) => segment.timelineEndMs))
    : 0;

  if (lastEndMs < plan.durationMs) {
    const gapLabel = graphPrefix + "_tail_gap";
    graphParts.push(
      buildTransparentGapFilter(
        plan,
        plan.durationMs - lastEndMs,
        gapLabel,
      ),
    );
    concatInputs.push("[" + gapLabel + "]");
  }

  if (concatInputs.length === 1) {
    graphParts.push(
      concatInputs[0] +
        "trim=duration=" +
        formatSeconds(plan.durationMs) +
        ",setpts=PTS-STARTPTS,format=rgba[" +
        label +
        "]",
    );
  } else {
    graphParts.push(
      concatInputs.join("") +
        "concat=n=" +
        concatInputs.length +
        ":v=1:a=0,format=rgba,setpts=PTS-STARTPTS[" +
        label +
        "]",
    );
  }

  return graphParts.join(";");
}

function buildTransparentGapFilter(
  plan: RenderPlan,
  durationMs: number,
  label: string,
): string {
  return (
    "color=c=black@0.0:s=" +
    plan.width +
    "x" +
    plan.height +
    ":r=" +
    formatNumber(plan.frameRate) +
    ":d=" +
    formatSeconds(durationMs) +
    ",format=rgba[" +
    label +
    "]"
  );
}

function assertSupportedVisualMetadataForMultiTrack(
  segment: RenderSegment,
): void {
  if (
    segment.mediaType !== "video" &&
    segment.mediaType !== "image"
  ) {
    throw new Error(
      "Video render graph supports video and image visual assets only.",
    );
  }
}

function assertSupportedTransition(
  outgoing: RenderSegment,
  incoming: RenderSegment,
  transition: NonNullable<ReturnType<typeof getClipTransition>>,
): void {
  if (outgoing.timelineEndMs !== incoming.timelineStartMs) {
    throw new Error(
      "Transitions require directly adjacent visual clips in the same video track.",
    );
  }

  if (
    outgoing.trackId !== incoming.trackId ||
    outgoing.trackType !== "video" ||
    incoming.trackType !== "video" ||
    (outgoing.mediaType !== "video" && outgoing.mediaType !== "image") ||
    (incoming.mediaType !== "video" && incoming.mediaType !== "image")
  ) {
    throw new Error(
      "Transitions require adjacent video/image clips on the same video track.",
    );
  }

  if (
    transition.type !== DISSOLVE_TRANSITION_TYPE &&
    transition.type !== FADE_THROUGH_BLACK_TRANSITION_TYPE
  ) {
    throw new Error("Unsupported transition type.");
  }
}

function buildTransitionGraphParts(
  outgoing: RenderSegment,
  outgoingFullLabel: string,
  incomingFullLabel: string,
  transition: NonNullable<ReturnType<typeof getClipTransition>>,
  graphParts: string[],
  index: number,
  durationMs: number,
  labelPrefix = "",
  preserveAlpha = false,
): string[] {
  const duration = formatSeconds(durationMs);
  const outgoingDuration = formatSeconds(outgoing.durationMs);
  const transitionStart = formatSeconds(outgoing.durationMs - durationMs);
  const transitionPrefix = labelPrefix ? labelPrefix + "_" : "";
  const prefixLabel = transitionPrefix + "transition_" + index + "_prefix";

  graphParts.push(
    "[" +
      outgoingFullLabel +
      "]trim=start=0:end=" +
      transitionStart +
      ",setpts=PTS-STARTPTS[" +
      prefixLabel +
      "]",
  );

  const labels = ["[" + prefixLabel + "]"];

  if (transition.type === DISSOLVE_TRANSITION_TYPE) {
    const outgoingTailLabel =
      transitionPrefix + "transition_" + index + "_outgoing_tail";
    const incomingFrameLabel =
      transitionPrefix + "transition_" + index + "_incoming_frame";
    const transitionLabel =
      transitionPrefix + "transition_" + index + "_dissolve";

    graphParts.push(
      "[" +
        outgoingFullLabel +
        "]trim=start=" +
        transitionStart +
        ":end=" +
        outgoingDuration +
        ",setpts=PTS-STARTPTS[" +
        outgoingTailLabel +
        "]",
    );
    graphParts.push(
      "[" +
        incomingFullLabel +
        "]select=eq(n\\,0),setpts=PTS-STARTPTS,loop=loop=-1:size=1:start=0,trim=duration=" +
        duration +
        ",setpts=PTS-STARTPTS,format=rgba,fade=t=in:st=0:d=" +
        duration +
        ":alpha=1[" +
        incomingFrameLabel +
        "]",
    );
    graphParts.push(
      "[" +
        outgoingTailLabel +
        "][" +
        incomingFrameLabel +
        "]overlay=x=0:y=0:shortest=1," +
        (preserveAlpha ? "format=rgba" : "format=yuv420p") +
        "[" +
        transitionLabel +
        "]",
    );
    labels.push("[" + transitionLabel + "]");
    return labels;
  }

  const halfDurationMs = durationMs / 2;
  const halfDuration = formatSeconds(halfDurationMs);
  const fadeOutLabel =
    transitionPrefix + "transition_" + index + "_fade_out";
  const fadeInLabel =
    transitionPrefix + "transition_" + index + "_fade_in";

  graphParts.push(
    "[" +
      outgoingFullLabel +
      "]trim=start=" +
      transitionStart +
      ":end=" +
      formatSeconds(outgoing.durationMs - halfDurationMs) +
      ",setpts=PTS-STARTPTS,fade=t=out:st=0:d=" +
      halfDuration +
      "[" +
      fadeOutLabel +
      "]",
  );
  graphParts.push(
    "[" +
      incomingFullLabel +
      "]select=eq(n\\,0),setpts=PTS-STARTPTS,loop=loop=-1:size=1:start=0,trim=duration=" +
      halfDuration +
      ",setpts=PTS-STARTPTS,fade=t=in:st=0:d=" +
      halfDuration +
      "[" +
      fadeInLabel +
      "]",
  );
  labels.push("[" + fadeOutLabel + "]", "[" + fadeInLabel + "]");
  return labels;
}

function buildSegmentFilter(
  segment: RenderSegment,
  plan: RenderPlan,
  label: string,
  includeOutputNormalization: boolean,
  preserveAlpha = false,
): string {
  const transform = getClipTransform(segment.transform);
  const transformKeyframes = normalizeTransformKeyframes(segment.transformKeyframes);
  const anchor = segment.transformAnchor ?? { x: 0.5, y: 0.5 };

  if (transformKeyframes.length > 0) {
    if (hasAnchorSensitiveAnimatedTransform(transformKeyframes, anchor)) {
      return buildAnchorAwareCompositedSegmentFilter(
        segment,
        plan,
        label,
        includeOutputNormalization,
        transform,
        transformKeyframes,
        preserveAlpha,
      );
    }

    return buildAnimatedCompositedSegmentFilter(
      segment,
      plan,
      label,
      includeOutputNormalization,
      transformKeyframes,
      preserveAlpha,
    );
  }

  const crop = getClipCrop(segment.crop);
  const cropPosition = getClipCropPosition(crop, segment.cropPosition);
  const staticTransformRequired = !isDefaultTransform(transform);
  const staticCropRequired = !isDefaultCrop(crop);

  if (staticTransformRequired || staticCropRequired) {
    if (hasAnchorSensitiveStaticTransform(transform, anchor)) {
      return buildAnchorAwareCompositedSegmentFilter(
        segment,
        plan,
        label,
        includeOutputNormalization,
        transform,
        [],
        preserveAlpha,
      );
    }

    return buildCompositedSegmentFilter(
      segment,
      plan,
      label,
      includeOutputNormalization,
      transform,
      crop,
      cropPosition,
      preserveAlpha,
    );
  }

  return [
    "[" + segment.inputIndex + ":v:0]" +
      "trim=start=" +
      formatSeconds(segment.sourceStartMs) +
      ":end=" +
      formatSeconds(segment.sourceEndMs),
    "setpts=PTS-STARTPTS",
    ...(preserveAlpha ? ["format=rgba"] : []),
    "scale=w=" +
      plan.width +
      ":h=" +
      plan.height +
      ":force_original_aspect_ratio=decrease",
    "pad=w=" +
      plan.width +
      ":h=" +
      plan.height +
      ":x=(ow-iw)/2:y=(oh-ih)/2" +
      (preserveAlpha ? ":color=black@0.0" : ""),
    ...(preserveAlpha ? ["format=rgba"] : []),
    ...(segment.visualEffects &&
    buildVisualEffectsFfmpegFilters(segment.visualEffects)
      ? [buildVisualEffectsFfmpegFilters(segment.visualEffects)]
      : []),
    ...(includeOutputNormalization
      ? [
          "fps=fps=" + formatNumber(plan.frameRate) + ":round=near",
          "setsar=1",
        ]
      : []),
  ].join(",") + "[" + label + "]";
}

function buildAnimatedCompositedSegmentFilter(
  segment: RenderSegment,
  plan: RenderPlan,
  label: string,
  includeOutputNormalization: boolean,
  keyframes: ReturnType<typeof normalizeTransformKeyframes>,
  preserveAlpha = false,
): string {
  const crop = getClipCrop(segment.crop);
  const cropPosition = getClipCropPosition(crop, segment.cropPosition);
  const visibleWidth = Math.max(
    0.001,
    1 - crop.left - crop.right,
  );
  const visibleHeight = Math.max(
    0.001,
    1 - crop.top - crop.bottom,
  );

  const cropFilters = isDefaultCrop(crop)
    ? []
    : [
        "format=rgba",
        "crop=w=trunc(iw*" +
          formatNumber(visibleWidth) +
          "):h=trunc(ih*" +
          formatNumber(visibleHeight) +
          "):x=trunc(iw*(" +
          formatNumber(cropPosition.x) +
          "-" +
          formatNumber(visibleWidth / 2) +
          ")):y=trunc(ih*(" +
          formatNumber(cropPosition.y) +
          "-" +
          formatNumber(visibleHeight / 2) +
          "))",
        "pad=w=iw/" +
          formatNumber(visibleWidth) +
          ":h=ih/" +
          formatNumber(visibleHeight) +
          ":x=(iw/" +
          formatNumber(visibleWidth) +
          ")*" +
          formatNumber(crop.left) +
          ":y=(ih/" +
          formatNumber(visibleHeight) +
          ")*" +
          formatNumber(crop.top) +
          ":color=black@0",
      ];

  const scaleExpression = buildTransformKeyframeExpression(
    keyframes,
    (transform) => transform.scale,
    "t",
  );
  const rotationExpression = buildTransformKeyframeExpression(
    keyframes,
    (transform) => transform.rotation,
    "t",
    (from, to) => shortestRotationDeltaDegrees(from, to),
  );
  const xExpression = buildTransformKeyframeExpression(
    keyframes,
    (transform) => transform.x,
    "t",
  );
  const yExpression = buildTransformKeyframeExpression(
    keyframes,
    (transform) => transform.y,
    "t",
  );
  const opacityExpression = buildTransformKeyframeExpression(
    keyframes,
    (transform) => transform.opacity,
    "N/" + formatNumber(plan.frameRate),
  );

  const scales = keyframes.map((keyframe) => keyframe.transform.scale);
  const rotations = keyframes.map((keyframe) => keyframe.transform.rotation);
  const hasDynamicScale = !allValuesEqual(scales) || scales[0] !== 1;
  const hasDynamicRotation = rotations.some((rotation) => rotation !== 0);
  const opacities = keyframes.map((keyframe) => keyframe.transform.opacity);
  const hasDynamicOpacity = !allValuesEqual(opacities) || opacities[0] !== 1;

  const maxScale = Math.max(...scales, 1);
  const rotatedExtent = Math.max(
    2,
    Math.ceil(
      Math.hypot(plan.width * maxScale, plan.height * maxScale) / 2,
    ) * 2,
  );

  const foregroundFilters = [
    "[" +
      segment.inputIndex +
      ":v:0]trim=start=" +
      formatSeconds(segment.sourceStartMs) +
      ":end=" +
      formatSeconds(segment.sourceEndMs),
    "setpts=PTS-STARTPTS",
    "fps=fps=" + formatNumber(plan.frameRate) + ":round=near",
    ...(preserveAlpha ? ["format=rgba"] : []),
    "scale=w=" +
      plan.width +
      ":h=" +
      plan.height +
      ":force_original_aspect_ratio=decrease",
    "pad=w=" +
      plan.width +
      ":h=" +
      plan.height +
      ":x=(ow-iw)/2:y=(oh-ih)/2" +
      (preserveAlpha ? ":color=black@0.0" : ""),
    ...(segment.visualEffects &&
    buildVisualEffectsFfmpegFilters(segment.visualEffects)
      ? [buildVisualEffectsFfmpegFilters(segment.visualEffects)]
      : []),
    ...cropFilters,
    ...(hasDynamicScale
      ? [
          "scale=w='iw*" +
            scaleExpression +
            "':h='ih*" +
            scaleExpression +
            "':eval=frame",
        ]
      : scaleExpression !== "1"
        ? [
            "scale=w=iw*" +
              formatNumber(scales[0]) +
              ":h=ih*" +
              formatNumber(scales[0]),
          ]
        : []),
    ...(hasDynamicRotation
      ? [
          "format=rgba",
          "rotate='" +
            radiansExpression(rotationExpression) +
            "':c=none:ow=" +
            rotatedExtent +
            ":oh=" +
            rotatedExtent,
        ]
      : []),
    ...(hasDynamicOpacity
      ? [
          "format=rgba",
          "geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*" +
            opacityExpression +
            "'",
        ]
      : opacities[0] !== 1
        ? [
            "format=rgba",
            "colorchannelmixer=aa=" + formatNumber(opacities[0]),
          ]
        : []),
  ];

  const backgroundLabel = "transform_bg_" + segment.inputIndex;
  const foregroundLabel = "transform_fg_" + segment.inputIndex;

  const backgroundFilter =
    "color=c=black@0.0:s=" +
    plan.width +
    "x" +
    plan.height +
    ":r=" +
    formatNumber(plan.frameRate) +
    ":d=" +
    formatSeconds(segment.durationMs) +
    ",format=rgba[" +
    backgroundLabel +
    "]";

  const overlayFilter =
    "[" +
    backgroundLabel +
    "][" +
    foregroundLabel +
    "]overlay=x='" +
    "(W-w)/2+" +
    "(" +
    xExpression +
    ")*" +
    formatNumber(plan.width / 100) +
    "':y='" +
    "(H-h)/2+" +
    "(" +
    yExpression +
    ")*" +
    formatNumber(plan.height / 100) +
    "':shortest=1";

  const normalization = includeOutputNormalization
    ? (preserveAlpha
        ? ",format=rgba,fps=fps=" +
          formatNumber(plan.frameRate) +
          ":round=near,setsar=1"
        : ",format=yuv420p,fps=fps=" +
          formatNumber(plan.frameRate) +
          ":round=near,setsar=1")
    : preserveAlpha
      ? ",format=rgba"
      : ",format=yuv420p";

  return (
    foregroundFilters.join(",") +
    "[" +
    foregroundLabel +
    "];" +
    backgroundFilter +
    ";" +
    overlayFilter +
    normalization +
    "[" +
    label +
    "]"
  );
}

function buildTransformKeyframeExpression(
  keyframes: ReturnType<typeof normalizeTransformKeyframes>,
  selector: (transform: ClipTransform) => number,
  timeExpression: string,
  interpolation?: (from: number, to: number) => number,
): string {
  const first = keyframes[0];
  if (!first) {
    return "0";
  }

  const getValue = selector;
  let expression = formatNumber(getValue(keyframes[keyframes.length - 1].transform));

  for (let index = keyframes.length - 2; index >= 0; index -= 1) {
    const current = keyframes[index];
    const next = keyframes[index + 1];
    const startSeconds = current.timeMs / 1000;
    const endSeconds = next.timeMs / 1000;
    const rangeSeconds = endSeconds - startSeconds;
    const fromValue = getValue(current.transform);
    const toValue = getValue(next.transform);
    const delta = interpolation
      ? interpolation(fromValue, toValue)
      : toValue - fromValue;
    const progress =
      "(" +
      timeExpression +
      "-" +
      formatNumber(startSeconds) +
      ")/" +
      formatNumber(rangeSeconds);
    const easedProgress = buildEasedProgress(progress, next.easing);
    const interpolated =
      formatNumber(fromValue) +
      "+(" +
      formatNumber(delta) +
      ")*(" +
      easedProgress +
      ")";
    expression = ffmpegIf(
      "lt(" +
        timeExpression +
        "," +
        formatNumber(endSeconds) +
        ")",
      interpolated,
      expression,
    );
  }

  return ffmpegIf(
    "lt(" +
      timeExpression +
      "," +
      formatNumber(first.timeMs / 1000) +
      ")",
    formatNumber(getValue(first.transform)),
    expression,
  );
}

function buildEasedProgress(
  progress: string,
  easing: TransformKeyframe["easing"],
): string {
  switch (easing) {
    case "ease-in":
      return "(" + progress + ")*(" + progress + ")";
    case "ease-out":
      return "1-(1-(" + progress + "))*(1-(" + progress + "))";
    case "ease-in-out":
      return ffmpegIf(
        "lt(" + progress + ",0.5)",
        "2*(" + progress + ")*(" + progress + ")",
        "1-pow(-2*(" + progress + ")+2,2)/2",
      );
    default:
      return progress;
  }
}

function ffmpegIf(condition: string, whenTrue: string, whenFalse: string): string {
  return "if(" + condition + "\\," + whenTrue + "\\," + whenFalse + ")";
}

function radiansExpression(degreesExpression: string): string {
  return "(" + degreesExpression + ")*PI/180";
}

function allValuesEqual(values: number[]): boolean {
  return values.every((value) => value === values[0]);
}

function shortestRotationDeltaDegrees(from: number, to: number): number {
  return ((to - from + 180) % 360 + 360) % 360 - 180;
}

function buildCompositedSegmentFilter(
  segment: RenderSegment,
  plan: RenderPlan,
  label: string,
  includeOutputNormalization: boolean,
  transform: ClipTransform,
  crop: ReturnType<typeof getClipCrop>,
  cropPosition: ReturnType<typeof getClipCropPosition>,
  preserveAlpha = false,
): string {
  const foregroundLabel = "transform_fg_" + segment.inputIndex;
  const backgroundLabel = "transform_bg_" + segment.inputIndex;
  const translationX = formatNumber((transform.x / 100) * plan.width);
  const translationY = formatNumber((transform.y / 100) * plan.height);
  const rotationRadians = formatNumber(
    (transform.rotation * Math.PI) / 180,
  );
  const visibleWidth = Math.max(
    0.001,
    1 - crop.left - crop.right,
  );
  const visibleHeight = Math.max(
    0.001,
    1 - crop.top - crop.bottom,
  );

  const cropFilters = isDefaultCrop(crop)
    ? []
    : [
        "format=rgba",
        "crop=w=trunc(iw*" +
          formatNumber(visibleWidth) +
          "):h=trunc(ih*" +
          formatNumber(visibleHeight) +
          "):x=trunc(iw*(" +
          formatNumber(cropPosition.x) +
          "-" +
          formatNumber(visibleWidth / 2) +
          ")):y=trunc(ih*(" +
          formatNumber(cropPosition.y) +
          "-" +
          formatNumber(visibleHeight / 2) +
          "))",
        "pad=w=iw/" +
          formatNumber(visibleWidth) +
          ":h=ih/" +
          formatNumber(visibleHeight) +
          ":x=(iw/" +
          formatNumber(visibleWidth) +
          ")*" +
          formatNumber(crop.left) +
          ":y=(ih/" +
          formatNumber(visibleHeight) +
          ")*" +
          formatNumber(crop.top) +
          ":color=black@0",
      ];

  const foregroundFilters = [
    "[" +
      segment.inputIndex +
      ":v:0]trim=start=" +
      formatSeconds(segment.sourceStartMs) +
      ":end=" +
      formatSeconds(segment.sourceEndMs),
    "setpts=PTS-STARTPTS",
    "scale=w=" +
      plan.width +
      ":h=" +
      plan.height +
      ":force_original_aspect_ratio=decrease",
    ...(segment.visualEffects &&
    buildVisualEffectsFfmpegFilters(segment.visualEffects)
      ? [buildVisualEffectsFfmpegFilters(segment.visualEffects)]
      : []),
    ...cropFilters,
    transform.scale !== 1
      ? "scale=w=iw*" +
        formatNumber(transform.scale) +
        ":h=ih*" +
        formatNumber(transform.scale)
      : null,
    transform.rotation !== 0
      ? [
          "format=rgba",
          "rotate=" +
            rotationRadians +
            ":c=none:ow=rotw(" +
            rotationRadians +
            "):oh=roth(" +
            rotationRadians +
            ")",
        ]
      : null,
    transform.opacity !== 1 ? "format=rgba" : null,
    transform.opacity !== 1
      ? "colorchannelmixer=aa=" + formatNumber(transform.opacity)
      : null,
  ]
    .flat()
    .filter((value): value is string => value !== null);

  const backgroundFilter =
    "color=c=black@0.0:s=" +
    plan.width +
    "x" +
    plan.height +
    ":r=" +
    formatNumber(plan.frameRate) +
    ":d=" +
    formatSeconds(segment.durationMs) +
    ",format=rgba[" +
    backgroundLabel +
    "]";

  const overlayFilter =
    "[" +
    backgroundLabel +
    "][" +
    foregroundLabel +
    "]overlay=x=(W-w)/2+" +
    translationX +
    ":y=(H-h)/2+" +
    translationY +
    ":shortest=1";

  const normalization = includeOutputNormalization
    ? ",fps=fps=" +
      formatNumber(plan.frameRate) +
      ":round=near,setsar=1"
    : "";

  return (
    foregroundFilters.join(",") +
    "[" +
    foregroundLabel +
    "];" +
    backgroundFilter +
    ";" +
    overlayFilter +
    (preserveAlpha ? ",format=rgba" : ",format=yuv420p") +
    normalization +
    "[" +
    label +
    "]"
  );
}

function hasAnchorSensitiveStaticTransform(
  transform: ClipTransform,
  anchor: { x: number; y: number },
): boolean {
  return (
    (anchor.x !== 0.5 || anchor.y !== 0.5) &&
    (transform.scale !== 1 || transform.rotation !== 0)
  );
}

function hasAnchorSensitiveAnimatedTransform(
  keyframes: ReturnType<typeof normalizeTransformKeyframes>,
  anchor: { x: number; y: number },
): boolean {
  return (
    (anchor.x !== 0.5 || anchor.y !== 0.5) &&
    keyframes.some(
      (keyframe) =>
        keyframe.transform.scale !== 1 ||
        keyframe.transform.rotation !== 0,
    )
  );
}

function buildAnchorAwareCompositedSegmentFilter(
  segment: RenderSegment,
  plan: RenderPlan,
  label: string,
  includeOutputNormalization: boolean,
  transform: ClipTransform,
  keyframes: ReturnType<typeof normalizeTransformKeyframes> = [],
  preserveAlpha = false,
): string {
  const anchor = segment.transformAnchor ?? { x: 0.5, y: 0.5 };
  const isAnimated = keyframes.length > 0;
  const effectiveKeyframes = isAnimated
    ? keyframes
    : [
        {
          timeMs: 0,
          transform,
          easing: "linear" as const,
        },
      ];

  const crop = getClipCrop(segment.crop);
  const cropPosition = getClipCropPosition(crop, segment.cropPosition);
  const visibleWidth = Math.max(0.001, 1 - crop.left - crop.right);
  const visibleHeight = Math.max(0.001, 1 - crop.top - crop.bottom);

  const cropFilters = isDefaultCrop(crop)
    ? []
    : [
        "format=rgba",
        "crop=w=trunc(iw*" +
          formatNumber(visibleWidth) +
          "):h=trunc(ih*" +
          formatNumber(visibleHeight) +
          "):x=trunc(iw*(" +
          formatNumber(cropPosition.x) +
          "-" +
          formatNumber(visibleWidth / 2) +
          ")):y=trunc(ih*(" +
          formatNumber(cropPosition.y) +
          "-" +
          formatNumber(visibleHeight / 2) +
          "))",
        "pad=w=iw/" +
          formatNumber(visibleWidth) +
          ":h=ih/" +
          formatNumber(visibleHeight) +
          ":x=(iw/" +
          formatNumber(visibleWidth) +
          ")*" +
          formatNumber(crop.left) +
          ":y=(ih/" +
          formatNumber(visibleHeight) +
          ")*" +
          formatNumber(crop.top) +
          ":color=black@0",
      ];

  const scaleExpression = isAnimated
    ? buildTransformKeyframeExpression(
        effectiveKeyframes,
        (current) => current.scale,
        "t",
      )
    : formatNumber(transform.scale);
  const rotationExpression = isAnimated
    ? buildTransformKeyframeExpression(
        effectiveKeyframes,
        (current) => current.rotation,
        "t",
        (from, to) => shortestRotationDeltaDegrees(from, to),
      )
    : formatNumber(transform.rotation);
  const xExpression = isAnimated
    ? buildTransformKeyframeExpression(
        effectiveKeyframes,
        (current) => current.x,
        "t",
      )
    : formatNumber(transform.x);
  const yExpression = isAnimated
    ? buildTransformKeyframeExpression(
        effectiveKeyframes,
        (current) => current.y,
        "t",
      )
    : formatNumber(transform.y);
  const opacityExpression = isAnimated
    ? buildTransformKeyframeExpression(
        effectiveKeyframes,
        (current) => current.opacity,
        "N/" + formatNumber(plan.frameRate),
      )
    : formatNumber(transform.opacity);

  const scales = effectiveKeyframes.map((keyframe) => keyframe.transform.scale);
  const rotations = effectiveKeyframes.map(
    (keyframe) => keyframe.transform.rotation,
  );
  const maxScale = Math.max(...scales, 1);
  const maxAnchorX = Math.max(anchor.x, 1 - anchor.x);
  const maxAnchorY = Math.max(anchor.y, 1 - anchor.y);
  const transformedContentRadius = Math.hypot(
    plan.width * maxScale * maxAnchorX,
    plan.height * maxScale * maxAnchorY,
  );
  const surfaceExtent = Math.max(
    2,
    Math.ceil(transformedContentRadius) * 2,
  );
  const hasDynamicScale = isAnimated;
  const hasDynamicRotation = isAnimated || rotations[0] !== 0;
  const foregroundFilters = [
    "[" +
      segment.inputIndex +
      ":v:0]trim=start=" +
      formatSeconds(segment.sourceStartMs) +
      ":end=" +
      formatSeconds(segment.sourceEndMs),
    "setpts=PTS-STARTPTS",
    ...(isAnimated
      ? ["fps=fps=" + formatNumber(plan.frameRate) + ":round=near"]
      : []),
    "scale=w=" +
      plan.width +
      ":h=" +
      plan.height +
      ":force_original_aspect_ratio=decrease",
    ...(segment.visualEffects &&
    buildVisualEffectsFfmpegFilters(segment.visualEffects)
      ? [buildVisualEffectsFfmpegFilters(segment.visualEffects)]
      : []),
    ...cropFilters,
    ...(hasDynamicScale || transform.scale !== 1
      ? [
          "scale=w='iw*" +
            scaleExpression +
            "':h='ih*" +
            scaleExpression +
            "':eval=frame",
        ]
      : []),
    "format=rgba[" +
      "anchor_scaled_" +
      segment.inputIndex +
      "]",
  ];

  const anchorBackgroundLabel = "anchor_bg_" + segment.inputIndex;
  const anchorScaledLabel = "anchor_scaled_" + segment.inputIndex;
  const anchorPivotLabel = "anchor_pivot_" + segment.inputIndex;
  const anchorRotatedLabel = "anchor_rotated_" + segment.inputIndex;
  const translationX = "(" + xExpression + ")*" + formatNumber(plan.width / 100);
  const translationY = "(" + yExpression + ")*" + formatNumber(plan.height / 100);
  const angleExpression = radiansExpression(rotationExpression);
  const pivotOverlayX =
    "'(W/2)-(" +
    formatNumber(anchor.x) +
    ")*w'";
  const pivotOverlayY =
    "'(H/2)-(" +
    formatNumber(anchor.y) +
    ")*h'";

  const pivotBackground =
    "color=c=black@0.0:s=" +
    surfaceExtent +
    "x" +
    surfaceExtent +
    ":r=" +
    formatNumber(plan.frameRate) +
    ":d=" +
    formatSeconds(segment.durationMs) +
    ",format=rgba[" +
    anchorBackgroundLabel +
    "]";

  const pivotComposite =
    "[" +
    anchorBackgroundLabel +
    "][" +
    anchorScaledLabel +
    "]overlay=x=" +
    pivotOverlayX +
    ":y=" +
    pivotOverlayY +
    ":shortest=1,format=rgba[" +
    anchorPivotLabel +
    "]";

  const rotatedFilters = hasDynamicRotation
    ? "[" +
      anchorPivotLabel +
      "]rotate='" +
      angleExpression +
      "':c=none:ow=" +
      surfaceExtent +
      ":oh=" +
      surfaceExtent +
      ",format=rgba[" +
      anchorRotatedLabel +
      "]"
    : "[" +
      anchorPivotLabel +
      "]format=rgba[" +
      anchorRotatedLabel +
      "]";

  const visualLabel = anchorRotatedLabel;
  const outputLabel =
    isAnimated || transform.opacity !== 1 ? label : visualLabel;
  const foregroundOpacity =
    isAnimated
      ? "[" +
        visualLabel +
        "]geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*" +
        opacityExpression +
        "'[" +
        label +
        "]"
      : transform.opacity !== 1
        ? "[" +
          visualLabel +
          "]colorchannelmixer=aa=" +
          formatNumber(transform.opacity) +
          "[" +
          label +
          "]"
        : "";
  const backgroundLabel = "anchor_output_bg_" + segment.inputIndex;
  const backgroundFilter =
    "color=c=black@0.0:s=" +
    plan.width +
    "x" +
    plan.height +
    ":r=" +
    formatNumber(plan.frameRate) +
    ":d=" +
    formatSeconds(segment.durationMs) +
    ",format=rgba[" +
    backgroundLabel +
    "]";

  const overlayFilter =
    "[" +
    backgroundLabel +
    "][" +
    outputLabel +
    "]overlay=x='(W-w)/2+" +
    translationX +
    "':y='(H-h)/2+" +
    translationY +
    "':shortest=1";

  const normalization = includeOutputNormalization
    ? (preserveAlpha
        ? ",format=rgba,fps=fps=" +
          formatNumber(plan.frameRate) +
          ":round=near,setsar=1"
        : ",format=yuv420p,fps=fps=" +
          formatNumber(plan.frameRate) +
          ":round=near,setsar=1")
    : preserveAlpha
      ? ",format=rgba"
      : ",format=yuv420p";

  const filterParts = [
    foregroundFilters.slice(0, -1).join(",") + "[" + anchorScaledLabel + "]",
    pivotBackground,
    pivotComposite,
    rotatedFilters,
    ...(foregroundOpacity ? [foregroundOpacity] : []),
    backgroundFilter,
    overlayFilter + normalization,
  ];

  return filterParts.join(";");
}

function isDefaultTransform(transform: ClipTransform): boolean {
  const normalized = normalizeClipTransform(transform);

  return (
    normalized.x === 0 &&
    normalized.y === 0 &&
    normalized.scale === 1 &&
    normalized.rotation === 0 &&
    normalized.opacity === 1
  );
}

function isDefaultCrop(
  crop: ReturnType<typeof getClipCrop>,
): boolean {
  return (
    crop.top === 0 &&
    crop.right === 0 &&
    crop.bottom === 0 &&
    crop.left === 0
  );
}

function assertSupportedVisualMetadata(segment: RenderSegment): void {
  if (segment.isMuted) {
    throw new Error(
      "M3.36 does not compile track mute state yet; audio/video graph policy is deferred.",
    );
  }
}

function formatSeconds(milliseconds: number): string {
  return formatNumber(milliseconds / 1000);
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
