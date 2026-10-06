# M3.231 — Preview Generation Single-Flight — active — 2026-10-06

Branch:
`fix/m3-231-preview-generation-single-flight`

PR:
- #249 (Draft).

Fresh audit finding:
- `prepare_media_preview()` generated a deterministic temporary path `<cache-key>.partial.mp4`.
- Concurrent requests for the same source could enter FFmpeg generation simultaneously and share that temporary path.
- This creates a concrete race on the temporary preview file and can duplicate expensive FFmpeg work.

Implementation:
- Added a process-local single-flight lock keyed by canonical source path.
- Requests for the same source wait for the active generator to finish before checking the cache again.
- Re-read source metadata after lock acquisition before computing the cache key.
- Added focused concurrency regression coverage for the per-source lock.
- Preserved preview encoding, source identity validation, cache layout, output semantics, and cancellation behavior.

No project schema change.
Local validation is pending user run.

Next step:
- Create the Draft PR and run the complete Pull/Fetch + Validation workflow for M3.231.

# M3.230 — Multi-Segment Source-Audio Presence Probe Deduplication — completed — 2026-10-06

- PR #248; squash-merged at `8e829c42e5b288048da951335de60fdfc6e2c000`.
- User reported PASS.
- Added a per-render cache keyed by source path for repeated multi-segment source-audio presence probes.
- Added focused regression coverage.
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


