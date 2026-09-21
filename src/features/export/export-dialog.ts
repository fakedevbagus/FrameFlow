import { save } from "@tauri-apps/plugin-dialog";

const exportFilter = [{ name: "MP4 video", extensions: ["mp4"] }];

export async function chooseExportOutputPath(
  fileName: string,
): Promise<string | null> {
  const path = await save({
    defaultPath: fileName,
    filters: exportFilter,
    title: "Choose export destination",
  });

  return path;
}
