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

### M3.58 — Persistent Waveform Cache — active draft PR

PR #72:
https://github.com/fakedevbagus/FrameFlow/pull/72

Branch:
`feat/m3-58-persistent-waveform-cache`

Base:
`main @ c8b89684665f61d5f03e78ccbcc66cc52beb28af`

Implemented:
- Persistent waveform cache in browser local storage.
- Native audio source fingerprint from file size and modification timestamp.
- Cache identity includes source path, peak count, and fingerprint.
- Changed media invalidates the previous waveform cache automatically.
- Cache is capped at 32 entries.
- Malformed or unavailable persistent storage falls back to normal native waveform generation.
- In-flight waveform requests remain deduplicated.
- Existing M3.57 click-seek and drag region-selection behavior remains intact.
- No project schema/history changes.

### Required local validation

```bash
git fetch origin --prune
git checkout feat/m3-58-persistent-waveform-cache
git pull --ff-only origin feat/m3-58-persistent-waveform-cache
git status
git log -1 --oneline

npm ci
npm run lint
npm run test
npm run build

cd src-tauri
cargo test
cd ..

npm run tauri dev
```

Manual M3.58 checks:
- Open an audio project and confirm the waveform renders normally.
- Restart the app and confirm a previously generated waveform does not invoke FFmpeg regeneration unnecessarily.
- Modify/replace the source audio file and confirm the changed fingerprint causes regeneration.
- Verify malformed/local-storage failure does not prevent waveform rendering.
- Confirm M3.57 click seek and drag selection still work.
- Confirm clip move/trim, playback, and existing audio effects remain intact.

Do not mark PR #72 ready or merge it until the user reports local PASS.


### M3.56 — Audio Waveform Scrubbing — active draft PR

PR #70:
https://github.com/fakedevbagus/FrameFlow/pull/70

Branch:
`feat/m3-56-audio-waveform-scrubbing`

Current HEAD:
`a8b3673c4850524abef93abee947d7cd48355727`

Base:
`main @ 8efdd97843fe63a02e9104ee52b369bf3bf3dd7b`

PR state:
- Open
- Draft
- Mergeable
- Do not merge until the user reports successful local validation.

Implemented in M3.56:
- Direct waveform click-to-seek maps pointer X to local audio clip time and clamps to the clip duration.
- Waveform pointer interaction is isolated from normal clip move/trim gestures.
- Waveform remains display-only and does not change project schema.
- Native FFmpeg waveform generation and in-memory request caching remain unchanged.
- Waveform rendering is hardened against invalid native peaks, empty peak arrays, and non-finite SVG dimensions.
- Waveform interaction is keyboard-accessible through Enter/Space.
- Playback `AbortError` is treated as an expected interruption rather than a user-facing preview error.
- Stale playback promises are invalidated after pause/seek operations.
- Multiple media `play()` failures are aggregated so one rejected media element does not hide another genuine failure.
- Vitest worker concurrency is constrained to reduce worker-startup timeout instability.
- Preview async effects are awaited by the relevant tests.
- jsdom media `play()` has a deterministic resolved default in test setup.
- Waveform visual amplitude was refined after Linux desktop inspection so the waveform is less overfilled, uses nonlinear peak compression, and has an explicit SVG fill.

### Current M3.56 validation evidence

The latest supplied local validation log established:
- `npm ci`: completed with 0 vulnerabilities.
- `npm run lint`: passed.
- `src/App.test.tsx`: 39/39 passed after the playback-test correction.
- Production build: passed.
- `cargo test`: 37/37 passed.
- `npm run tauri dev`: Vite started on `http://localhost:1420/` and the Tauri binary launched.
- Known React `act(...)` warnings remain test-environment warnings and are not current test failures.

A later renderer refinement temporarily exposed one stale waveform geometry assertion; that assertion has been corrected. The current branch must still be locally revalidated after the latest change.

### M3.57 final gate

Before marking PR #70 ready:
1. Run the required pull/fetch sequence.
2. Run:
   - `npm ci`
   - `npm run lint`
   - `npm run test`
   - `npm run build`
   - `cd src-tauri && cargo test && cd ..`
   - `npm run tauri dev`
3. Manually inspect:
   - Audio waveform is visually readable and not an overfilled black block.
   - Clicking left/middle/right positions moves the playhead to the expected local time.
   - Enter/Space on the focused waveform seeks to the clip midpoint.
   - Waveform interaction does not move/trim the clip.
   - Playback can be paused/resumed without stale-position regressions.
   - Existing audio fades, volume automation, pan, EQ, compressor, mute, multi-track mix, and export remain intact.
4. Keep PR #70 Draft until the user reports the result.
5. After user approval, mark the PR ready and squash-merge.
6. Record the merge SHA in both context documents.

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
