# M3.232 — Bound Pending Export Cancellation Job IDs — active — 2026-10-06

Branch:
`fix/m3-232-bound-export-cancel-pending-job-ids`

PR:
- #250 (Draft).

Fresh audit finding:
- `ExportProcessState.cancel()` could retain arbitrary unknown cancellation job IDs indefinitely in the `cancelled` set.
- Job IDs are individually capped at 256 bytes, but the count of pending unknown cancellation IDs had no bound.
- Repeated cancellation requests for arbitrary IDs could therefore grow backend memory without a corresponding export process.

Implementation:
- Added `MAX_PENDING_CANCELLED_EXPORT_JOB_IDS = 1024`.
- Unknown/pending cancellation IDs are bounded before insertion.
- Duplicate pending IDs remain idempotent.
- Active child cancellation behavior is preserved.
- Lock acquisition order remains consistent with registration and finish paths.
- Added focused regression coverage for capacity, duplicate idempotency, and overflow rejection.

No project schema change.
Local validation is pending user run.

Next step:
- Run the complete Pull/Fetch + Validation workflow for M3.232.

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


