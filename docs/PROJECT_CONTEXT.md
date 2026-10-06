# M3.229 — Unified AV Aggregate Input Source Path Bytes Cap — active — 2026-10-06

Branch:
`fix/m3-229-unified-av-aggregate-input-source-path-bytes-cap`

Fresh audit finding:
- Unified AV render requests allow up to 256 video inputs and 256 audio inputs.
- Each input path is individually capped at 4,096 bytes.
- No aggregate byte cap exists across the combined video and audio input path arrays.
- Those independent limits permit a theoretical 2 MiB input-path string payload before filesystem/media probing.

Scope:
- Add one aggregate UTF-8 byte cap across unified AV video and audio input paths.
- Enforce the aggregate cap before per-input `PathBuf`/filesystem/media probing.
- Preserve existing per-input path caps, media-type validation, source-audio segment semantics, graph construction, rendering, cleanup, and result behavior.
- Add exact-limit and over-limit regression coverage.
- No project schema change.

Next step:
- Implement the focused M3.229 fix and regression coverage.

# M3.228 — Unified AV Source-Audio Presence Probe Deduplication — completed — 2026-10-06

- PR #246; squash-merged at `6711c54379ed4807f330a946411e30b4120cbfb2`.
- User reported PASS.
- Added per-render-request source-path caching for audio-presence probes and focused regression coverage.
- No project schema change.

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


