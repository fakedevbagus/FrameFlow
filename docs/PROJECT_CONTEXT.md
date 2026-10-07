# M3.233 — Close Export Cancel/Registration Race — active — 2026-10-07

Branch:
`fix/m3-233-close-export-cancel-registration-race`

PR:
- #251 (Draft).

Fresh audit finding:
- `run_ffmpeg_with_progress()` can spawn FFmpeg before the child is registered in `ExportProcessState`.
- A concurrent `cancel_export_job` request during that window can create a pending cancellation marker.
- The previous `register()` implementation removed that marker immediately, so the cancellation request could be lost and the newly spawned export could continue.

Implementation:
- `register()` no longer clears the cancellation marker.
- After registering an export child, `run_ffmpeg_with_progress()` immediately re-checks cancellation and invokes the existing cancellation path when required.
- This preserves cancellation across the spawn/register ordering boundary.
- Existing bounded pending cancellation behavior from M3.232 is preserved.
- Added focused regression coverage proving registration does not clear a pending cancellation marker created before child registration and that active cancellation remains supported.

No project schema change.

Local validation is pending user run.

Next step:
- Run the complete Pull/Fetch + Validation workflow for M3.233.

# M3.231 — Preview Generation Single-Flight — completed — 2026-10-06

- PR #249; squash-merged at `6dd5d464faaf59d1bd93659629a0ae267ee293be`.
- User explicitly reported PASS and the milestone was accepted through the established workflow.
- Added process-local single-flight preview generation keyed by canonical source path.
- No project schema change.

# M3.230 — Multi-Segment Source-Audio Presence Probe Deduplication — completed — 2026-10-06

- PR #248; squash-merged at `8e829c42e5b288048da951335de60fdfc6e2c000`.
- User reported PASS.
- Added per-render source-path caching for audio-presence probes.
- No project schema change.

# M3.229 — Unified AV Aggregate Input Source Path Bytes Cap — completed — 2026-10-06

- PR #247; squash-merged at `87e8b969c23160091433e0a34438c793b5762119`.
- User reported PASS.
- Added the 1 MiB aggregate UTF-8 input-path cap before unified AV filesystem/media validation.
- Added exact-limit and over-limit regression coverage.
- No project schema change.

# M3.229 — Unified AV Aggregate Input Source Path Bytes Cap — completed — 2026-10-06

Branch:
`fix/m3-229-unified-av-aggregate-input-source-path-bytes-cap`

PR:
- #247; squash-merged at `87e8b969c23160091433e0a34438c793b5762119`.
- User reported PASS after the corrected validation workflow.

- Added a 1 MiB aggregate UTF-8 byte cap across unified AV video and audio input paths.
- Enforced the cap before per-input path/file/media validation using saturating accounting.
- Added exact-limit and over-limit regression coverage.
- Corrected validation-discovered test import and boundary fixture issues before acceptance.
- No project schema change.

# M3.228 — Unified AV Source-Audio Presence Probe Deduplication — completed — 2026-10-06

- PR #246; squash-merged at `6711c54379ed4807f330a946411e30b4120cbfb2`.
- User reported PASS.
- Added per-render-request source-path caching for audio-presence probes.
- No project schema change.


