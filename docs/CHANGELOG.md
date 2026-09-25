### M3.99 — Canonical Integer Audio Keyframe Times — in progress — 2026-09-25

- Branch: `fix/m3-99-integer-audio-keyframe-times`.
- Persisted Audio Volume Automation keyframe `timeMs` values must be integer milliseconds.
- This matches the runtime normalizer, which rounds audio automation timestamps before ordering/deduplication.
- Added parser regression coverage for fractional persisted audio keyframe times.
- Validation is pending.

### M3.98 — Unique Native Project Save Temp Paths — completed — 2026-09-25

- Branch: `fix/m3-98-unique-project-save-temp`.
- PR #113; merge SHA `d3e93c9a3af3333fd2a2fd33baecf33a38f9fa74`.
- Native project save temp paths use process ID + atomic per-process counter.
- Added Rust regression coverage for temp-path uniqueness.
- User reported PASS.
- No project format or React-side persistence behavior change.

### M3.97 — Strict Persisted Transform Keyframe Payload — completed — 2026-09-25

- Branch: `fix/m3-97-strict-transform-keyframe-payload`.
- PR #112; merge SHA `3bca10042a369191a14e441acabc891a21a09135`.
- Persisted transform keyframes require a structured `transform` object.
- Added parser regressions for missing and null transform payloads.
- User reported PASS.
- No project schema, runtime/editor, preview, or export behavior change.

### M3.96 — Strict Persisted Keyframe Ordering — completed — 2026-09-25

- Branch: `fix/m3-96-strict-persisted-keyframe-order`.
- PR #111; merge SHA `95fba85c4eee193af70bb306e5a86535e0b601b1`.
- Persisted transform keyframes and Audio Volume Automation keyframes must use strictly increasing `timeMs` order.
- Duplicate timestamps remain rejected with their existing validation error.
- Added focused parser regression coverage for out-of-order persisted keyframes.
- User reported PASS.
- No project schema, runtime normalization, Timeline editing, preview, or export behavior change.

### M3.95 — Strict Project Timestamp Validation — completed — 2026-09-25

- Branch: `fix/m3-95-strict-project-timestamps`.
- PR #110; merge SHA `e775ef3eeab26ed4557303b723778748182b6488`.
- Persisted `createdAt`/`updatedAt` require canonical UTC ISO timestamps with millisecond precision.
- Persisted `updatedAt` must be the same as or later than `createdAt`.
- Added focused parser regression coverage.
- User reported PASS.
- No project schema, preview, timeline, playback, waveform, or export behavior change.