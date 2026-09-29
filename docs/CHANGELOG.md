# M3.207 — Media Server Path Length Cap — active — 2026-09-30

- Branch: `fix/m3-207-media-server-path-length-cap`.
- Fresh audit found the local HTTP media server had a separate media-path validator without the 4,096-byte path boundary.
- Added the shared 4,096-byte media path limit to the media server before canonicalization/filesystem probing.
- Reused `MAX_MEDIA_PATH_BYTES` from the native command layer.
- Preserved capability-token, allowlist, media-type, identity, range, and response behavior.
- Added exact-limit and over-limit regression coverage.
- No project schema change.
- Implementation complete; local validation pending user run. Do not infer test/build/lint/cargo success.

## M3.206 — Shared Media Path Length Cap — completed — 2026-09-30

- Branch: `fix/m3-206-shared-media-path-length-cap`.
- PR #223; squash-merged at `a1ca15bcb9468f5cc40c9a9b6ee75803ef215781`.
- `main` was verified identical to the merge SHA.
- User reported PASS after full local validation.
- Added a centralized 4,096-byte path limit to the shared `media_path()` helper before filesystem probing.
- Added exact-limit and over-limit regression coverage.
- No project schema change.

Next step:
- Fresh audit from verified `main` identified M3.207: media-server path length cap.

# M3.206 — Shared Media Path Length Cap — active — 2026-09-30

- Branch: `fix/m3-206-shared-media-path-length-cap`.
- Fresh audit found the shared `media_path()` helper accepted arbitrarily long media path strings before filesystem probing.
- Scope: reject shared media paths above 4,096 bytes through one centralized validation boundary.
- Preserve existing media inspection, preview, waveform, native export, multi-segment render, and video-graph behavior.
- Add focused exact-limit and over-limit regression coverage.
- No project schema change.
- Implementation complete; local validation pending user run. Do not infer test/build/lint/cargo success.

## M3.205 — Native Audio Graph Input Path Length Cap — completed — 2026-09-30

- Branch: `fix/m3-205-native-audio-graph-input-path-cap`.
- PR #222; squash-merged at `44a3e7926cfdaada243a7bc9b64200a1d8759d03`.
- `main` was verified identical to the merge SHA.
- User reported PASS after full local validation: 529/529 frontend tests, lint PASS, frontend build PASS, and 137/137 Rust tests.
- Added a 4,096-byte cap to each `NativeAudioGraphRenderRequest.inputs` path before filesystem probing.
- Added exact-limit and over-limit regression coverage.
- No project schema change.
- Protected PR #76 and unrelated PR #22 remained untouched.

Next step:
- Fresh audit from verified `main` identified M3.206: shared media path length cap.

### M3.204 — Legacy Video/Audio Mix Video Input Path Length Cap — completed — 2026-09-30

- Branch: `fix/m3-204-video-audio-mix-video-input-path-cap`.
- PR #221; squash-merged at `a23e35fe3a3b0fb9a78dbcc46e1fe5228287b0c1`.
- `main` was verified identical to the merge SHA.
- User reported PASS after full validation.
- Added a 4,096-byte cap to the legacy video/audio mix primary video source path before filesystem/media probing.
- Added exact-limit and over-limit regression coverage.
- Corrected the exact-limit fixture to include `.mp4` while retaining the intended 4,096-byte boundary.
- Validation reported: 529/529 frontend tests, successful lint/build, and 135/135 Rust tests.
- Protected PR #76 and unrelated PR #22 remained untouched.

### M3.203 — Legacy Video/Audio Mix Audio Filter Size Cap — completed — 2026-09-30

- Branch: `fix/m3-203-video-audio-mix-audio-filter-size-cap`.
- PR #220; squash-merged at `558bb5000138f1d384c62eb69f97f08993f280ab`.
- `main` was verified identical to the merge SHA.
- Added a maximum of 256 KiB for legacy video/audio mix `audio_filter_complex` and rejected oversized graphs before filesystem probing.
- Preserved existing input, path, duration, map, source identity, rendering, cleanup, and audio-graph behavior.
- Added focused exact-limit and over-limit regression coverage.
- Full user validation passed: npm install/lint/tests/build and Rust tests; Rust reported 133 passed and 0 failed.
- Validation also exposed and resolved existing repository correctness/type/test issues without weakening M3.203 resource-boundary semantics.
- No project schema change.
- Protected PR #76 and unrelated PR #22 were untouched.

Next step:
- Fresh audit from verified `main` identified M3.204: legacy video/audio mix video source path length cap.

### M3.202 — Legacy Video/Audio Mix Audio Input Path Length Cap — completed — 2026-09-29

- Branch: `fix/m3-202-video-audio-mix-audio-input-path-cap`.
- Fresh audit found individual `NativeVideoWithAudioGraphRenderRequest.audio_inputs` path strings had no maximum length validation after the input count was bounded.
- A pathological audio input path could therefore increase request memory and path-processing work before filesystem validation.
- Added a maximum of 4,096 bytes per legacy video/audio mix audio input path and reject oversized values during metadata validation before filesystem probing.
- Preserved existing input count, media-type, absolute-path, existence, source identity, rendering, cleanup, and audio-graph behavior.
- Added focused regression coverage at 4,096 and 4,097 bytes.
- No project schema change.
- Implementation is complete; user local validation is pending. Do not assume lint/test/build/cargo/manual validation has passed.
- Next step: run the local validation workflow; after PASS follow the standard refresh → merge → docs → verify main → fresh audit workflow.

### M3.201 — Legacy Video/Audio Mix Audio Input Count Cap — completed — 2026-09-29
