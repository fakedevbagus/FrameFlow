## M3.207 — Media Server Path Length Cap — active — 2026-09-30

Branch:
`fix/m3-207-media-server-path-length-cap`

Previous milestone:
- M3.206 — Shared Media Path Length Cap
- PR #223
- Squash merge SHA: `a1ca15bcb9468f5cc40c9a9b6ee75803ef215781`
- `main` verified identical to that merge SHA.
- User reported PASS after full local validation.

Fresh audit finding:
- `src-tauri/src/media_server.rs` maintains a separate `validate_media_path()` boundary for local HTTP media access.
- That validator had no 4,096-byte path limit, so media paths arriving through the local media-server URL/request path remained unbounded before canonicalization/filesystem probing.

Scope:
- Enforce the shared 4,096-byte media path contract in the media server.
- Reject oversized decoded media paths before canonicalization.
- Reuse the shared `MAX_MEDIA_PATH_BYTES` constant from the native command layer.
- Preserve existing capability-token, path-allowlist, media-type, identity, range, and response behavior.
- Add exact-limit and over-limit regression coverage.
- No project schema change.

M3.207 validation correction:
- Initial user validation reached 529/529 frontend tests and successful client build, but `cargo test` failed because the two new media-server boundary tests omitted `validate_media_path_length` from their local test-module imports.
- Corrected the test import only; no production boundary or scope change.
- Follow-up Rust validation found the over-limit regression fixture borrowed a temporary `String`; changed it to a local binding so the `Path` borrow has a valid lifetime. No production behavior or scope change.

Validation:
- Implementation complete.
- Local validation pending user run; do not infer lint/test/build/cargo/manual success.

Next step:
- Run the complete Pull/Fetch + Validation workflow for M3.207.
- After user PASS, refresh PR/head/base state, mark Ready for Review, squash-merge using the freshly verified head SHA, verify `main`, reconcile all three docs, perform a fresh audit, and create the next focused milestone.

## M3.206 — Shared Media Path Length Cap — active — 2026-09-30

Branch:
`fix/m3-206-shared-media-path-length-cap`

Previous milestone:
- M3.205 — Native Audio Graph Input Path Length Cap
- PR #222
- Squash merge SHA: `44a3e7926cfdaada243a7bc9b64200a1d8759d03`
- `main` verified identical to that merge SHA.
- User reported PASS after full local validation: 529/529 frontend tests, lint PASS, frontend build PASS, and 137/137 Rust tests.

Fresh audit finding:
- The shared `media_path()` helper still accepted arbitrarily long media path strings before filesystem probing.
- That helper is used by media inspection, preview preparation, waveform generation, single-source export, multi-segment export, and native video-graph input flows.
- This left a common media-input request boundary inconsistent with the path caps already applied to individual native graph request fields.

Scope:
- Add a centralized 4,096-byte maximum to shared `media_path()` input validation.
- Reject oversized media paths before `PathBuf` filesystem probing.
- Preserve existing existence, media-type, export, preview, waveform, and rendering behavior.
- Add exact-limit and over-limit regression coverage.
- No project schema change.

Validation:
- Implementation complete.
- Local validation is pending user run; do not infer lint/test/build/cargo/manual success.

Next step:
- Run the complete Pull/Fetch + Validation workflow for M3.206.
- After user PASS, refresh PR/head/base state, mark Ready for Review, squash-merge using the freshly verified head SHA, verify `main`, reconcile all three docs, perform a fresh audit, and create the next focused milestone.

## M3.204 — Legacy Video/Audio Mix Video Input Path Length Cap — completed — 2026-09-30

Branch:
`fix/m3-204-video-audio-mix-video-input-path-cap`

Merge:
- PR #221
- Squash merge SHA: `a23e35fe3a3b0fb9a78dbcc46e1fe5228287b0c1`
- `main` verified identical to the merge SHA.
- User reported PASS after full validation.

Implementation:
- Added a 4,096-byte cap to `NativeVideoWithAudioGraphRenderRequest.video_source_path`.
- Rejected oversized values before filesystem/media probing.
- Preserved existing absolute-path, media-type, source identity, rendering, cleanup, and output behavior.
- Added exact 4,096-byte and over-limit 4,097-byte regression coverage.
- Corrected the exact-limit fixture to retain a `.mp4` extension so the intended path boundary was actually exercised.
- No project schema change.

Validation reported by user:
- `npm ci`: successful, 0 vulnerabilities.
- `npm run lint`: successful.
- `npm run test`: 529/529 passed.
- `npm run build`: successful.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 135 passed, 0 failed; binary test target and doc-tests also completed with 0 failures.

Next step:
- Fresh audit from verified `main` identified M3.205: cap individual native audio graph input path strings at 4,096 bytes.

## M3.203 — Legacy Video/Audio Mix Audio Filter Size Cap — completed — 2026-09-30

Branch:
`fix/m3-203-video-audio-mix-audio-filter-size-cap`

Merge:
- PR #220
- Squash merge SHA: `558bb5000138f1d384c62eb69f97f08993f280ab`
- `main` verified identical to the merge SHA.

Fresh audit finding:
- `NativeVideoWithAudioGraphRenderRequest.audio_filter_complex` had no maximum size validation.

Implementation:
- Added `MAX_NATIVE_VIDEO_AUDIO_MIX_AUDIO_FILTER_BYTES = 256 * 1024`.
- Reject oversized legacy video/audio mix audio filter graphs before filesystem probing.
- Preserved existing input, path, duration, map, source identity, rendering, cleanup, and audio-graph behavior.
- Added exact-limit and over-limit regression coverage.
- During full validation, fixed repository-wide correctness/type/test issues exposed by the existing suite without weakening the M3.203 boundary.
- Added project-file read-size enforcement and corrected the large ffprobe streamed fixture; production parser semantics were preserved.
- No project schema change.

Validation reported by user: