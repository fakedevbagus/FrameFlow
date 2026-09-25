# Project format

FrameFlow stores each project as a versioned JSON document. The first schema version contains project metadata, canvas settings, media assets, and ordered audio/video tracks.

## Rules

- Every document declares `schemaVersion`.
- Unsupported schema versions are rejected instead of being modified silently.
- Times are stored in milliseconds.
- Canvas frame rates must be finite, greater than 0, and no more than 240 fps; supported fractional frame rates remain valid.
- Source paths point to local media and may need relinking when media moves.
- Cache and generated proxy files do not belong in the project document.

## Default project

A new project uses a vertical 1080 Ã— 1920 canvas at 30 fps and contains one video track plus one audio track.
