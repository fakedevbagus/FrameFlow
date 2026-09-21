import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExportPanel } from "./ExportPanel";
import { createProject } from "../project/domain";

const { chooseExportOutputPath } = vi.hoisted(() => ({
  chooseExportOutputPath: vi.fn(),
}));

vi.mock("./export-dialog", () => ({
  chooseExportOutputPath,
}));

describe("ExportPanel", () => {
  it("shows source settings by default", () => {
    render(<ExportPanel project={createProject()} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Export settings" });

    expect(dialog).toHaveTextContent("1080 × 1920");
    expect(dialog).toHaveTextContent("30 fps");
    expect(
      screen.getByRole("textbox", { name: "Export file name" }),
    ).toHaveValue("Untitled project.mp4");
  });

  it("shows the selected quality dimensions", () => {
    render(<ExportPanel project={createProject()} onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Export quality" }), {
      target: { value: "720p" },
    });

    expect(
      screen.getByRole("dialog", { name: "Export settings" }),
    ).toHaveTextContent("406 × 720");
  });

  it("closes through the supplied callback", () => {
    const onClose = vi.fn();

    render(<ExportPanel project={createProject()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close export settings" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("lets the user choose and displays an output destination", async () => {
    chooseExportOutputPath.mockResolvedValueOnce("/home/user/Exports/demo.mp4");

    render(<ExportPanel project={createProject()} onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Choose export destination" }),
    );

    expect(await screen.findByText("/home/user/Exports/demo.mp4")).toBeInTheDocument();
    expect(chooseExportOutputPath).toHaveBeenCalledWith("Untitled project.mp4");
  });
});
