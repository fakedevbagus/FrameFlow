import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createProject } from "../project/domain";
import { ExportPanel } from "./ExportPanel";

describe("ExportPanel", () => {
  it("shows project-derived source export settings", () => {
    const project = createProject({ id: "export-panel" });
    project.canvas = { width: 1080, height: 1920, frameRate: 60 };

    render(<ExportPanel project={project} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Export settings" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Export quality" })).toHaveValue("source");
    expect(screen.getByText("1080 × 1920")).toBeInTheDocument();
    expect(screen.getByText("60 fps")).toBeInTheDocument();
  });

  it("updates output dimensions for standard quality presets", () => {
    const project = createProject({ id: "export-quality" });
    project.canvas = { width: 1920, height: 1080, frameRate: 30 };

    render(<ExportPanel project={project} onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Export quality" }), {
      target: { value: "720p" },
    });

    expect(
      screen.getByRole("dialog", { name: "Export settings" }),
    ).toHaveTextContent("1280 × 720");
    expect(
      screen.getByRole("textbox", { name: "Export file name" }),
    ).toHaveValue("Untitled project.mp4");
  });

  it("closes through the provided callback", () => {
    const onClose = vi.fn();
    const project = createProject({ id: "export-close" });

    render(<ExportPanel project={project} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close export settings" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
