import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { MediaAsset, MediaType } from "../project/domain";

interface MediaProbe {
  mediaType: MediaType;
  durationMs: number | null;
}

const mediaFilters = [
  {
    name: "Media",
    extensions: [
      "aac",
      "avi",
      "avif",
      "bmp",
      "flac",
      "gif",
      "jpeg",
      "jpg",
      "m4a",
      "mkv",
      "mov",
      "mp3",
      "mp4",
      "mpeg",
      "mpg",
      "ogg",
      "opus",
      "png",
      "wav",
      "webm",
      "webp",
    ],
  },
];

export async function importMediaFiles(): Promise<MediaAsset[]> {
  const selection = await open({
    directory: false,
    filters: mediaFilters,
    multiple: true,
    title: "Import media",
  });
  const paths = normalizeSelection(selection);

  return Promise.all(paths.map(createMediaAsset));
}

export async function createMediaAsset(path: string): Promise<MediaAsset> {
  const probe = await invoke<MediaProbe>("inspect_media", { path });

  return {
    id: crypto.randomUUID(),
    name: fileName(path),
    mediaType: probe.mediaType,
    sourcePath: path,
    durationMs: probe.durationMs,
  };
}

function normalizeSelection(selection: string | string[] | null): string[] {
  if (selection === null) {
    return [];
  }

  return Array.isArray(selection) ? selection : [selection];
}

function fileName(path: string): string {
  const segments = path.split(/[\\/]/);

  return segments[segments.length - 1] || path;
}
