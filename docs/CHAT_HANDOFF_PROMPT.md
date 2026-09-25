## M3.97 — active — 2026-09-25

- Branch: `fix/m3-97-strict-transform-keyframe-payload`.
- Scope: require every persisted transform keyframe to contain a structured `transform` object.
- Preserve keyframe ordering, duplicate-time validation, all existing payload/range checks, schema version 1, and runtime/editor/preview/export behavior.
- M3.96 completed and squash-merged as PR #111 at `95fba85c4eee193af70bb306e5a86535e0b601b1`.
- Awaiting local validation of M3.97.
- PR #76 remains parked; PR #22 remains unrelated and untouched.

## Workflow for next chat

- Inspect actual `main` SHA, branch state, and open PRs before acting.
- M3.97 is the active milestone; do not assume local validation has passed.
- When user reports `PASS` / `pass` / `lanjutkan`, mark the active Draft PR ready, squash-merge it using the verified head SHA, record the actual merge SHA, reconcile all three docs, verify `main`, then audit and start the next focused milestone.
- Never claim lint/test/build/cargo/manual validation passed unless the user explicitly confirms it.

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


