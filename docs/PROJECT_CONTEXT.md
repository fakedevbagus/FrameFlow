## M3.227 — Multi-Segment Aggregate Source Path Bytes Cap — active — 2026-10-01

Branch:
`fix/m3-227-multi-segment-aggregate-source-path-bytes-cap`

PR:
- #245 (Draft).

Fresh audit finding:
- `NativeVideoSegmentsRenderRequest.segments` is capped at 4,096 entries.
- Each optional segment source path is capped by the shared 4,096-byte media-path contract.
- No aggregate source-path byte cap existed across a multi-segment request, allowing a theoretical 16 MiB source-path payload before filesystem/media probing.

Scope:
- Add `MAX_NATIVE_VIDEO_SEGMENTS_TOTAL_SOURCE_PATH_BYTES = 4 * 1024 * 1024`.
- Enforce the aggregate source-path byte cap before per-segment filesystem/media probing.
- Preserve segment count, per-path, duration, absolute-path, media-type, source identity, render, cleanup, and result semantics.
- Use overflow-safe aggregate accounting.
- Add exact-limit and over-limit regression coverage.
- No project schema change.

Implementation:
- Added the 4 MiB aggregate source-path byte cap.
- Added saturating aggregate accounting before the per-segment validation loop.
- Added exact 4 MiB acceptance and over-limit rejection tests.
- Documentation is reconciled for M3.227.
- First validation run passed lint, frontend tests (554/554), and frontend build, but Cargo tests failed because the two new tests lacked the `NativeVideoSegment` test-module import. Corrected in commit `4e12008bac5707ab2afecba066ea36282345bfb9`.
- Second validation run completed 545/545 frontend tests but Vitest reported 2 unhandled fork-worker startup timeouts for `src/features/export/export-job.test.ts` and `src/features/transform/crop.test.ts`. The run is not accepted as PASS because Vitest warned unhandled errors can cause false positives.
- Hardened `vitest.config.ts` with `maxWorkers: 1` in commit `6d4eb658443a99c316989509fe37d4808c2527c3` to avoid concurrent fork-worker startup pressure. Full validation remains pending.

Pre-existing PR #231:
- Left untouched.
- Its base is stale/diverged from current `main`; M3.227 is implemented fresh from the verified current `main`.

Next step:
- Run the complete Pull/Fetch + Validation workflow for M3.227 after the Vitest worker-concurrency correction.

## M3.228 — Unified AV Source-Audio Presence Probe Deduplication — active — 2026-10-02

Branch:
`fix/m3-228-unified-av-source-audio-probe-dedup`

PR:
- #246 (Draft).

Fresh audit finding:
- Unified AV render requests allow up to 4,096 source-audio segments.
- Audio-presence probing occurs inside source-audio segment resolution, so multiple segments referencing the same resolved video source can repeat the same FFprobe probe.

Implementation:
- Added a per-render-request cache keyed by resolved source path.
- Reused cached audio-presence results for repeated segments.
- Preserved source-duration caching and all render/error/cancellation/cleanup/result semantics.
- Added focused regression coverage proving one probe for repeated source paths.

No project schema change.
Local validation is pending user run.

Next step:
- Run the complete Pull/Fetch + Validation workflow for M3.228.

# M3.227 — Multi-Segment Aggregate Source Path Bytes Cap — completed — 2026-10-01

- PR #245; squash-merged at `7658d53bd58c407d07c363ba0cc8bf918f57dc63`.
- User reported PASS.
- Added a 4 MiB aggregate UTF-8 source-path cap before multi-segment filesystem/media probing.
- Used saturating aggregate accounting and exact-limit/over-limit regression coverage.
- Validation incidents were corrected before acceptance.
- No project schema change.

# M3.226 — Persisted Project Display Name Byte Caps — completed — 2026-10-01

Branch:
`fix/m3-226-persisted-display-name-byte-caps`

PR:
- #244; squash-merged at `687964d8331311d42913f09f9d7e5acc5c88f88c`.

- Added `MAX_PERSISTED_DISPLAY_NAME_BYTES = 256` using UTF-8 byte length.
- Enforced the cap on `Project.name`, `MediaAsset.name`, and `Track.name`.
- Preserved existing non-empty and project-name trimming semantics.
- Added exact 256-byte acceptance and 257-byte rejection coverage using a multibyte UTF-8 boundary.
- User reported PASS.
- No project schema version change.

## M3.225 — Persisted Project Serialization Size Cap — completed — 2026-10-01

Branch:
`fix/m3-225-persisted-project-serialization-size-cap`

PR:
- #243; squash-merged at `c12fde998a6c27421174493550020a825d80a6d6`.

- Added `MAX_PROJECT_SERIALIZED_BYTES = 16 * 1024 * 1024` at the domain parse/serialize boundary.
- Rejected serialized input above 16 MiB before JSON parsing.
- Rejected serialized output above 16 MiB before workspace storage or native save.
- Added exact-boundary and over-limit regression coverage.
- User reported PASS.
- No project schema version change.

## M3.224 — Persisted Project Identifier Byte Caps — completed — 2026-10-01

Branch:
`fix/m3-224-persisted-project-identifier-byte-caps`

PR:
- #242; squash-merged at `42f0655b6ed56abfb0b22dbb9d9b75138bbdbef4`.

- Added `MAX_PERSISTED_IDENTIFIER_BYTES = 256`.
- Validated project, asset, track, clip, and clip `assetId` identifiers by UTF-8 byte length.
- Added exact-limit, over-limit, and multibyte UTF-8 regression coverage.
- User reported PASS.
- No project schema version change.

## M3.223 — Persisted Project Asset Source Path Byte Cap — completed — 2026-10-01

Branch:
`fix/m3-223-persisted-asset-source-path-cap`

PR:
- #241; squash-merged at `21610705086360cf7d8022bb5bd111d3b0feb7f3`.

- Added `MAX_PERSISTED_ASSET_SOURCE_PATH_BYTES = 4096`.
- Persisted asset source paths use UTF-8 byte-length validation.
- Added exact-limit, over-limit, and multibyte UTF-8 regression coverage.
- User reported PASS.
- No project schema version change.

## M3.221 — Persisted Project Total Clip Count Cap — completed — 2026-10-01


Branch:
`fix/m3-221-project-total-clip-count-cap`

Fresh audit finding:
- Per-track clip count is capped at 4,096, but aggregate project clip count remained unbounded.
- Existing 256-track cap still permits up to 1,048,576 persisted clips.
- `validateTracks()` also maintains a project-wide `clipIds` set while validating tracks, so aggregate clip count is a direct project-load/resource boundary.

Scope:
- Add `MAX_PROJECT_TOTAL_CLIPS = 65_536`.
- Reject projects whose aggregate persisted clip count exceeds 65,536 before validating the excess clip collection.
- Preserve the existing 4,096 per-track cap and all clip/topology semantics.
- Add exact-limit and over-limit regression coverage.
- No project schema version change.

Implementation:
- Added `MAX_PROJECT_TOTAL_CLIPS = 65_536`.
- Added aggregate persisted clip counting across all tracks before per-clip validation for an over-limit project.
- Added exact-limit acceptance and 65,537-entry rejection tests.
- Documentation is reconciled for M3.221.
- Local validation is pending user run.

Next step:
- Run the complete Pull/Fetch + Validation workflow for M3.221.
- After user PASS, refresh PR/head/base state, mark Ready for Review, squash-merge using the freshly verified head SHA, verify main, reconcile all three docs, perform a fresh audit, and create the next focused milestone.


