import { describe, expect, it } from "vitest";
import {
  buildVisualEffectsCssFilter,
  buildVisualEffectsFfmpegFilters,
} from "./visual-effects";

describe("visual effects helpers", () => {
  it("omits CSS filters for default adjustments", () => {
    expect(
      buildVisualEffectsCssFilter({
        brightness: 0,
        contrast: 0,
        saturation: 0,
      }),
    ).toBeUndefined();
  });

  it("builds CSS brightness, contrast, and saturation filters", () => {
    expect(
      buildVisualEffectsCssFilter({
        brightness: 0.25,
        contrast: -0.5,
        saturation: 0.4,
      }),
    ).toBe("brightness(125%) contrast(50%) saturate(140%)");
  });

  it("builds the matching FFmpeg eq filter", () => {
    expect(
      buildVisualEffectsFfmpegFilters({
        brightness: 0.25,
        contrast: -0.5,
        saturation: 0.4,
      }),
    ).toBe("eq=brightness=0.25:contrast=0.5:saturation=1.4");
  });

  it("omits FFmpeg filters for default adjustments", () => {
    expect(
      buildVisualEffectsFfmpegFilters({
        brightness: 0,
        contrast: 0,
        saturation: 0,
      }),
    ).toBeUndefined();
  });
});
