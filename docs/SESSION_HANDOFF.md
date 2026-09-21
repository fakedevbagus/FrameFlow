# FrameFlow Session Handoff

Last updated: 2026-09-21

## Purpose

This file is the canonical handoff checkpoint for continuing FrameFlow work across ChatGPT sessions.

A new chat must treat repository state, this file, `docs/PROJECT_CONTEXT.md`, and `docs/CHANGELOG.md` as the primary project context. Model memory and old pasted logs are secondary and may be stale.

## Verified repository state

- Repository: `fakedevbagus/FrameFlow`
- Default branch: `main`
- Current `main` tip: `7d9400634c0f9a4650212110b938a17e0fa685da`
- Latest completed milestone: M3.28 — Transition lifecycle integrity
- M3.28 PR: #39
- M3.28 merge SHA: `2e77190ef6474b3ede1ad72af0682a9c5bfb7c61`
- There is currently no approved or active M3.29 implementation.
- The historical branch `feat/m3-28-transition-lifecycle-integrity` still exists but must not be used as the base for new work.

## Recent completed milestones

| Milestone | PR | Merge SHA | Validation status |
| --- | --- | --- | --- |
| M3.25 Dissolve transition foundation | #36 | `01c90688fe4256278fe7dc1f94c1c94463e6eb6e` | User confirmed local validation |
| M3.26 Timeline transition indicator | #37 | `74ebee88b79b99fe9be7c2b8cd641cb28194a7ae` | User confirmed local validation |
| M3.27 Direct transition duration | #38 | `9eb1512e733e47ab84d37fdbddfe30e24856a2e0` | User confirmed local validation |
| M3.28 Transition lifecycle integrity | #39 | `2e77190ef6474b3ede1ad72af0682a9c5bfb7c61` | Remote merge confirmed; fresh local post-fix validation not confirmed in this chat |

## M3.28 validation truth

The latest pasted local log available in the conversation was captured before the final follow-up fixes. It showed:

- branch `feat/m3-28-transition-lifecycle-integrity`
- local modifications in `src-tauri/Cargo.lock` and `src-tauri/Cargo.toml`
- one lint failure in `Timeline.test.tsx` (`prefer-const`)
- two failing transition lifecycle tests
- two TypeScript build errors in `src/features/transition/transition.ts`
- `tauri dev` launched successfully

After that, PR #39 was merged remotely with follow-up fixes. The repository documentation records that merge, but the merge itself is not proof of a new local validation run.

Current truth: **M3.28 local post-fix validation is not confirmed in this chat.**

## Working-tree safety

Never reset or overwrite unrelated local changes.

The latest local log showed modifications to:

- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`

Preserve these when present unless the user explicitly asks to change them.

## Architecture continuity

- Tauri 2 + React + TypeScript.
- Timeline: `src/features/timeline/`
- Preview/compositor: `src/features/preview/`
- Transform/crop: `src/features/transform/`
- Domain: `src/features/project/`
- History: `src/features/history/`
- Playback: `src/features/playback/`
- Media: `src/features/media/`
- Native Tauri/Rust: `src-tauri/`
- Project/history mutations must continue through the existing history engine.
- Playback transport state remains separate from project history.
- Reuse existing helpers and commands instead of creating parallel state pipelines.
- Code/comments are English; user-facing UI may remain Indonesian.

## Transition state at M3.28

Current transition feature supports:

- clip-level outgoing `dissolve`
- only directly adjacent visual clips
- duration normalization with existing 50–2000 ms bounds
- preview cross-dissolve layers
- Inspector configuration
- timeline transition indicator
- direct timeline duration-handle editing
- keyboard duration nudging
- Escape cancellation
- lifecycle sanitization after move/remove/trim/split edits

Known future transition work:

- more transition types
- transition browser
- richer draggable transition block / placement UX
- audio transitions

## Rules for every new chat

1. Read this file first.
2. Read `docs/PROJECT_CONTEXT.md` and `docs/CHANGELOG.md`.
3. Verify the current `main` SHA and open/closed PR state directly from GitHub.
4. Inspect actual repository files before proposing or changing code.
5. Do not infer local validation from a merged PR.
6. If local validation is unknown, explicitly say so.
7. Protect unrelated working-tree changes.
8. Keep each milestone focused and use a feature branch created from the verified current `main`.
9. Keep the PR draft until the user reports local validation.
10. After every meaningful milestone or correction, update all three continuity documents: `docs/SESSION_HANDOFF.md`, `docs/PROJECT_CONTEXT.md`, and `docs/CHANGELOG.md`.

## Required first response in a new chat

Before implementing anything, provide a concise state report containing:

- current `main` SHA
- latest completed milestone and merge SHA
- current local-validation status of the latest milestone
- any known stale/open PRs that should not be confused with active work
- the immediate next verification or implementation step

Do not start coding until this state has been reconciled with the live repository.

## Next milestone policy

Do not invent a fixed M3.29 scope from memory.

First verify M3.28 against current `main`, review remaining transition UX gaps and the existing roadmap, propose one small vertical slice for M3.29, then create a feature branch and draft PR.

## Known stale GitHub item

PR #22 (`fix: preserve keyframe easing when moving markers`) is still an old open draft. It predates the later keyframe work and must not be treated as the current active milestone unless repository inspection shows it is intentionally revived.

## Continuity principle

The repository documentation is part of the implementation. When a session ends, the latest verified state must be written down so the next session can resume from evidence rather than inference.