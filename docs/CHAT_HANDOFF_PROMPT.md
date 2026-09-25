## M3.109 — active — 2026-09-25

- Branch: `fix/m3-109-canonical-transform-scale-precision`.
- Scope: align Transform Scale persistence and runtime normalization with the existing Inspector precision contract.
- Implemented two-decimal Scale normalization, strict persisted-value validation, and focused regression coverage.
- Local validation is pending; do not assume lint/test/build/cargo/manual validation has passed.

## Workflow for this chat

- Inspect actual `main` SHA, branch state, and open PRs before acting.
- M3.109 is the active milestone; do not assume local validation has passed.
- On user `PASS` / `pass` / `lanjutkan`: mark the active Draft PR ready, squash-merge it using the freshly verified head SHA, record the actual merge SHA, reconcile all three docs, verify `main`, audit again, and start the next focused milestone.
- Never claim lint/test/build/cargo/manual validation passed unless the user explicitly confirms it.
- Keep parked PR #76 and unrelated PR #22 untouched.

## M3.108 — completed — 2026-09-25

- Branch: `fix/m3-108-canonical-track-audio-precision`.
- PR #123; squash-merged at `317f09aa66f6f7e1196fdd6d8ce86e07fdd07cd8`.
- Track Volume/Pan now use shared two-decimal canonical normalization in getters and update commands.
- Persisted Track Volume/Pan values with more than two decimal places are rejected.
- Added regression coverage for getter normalization, command normalization, and persisted-value rejection.
- User reported PASS.
- No project schema change and no change to preview/export/media behavior beyond canonicalizing existing track controls.

Next milestone:
- M3.109 — Canonical Transform Scale Precision.

