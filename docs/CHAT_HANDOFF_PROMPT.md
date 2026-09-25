## M3.102 — completed — 2026-09-25

- Branch: `fix/m3-102-canonical-text-overlay`.
- PR #117; squash-merged at `834a8ee84367f79bc1cdf02ef1d75f13072aa928`.
- Persisted TextOverlay text must be trimmed, x/y positions use at most three decimal places, and colors use lowercase six-digit hex notation.
- These rules align persistence with the existing runtime text overlay normalizer.
- User reported PASS.
- No project schema version change and no change to canonical runtime/editor/preview/export behavior.
- PR #76 remains parked; PR #22 remains unrelated and untouched.

## Workflow for next chat

- Inspect actual `main` SHA, branch state, and open PRs before acting.
- M3.102 is the active milestone; do not assume local validation has passed.
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


