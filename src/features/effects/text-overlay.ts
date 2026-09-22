import { getTextOverlay, type TextOverlay } from "../project/domain";

export const TEXT_OVERLAY_RENDER_FONT = "DejaVu Sans";

export function buildTextOverlayFfmpegFilter(
  overlay: TextOverlay | undefined,
): string | undefined {
  const normalized = normalizeTextOverlayForRender(overlay);

  if (!normalized) {
    return undefined;
  }

  const xExpression =
    normalized.alignment === "left"
      ? "w*" + formatNumber(normalized.x)
      : normalized.alignment === "right"
        ? "w*" + formatNumber(normalized.x) + "-text_w"
        : "(w-text_w)*" + formatNumber(normalized.x);
  const yExpression = "(h-text_h)*" + formatNumber(normalized.y);

  return [
    "drawtext=font='" + TEXT_OVERLAY_RENDER_FONT + "'",
    "text='" + escapeDrawtextText(normalized.text) + "'",
    "fontsize=" + normalized.fontSize,
    "fontcolor=" + normalized.color,
    "x=" + xExpression,
    "y=" + yExpression,
    "line_spacing=4",
    "expansion=none",
  ].join(":");
}

function normalizeTextOverlayForRender(
  overlay: TextOverlay | undefined,
): TextOverlay | undefined {
  if (!overlay) {
    return undefined;
  }

  return getTextOverlay({
    id: "text-overlay-render",
    assetId: "text-overlay-render",
    timelineStartMs: 0,
    sourceStartMs: 0,
    sourceEndMs: 1,
    textOverlay: overlay,
  });
}

function escapeDrawtextText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/'/g, "\\'");
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
