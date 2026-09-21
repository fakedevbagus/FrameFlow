# FrameFlow New Chat Continuation Prompt

Copy and paste this prompt into a new ChatGPT session when continuing the project.

---

You are continuing development of the existing GitHub repository `fakedevbagus/FrameFlow`.

## Mandatory first step: reconcile state

Before writing, changing, or proposing code, read these repository documents:

1. `docs/SESSION_HANDOFF.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/CHANGELOG.md`

Then verify the live GitHub repository state, especially:

- current `main` SHA
- latest merged PR and merge SHA
- open PRs
- active/stale feature branches relevant to the latest milestone

Do not rely on model memory, an old conversation summary, or a pasted log when the repository can provide the current truth.

## Current checkpoint recorded in the handoff

- Repository: `fakedevbagus/FrameFlow`
- Current `main` tip at the checkpoint: `7d9400634c0f9a4650212110b938a17e0fa685da`
- Latest completed milestone: M3.28 — Transition lifecycle integrity
- M3.28 PR: #39
- M3.28 merge SHA: `2e77190ef6474b3ede1ad72af0682a9c5bfb7c61`
- M3.25 PR #36 merged: `01c90688fe4256278fe7dc1f94c1c94463e6eb6e`
- M3.26 PR #37 merged: `74ebee88b79b99fe9be7c2b8cd641cb28194a7ae`
- M3.27 PR #38 merged: `9eb1512e733e47ab84d37fdbddfe30e24856a2e0`
- No M3.29 implementation is currently approved or active.

## Important validation truth

M3.27 local validation was explicitly confirmed by the user.

M3.28 was merged remotely after follow-up fixes, but the latest local validation log available before those fixes showed:

- one lint failure (`prefer-const` in `Timeline.test.tsx`)
- two failing transition lifecycle tests
- two TypeScript build errors in `src/features/transition/transition.ts`
- successful `tauri dev` startup

Therefore, do NOT say that M3.28 passed local validation unless the user gives a fresh post-fix validation result.

## Local-worktree safety

The user's latest local log showed modifications to:

- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`

Never use a blanket reset that destroys unrelated local changes. Preserve them unless the user explicitly asks otherwise.

## Required first response

Your first response in the new session must be a state report, not code.

Report:

- verified current `main` SHA
- latest completed milestone and merge SHA
- current local-validation status
- relevant open/stale PRs, especially old PR #22, without treating it as active work
- the immediate next step

Then proceed according to the verified repository state.

## M3.28 verification

Because M3.28 is already merged remotely but its fresh local validation is not confirmed in the checkpoint, the first operational task should be to get the user onto current `main` and run the validation sequence before starting a new feature:

```bash
git fetch origin
git switch main
git pull --ff-only origin main

npm run lint
npm run test
npm run build
npm run tauri dev
```

Do not create M3.29 until this current-state validation is explicitly confirmed, unless inspection reveals a concrete blocking issue that requires a focused fix first.

## Engineering workflow

- Read actual repository files before changing code.
- Use a feature branch from the verified current `main`.
- Keep one focused milestone per PR.
- Add regression tests for user-visible behavior and bugs.
- Keep project/history mutations inside the existing history engine.
- Keep playback transport state separate from project history.
- Reuse existing architecture and helpers.
- Code and comments in English; existing user-facing UI language may remain Indonesian.
- Keep PRs draft until the user validates locally.
- Never claim local validation that the user has not reported.

## Documentation continuity requirement

Documentation is part of the project state.

After every meaningful milestone, bug fix, validation correction, or session checkpoint, update all three:

- `docs/SESSION_HANDOFF.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/CHANGELOG.md`

Each milestone entry must record:

- milestone name
- branch
- PR
- merge SHA when merged
- implementation summary
- architecture decisions
- automated tests
- exact validation status
- known limitations
- next step

When a session is ending or being handed to another chat, update `docs/SESSION_HANDOFF.md` with the exact current state so the next chat does not have to reconstruct history from memory.

## Scope discipline

Do not invent a predetermined M3.29 scope.

After M3.28 validation is confirmed, inspect the remaining transition UX gaps and broader roadmap, then propose one small vertical slice. Examples may include transition browser/placement UX, additional transition types, audio transitions, or the deferred orientation-aware workspace, but choose based on the actual repository state rather than memory.

Do not mix the deferred responsive workspace redesign into unrelated core editing milestones unless the scope explicitly requires it.

## Output style

Be direct and implementation-focused. Do not give a generic project summary when repository inspection can provide exact facts. Surface conflicts between documents, GitHub, and pasted logs explicitly and resolve them from the newest authoritative evidence.