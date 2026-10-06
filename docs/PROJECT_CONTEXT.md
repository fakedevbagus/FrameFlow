# M3.232 — Bound Pending Export Cancellation Job IDs — active — 2026-10-06

Branch:
`fix/m3-232-bound-export-cancel-pending-job-ids`

PR:
- Draft; pending creation after the implementation/documentation commit.

Fresh audit finding:
- `ExportProcessState.cancel()` previously inserted every unknown cancellation job ID into the `cancelled` set and retained it until that ID was later registered or the process exited.
- Job IDs were individually limited to 256 bytes, but the pending cancellation set itself had no capacity bound.
- Repeated cancellation requests for arbitrary IDs could therefore grow backend memory without a corresponding export process.

Implementation:
- Added `MAX_PENDING_CANCELLED_EXPORT_JOB_IDS = 1024`.
- Unknown cancellation IDs are accepted only while the bounded pending set has capacity.
- Duplicate pending IDs remain idempotent.
- Existing active-child cancellation behavior is preserved.
- The lock acquisition order now remains consistent with registration/finish paths.

No project schema change.
Local validation is pending user run.

Next step:
- Create the Draft PR and run the complete Pull/Fetch + Validation workflow for M3.232.

# M3.231 — Preview Generation Single-Flight — completed — 2026-10-06

- PR #249; squash-merged at `6dd5d464faaf59d1bd93659629a0ae267ee293be`.
- User explicitly reported PASS.
- Added process-local preview-generation single-flight keyed by canonical source path.
- No project schema change.

# M3.230 — Multi-Segment Source-Audio Presence Probe Deduplication — completed — 2026-10-06

- PR #248; squash-merged at `8e829c42e5b288048da951335de60fdfc6e2c000`.
- User reported PASS.
- Added per-render source-path caching for repeated audio-presence probes.
- No project schema change.


