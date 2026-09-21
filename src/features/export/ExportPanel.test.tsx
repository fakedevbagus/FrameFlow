import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExportPanel } from "./ExportPanel";
import { createProject } from "../project/domain";

const {
  chooseExportOutputPath,
  requestExportJobCancellation,
  runExportJob,
} = vi.hoisted(() => ({
  chooseExportOutputPath: vi.fn(),
  requestExportJobCancellation: vi.fn(),
  runExportJob: vi.fn(),
}));

vi.mock("./export-dialog", () => ({
  chooseExportOutputPath,
}));

vi.mock("./export-runner", () => ({
  requestExportJobCancellation,
  runExportJob,
}));

describe("ExportPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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


  it("exports to the selected destination and shows completion", async () => {
    chooseExportOutputPath.mockResolvedValueOnce("/home/user/Exports/demo.mp4");
    runExportJob.mockImplementationOnce(
      async (_project, _request, onUpdate) => {
        const running = {
          id: "export-test",
          phase: "running",
          progress: 0,
          request: _request,
          errorMessage: null,
          outputPath: null,
        };
        onUpdate?.(running);

        const completed = {
          ...running,
          phase: "completed",
          progress: 1,
          outputPath: "/home/user/Exports/demo.mp4",
        };
        onUpdate?.(completed);
        return completed;
      },
    );

    render(<ExportPanel project={createProject()} onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Choose export destination" }),
    );
    await screen.findByText("/home/user/Exports/demo.mp4");

    fireEvent.click(screen.getByRole("button", { name: "Export video" }));

    expect(await screen.findByText("Export completed")).toBeInTheDocument();
    expect(runExportJob).toHaveBeenCalledTimes(1);
    expect(runExportJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        outputPath: "/home/user/Exports/demo.mp4",
      }),
      expect.any(Function),
    );
  });

  it("shows the full renderer error when export fails", async () => {
    chooseExportOutputPath.mockResolvedValueOnce("/home/user/Exports/demo.mp4");
    runExportJob.mockImplementationOnce(
      async (_project, _request, onUpdate) => {
        const failed = {
          id: "export-failed",
          phase: "failed",
          progress: 0,
          request: _request,
          errorMessage: "FFmpeg could not render the requested video graph: detailed stderr",
          outputPath: null,
        };
        onUpdate?.(failed);
        return failed;
      },
    );

    render(<ExportPanel project={createProject()} onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Choose export destination" }),
    );
    await screen.findByText("/home/user/Exports/demo.mp4");

    fireEvent.click(screen.getByRole("button", { name: "Export video" }));

    expect(
      await screen.findByText(
        "FFmpeg could not render the requested video graph: detailed stderr",
      ),
    ).toBeInTheDocument();
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

  it("shows render progress and requests cancellation", async () => {
    chooseExportOutputPath.mockResolvedValueOnce("/home/user/Exports/demo.mp4");
    runExportJob.mockImplementationOnce(
      async (_project, _request, onUpdate) => {
        const running = {
          id: "export-progress",
          phase: "running",
          progress: 0.42,
          request: _request,
          errorMessage: null,
          outputPath: null,
        };
        onUpdate?.(running);
        return running;
      },
    );

    render(<ExportPanel project={createProject()} onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Choose export destination" }),
    );
    await screen.findByText("/home/user/Exports/demo.mp4");
    fireEvent.click(screen.getByRole("button", { name: "Export video" }));

    expect(await screen.findByRole("progressbar", { name: "Export progress" })).toHaveValue(
      0.42,
    );
    expect(screen.getByText("42%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel export" }));

    expect(requestExportJobCancellation).toHaveBeenCalledWith("export-progress");
  });
});
