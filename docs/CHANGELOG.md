# M3.232 — Bound Pending Export Cancellation Job IDs — active — 2026-10-06

- Branch: `fix/m3-232-bound-export-cancel-pending-job-ids`.
- PR #250 (Draft).
- Fresh audit found unknown export cancellation job IDs could accumulate without a count bound.
- Added `MAX_PENDING_CANCELLED_EXPORT_JOB_IDS = 1024` for unknown/pending cancellation requests.
- Duplicate pending cancellation IDs remain idempotent.
- Active-child cancellation behavior is preserved.
- Added focused regression coverage.
- No project schema change.
- Local validation is pending user run.

# M3.231 — Preview Generation Single-Flight — completed — 2026-10-06

- PR #249; squash-merged at `6dd5d464faaf59d1bd93659629a0ae267ee293be`.
- User explicitly reported PASS and the milestone was accepted through the established workflow.
- Added process-local single-flight preview generation keyed by canonical source path.
- No project schema change.

# M3.230 — Multi-Segment Source-Audio Presence Probe Deduplication — completed — 2026-10-06

- PR #248; squash-merged at `8e829c42e5b288048da951335de60fdfc6e2c000`.
- User reported PASS.
- Added per-render-request source-path caching for multi-segment audio-presence probes.
- No project schema change.

# M3.229 — Unified AV Aggregate Input Source Path Bytes Cap — completed — 2026-10-06

- PR #247; squash-merged at `87e8b969c23160091433e0a34438c793b5762119`.
- User reported PASS after the corrected validation workflow.
- Added a 1 MiB aggregate UTF-8 input-path cap across unified AV video and audio inputs.
- Enforced the cap before per-input filesystem/media validation using saturating accounting.
- Added exact-limit and over-limit regression coverage.
- Validation corrections discovered during the milestone were fixed before acceptance.
- No project schema change.

# M3.229 — Unified AV Aggregate Input Source Path Bytes Cap — completed — 2026-10-06

- PR #247; squash-merged at `87e8b969c23160091433e0a34438c793b5762119`.
- User reported PASS after the corrected validation workflow.
- Added a 1 MiB aggregate UTF-8 input-path cap across unified AV video and audio inputs.
- Enforced the cap before per-input filesystem/media validation using saturating accounting.
- Added exact-limit and over-limit regression coverage.
- Validation corrections discovered during the milestone were fixed before acceptance.
- No project schema change.

# M3.228 — Unified AV Source-Audio Presence Probe Deduplication — completed — 2026-10-06

- PR #246; squash-merged at `6711c54379ed4807f330a946411e30b4120cbfb2`.
- User reported PASS.
- Added per-render-request source-path caching for unified AV source-audio presence probes.
- Added focused regression coverage proving repeated source paths invoke the probe once.
- Preserved existing render/error/cancellation/cleanup/result semantics.
- No project schema change.

# M3.227 — Multi-Segment Aggregate Source Path Bytes Cap — completed — 2026-10-01

- PR #245; squash-merged at `7658d53bd58c407d07c363ba0cc8bf918f57dc63`.
- User reported PASS.
- Added a 4 MiB aggregate UTF-8 source-path cap before multi-segment filesystem/media probing.
- Used saturating aggregate accounting and exact-limit/over-limit regression coverage.
- Validation corrections were completed before acceptance.
- No project schema change.

# M3.226 — Persisted Project Display Name Byte Caps — completed — 2026-10-01

- Branch: `fix/m3-226-persisted-display-name-byte-caps`.
- PR #244; squash-merged at `687964d8331311d42913f09f9d7e5acc5c88f88c`.
- Added `MAX_PERSISTED_DISPLAY_NAME_BYTES = 256` using UTF-8 byte length.
- Enforced the cap on project, asset, and track names.
- Added exact-limit and over-limit regression coverage using a multibyte UTF-8 boundary.
- User reported PASS.
- No project schema change.

# M3.225 — Persisted Project Serialization Size Cap — completed — 2026-10-01

- Branch: `fix/m3-225-persisted-project-serialization-size-cap`.
- PR #243; squash-merged at `c12fde998a6c27421174493550020a825d80a6d6`.
- Added `MAX_PROJECT_SERIALIZED_BYTES = 16 * 1024 * 1024`.
- `parseProject()` rejects serialized input above 16 MiB before JSON parsing.
- `serializeProject()` rejects serialized output above 16 MiB before callers store or save it.
- Added exact-boundary and over-limit regression coverage.
- User reported PASS.
- No project schema change.

# M3.224 — Persisted Project Identifier Byte Caps — completed — 2026-10-01

- Branch: `fix/m3-224-persisted-project-identifier-byte-caps`.
- PR #242; squash-merged at `42f0655b6ed56abfb0b22dbb9d9b75138bbdbef4`.
- Added `MAX_PERSISTED_IDENTIFIER_BYTES = 256` for project, asset, track, clip, and clip `assetId` identifiers using UTF-8 byte length.
- Added exact-limit, over-limit, and multibyte UTF-8 regression coverage.
- User reported PASS.
- No project schema change.

# M3.223 — Persisted Project Asset Source Path Byte Cap — completed — 2026-10-01

- Branch: `fix/m3-223-persisted-asset-source-path-cap`.
- PR #241; squash-merged at `21610705086360cf7d8022bb5bd111d3b0feb7f3`.
- Added `MAX_PERSISTED_ASSET_SOURCE_PATH_BYTES = 4096`.
- Persisted asset source paths use UTF-8 byte-length validation.
- Added exact-limit, over-limit, and multibyte UTF-8 regression coverage.
- User reported PASS.
- No project schema change.

# M3.222 — Persisted Project Total Audio Volume Keyframe Count Cap — completed — 2026-10-01

- Branch: `fix/m3-222-project-total-audio-keyframe-count-cap`.
- PR #240; squash-merged at `980f7357669593f6d4ec137359cd7aa30bd6a55b`.
- Added `MAX_PROJECT_TOTAL_AUDIO_VOLUME_KEYFRAMES = 65_536`.
- Persisted projects above 65,536 aggregate audio volume keyframes are rejected before validating the excess collection.
- Preserved the existing 4,096 per-clip cap and audio keyframe semantics.
- Added exact-limit and over-limit regression coverage.
- Validation incidents discovered during development were corrected before the user-reported PASS.
- No project schema change.

Next step:
- Fresh audit from verified `main` identified M3.223: persisted asset source-path byte cap.

# M3.221 — Persisted Project Total Clip Count Cap — completed — 2026-10-01


- Branch: `fix/m3-221-project-total-clip-count-cap`.
- Fresh audit of verified `main` found the aggregate persisted clip count remained unbounded after the per-track clip cap was added.
- Added `MAX_PROJECT_TOTAL_CLIPS = 65_536`.
- Persisted projects with more than 65,536 clips across all tracks are rejected before validating the excess clip collection.
- Preserved the existing 4,096 per-track cap and clip/topology semantics.
- Added exact-limit and over-limit regression coverage.
- Local validation is pending user run.
- Do not infer lint/test/build/cargo/manual success until the user reports the result.
- No project schema change.

Next step:
- Run the complete Pull/Fetch + Validation workflow for M3.221.
- After user PASS, refresh PR/head/base state, mark Ready for Review, squash-merge using the freshly verified head SHA, verify main, reconcile all three docs, perform a fresh audit, and create the next focused milestone.


