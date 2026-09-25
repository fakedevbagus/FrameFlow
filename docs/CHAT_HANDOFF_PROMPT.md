## M3.103 — active — 2026-09-25

- Branch: `fix/m3-103-canonical-visual-effects`.
- Scope: require persisted `visualEffects.brightness`, `contrast`, and `saturation` values to use at most two decimal places.
- Align persistence with the runtime visual-effects normalizer, which rounds these values to two decimal places.
- M3.102 completed and squash-merged as PR #117 at `834a8ee84367f79bc1cdf02ef1d75f13072aa928`.
- Awaiting local validation of M3.103.
- PR #76 remains parked; PR #22 remains unrelated and untouched.

## Workflow for next chat

- Inspect actual `main` SHA, branch state, and open PRs before acting.
- M3.103 is the active milestone; do not assume local validation has passed.
- When user reports `PASS` / `pass` / `lanjutkan`, mark the active Draft PR ready, squash-merge it using the verified head SHA, record the actual merge SHA, reconcile all three docs, verify `main`, then audit and start the next focused milestone.
- Never claim lint/test/build/cargo/manual validation passed unless the user explicitly confirms it.


## M3.99 — completed — 2026-09-25

- Branch: `fix/m3-99-integer-audio-keyframe-times`.
- PR #114; squash-merged at `2918b809edf39306e15fdf884ce11ae3558fee7f`.
- Persisted Audio Volume Automation keyframe `timeMs` values now require integer milliseconds.
- Persistence aligns with runtime normalization, which rounds timestamps before ordering/deduplication.
- User reported PASS.
- No project schema version change and no change to canonical runtime/editor/preview/export behavior.
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


