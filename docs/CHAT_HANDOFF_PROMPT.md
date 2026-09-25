## M3.106 — active — 2026-09-25

- Branch: `fix/m3-106-canonical-audio-volume`.
- Scope: enforce persisted Audio Volume Automation keyframe `volume` values to the same three-decimal precision used by runtime normalization and editing commands.
- Audit finding from current `main`: `normalizeAudioVolumeKeyframes()` and `updateAudioClipVolumeAtTime()` canonicalize volume to three decimal places, while persistence currently accepts arbitrary finite values within 0..1.
- No project schema change is planned.
- Local validation is pending and must not be assumed passed.

## Workflow for this chat

- Inspect actual `main` SHA, branch state, and open PRs before acting.
- M3.106 is the active milestone; do not assume local validation has passed.
- On user `PASS` / `pass` / `lanjutkan`: mark the active Draft PR ready, squash-merge it using the freshly verified head SHA, record the actual merge SHA, reconcile all three docs, verify `main`, audit again, and start the next focused milestone.
- Never claim lint/test/build/cargo/manual validation passed unless the user explicitly confirms it.
- Keep parked PR #76 and unrelated PR #22 untouched.

## M3.105 — completed — 2026-09-25

- Branch: `fix/m3-105-canonical-audio-compressor`.
- PR #120; squash-merged at `6cc2a230ed351b44db8dc9551e58a17b1305ed94`.
- Persisted Audio Compressor threshold/ratio values now require at most one decimal place; attack/release values require at most two decimal places.
- Added parser regression coverage.
- User reported PASS.
- No project schema version change and no change to canonical runtime/editor/preview/export behavior.

## M3.104 — completed — 2026-09-25

- Branch: `fix/m3-104-canonical-audio-eq`.
- PR #119; squash-merged at `c83479fec28f6403fedefad9add5ada8ddecfc30`.
- Persisted Audio EQ low/mid/high gains now require at most one decimal place.
- Added parser regression coverage.
- User reported PASS.
- No project schema version change and no change to canonical runtime/editor/preview/export behavior.

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


