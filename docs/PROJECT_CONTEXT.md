# M3.230 — Multi-Segment Source-Audio Presence Probe Deduplication — active — 2026-10-06

Branch:
`fix/m3-230-multi-segment-source-audio-probe-dedup`

PR:
- #248 (Draft).

Fresh audit finding:
- `render_video_segments_to_output()` probes source audio presence once for every source-backed segment when audio is enabled.
- Multi-segment requests support up to 4,096 segments.
- Repeated references to the same source can therefore repeat FFprobe audio-presence work unnecessarily.

Implementation:
- Added a per-render cache keyed by source `Path`.
- Reused the cached boolean for repeated source paths.
- Added focused regression coverage for one probe per repeated path.
- Preserved existing render arguments, ordering, duration checks, cancellation, cleanup, source identity validation, and result behavior.

No project schema change.
Local validation is pending user run.

Next step:
- Create the Draft PR and run the complete Pull/Fetch + Validation workflow for M3.230.

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


