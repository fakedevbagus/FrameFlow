# FrameFlow — New Chat Continuation Prompt

You are continuing development of my existing project **FrameFlow**:
https://github.com/fakedevbagus/FrameFlow

FrameFlow is a Linux-native desktop video editor inspired by modern editors such as CapCut, built with Tauri 2 + React 19 + TypeScript and Rust, without Wine.

## Mandatory first step

Before changing anything:
1. Inspect the actual repository.
2. Read `docs/PROJECT_CONTEXT.md`.
3. Read `docs/CHANGELOG.md`.
4. Inspect current `main`, open PRs, branches, and the relevant source files.
5. Verify documentation against the repository. Repository state wins if there is any disagreement.
6. Never guess file paths, APIs, architecture, tests, or previous work.

## Development rules

- Read actual files before modifying them.
- Preserve unrelated user changes.
- Create feature branches from the current `main`.
- Keep each milestone focused and normally use one PR per milestone.
- PRs stay draft until I report successful local validation.
- Never claim local tests/build/manual checks passed unless I provide the result.
- Code and code comments are English. Preserve existing Indonesian UI wording unless the feature needs new wording.
- Reuse existing helpers and architecture.
- Project mutations go through the existing history engine.
- Playback/transport state is UI state, not project history.
- Add regression tests for meaningful behavior and bug fixes.
- After every milestone or meaningful fix, update `docs/PROJECT_CONTEXT.md` and `docs/CHANGELOG.md`.
- Do not reset/delete/overwrite unrelated `Cargo.toml`, `Cargo.lock`, or working-tree changes without explicit confirmation.
- Do not give me a coding prompt for another agent. You are the engineer working directly on this repository.

## Known environment

- Linux Mint 22.3
- Node.js 24.19.0
- Rust/Cargo 1.97.1
- FFmpeg 6.1.1
- Tauri 2
- React 19
- TypeScript 6
- Vite 8
- Vitest 4
- ESLint 9

## Git workflow

Use this lifecycle:
1. Inspect current `main`.
2. Create a focused feature branch.
3. Implement.
4. Add/update tests.
5. Update documentation.
6. Open a draft PR.
7. Give me exact local validation commands.
8. Wait for my validation.
9. Only after I confirm success, mark PR ready and squash-merge.
10. Record the merge SHA in both documentation files.
11. Create the next branch from the updated `main`.

Normal validation:

```bash
git fetch origin
git checkout <feature-branch>
git pull --ff-only origin <feature-branch>

npm run lint
npm run test
npm run build
npm run tauri dev
```

## Current project state

Latest merged milestone:

### M3.12 — Keyframe keyboard nudging
PR #21
Merge SHA:
`9c745f798b73b34fdbf70ca04837de0eaa085036`

Implemented:
- ArrowLeft/ArrowRight moves focused transform keyframes by one frame.
- Shift+Arrow moves by 500 ms.
- Keyframes stay inside clip bounds and cannot cross adjacent keyframes.
- Playhead follows moved keyframes.
- Click, drag, Delete/Backspace remain supported.

### M3.11 — Keyframe selection controls
PR #20
Merge SHA:
`6470a740818b9f3988d19f66f79fc39387981934`

Implemented:
- Keyframe markers receive keyboard focus.
- Delete/Backspace removes only the keyframe, not the clip.
- Timeline/App regression coverage added.

Previous keyframe milestones:
- M3.10 easing: `c4eef9e65bac87c7b3f31e3623ccf85caf714596`
- M3.9 draggable keyframes: `fb9f6fe5fc2186df9351d2abee1246d67b9ef661`
- M3.8 timeline UI: `031033c1a6036d55a6c22ecc3ad184b376b76175`
- M3.7 keyframe foundation: `6bb225f35638f37d89a1031aae7371b5c95c01d6`

The complete history is in `docs/PROJECT_CONTEXT.md`.

## Current issue / current branch

During Linux manual playback testing I reported:
- Clicking Play can have a noticeable startup delay or apparent freeze.
- Playback may become normal after the delay.
- Replay can start from a stale end position or unexpectedly jump back to the beginning.

A concrete race was identified:
1. `App.tsx` waited for `media.play()` to resolve before setting `isPlaying`.
2. Starting from timeline end scheduled `setPlaybackTime(0)`, then immediately called `play()` before the media element was necessarily reset.
3. `Preview.tsx` did not explicitly re-align media to the current transport position when playback began.
4. The Linux preview path uses a localhost HTTP media server because older local WebView media delivery approaches were unreliable.

A fix is now implemented on:
`feat/m3-13-playback-stability`

Fix contents:
- `App.tsx`: starts playback immediately without awaiting all `play()` promises.
- `App.tsx`: determines a transport target time and resets to 0 when playback is at timeline end.
- `App.tsx`: aligns active media to clip-local/source-local time before calling `play()`.
- `Preview.tsx`: video elements expose `data-clip-id`.
- `Preview.tsx`: playback-start effect re-aligns video to the current clip-local time.
- `Preview.test.tsx`: regression test covers replay alignment from a near-end media position.
- Documentation files were added/updated as the long-lived context source.

Important: **M3.13 is not yet validated locally by me.**

Do not mark it complete or merge it until I report the local result.

## M3.13 manual validation

1. Import a real local MP4.
2. Start Play from 00:00; verify no noticeable transport-start delay.
3. Verify video and playhead advance together.
4. Pause in the middle and resume from the same position.
5. Move playhead to the exact timeline end and press Play; verify clean restart from 00:00, without replaying the stale end frame first.
6. Repeat with a trimmed clip where `sourceStartMs` is not zero.
7. Test multiple active media layers and verify each aligns to its own clip-local position.
8. Verify playback does not create Undo/Redo history entries.
9. Verify M3.11/M3.12 keyframe click, drag, Delete/Backspace, Arrow nudging, and Shift+Arrow still work.

## Media preview architecture

Video preview currently follows:
1. Native `prepare_media_preview` creates/returns a compatible H.264 MP4 preview.
2. Native localhost HTTP media server serves the prepared media.
3. React calls `get_media_http_url` and assigns the URL to `<video>`.
4. Transport state and media elements are synchronized.
5. Timeline time is mapped to clip-local/source-local time.

Do not replace this architecture without first auditing the reasons for it. A large part of M3.7 solved Linux WebView media compatibility, range requests, preview caching, and localhost serving.

## Existing transform/keyframe system

Visual clips support:
- X/Y position
- Scale
- Rotation
- Opacity
- Transform keyframes
- Linear / Ease in / Ease out / Ease in-out interpolation

Current keyframe UX:
- Add/update/remove
- Timeline diamond markers
- Click-to-seek
- Drag-to-move
- Delete/Backspace
- ArrowLeft/ArrowRight one-frame nudge
- Shift+Arrow 500 ms nudge
- Clip/neighbor constraints
- Undo/Redo

## Documentation contract

`docs/PROJECT_CONTEXT.md` is the long-lived source of truth.
`docs/CHANGELOG.md` records dated milestone/fix history.

For each milestone or meaningful bug fix, record:
- date
- milestone / issue
- branch
- PR number
- merge SHA when merged
- implementation summary
- architecture decisions
- tests added/updated
- manual validation actually reported by me
- known limitations
- next step

Never document unverified validation as completed.

## Immediate continuation

Start by reading:
- `docs/PROJECT_CONTEXT.md`
- `docs/CHANGELOG.md`
- `src/App.tsx`
- `src/features/preview/Preview.tsx`
- `src/features/preview/Preview.test.tsx`

Then inspect `feat/m3-13-playback-stability`, review the playback fix, and prepare/maintain its draft PR. After I validate it locally, continue to the next milestone using the same workflow.