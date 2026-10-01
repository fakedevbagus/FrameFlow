## M3.223 — Persisted Project Asset Source Path Byte Cap — active — 2026-10-01

Branch:
`fix/m3-223-persisted-asset-source-path-cap`

PR:
- not created yet.

Fresh audit finding:
- Native media-path handling already enforces a 4,096-byte path limit.
- Persisted `MediaAsset.sourcePath` only required a non-empty string, so oversized source paths could survive project parsing and reach later native boundaries.

Scope:
- Add `MAX_PERSISTED_ASSET_SOURCE_PATH_BYTES = 4096`.
- Validate persisted asset `sourcePath` by UTF-8 byte length.
- Reject values above 4,096 bytes during project parsing.
- Preserve existing asset semantics and project schema.
- Add exact-limit, over-limit, and multibyte UTF-8 regression coverage.
- No project schema version change.

Implementation:
- Added the 4,096-byte persisted asset source-path cap.
- Added focused regression coverage for the byte boundary.
- Documentation is being reconciled for M3.223.
- Local validation is pending.

Next step:
- Run the complete Pull/Fetch + Validation workflow for M3.223.
- After user PASS, refresh PR/head/base state, mark Ready for Review, squash-merge using the freshly verified head SHA, verify main, reconcile all three docs, perform a fresh audit, and create the next focused milestone.

## M3.222 — Persisted Project Total Audio Volume Keyframe Count Cap — completed — 2026-10-01

PR:
- #240; squash-merged at `980f7357669593f6d4ec137359cd7aa30bd6a55b`.

- Added `MAX_PROJECT_TOTAL_AUDIO_VOLUME_KEYFRAMES = 65_536`.
- Added aggregate persisted audio-volume keyframe counting across clips.
- Preserved the existing 4,096 per-clip cap and audio keyframe semantics.
- Added exact-limit and over-limit regression coverage.
- User reported PASS.
- Validation incidents found and corrected before the accepted PASS: malformed test syntax, unused import, and missing runtime constant.
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


