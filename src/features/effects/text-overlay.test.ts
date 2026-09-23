import { describe, expect, it } from "vitest";
import {
  buildTextOverlayFfmpegFilter,
  TEXT_OVERLAY_RENDER_FONT,
} from "./text-overlay";

describe("text overlay ffmpeg renderer", () => {
  it("omits an empty overlay", () => {
    expect(buildTextOverlayFfmpegFilter(undefined)).toBeUndefined();
    expect(
      buildTextOverlayFfmpegFilter({
        text: "   ",
        x: 0.5,
        y: 0.5,
        fontSize: 56,
        color: "#ffffff",
        alignment: "center",
      }),
    ).toBeUndefined();
  });

  it("compiles a centered overlay with normalized position", () => {
    expect(
      buildTextOverlayFfmpegFilter({
        text: "Hello FrameFlow",
        x: 0.5,
        y: 0.25,
        fontSize: 72,
        color: "#aabbcc",
        alignment: "center",
      }),
    ).toBe(
      "drawtext=font='DejaVu Sans':text='Hello FrameFlow':fontsize=72:fontcolor=#aabbcc:x=(w-text_w)*0.5:y=(h-text_h)*0.25:line_spacing=4:expansion=none",
    );
    expect(TEXT_OVERLAY_RENDER_FONT).toBe("DejaVu Sans");
  });

  it("uses left and right anchor expressions", () => {
    expect(
      buildTextOverlayFfmpegFilter({
        text: "Left",
        x: 0.2,
        y: 0.5,
        fontSize: 40,
        color: "#ffffff",
        alignment: "left",
      }),
    ).toContain("x=w*0.2");

    expect(
      buildTextOverlayFfmpegFilter({
        text: "Right",
        x: 0.8,
        y: 0.5,
        fontSize: 40,
        color: "#ffffff",
        alignment: "right",
      }),
    ).toContain("x=w*0.8-text_w");
  });

  it("escapes drawtext delimiters and preserves multiline text", () => {
    expect(
      buildTextOverlayFfmpegFilter({
        text: "100%\\ready, now:\\nnext; okay",
        x: 0.5,
        y: 0.5,
        fontSize: 56,
        color: "#ffffff",
        alignment: "center",
      }),
    ).toContain(
      "text='100%\\\\ready\\, now\\:\\\\nnext\\; okay'",
    );
  });
});
