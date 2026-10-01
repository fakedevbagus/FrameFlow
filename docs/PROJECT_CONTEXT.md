## M3.222 — Persisted Project Total Audio Volume Keyframe Count Cap — active — 2026-10-01

Branch:
`fix/m3-222-project-total-audio-keyframe-count-cap`

PR:
- #240 (Draft).

Fresh audit finding:
- Persisted audio volume keyframes are capped at 4,096 per clip, but aggregate project count remained unbounded.
- Native unified AV rendering already enforces a 65,536 aggregate audio-keyframe cap.

Scope:
- Add `MAX_PROJECT_TOTAL_AUDIO_VOLUME_KEYFRAMES = 65_536`.
- Reject projects whose aggregate persisted audio volume keyframe count exceeds 65,536 before validating the excess collection.
- Preserve the existing 4,096 per-clip cap and audio keyframe semantics.
- Add exact-limit and over-limit regression coverage.
- No project schema version change.

Implementation:
- Added `MAX_PROJECT_TOTAL_AUDIO_VOLUME_KEYFRAMES = 65_536`.
- Added aggregate persisted audio-volume keyframe counting across clips.
- Corrected a syntax error in the aggregate audio-keyframe test block after the initial lint failure.
- User-reported validation also showed a local `src-tauri/Cargo.lock` modification; it must be preserved.
- A fresh full validation rerun is required.

Next step:
- Run the complete Pull/Fetch + Validation workflow for M3.222.
- After successful PASS, refresh PR/head/base state, mark Ready for Review, squash-merge using the freshly verified head SHA, verify main, reconcile all three docs, perform a fresh audit, and create the next focused milestone.

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


