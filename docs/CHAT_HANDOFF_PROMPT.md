## M3.95 — active — 2026-09-25

- Branch: `fix/m3-95-strict-project-timestamps`.
- Scope: strictly validate persisted `createdAt`/`updatedAt` timestamps and require `updatedAt >= createdAt`.
- Preserve schema version 1 and editor/export behavior.
- M3.94 completed and squash-merged as PR #109 at `6048b038e4d15e00372e0267a9e0d2f14caaf72b`.
- PR #76 remains parked; PR #22 remains unrelated and untouched.

## M3.94 — completed — 2026-09-25

- PR #109; merge SHA `6048b038e4d15e00372e0267a9e0d2f14caaf72b`.
- Persisted canvas width/height now require positive integers.
- Positive fractional frame rates remain valid.
- User reported PASS.
- No project schema, preview, playback, Timeline, waveform, or export behavior change.


