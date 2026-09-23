## M3.73 — validation correction — 2026-09-24

- User run passed lint, the full frontend suite (33/33 files, 397/397 tests), and production build.
- The Rust/Tauri stage failed on implementation/test integration issues.
- Corrected the duplicate serde declaration, missing `source_audio_segments` fields in native test fixtures, missing builder argument coverage, and test import scope in commit `66afae8ad3307bddebcf3ca320cee51c1c936913`.
- PR #87 remains Draft and requires fresh Rust/Tauri validation before PASS.

## M3.73 — active — 2026-09-24

- Branch: `feat/m3-73-source-audio-unified-export`.
- Scope: preserve embedded audio from non-muted video clips when explicit Audio tracks use the unified AV export path.
- The request now carries optional `sourceAudioSegments` metadata for rebased video input indexes and source/timeline timing.
- Native export probes referenced video sources for audio, trims the first audio stream to the clip source range, delays it to the timeline start, normalizes it to 48 kHz stereo, and mixes it with the existing explicit Audio graph.
- Image inputs and muted video segments are excluded from source-audio preservation.
- No project schema change.
- PR #87 is the intended draft PR.
- Local validation is pending.
- M3.72 is complete and merged at `8aaae96d09bd7275c9171dc08cf89b74e1dd8e38`.
- PR #76 remains parked and must not be merged or revived wholesale.

## M3.72 — completed — 2026-09-24

- PR #86 `feat: integrate audio with multitrack export` was user-validated, marked ready, and squash-merged.
- Merge SHA: `8aaae96d09bd7275c9171dc08cf89b74e1dd8e38`.
- User reported PASS for the requested local lint, frontend test suite, production build, Rust tests, and Tauri development startup.
- A stale render-graph assertion was corrected before the successful validation; no production implementation change was required for that correction.
- M3.72 removed the visual graph compilers' obsolete rejection of explicit Audio track segments and connected multi-video + explicit-audio plans to the unified native AV renderer.
- Known next gap: embedded/source audio from graph-rendered visual clips is still not preserved when explicit Audio tracks trigger the unified AV path.
- PR #76 remains parked and must not be merged or revived wholesale.

- M3.72 validation correction: user validation found one stale render-graph assertion expecting `track_1_sequence`; the actual generated graph correctly uses `track_2_sequence` because the fixture's second video track is project track index 2.
- Corrected the assertion in commit `230dcf7c0d09e01319602c662bb3a50d33f1d320`.
- Lint, production build, 42 Rust tests, and Tauri startup passed in that run; fresh frontend validation is still required.
- PR #86 remains Draft.

- M3.72 is the active milestone- M3.72 is the active milestone on `feat/m3-72-multitrack-audio-export`: Multi-Track + Audio Export Integration.
- M3.71 is complete and squash-merged as PR #85 at `3ae70e91ad5ff0dc2a11bcde59c32a39cab3ab89`.
- M3.72 removes the visual graph compiler's obsolete rejection of explicit Audio track segments.
- Regression coverage includes single-track + audio, multi-track + audio graph compilation, and unified pipeline routing for multiple video tracks plus explicit audio.
- Keep PR #86 Draft until I report PASS.
- PR #76 remains parked and must not be merged or revived wholesale.
- No project schema change.

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
2. Create a focused feature branch from the updated `main).
3. Implement.
4. Add/update tests.
5. Update documentation.
6. Open a draft PR.
7. Give me exact local validation commands.
8. Wait for my validation.
9. Only after I confirm success, mark PR ready and squash-merge.
10. Record the merge SHA in `docs/PROJECT_CONTEXT.md` and `docs/CHANGELOG.md`.
11. Create the next branch from the updated `main`.

### Required pull/fetch sequence

For an existing working feature branch:

```bash
git fetch origin --prune
git checkout <feature-branch>
git pull --ff-only origin <feature-branch>
git status
git log -1 --oneline
```

Do not skip the fetch/pull sequence when handing work back to the local environment.

### Normal validation

```bash
npm ci
npm run lint
npm run test
npm run build
npm run tauri dev
```

For Rust-specific validation:

```bash
cd src-tauri
cargo test
cd ..
```

## Current repository state

### M3.68 — Non-Centered Transform Anchor Export — active draft PR

Branch:
`feat/m3-68-non-centered-transform-anchor-export`

PR:
#82 — Draft

Status:
- In progress
- Local validation pending

M3.68 current scope:
- Export non-centered transform anchors already supported by the editor and Preview.
- Preserve anchor-aware scale and rotation semantics for static transforms and animated keyframes.
- Preserve existing crop/effects ordering, image/video compatibility, keyframe easing, and world-space X/Y translation.
- Keep the project schema unchanged.
- Off-center pivot export uses a transparent surface with the selected anchor placed at its center before rotation; X/Y translation is then applied in world space.
- Route graph-required visual metadata through the graph renderer instead of direct/legacy render paths.

Explicitly deferred:
- Text Overlay Export remains parked in PR #76.
- Multi-track compositing.
- Audio mixing.

### M3.67 — Animated Transform Export — merged

- PR #81 was user-validated and squash-merged at `783885376209ec56013612147b217a13c8bf1ef7`.
- GitHub CI run #181 passed.
- Animated X/Y, Scale, Rotation, and Opacity export now uses the existing keyframe/easing model through the single-video FFmpeg graph.
- Centered transform anchors remain supported; non-centered anchor export is the current M3.68 focus.

## Previous merged audio milestones

- M3.55 Audio Waveform Foundation — PR #69 — merge SHA:
  `8efdd97843fe63a02e9104ee52b369bf3bf3dd7b`
- M3.54 Audio Volume Automation Timeline UX — PR #68 — merge SHA:
  `21a1d601bed8215ea52c6ec4eb8ddcb2c4e769d2`
- M3.53 Audio Clip Volume Automation — PR #67 — merge SHA:
  `fafe6e183ba4eb350db0f1b9873861d9c5543689`
- M3.52 Audio Clip Dynamics Compressor — PR #66 — merge SHA:
  `da0b5dc957be094738ac4e657007523f8684fdd8`
- M3.51 Audio Clip 3-Band EQ — PR #65 — merge SHA:
  `52844a8c5f1a1f0605e6c9508d87c52c90ead7de`

The complete milestone history is in `docs/PROJECT_CONTEXT.md`.

## Next-milestone rule

After M3.57 is locally validated and merged:
1. Re-inspect the updated `main`.
2. Inspect open PRs/branches/issues and the current project context.
3. Determine the next focused milestone from repository evidence.
4. Create the next feature branch from the updated `main`.
5. Do not regress into older milestones described by stale historical prompts.

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
- manual validation actually reported by the user
- known limitations
- next step

Never document unverified validation as completed.
