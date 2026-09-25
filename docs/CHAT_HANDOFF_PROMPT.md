## M3.104 — active — 2026-09-25

- Branch: `fix/m3-104-canonical-audio-eq`.
- Scope: require persisted Audio EQ `lowGainDb`, `midGainDb`, and `highGainDb` values to use at most one decimal place.
- Audit finding: `getAudioEq()` rounds gains to one decimal place and `updateAudioClipEq()` also persists one-decimal gains, while project parsing previously accepted arbitrary finite precision within -12 to 12.
- Implemented parser validation plus focused regression coverage.
- PR will be created after documentation is updated.
- Local validation is pending; do not assume lint/test/build/cargo/manual validation has passed.

## M3.104 — active — 2026-09-25

- Branch: `fix/m3-104-canonical-audio-eq`.
- Scope: require persisted Audio EQ `lowGainDb`, `midGainDb`, and `highGainDb` values to use at most one decimal place.
- Audit finding: `getAudioEq()` rounds gains to one decimal place and `updateAudioClipEq()` also persists one-decimal gains, while the project parser currently accepts arbitrary finite precision within -12 to 12.
- No project schema change is planned.
- PR will be created after implementation and focused regression coverage.

## Workflow for this chat

- Inspect actual `main` SHA, branch state, and open PRs before acting.
- M3.104 is the active milestone; do not assume local validation has passed.
- On user `PASS` / `pass` / `lanjutkan`: mark the active Draft PR ready, squash-merge it using the freshly verified head SHA, record the actual merge SHA, reconcile all three docs, verify `main`, audit again, and start the next focused milestone.
- Never claim lint/test/build/cargo/manual validation passed unless the user explicitly confirms it.
- Keep parked PR #76 and unrelated PR #22 untouched.

## M3.103 — completed — 2026-09-25

- Branch: `fix/m3-103-canonical-visual-effects`.
- PR #118; squash-merged at `c4ae88dc9cf1cde64a1f39672809b74bc25e266e`.
- Persisted `visualEffects.brightness`, `contrast`, and `saturation` values now require at most two decimal places.
- Added parser regression coverage for over-precise persisted visual-effect values.
- User reported PASS.
- No project schema version change and no change to canonical runtime/editor/preview/export behavior.
- PR #76 remains parked; PR #22 remains unrelated and untouched.

## Workflow for next chat

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


