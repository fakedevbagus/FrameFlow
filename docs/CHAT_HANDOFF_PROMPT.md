# FrameFlow — New Chat Continuation Prompt

## READ FIRST — Current State

You are continuing development of the existing repository:

- Repository: `https://github.com/fakedevbagus/FrameFlow`
- Product: FrameFlow, a Linux-native desktop video editor.
- Stack: Tauri 2, React 19, TypeScript, Vite, Vitest, Rust, FFmpeg.
- Platform constraint: Linux-native only. Do not introduce Wine or a Windows compatibility layer.
- Repository is the source of truth. Do not invent project state from memory when GitHub can be checked.

### Milestone status at the exact handoff point

- **Latest accepted milestone:** M3.231 — Preview Generation Single-Flight.
- **M3.231 PR:** #249.
- **M3.231 squash merge SHA:** `6dd5d464faaf59d1bd93659629a0ae267ee293be`.
- GitHub verified `main` is identical to that merge SHA before continuing.
- User explicitly reported `pass`; M3.231 was accepted through the established workflow.
- M3.231 serializes preview generation for the same canonical source path and prevents concurrent requests from writing the same deterministic temporary preview file.
- **Current active milestone:** M3.232 — Bound Pending Export Cancellation Job IDs.
- **Current branch:** `fix/m3-232-bound-export-cancel-pending-job-ids`.
- **M3.232 PR:** Draft, pending creation from this branch.
- Fresh audit found the export cancellation state could grow without bound from cancellation requests for unknown job IDs.
- Each job ID is capped at 256 bytes, but the count of retained pending cancellation IDs had no limit.
- M3.232 adds a 1024-entry bound for pending unknown cancellation IDs while preserving active-job cancellation semantics.
- Protected PR #76 and unrelated PR #22 remain untouched.
- Stale PR #231 remains untouched.

## Established workflow — MUST FOLLOW

1. Refresh real GitHub state first.
2. Work one focused milestone at a time from verified `main`.
3. Implement the smallest safe correction and add focused regression coverage.
4. Update `docs/CHAT_HANDOFF_PROMPT.md`, `docs/PROJECT_CONTEXT.md`, and `docs/CHANGELOG.md` every milestone.
5. Create the milestone as a Draft PR.
6. Provide exactly one combined Pull/Fetch + Validation command for the user.
7. Do not claim lint, tests, build, Cargo, or runtime validation passed unless the user's output supports it. Treat an explicit user `pass` as the workflow acceptance signal.
8. On user `pass`: refresh PR/head/base, ensure branch is not behind, mark Ready for Review, re-read exact head SHA, squash-merge with that exact SHA, record the actual merge SHA, verify `main` is identical to the merge SHA, reconcile documentation, perform a fresh audit, create the next focused branch/Draft PR, and provide the next validation command.
9. Never reset, discard, or overwrite a user-local modification such as `src-tauri/Cargo.lock` automatically.
10. Keep the UI/UX/frontend redesign blocked until the stability gate is reached.
11. Do not modify protected PR #76 or unrelated PR #22. Leave stale PR #231 untouched unless a fresh audit specifically requires a new comparison.
12. Linux-native only. No Wine or Windows compatibility layer.

## Stability roadmap

- M3 hardening: resource bounds, lifecycle correctness, repeated-probe elimination, input validation.
- M4 media correctness.
- M5 process/lifecycle hardening.
- M6 persistence hardening.
- M7 native runtime/packaging.
- M8 QA.
- M9 stability gate.
- Only after M9/UI gate: major UI/UX/frontend redesign.

## M3.232 — Scope

Target only the unbounded pending export-cancellation state.

Current implementation:
- `MAX_PENDING_CANCELLED_EXPORT_JOB_IDS = 1024` in `src-tauri/src/export_process.rs`.
- Unknown job IDs consume bounded pending-cancellation capacity.
- Duplicate pending IDs are idempotent.
- Active child cancellation still marks the job cancelled and attempts to terminate FFmpeg.
- Lock ordering is kept consistent with registration/finish paths.
- Focused regression test verifies the exact capacity boundary and overflow rejection.
- No project schema change.

Do not broaden the milestone into unrelated export, UI, media, or architectural changes without a fresh audit.

## M3.232 — Validation

Validation is pending. Use this exact workflow:

```bash
ROOT="$(git rev-parse --show-toplevel)" &&
cd "$ROOT" &&
git fetch origin &&
git checkout fix/m3-232-bound-export-cancel-pending-job-ids &&
git pull --ff-only origin fix/m3-232-bound-export-cancel-pending-job-ids &&
git status --short &&
git log -1 --oneline &&
npm ci &&
npm run lint &&
npm run test &&
npm run build &&
cargo test --manifest-path src-tauri/Cargo.toml
```

Do not reset `src-tauri/Cargo.lock`.

## Immediate first action in a new chat

1. Refresh PR #250/current branch state from GitHub.
2. Verify the branch is still based directly on current `main` and not behind.
3. Inspect the M3.232 diff and focused regression test.
4. Check docs are synchronized with the branch.
5. Continue only within M3.232 until validation is explicitly accepted.
6. After PASS, execute the established merge/audit/next-branch workflow exactly.

.