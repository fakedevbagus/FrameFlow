import type { VisualEffects } from "../project/domain";

export function buildVisualEffectsCssFilter(
  effects: VisualEffects,
): string | undefined {
  const filters: string[] = [];

  if (effects.brightness !== 0) {
    filters.push("brightness(" + formatPercent(1 + effects.brightness) + "%)");
  }

  if (effects.contrast !== 0) {
    filters.push("contrast(" + formatPercent(1 + effects.contrast) + "%)");
  }

  if (effects.saturation !== 0) {
    filters.push("saturate(" + formatPercent(1 + effects.saturation) + "%)");
  }

  return filters.length > 0 ? filters.join(" ") : undefined;
}

export function buildVisualEffectsFfmpegFilters(
  effects: VisualEffects,
): string | undefined {
  if (
    effects.brightness === 0 &&
    effects.contrast === 0 &&
    effects.saturation === 0
  ) {
    return undefined;
  }

  return (
    "eq=brightness=" +
    formatNumber(effects.brightness) +
    ":contrast=" +
    formatNumber(1 + effects.contrast) +
    ":saturation=" +
    formatNumber(1 + effects.saturation)
  );
}

function formatPercent(value: number): string {
  return formatNumber(value * 100);
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
