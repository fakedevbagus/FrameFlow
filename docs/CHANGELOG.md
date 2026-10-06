# M3.229 — Unified AV Aggregate Input Source Path Bytes Cap — active — 2026-10-06

- Branch: `fix/m3-229-unified-av-aggregate-input-source-path-bytes-cap`.
- PR #247 (Draft).
- Fresh audit found unified AV requests permit 256 video inputs plus 256 audio inputs, each capped at 4,096 bytes, but aggregate input-path bytes were unbounded.
- Added a 1 MiB aggregate UTF-8 cap across video and audio input paths.
- Enforced the cap before per-input `PathBuf`/filesystem/media validation using saturating accounting.
- Added exact-limit and over-limit regression coverage.
- Preserved existing request, graph, render, cleanup, and result semantics.
- No project schema change.
- Validation attempt on 2026-10-06 reached lint, all 554 Vitest tests, and the frontend production build, but the Rust build failed because the M3.229 aggregate-cap constant was not imported into the test module.
- Corrected the test-module import and fixed the over-limit fixture so it exceeds 1 MiB by one byte in commit `bb01d54bcd56f3b352b3fa8ff290f22ab6667715`.
- Validation rerun on 2026-10-06 reached the Rust test build but failed because the exact-limit regression fixture mutated an immutable `audio_inputs` binding.
- Corrected the fixture in commit `83bc29e973006a4ffacecad864dd32eb82944e46`.
- Full validation remains pending rerun after this correction.

# M3.228 — Unified AV Source-Audio Presence Probe Deduplication — completed — 2026-10-06

- PR #246; squash-merged at `6711c54379ed4807f330a946411e30b4120cbfb2`.
- User reported PASS.
- Added per-render-request source-path caching for audio-presence probes.
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


