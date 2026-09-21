import { beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeToExportProgress } from "./export-progress";

const { listen } = vi.hoisted(() => ({
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen,
}));

describe("export progress subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters unrelated jobs and clamps matching progress", async () => {
    const handler = vi.fn();
    const unlisten = vi.fn();

    listen.mockResolvedValueOnce(unlisten);

    let listener: ((event: { payload: unknown }) => void) | undefined;
    listen.mockImplementationOnce(async (_eventName, callback) => {
      listener = callback;
      return unlisten;
    });

    await subscribeToExportProgress("job-1", handler);

    listener?.({
      payload: {
        jobId: "job-2",
        stage: "video",
        progress: 0.9,
      },
    });
    listener?.({
      payload: {
        jobId: "job-1",
        stage: "video",
        progress: 1.4,
      },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      jobId: "job-1",
      stage: "video",
      progress: 1,
    });
    expect(listen).toHaveBeenCalledWith(
      "export-progress",
      expect.any(Function),
    );
  });
});
