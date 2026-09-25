## M3.96 — active — 2026-09-25

- Branch: `fix/m3-96-strict-persisted-keyframe-order`.
- Scope: require persisted transform and audio volume keyframes to be strictly increasing by `timeMs`.
- Preserve duplicate-time validation, schema version 1, runtime normalization, and editor/export behavior.
- M3.95 completed and squash-merged as PR #110 at `e775ef3eeab26ed4557303b723778748182b6488`.
- PR #76 remains parked; PR #22 remains unrelated and untouched.

## M3.95 — completed — 2026-09-25

- PR #110; merge SHA `e775ef3eeab26ed4557303b723778748182b6488`.
- Persisted project timestamps require canonical UTC ISO timestamps and chronological ordering.
- User reported PASS.
- No project schema, preview, playback, Timeline, waveform, or export behavior change.

## M3.94 — completed — 2026-09-25

- PR #109; merge SHA `6048b038e4d15e00372e0267a9e0d2f14caaf72b`.
- Persisted canvas width/height now require positive integers.
- Positive fractional frame rates remain valid.
- User reported PASS.
- No project schema, preview, playback, Timeline, waveform, or export behavior change.


