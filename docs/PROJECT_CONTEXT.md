# FrameFlow Project Context

## Purpose

FrameFlow is a Linux-native desktop video editor inspired by the workflow and usability of modern editors such as CapCut, but implemented as a real Linux desktop application without Wine.

The project is being built incrementally. Every milestone must be small, testable, reversible, and documented before the next milestone starts.

## Repository

- GitHub: https://github.com/fakedevbagus/FrameFlow
- Current default branch: `main`
- M3.13 was merged as PR #23 with merge SHA `595f7498e503aab19052279979fb389ae8300691`.
- M3.14 was merged as PR #24 with merge SHA `838c5a8dad7ce4214b8e8d4d85084d7e2fd50379`.
- M3.15 was merged as PR #25 with merge SHA `69c2b5edee8e4ea5e5d530c2402e0c9ce7281abc`.
- New milestone branches must be created from the updated `main` after the preceding milestone validation.

## Development environment

Known local environment used for validation:

- Linux Mint 22.3
- Node.js 24.19.0
- Rust/Cargo 1.97.1
- FFmpeg 6.1.1
- Vite 8
- React 19
- TypeScript 6
- Tauri 2
- Vitest 4
- ESLint 9

The AI assistant cannot run the user's local desktop application. Local validation results must come from the user and must never be invented.

## Engineering rules

1. Read the actual repository files before proposing or applying a change. Never guess the file tree or invent APIs.
2. Keep user changes intact. Do not reset, delete, or overwrite unrelated working-tree changes.
3. Use feature branches from the current `main`.
4. One milestone should normally be one focused PR.
5. Keep PRs draft until the user has validated the branch locally.
6. Do not merge a PR merely because automated reasoning says it should work. Wait for the user's local validation.
7. Prefer existing architecture and helpers over parallel implementations.
8. Keep project/history mutations inside the existing history engine.
9. Keep playback position and other transport UI state separate from project history.
10. Code and code comments are written in English. User-facing UI may remain Indonesian where the existing UI uses Indonesian.
11. Add regression tests for every bug fix or user-visible behavior change.
12. After each completed milestone, update this context document and the changelog with the PR, merge SHA, implementation summary, validation result, architectural decisions, and known limitations.
13. When starting a new chat, treat this document as the source of truth and verify it against the repository before continuing.
14. Never claim that a fix is validated until the user reports the local validation result.

## GitHub workflow

Typical sequence:

1. Inspect current `main` and the relevant existing implementation.
2. Create a feature branch from current `main`.
3. Implement one focused milestone.
4. Add or update automated tests.
5. Open a draft PR.
6. User pulls the branch and runs:
   `npm run lint`
   `npm run test`
   `npm run build`
   `npm run tauri dev`
7. User performs the requested manual checks.
8. After user confirms validation, mark PR ready and squash-merge.
9. Record the merge SHA here and in the changelog.
10. Create the next branch from updated `main`.

## Product architecture

### Frontend
- React + TypeScript
- Vite
- UI state is primarily in `src/App.tsx`
- Timeline UI: `src/features/timeline/`
- Preview/compositor UI: `src/features/preview/`
- Transform logic: `src/features/transform/`
- Project/domain model: `src/features/project/`
- History engine: `src/features/history/`
- Playback timing: `src/features/playback/`
- Media import: `src/features/media/`

### Native layer
- Tauri 2 + Rust
- FFmpeg is used for compatibility preview generation
- A localhost HTTP media server is used because Linux WebView media delivery through local asset/custom protocols proved unreliable for the required playback path.

### Media preview pipeline

For video preview:

1. The selected/local source asset is prepared through the Tauri native command `prepare_media_preview`.
2. A compatible H.264 MP4 preview is generated/cached when required.
3. The resulting preview is exposed through the Tauri localhost HTTP media server.
4. The React preview uses the returned HTTP URL as the `video.src`.
5. Audio preview uses the same localhost media serving path.
6. Preview media elements use clip identity metadata so the transport controller can align media to the timeline.

This pipeline is intentionally separate from the eventual full FFmpeg export/render pipeline.

## Current project model

Visual clips may contain:

- static transform
- optional transform keyframes
- transform keyframe easing metadata

Current transform fields:

- X: -100% to +100%
- Y: -100% to +100%
- Scale: 0.05x to 10x
- Rotation: -180 to +180 degrees
- Opacity: 0% to 100%

Keyframe easing values:

- `linear`
- `ease-in`
- `ease-out`
- `ease-in-out`

Keyframe behavior currently includes:

- add/update/remove
- interpolation
- easing
- timeline markers
- click-to-seek
- pointer dragging
- Delete/Backspace removal
- ArrowLeft/ArrowRight one-frame nudging
- Shift+ArrowLeft/Right 500 ms coarse nudging

Keyframe moves are constrained to the clip range and cannot cross adjacent keyframes.

## Milestone history

### M1 — Foundation
Initial Tauri + React + TypeScript application foundation.

### M2.1 — Media import foundation
Basic local media import workflow.

### M2.2 — Media Bin to Timeline
Imported media can be placed on the main timeline.

### M2.3 — Clip selection / inspector / delete
Clip selection and initial inspector controls.

### M2.4 — Timeline interaction foundation
Timeline interaction groundwork.

### M2.5 — Core edit commands
Core timeline editing commands.

### M2.6 — Direct mouse timeline editing
Merged commit: `7c21c206` (recorded in project history).

### M2.7 — Undo/Redo engine
Merged commit: `388206b60f29363abc7047af49be5f5af6a5ef60`.

### M2.8 — Playback / transport foundation
Merged commit: `32f56ffc1f41ac61d35c1f5a802a380d30ef2731`.

Key design decision: playback position is UI state, not history.

### M2.9 — Local media preview foundation
Merged commit: `74043de39126ddc3840711e36cc088cf03078cb5`.

Introduced local preview rendering, timeline-to-source time mapping, and browser/media playback synchronization groundwork.

### M3.1 — Multi-track preview compositor
Merged commit: `6a423ca4d73457901d9506026ca7b2ee72ac8605`.

Multiple active visual layers, audio/video coexistence, deterministic track ordering, mute exclusion.

### M3.2 — Track management and media routing
Merged commit: `d7453426b256e5804c279b6cf72cc8ae379cf1b6`.

Added track creation/removal, mute controls, media routing, and drop-to-track behavior.

### M3.3 — Transform and layer controls
Merged commit: `898efee71605a9aa2cd08691ef098708653e2fd2`.

Added per-clip transform model and Inspector controls.

### M3.4 — Direct canvas manipulation
Merged commit: `84bec251aae2c90e00ceb473227a6cf7b01c7281`.

Added direct canvas move/scale/rotation interaction with history integration.

### M3.5 — Precision transform Inspector
Merged commit: `110a19d9d0fe1258acecf912ddb85dd2e5d69408`.

Numeric transform inputs with normalized ranges and committed history edits.

### M3.6 — Content-aware transform bounds
Merged commit: `8641304dfe108017f57264d6f902dda274c7888f`.

Transform handles and centers follow visible media content rather than the entire canvas.

### M3.7 — Transform keyframe foundation
Merged commit: `6bb225f35638f37d89a1031aae7371b5c95c01d6`.

Added keyframe data model, interpolation, commands, Inspector controls, preview evaluation, split preservation, and the long-running Linux local-video delivery fixes that culminated in localhost HTTP serving.

### M3.8 — Keyframe Timeline UI
Merged commit: `031033c1a6036d55a6c22ecc3ad184b376b76175`.

Added timeline diamond markers, active state, and marker click-to-seek.

### M3.9 — Keyframe editing
Merged commit: `fb9f6fe5fc2186df9351d2abee1246d67b9ef661`.

Added draggable keyframe markers with snapping and collision constraints.

### M3.10 — Keyframe easing
Merged commit: `c4eef9e65bac87c7b3f31e3623ccf85caf714596`.

Added easing metadata, interpolation formulas, Inspector control, command support, and regression coverage.

### M3.11 — Keyframe selection controls
Merged commit: `6470a740818b9f3988d19f66f79fc39387981934` (PR #20).

Added keyboard-focusable keyframe markers and Delete/Backspace removal without deleting the clip.

### M3.12 — Keyframe keyboard nudging
Merged commit: `9c745f798b73b34fdbf70ca04837de0eaa085036` (PR #21).

Added ArrowLeft/ArrowRight one-frame movement and Shift+Arrow coarse 500 ms movement, with clip/neighbor constraints and timeline coverage.

## Known playback issue under investigation

User reported this behavior on Linux during manual playback testing after the recent keyframe work:

- Clicking Play can introduce a visible startup delay or apparent freeze.
- Playback may become normal after the delay.
- Replay behavior can return the video to the beginning unexpectedly.

The current investigation found a concrete race in the transport/preview interaction:

1. `App.tsx` waited for `media.play()` to resolve before setting `isPlaying`.
2. When starting from the timeline end, the app scheduled `setPlaybackTime(0)` and then immediately called `play()`, before React had necessarily applied the reset to the media element.
3. The preview playback effect started media playback but did not explicitly re-align the media element to the current transport position when `isPlaying` changed to true.
4. This can cause delayed transport UI startup, replay from a stale end position, or a mismatch between the timeline clock and the media element.

## M3.13 — Playback stability fix (PR #23, merged)

Branch:
`feat/m3-13-playback-stability`

PR: https://github.com/fakedevbagus/FrameFlow/pull/23

Merge SHA:
`595f7498e503aab19052279979fb389ae8300691`

Current changes:

- `src/App.tsx`
  - Do not wait for all `play()` promises before entering the playing state.
  - Start playback immediately from the user gesture.
  - Determine an explicit transport start position, resetting to 0 at timeline end.
  - Align each active media element to its current clip-local source position before `play()`.
  - Preserve WebKit user-activation compatibility by invoking `play()` directly in the click handler.
  - Surface asynchronous playback failures through the existing project notice.
- `src/features/preview/Preview.tsx`
  - Re-align video media to the current clip-local transport position whenever playback starts.
  - Add `data-clip-id` to media elements so the App transport handler can resolve the corresponding clip.
- `src/features/preview/Preview.test.tsx`
  - Added regression coverage that forces a video to a near-end position and verifies a new playback start re-aligns it to the transport position.

Branch commits:
- `bc1f2b870d83e245cbc986b99ca76410e68e7357` — App playback startup/replay fix
- `94a01ec0892c32a6ed980ef464fcb985815d220e` — Preview playback alignment fix
- `030a17a8f4100537fbe72a18a27c25fb763b3a9e` — replay alignment regression test
- `fa630787122cd4133628e6cbcf71863517fb3b5e` — project context documentation
- `e8f4de5a546661ee6a042595574491be281a1e6f` — changelog documentation
- `7cf18d1c4d7cb3c6a2fdb1f0901eb5aea1eedc67` — new-chat handoff prompt

Validation:
- User reported the M3.13 fix successfully validated locally on Linux.
- Playback startup/replay synchronization and playback smoothness were reported working.

Important: these changes were implemented from current `main` after M3.12 was already merged. The earlier temporary branch `feat/m3-12-keyframe-keyboard-nudging` was intentionally not used for the final playback fix.

## Current validation status

M3.13 has been validated locally by the user.

During M3.13 work, a follow-up playback smoothness issue was fixed: the preview video effect previously depended on changing clip-local transport time and could seek the video element on every animation-frame update. The correction keeps re-alignment limited to playback start or active-clip changes, with regression coverage.

Historical M3.13 validation commands:

```bash
git fetch origin
git checkout feat/m3-13-playback-stability
git pull --ff-only origin feat/m3-13-playback-stability

npm run lint
npm run test
npm run build
npm run tauri dev
```

Manual playback checks:

1. Import a real local MP4.
2. Start playback from 00:00.
3. Verify Play responds without a noticeable transport-start delay.
4. Verify video and playhead advance together.
5. Pause and resume from the middle; verify playback continues from the paused position.
6. Move playhead to the exact end; press Play; verify playback restarts from 00:00 without briefly playing the old end position.
7. Repeat with a trimmed clip whose `sourceStartMs` is not zero.
8. With multiple active media layers, verify all layers restart/align to their clip-local positions.
9. Verify Undo/Redo does not change because of playback alone.
10. Verify keyframe click, drag, Delete/Backspace, and keyboard nudge behavior remain intact.

## Future roadmap principle

Do not jump directly into a large CapCut-scale feature set. Build in vertical slices:

1. playback stability
2. keyframe UX completion
3. crop/anchor and transform polish
4. transitions
5. effects/filters
6. text and captions
7. audio waveform/audio tools
8. export pipeline
9. project persistence hardening
10. performance and render architecture
11. production packaging
12. deeper FFmpeg render/export pipeline

The exact next milestone should be based on the actual current repository state after the preceding validation.

## Completed milestone — M3.14

Title: Keyframe UX hardening
Branch: `feat/m3-14-keyframe-ux-hardening`
PR: #24
Merge SHA: `838c5a8dad7ce4214b8e8d4d85084d7e2fd50379`

Scope:
- Preserve the existing keyframe model and history architecture.
- Make keyboard focus on a keyframe marker select its owning clip.
- Expose the active keyframe state through `aria-current`.
- Allow Escape to cancel an in-progress keyframe drag without committing a move.
- Add focused regression coverage for these interactions.

Validation status:
- User reported successful local validation after the implementation fixes.
- PR #24 was marked ready and squash-merged.

M3.14 validation correction:
- Updated the preview time ref inside a React effect to satisfy the React refs lint rule without reintroducing per-tick media seeking.
- Corrected Escape handling to call the Timeline-owned cancellation callback instead of an undefined child-scope function.

Next step:
- Continue with the next focused transform milestone from updated `main`.

## M3.15 — Transform anchor foundation — completed

Branch: `feat/m3-15-transform-anchor-foundation`
PR: #25
Merge SHA: `69c2b5edee8e4ea5e5d530c2402e0c9ce7281abc`

Scope delivered:
- Added a backward-compatible per-clip transform anchor point with a center default.
- Added nine anchor presets in the Transform Inspector.
- Applied anchor coordinates to the preview transform origin.
- Updated direct canvas scale/rotation manipulation to use the selected anchor as the pivot.
- Kept anchor edits in the existing project history engine and separate from transform keyframes for this milestone.
- Added domain, command, preview, manipulation, and App regression coverage.

Validation:
- User confirmed local validation succeeded after correcting the App accessibility-name assertion and removing the unused TypeScript import.

Known limitation:
- This milestone establishes anchor state and pivot behavior but does not yet provide visual anchor dragging or compensating translation to keep the visible content stationary when changing the pivot.

Next step:
- Continue M3.16 crop foundation validation before merge.

## M3.16 — Crop foundation (in progress)

Branch: `feat/m3-16-crop-foundation`
PR: #26

Scope:
- Add a backward-compatible per-clip crop model with zero-crop as the default.
- Expose Top, Right, Bottom, and Left crop controls in the Transform Inspector.
- Apply crop in the preview using media-element clipping.
- Keep crop edits in the existing project history engine and separate from transform keyframes for this milestone.
- Preserve crop state across clip splitting.
- Add transform-domain, timeline-command, preview, and App regression coverage.

Architecture decisions:
- Crop is represented as normalized per-edge insets (0..1) on the clip.
- Horizontal and vertical crop totals must remain below 1 so the entire visual content cannot be removed.
- Crop is applied before the existing clip transform effect on the media element, leaving transform handles available outside the clipped media.
- Legacy clips without crop data render with zero crop.

Validation:
- Initial local validation found one unused TypeScript import in `src/features/timeline/commands.ts`; the import has been removed.
- The test suite itself passed: 17 test files, 136 tests.
- `npm run build` failed only because of the same unused import.
- `npm run tauri dev` launched successfully despite the prior TypeScript build failure.
- A clean lint/build rerun and manual validation are still required.

Known limitation:
- This milestone provides Inspector-based crop values only. Direct crop-handle manipulation, aspect-ratio presets, and crop-position translation compensation are future work.

Next step:
- Run local lint, test, build, Tauri dev, and the requested manual crop checks on Linux before merging.

## Documentation protocol

For every milestone or meaningful bug fix, update:

- `docs/PROJECT_CONTEXT.md`
- `docs/CHANGELOG.md`

Each entry must include:

- milestone / issue name
- branch
- PR number
- merge SHA when merged
- what changed
- important architecture decisions
- automated tests added/changed
- user manual validation steps
- known limitations
- what should happen next

Never put claims in documentation about tests or manual checks that the user has not actually reported.
