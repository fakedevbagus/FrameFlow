## M3.111 — active — 2026-09-25

- Branch: `fix/m3-111-strict-transform-rotation-range`.
- Scope: align persisted Transform Rotation with the runtime's supported `-180..180` angle range.
- M3.110 completed and squash-merged as PR #125 at `40c0fd1df662754e814e7e658f9a56e0ce615b78`; user reported PASS.
- Implemented strict persisted Rotation range validation and focused parser regressions for `181` and `-181`.
- Local validation is pending; do not assume lint/test/build/cargo/manual validation has passed.

## Workflow for this chat

- Inspect actual `main` SHA, branch state, and open PRs before acting.
- M3.111 is the active milestone; do not assume local validation has passed.
- On user `PASS` / `pass` / `lanjutkan`: mark the active Draft PR ready, squash-merge it using the freshly verified head SHA, record the actual merge SHA, reconcile all three docs, verify `main`, audit again, and start the next focused milestone.
- Never claim lint/test/build/cargo/manual validation passed unless the user explicitly confirms it.
- Keep parked PR #76 and unrelated PR #22 untouched.

## M3.110 — completed — 2026-09-25

- Branch: `fix/m3-110-canonical-transform-opacity-precision`.
- Scope: align Transform Opacity persistence and runtime normalization with the Inspector's integer-percent input contract.
- PR #125; squash-merged at `40c0fd1df662754e814e7e658f9a56e0ce615b78`.
- Transform Opacity is now normalized to two decimal places after range clamping.
- Persisted Transform Opacity values with more than two decimal places are rejected, including transform keyframe transforms.
- Added regression coverage for runtime normalization, command behavior, and persisted-value rejection.
- User reported PASS.
- No project schema change.
- Local validation is considered passed only because the user reported PASS; do not infer additional checks beyond the user's report.

## Workflow for this chat

- Inspect actual `main` SHA, branch state, and open PRs before acting.
- The latest completed milestone is M3.110; the next step is a fresh audit from updated `main`.
- On user `PASS` / `pass` / `lanjutkan`: mark the active Draft PR ready, squash-merge it using the freshly verified head SHA, record the actual merge SHA, reconcile all three docs, verify `main`, audit again, and start the next focused milestone.
- Never claim lint/test/build/cargo/manual validation passed unless the user explicitly confirms it.
- Keep parked PR #76 and unrelated PR #22 untouched.

## M3.109 — completed — 2026-09-25

- Branch: `fix/m3-109-canonical-transform-scale-precision`.
- PR #124; squash-merged at `d7c31e4dcd9c0da664fd76c3de673bbd6d2fedcc`.
- Transform Scale now uses two-decimal canonical normalization after range clamping.
- Persisted Transform Scale values with more than two decimal places are rejected, including transform keyframe transforms.
- Existing Scale range `0.05..10` remains unchanged.
- Added regression coverage for runtime normalization, command behavior, and persisted-value rejection.
- User reported PASS.
- No project schema change and no change to X/Y, Rotation, Opacity, Crop, Preview, or Export contracts.

Next milestone:
- M3.110 — audit remaining persisted visual-transform precision and control normalization.

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

