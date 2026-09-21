## 2026-09-21 — M3.38 single-clip compatibility path

- Routed one video clip starting at timeline zero through the existing native single-source renderer instead of filter_complex.
- Added source segment timing and explicit video-only output options.
- Preserved filter-graph rendering for multi-clip and timeline-gap cases.
- Added regression coverage for direct routing and native segment FFmpeg arguments.
- Real-media validation is pending.
- Refined the single-clip export graph to use only trim, setpts, scale, and pad, with frame rate and yuv420p set at the encoder output.\n- Synthetic FFmpeg validation produced the expected 406x720, 30 fps MP4.
## 2026-09-21 — M3.38 single-clip FFmpeg graph hardening

- Simplified the one-clip-at-zero export graph to bypass the concat filter.
- Added regression coverage for the direct graph path.
- Verified the resulting graph independently with FFmpeg 7.1.5.
- M3.38 real-media export validation remains pending.
## 2026-09-21 — M3.38 export error diagnostics

- ExportPanel now exposes the full native renderer error instead of truncating it in the status summary.
- Added regression coverage for complete renderer-error visibility.
- The underlying FFmpeg graph command shape was separately validated with an equivalent synthetic input.
- M3.38 local media export validation remains pending.

## 2026-09-21 — M3.38 export render-job activation — in progress

Branch: `feat/m3-38-export-render-job`

Implemented:
- Added an export runner that starts the existing export-job state machine, compiles the current project render plan, invokes native video rendering, and converts failures into controlled job state.
- Activated the ExportPanel Export action when an output file is selected.
- Added running, completed, and failed status feedback without introducing fake progress reporting.
- Added regression coverage for ExportPanel render-job wiring and runner success/failure behavior.

Architecture:
- ExportPanel owns presentation state only.
- `export-runner.ts` owns the project-to-render-job orchestration.
- `render-pipeline.ts` remains the RenderPlan-to-native-render adapter.
- M3.37's native renderer remains unchanged and video-only.

Validation:
- M3.37 user validation passed before merge.
- M3.38 local validation is pending.
## 2026-09-21 — M3.37 native render graph wiring — in progress

Branch: `feat/m3-37-native-render-graph-wiring`

Implemented:
- Added a native Tauri `render_video_graph_to_mp4` command for multiple video inputs plus a compiled FFmpeg `filter_complex`.
- Added native validation for graph metadata, input media type, absolute paths, output path, and fixed `[vout]` mapping.
- Added structured FFmpeg argument construction without shell interpolation.
- Added a TypeScript graph-render bridge and a RenderPlan-to-native pipeline adapter.
- Added regression tests for the native argument contract, Tauri invoke boundary, and RenderPlan-to-renderer wiring.

Architecture:
- M3.36 remains the pure graph compiler.
- M3.37 is only the process-execution boundary; it does not add another graph/state model.
- Video output is explicitly mapped from `[vout]` and audio is disabled until an audio graph exists.
- Progress, cancellation, multi-track compositing, images, and advanced visual semantics remain separate milestones.

Validation:
- User confirmed M3.36 passed locally.
- M3.37 local validation is pending.

Next step:
- User validates M3.37 locally before PR readiness and merge.

## 2026-09-21 — M3.36 FFmpeg video filter graph — merged

- PR #47 `feat: add FFmpeg video filter graph compiler` was marked ready and squash-merged.
- Merge SHA: `3b0f3b2f0c5a54ee821fcda1f2a98a611145e814`.
- User confirmed the corrected local validation passed after the graph-input label and multi-track test fixes.
- M3.36 adds deterministic RenderPlan-to-video-filter compilation with source trim, canvas fit, FPS normalization, concat, and black timeline gaps.
- Advanced visual semantics, audio, images, and multi-track compositing remain deferred.

## 2026-09-21 — M3.36 FFmpeg video filter graph

- Added deterministic compilation from RenderPlan to a basic FFmpeg video filter graph.
- Added source trim, canvas scale/pad, FPS normalization, sequential concatenation, and timeline-gap black frames.
- Added explicit unsupported-state validation for multi-track, audio, image, transition, transform, crop, keyframe, and mute rendering.
- Added regression tests for graph generation and deferred boundaries.

## 2026-09-21 — M3.35 project render plan

- Added a pure project-to-render-plan compiler for timeline segments.
- Preserved clip source/timeline timing, track metadata, mute state, visual metadata, and transitions for later FFmpeg graph compilation.
- Added validation and regression coverage for invalid timeline references and overlap conditions.
- Actual FFmpeg filter graph generation remains deferred.

## 2026-09-21 — M3.34 native FFmpeg render boundary

- Added a native Tauri FFmpeg single-source MP4 render command.
- Added request validation and controlled FFmpeg error handling.
- Added safe structured argument construction and regression coverage.
- Added a frontend invoke wrapper for the native render boundary.
- Full project timeline rendering remains deferred.

## 2026-09-21 — M3.33 export destination and render-job boundary merged

- PR #44 `feat: add export destination and render-job boundary` was marked ready and squash-merged.
- Merge SHA: `a6c40943d2673d3688e218d1d45d79e828b5f39a`.
- Added native MP4 output destination selection and a renderer-agnostic export-job state contract.
- M3.33 intentionally stopped before invoking FFmpeg.

## 2026-09-21 — M3.34 started

- M3.34 scope: one controlled native FFmpeg render invocation boundary.
- Goal: connect the existing export request model to a safe Rust/Tauri command without yet implementing the complete timeline render graph or progress/cancel transport.

## M3.33 validation correction — 2026-09-21

- User local validation: lint passed; the full test suite executed with 215/215 tests passing, but the ExportPanel suite failed to initialize because its Vitest mock referenced a hoisted module value before initialization.
- The failure is isolated to the test mock setup, not export behavior. `ExportPanel.test.tsx` now creates the mocked `chooseExportOutputPath` with `vi.hoisted`.
- Build completed successfully and `tauri dev` launched successfully in the same local run.
- Fresh local test rerun is required after the test-only correction.

## 2026-09-21 — M3.33 export pipeline boundary started

- Added a real MP4 output destination picker using the existing Tauri dialog integration.
- Added a renderer-agnostic export job state contract with queued/running/completed/failed/cancelled transitions.
- Added regression coverage for destination selection and job state transitions.
- Actual FFmpeg encoding remains deferred to the next renderer slice.

## 2026-09-21 — M3.32 Export settings foundation merged

- PR #43 `feat: add export settings foundation` was marked ready and squash-merged.
- Merge SHA: `c81df8e7b0901a54c08b19dba2f5df3ee6a63adf`.
- Added MP4/H.264 export settings, Source/1080p/720p quality normalization, aspect-ratio-preserving output sizing, filename sanitization, and the Export Settings panel.
- M3.32 intentionally stopped before actual output-path selection and FFmpeg rendering.

## 2026-09-21 — M3.33 started

- M3.33 scope: add output-file selection and a focused native render-job boundary without implementing the complete renderer.
- Goal: make Export move from settings-only UI toward an explicit destination and renderer contract while preserving project/history separation.

## 2026-09-21

### M3.32 validation correction

- First local run: lint passed, 213/215 tests passed, build passed, and Tauri dev launched.
- Two test assertions were corrected: portrait 720p dimensions are 406×720 because the export helper enforces even width, and filename verification now checks the input value.
- PR #43 remains draft pending a fresh clean rerun.

## 2026-09-21

### M3.32 — Export settings foundation — in progress

Branch: `feat/m3-32-export-settings`
Base: M3.31 merge SHA `3a2a77aca9b30779870e16863fe709661cd02f3e`

Implemented:
- Added a dedicated export settings domain model.
- Added source, 1080p, and 720p quality presets that preserve the project canvas aspect ratio.
- Added MP4/H.264 as the initial renderer target.
- Added project-derived frame rate and sanitized output filename defaults.
- Added an Export Settings panel opened by the toolbar Export action and Workspace Export navigation.
- Kept export settings out of project history.
- Added regression tests for settings normalization, quality dimensions, filename sanitization, panel behavior, and App wiring.

Validation:
- M3.31: user-reported local validation passed before merge.
- M3.32: pending user local validation.

Known limitations:
- The Export button in the panel is intentionally not connected to rendering yet.
- No output directory picker, render queue, progress, cancellation, or FFmpeg encoding graph exists yet.

Next step:
- Validate PR #43 locally before marking it ready for review and merging.

## 2026-09-21

### M3.31 validation correction

First local validation: lint passed; 206/207 tests passed across 19 files, with the only failure caused by a missing `addAssetToTimeline` import in the new App playback-throttle regression. Build reported the same TypeScript error; Tauri dev launched successfully. Corrected in commit `a9e1b5111a1338fd758186969114eee2ab624612`. PR #42 remains draft pending one clean rerun.

## 2026-09-21

### M3.31 — Playback smoothness / render-throttle — in progress

Branch: `feat/m3-31-playback-smoothness`
Base: M3.30 merge SHA `dedeeccf309238b483e38d041d4928b23227f0a1`

Implemented:
- Added a deterministic playback UI publication gate with a default 33 ms interval.
- Kept the internal transport clock at requestAnimationFrame cadence.
- Reduced `currentTimeMs` React state publications during playback to approximately 30 Hz.
- Preserved immediate user-driven seeking and immediate final publication when playback reaches the timeline end.
- Added playback helper regression tests.
- Added an App integration regression test covering multiple animation-frame callbacks.

Architecture:
- The browser/native media element remains responsible for continuous media playback.
- The transport ref remains the authoritative per-frame clock used by playback progression.
- React-rendered timeline/inspector/preview UI receives a throttled transport snapshot rather than every animation-frame tick.
- Project history and playback state remain separate.

Validation:
- M3.30: user-reported local validation passed before merge.
- M3.31: pending user local validation.

Known limitations:
- The interval is a UI rendering optimization, not a replacement for true audio/video clock synchronization.
- Deeper decode/render profiling and compositor/GPU optimization remain future work.

Next step:
- Validate PR #42 locally before marking it ready for review and merging.

## 2026-09-21

### M3.30 — Transition Browser / Picker — in progress

Branch: feat/m3-30-transition-browser

Base: M3.29 merge SHA 1aa5dee0da89a0f80357ad294273025164254a90

Implemented:
- Added a discoverable transition picker for None, Dissolve, and Fade through black.
- Preserved the existing transition mutation contract and history-backed project updates.
- Preserved transition duration editing and type retention.
- Kept the existing transition type select as an accessibility/keyboard fallback.
- Added TransitionInspector regression coverage for rendering, selection, ineligible transitions, and duration retention.

Validation:
- M3.29: user-reported local validation passed.
- M3.30 first local validation: lint/build/Tauri passed, but 4 TransitionInspector tests failed because picker button accessible names included their descriptions. A focused aria-label/aria-describedby fix has now been committed; rerun validation after pulling the latest branch.
- Automated execution was not run in this environment because direct GitHub cloning failed due network/DNS resolution.

Known limitations:
- Picker currently covers the two implemented visual transition types and None; thumbnails/preview thumbnails are deferred.
- Rich drag-and-drop placement, audio transitions, custom profiles, and responsive workspace changes remain outside this milestone.

Next step:
- User validates M3.30 locally before PR readiness and merge.

# FrameFlow Changelog

## 2026-09-21

### M3.29 — Fade through black transition — in progress
Branch: feat/m3-29-fade-through-black-transition
PR: #40 (draft)
Merge SHA: not applicable yet

Implemented:
- Extended ClipTransition with a backward-compatible fade-through-black type.
- Preserved transition type through normalization and lifecycle sanitization.
- Added shared transition visual-state math for dissolve and fade-through-black.
- Added a preview black overlay that reaches full opacity at the transition midpoint.
- Generalized transition Inspector and Timeline duration controls to preserve the active transition type.
- Added regression tests covering command creation, normalization, preview compositor behavior, overlay rendering, Timeline controls, and App Inspector selection.

Architecture:
- Reused the existing history-backed updateClipTransition mutation path.
- Kept transient pointer interaction state separate from project history.
- Kept the new overlay inside the existing Preview layer stacking model; no parallel rendering/state architecture was introduced.

Validation:
- M3.28 baseline: user reports latest local validation completed without errors; exact command output is not recorded in this branch.
- M3.29: not yet locally validated by the user.

Known limitations:
- Only Dissolve and Fade through black are available.
- Transitions require directly adjacent visual clips.
- Transition browser, richer placement UX, audio transitions, and custom profiles are deferred.

Next step:
- Draft PR #40 is open; the next step is user local validation and manual transition checks.

## 2026-09-21

### Continuity checkpoint — chat handoff

Repository state:
- `main` tip: `7d9400634c0f9a4650212110b938a17e0fa685da`.
- Latest completed milestone: M3.28 — Transition lifecycle integrity.
- PR #39 merge SHA: `2e77190ef6474b3ede1ad72af0682a9c5bfb7c61`.
- No M3.29 implementation is currently approved or active.

Validation state:
- M3.27 local validation was confirmed by the user.
- M3.28 was merged remotely after follow-up fixes.
- The latest pasted M3.28 local log was from before those fixes and contained one lint error, two failing lifecycle tests, and two TypeScript build errors; Tauri dev launched successfully.
- No fresh post-fix M3.28 local validation result is recorded in this chat.
- Do not infer local validation from the merged PR.

Continuity rule:
- New chats must read `docs/SESSION_HANDOFF.md` and verify the repository before making changes.
- Preserve unrelated local changes, especially `src-tauri/Cargo.lock` and `src-tauri/Cargo.toml` when they appear modified locally.
- After every meaningful milestone, update `docs/SESSION_HANDOFF.md`, `docs/PROJECT_CONTEXT.md`, and this changelog.

Next step:
- Verify the current M3.28 local state first. After validation is explicitly confirmed, choose and document the next focused milestone from the verified `main`.


### M3.28 — Transition lifecycle integrity — merged
Branch: `feat/m3-28-transition-lifecycle-integrity`
PR #39
Merge SHA: `2e77190ef6474b3ede1ad72af0682a9c5bfb7c61`

Implemented:
- Added transition-pair normalization and edited-track sanitization helpers.
- Cleared stale transition metadata after move, remove, and trim edits break adjacency.
- Clamped transition duration when an adjacent clip is shortened.
- Preserved the outgoing transition on the correct segment when splitting a clip.
- Added regression coverage for the lifecycle cases.

Validation:
- Remote PR #39 was merged after follow-up fixes addressing the reported lint/build/test/fixture issues.
- Local post-fix validation is not confirmed in this chat yet.

Known limitations:
- Only dissolve transitions are supported.
- No transition browser, drag-and-drop placement, or audio transitions yet.

Next step:
- Continue from updated `main` with the next focused editor milestone.


### M3.25 — Dissolve transition foundation — merged
Branch: `feat/m3-25-dissolve-transition-foundation`
PR #36
Merge SHA: `01c90688fe4256278fe7dc1f94c1c94463e6eb6e`

Implemented:
- Added optional outgoing `dissolve` transition metadata to clips.
- Added transition helpers for adjacency, duration normalization, and dissolve opacity.
- Added a command for adding/updating/removing a dissolve transition between adjacent visual clips.
- Added preview support for complementary outgoing/incoming dissolve layers.
- Added Inspector controls for transition type and duration.
- Added regression coverage for transition helpers, commands, preview behavior, and Inspector history.

Validation:
- User confirmed local Linux validation passed, including lint, tests, build, Tauri dev, and the manual transition checks.

Known limitations:
- Only the `dissolve` transition type is included.
- No audio transitions or visual transition browser are included.
- Transition metadata is not automatically cleared when later edits break adjacency.

Next step:
- Continue with the next focused transition UX milestone from updated `main`.


### M3.24 — Timeline clip interaction hardening — merged
Branch: `feat/m3-24-timeline-interaction-hardening`
PR #35 — merged
Merge SHA: `0c190a82a18e87bf56f2aea72a4d280265858ad5`

Implemented:
- Added Escape cancellation for direct timeline clip movement.
- Added Escape cancellation for trim-start gestures.
- Added Escape cancellation for trim-end gestures.
- Released active pointer capture during cancellation without committing project history.
- Added Timeline regression coverage for all clip gesture cancellation paths.

Validation:
- User confirmed local validation passed (lint, 173 tests, build, Tauri dev, and manual interaction checks).

Next step:
- Continue with the next focused editor milestone from updated `main`.



### M3.23 — Transform/crop interaction hardening — merged
Branch: `feat/m3-23-transform-crop-interaction-hardening`
PR #34 — merged
Merge SHA: `e12a86d1041dfa9a67b962ec95fbdbf9340eba30`

Implemented:
- Added Escape cancellation for direct transform movement.
- Added Escape cancellation for direct transform-anchor dragging.
- Added Escape cancellation for crop-edge dragging.
- Added Escape cancellation for crop-content panning.
- Released pointer capture during cancellation without committing project history.
- Added Preview regression coverage for all direct manipulation cancellation paths.

Validation:
- User confirmed local Linux validation passed.
- `npm run lint` passed.
- `npm run test` passed.
- `npm run build` passed.
- `npm run tauri dev` started successfully.
- User confirmed normal completed gestures and Escape cancellation behavior worked as expected.

Known scope:
- No workspace layout change was introduced.
- Portrait/landscape responsive workspace remains a future dedicated UX milestone.

Next step:
- Start the next focused editor feature from updated `main`.

### M3.22 — Direct on-canvas anchor manipulation — merged
Branch: `feat/m3-22-direct-anchor-manipulation`
PR #33 — merged
Merge SHA: `0dcae3d91fd298b36b99393921601e34a0e217c0`

Implemented:
- Added a visible transform-anchor handle to selected visual preview layers.
- Added direct pointer dragging for the transform anchor.
- Resolved pointer coordinates into transformed content space.
- Preserved live visual position during anchor movement using M3.21 compensation.
- Routed completed anchor changes through the existing compensated anchor history command.
- Preserved the Inspector anchor grid as the precision control.
- Added media-dimension readiness handling so anchor compensation uses intrinsic dimensions when available.
- Added regression coverage for pointer mapping, Preview interaction, App integration, media-dimension readiness, compensation, and Undo.

Validation:
- User confirmed local Linux validation passed.
- `npm run lint` passed.
- `npm run test` passed with 17 test files / 169 tests.
- `npm run build` passed.
- `npm run tauri dev` started successfully.
- User confirmed the requested manual anchor, transform, crop, keyframe, playback, and Undo/Redo checks passed.

Known limitations:
- Anchor dragging remains disabled during playback.
- When intrinsic media dimensions are unavailable, the existing fallback anchor command is used.

UI/layout direction:
- The current workspace layout remains intentionally stable during core editing work.
- The responsive orientation-aware workspace redesign for portrait/landscape projects is deferred to a dedicated UX/layout milestone so it does not destabilize the current editor foundation.

Next step:
- M3.23: focused transform/crop interaction hardening.
## 2026-09-21

### M3.21 — Transform anchor compensation — merged
Branch: `feat/m3-21-anchor-compensation`
PR #32 — merged
Merge SHA: `0da298e3f5c047e13c7c43c7ac391ba31f33a181`

Implemented:
- Preserved visual position when changing a transform anchor.
- Compensated X/Y using anchor delta, scale/rotation, and contained media bounds.
- Applied the same compensation to all transform keyframes.
- Integrated the compensated anchor command into the Inspector workflow.
- Added regression coverage for domain math, command behavior, keyframes, App interaction, and Undo.

Validation:
- User confirmed M3.21 local validation passed on Linux.
- Final validation reached lint success, 17 test files / 161 tests passing, successful production build after CSS corrections, and successful Tauri dev startup.

Known limitation:
- Anchor changes before intrinsic media metadata is available use the legacy anchor command and may not preserve the rendered position.

Next step:
- M3.22: direct on-canvas anchor manipulation.
## 2026-09-21

### M3.21 — Transform anchor compensation — in progress
Branch: `feat/m3-21-anchor-compensation`
PR #31 — draft

Implemented:
- Added transform-anchor compensation math that preserves the rendered visual position when changing the anchor.
- Compensates X/Y using the current scale/rotation and the contained media bounds.
- Applies the same compensation to all transform keyframes.
- Integrated the behavior into the existing Inspector anchor workflow with a fallback when media dimensions are not available.
- Added regression coverage for transform math, command history behavior, keyframes, and App/Inspector interaction.

Validation:
- Local validation is pending user verification.

Known limitation:
- Anchor changes made before intrinsic media metadata is available use the legacy anchor command and may not preserve the rendered position.

Next step:
- User validates M3.21 locally before the draft PR is marked ready and merged.

# FrameFlow Changelog

## 2026-09-21

### M3.20 — Aspect-ratio crop presets and responsive canvas — merged
Branch: `feat/m3-20-crop-aspect-presets`
PR #30 — merged
Merge SHA: `8c366b12e6320fe8844096b0c8fda75234de4b61`

Implemented:
- Added crop aspect-ratio presets: Original, 16:9, 9:16, 1:1, 4:5, and 4:3.
- Derived crop insets from intrinsic video/image dimensions and preserved/clamped crop content position.
- Applied crop and crop position atomically through the existing history engine.
- Added canvas aspect-ratio presets: 16:9, 9:16, 1:1, 4:5, and 4:3.
- Made the preview canvas follow project canvas dimensions and fit the available editor viewport.
- Hardened fullscreen workspace behavior so side panels scroll internally instead of forcing document-level vertical scrolling.
- Added regression coverage for crop preset math, crop history, canvas dimensions, preview framing, and Undo workflows.

Validation:
- User confirmed M3.20 local validation passed on Linux.
- During the final validation cycle, lint passed, 17 test files / 161 tests passed, and Tauri dev started successfully. The production build initially exposed malformed CSS introduced during the viewport refactor; the offending fragments were corrected on the same branch before the user's final pass confirmation.

Known limitations:
- Crop position remains per-clip and is not keyframed.
- Custom crop ratios are deferred.
- Canvas presets expose fixed common output dimensions; arbitrary custom canvas dimension editing is not yet exposed.


## 2026-09-21

### M3.19 — Direct crop-content panning — merged
Branch: `feat/m3-19-direct-crop-content-panning`
PR #29 — merged
Merge SHA: `549b1423e365ed11116a14b1005aa5a38f7b35ad`

Implemented:
- Added direct crop-content panning inside the fixed M3.18 crop viewport.
- Added transform-aware crop-position pointer math for scale, rotation, translation, and anchor.
- Constrained the source content position so the crop viewport stays covered by the source media.
- Kept completed pan gestures as one history mutation through the existing crop-position command.
- Preserved the existing canvas move gesture for uncropped visuals and kept crop edge handles separate.
- Added Preview and App regression coverage for direct pan interaction and Undo behavior.

Architecture:
- Reused the existing transformed pointer-to-content mapping for crop-position dragging.
- Kept the pan surface separate from crop edge handles and the existing uncropped canvas move interaction.
- Kept live gesture state separate from project history; only the completed gesture is committed.

Validation:
- User confirmed M3.19 local validation passed on Linux after the final crop-pan regression fixture correction.

Known limitations:
- Aspect-ratio crop presets remain future work.
- Crop position remains per-clip and is not keyframed in this milestone.

Next step:
- M3.20: aspect-ratio crop presets.

## 2026-09-20

### M3.16 — Crop foundation — merged
Branch: `feat/m3-16-crop-foundation`
PR #26 — merged
Merge SHA: `cb61fb6277d8b800f30978098ba5abfaf2acc97f`

Implemented:
- Added a backward-compatible per-clip crop model with zero-crop defaults.
- Added Top, Right, Bottom, and Left crop controls to the Transform Inspector.
- Applied crop clipping to visual preview media while keeping transform controls available.
- Preserved crop state when splitting a clip.
- Added regression coverage for crop normalization, command validation/preservation, preview clipping, and App workflow.

Validation:
- User confirmed lint, test, build, Tauri dev, and the requested manual crop checks passed locally on Linux.
- The automated suite reported 17 test files and 136 tests passing before the final lint/build correction.

Known limitation:
- Direct crop-handle manipulation, aspect-ratio presets, and crop-position translation compensation remain future work.

### M3.15 — Transform anchor foundation — merged
Branch: `feat/m3-15-transform-anchor-foundation`
PR #25 — merged

Merge SHA: `69c2b5edee8e4ea5e5d530c2402e0c9ce7281abc`

Implemented:
- Added backward-compatible per-clip transform anchor defaults.
- Added nine anchor presets to the Transform Inspector.
- Applied anchor coordinates to preview transform origin.
- Updated direct scale/rotation manipulation to use the selected anchor as its pivot.
- Added regression coverage for anchor normalization, commands, preview transform origin, anchor pivot math, and App history workflow.

Validation:
- User confirmed local validation succeeded after the App anchor accessibility-name assertion and unused TypeScript import were corrected.

Known limitation:
- The milestone establishes anchor state and pivot behavior; visual anchor dragging and pivot-change translation compensation remain future work.

3.14 — Keyframe UX hardening — merged
Branch: `feat/m3-14-keyframe-ux-hardening`

Implemented:
- Focusing a timeline keyframe marker selects its owning clip.
- Active keyframe markers expose `aria-current="time"` for assistive technology.
- Escape cancels an active keyframe drag and avoids committing an unintended keyframe move.
- Added Timeline regression coverage for focus/selection and Escape cancellation.

Merge SHA: `838c5a8dad7ce4214b8e8d4d85084d7e2fd50379`

Validation:
- User reported successful local validation after fixes.
- PR #24 was marked ready and squash-merged.

### M3.13 — Playback stability — merged
Branch: `feat/m3-13-playback-stability`
PR #23 — merged

Merge SHA: `595f7498e503aab19052279979fb389ae8300691`

Implemented:
- Playback no longer waits for every media `play()` promise before entering the playing state.
- Starting playback from the timeline end explicitly targets 00:00.
- Active media elements are aligned to their clip-local source position before playback starts.
- Preview video re-aligns itself to the transport position whenever playback begins.
- Video and audio elements expose their clip ID to the transport controller.
- Added regression coverage for replay alignment.

Implementation commits:
- `bc1f2b870d83e245cbc986b99ca76410e68e7357` — App playback startup/replay fix
- `94a01ec0892c32a6ed980ef464fcb985815d220e` — Preview playback alignment fix
- `030a17a8f4100537fbe72a18a27c25fb763b3a9e` — replay alignment regression test
- `fa630787122cd4133628e6cbcf71863517fb3b5e` — project context documentation
- `e8f4de5a546661ee6a042595574491be281a1e6f` — changelog documentation
- `7cf18d1c4d7cb3c6a2fdb1f0901eb5aea1eedc67` — new-chat handoff prompt
- `fc5ed54ca8bcfb91fe0df8294fd64e34852cd1a6` — context updated with PR #23

Follow-up playback smoothness correction:
- Prevent the video preview effect from seeking `currentTime` on every transport tick while playback is active.
- Keep playback-start re-alignment for replay/start synchronization.
- Added regression coverage for transport ticks during active playback.
- User reported successful local validation on Linux, including the playback behavior targeted by this milestone.

Validation:
- User confirmed the M3.13 validation succeeded locally.
- PR #23 was then marked ready and squash-merged.

### M3.12 — Keyframe keyboard nudging
PR #21 — merged.

Merge SHA:
`9c745f798b73b34fdbf70ca04837de0eaa085036`

Implemented:
- ArrowLeft/ArrowRight moves focused transform keyframes by one frame.
- Shift+Arrow moves by 500 ms.
- Keyframes stay inside clip bounds and cannot cross adjacent keyframes.
- Playhead follows the moved keyframe.
- Existing click-to-seek, dragging, and Delete/Backspace remain intact.
- Timeline regression coverage added.

### M3.11 — Keyframe selection controls
PR #20 — merged.

Merge SHA:
`6470a740818b9f3988d19f66f79fc39387981934`

Implemented:
- Keyframe markers receive keyboard focus.
- Delete/Backspace removes the focused keyframe without deleting the clip.
- Existing marker click and drag behavior preserved.
- Timeline and App integration coverage added.

### M3.10 — Transform keyframe easing
PR #19 — merged.

Merge SHA:
`c4eef9e65bac87c7b3f31e3623ccf85caf714596`

Implemented:
- Linear, Ease in, Ease out, Ease in-out.
- Easing metadata is backward compatible with legacy keyframes.
- Inspector easing control and history command.
- Transform/command/App regression coverage.

### M3.9 — Keyframe editing
PR #18 — merged.

Merge SHA:
`fb9f6fe5fc2186df9351d2abee1246d67b9ef661`

Implemented:
- Draggable transform keyframe markers.
- 500 ms snapping.
- Neighbor collision and clip-bound constraints.
- One history operation per completed drag.

### M3.8 — Keyframe Timeline UI
PR #17 — merged.

Merge SHA:
`031033c1a6036d55a6c22ecc3ad184b376b76175`

Implemented:
- Timeline diamond markers.
- Active marker state.
- Marker click-to-seek.

### M3.7 — Transform keyframe foundation
PR #16 — merged.

Merge SHA:
`6bb225f35638f37d89a1031aae7371b5c95c01d6`

Implemented:
- Transform keyframe model and interpolation.
- Keyframe CRUD commands.
- Inspector controls.
- Preview keyframe evaluation.
- Split preservation.
- Linux local preview pipeline work culminating in localhost HTTP media serving.

### M3.6 — Content-aware transform bounds
PR #15 — merged.

Merge SHA:
`8641304dfe108017f57264d6f902dda274c7888f`

### M3.5 — Precision transform Inspector
Merge SHA:
`110a19d9d0fe1258acecf912ddb85dd2e5d69408`

### M3.4 — Direct canvas manipulation
Merge SHA:
`84bec251aae2c90e00ceb473227a6cf7b01c7281`

### M3.3 — Transform and layer controls
Merge SHA:
`898efee71605a9aa2cd08691ef098708653e2fd2`

### M3.2 — Track management and media routing
Merge SHA:
`d7453426b256e5804c279b6cf72cc8ae379cf1b6`

### M3.1 — Multi-track preview compositor
Merge SHA:
`6a423ca4d73457901d9506026ca7b2ee72ac8605`

### M2.9 — Local media preview foundation
Merge SHA:
`74043de39126ddc3840711e36cc088cf03078cb5`

### M2.8 — Playback and transport foundation
Merge SHA:
`32f56ffc1f41ac61d35c1f5a802a380d30ef2731`

### M2.7 — Undo/Redo engine
Merge SHA:
`388206b60f29363abc7047af49be5f5af6a5ef60`

### M2.6 — Direct mouse timeline editing
Merge SHA:
`7c21c206`

### M1–M2.5
Foundation, media import, Media Bin to Timeline, selection/Inspector/delete, timeline interaction foundation, and core edit commands were completed before the recorded M2.6 merge point. Use repository history when exact older SHAs are needed.

### M3.17 — Direct crop handle manipulation — merged
Branch: `feat/m3-17-direct-crop-handles`
PR #27 — merged
Merge SHA: `dd4333deccc420bfe07dd68f05c2cb49ae865bdb`

Implemented:
- Added direct Top, Right, Bottom, and Left crop handles to selected visual preview layers.
- Added transformed pointer-to-content crop math for scale, rotation, translation, and custom transform anchors.
- Added live crop feedback during dragging.
- Committed one crop history edit on pointer release.
- Preserved existing Inspector crop editing and transform/keyframe controls.

Automated coverage:
- Added direct crop pointer-math tests.
- Added Preview crop-handle interaction coverage.
- Added App-level crop history/Undo coverage.

Validation:
- User confirmed local lint, test, build, Tauri dev, and M3.17 manual checks passed on Linux.

Known limitation:
- Aspect-ratio crop presets and crop-position translation compensation remain future work.

Next step:
- M3.18 should address crop-position translation compensation so crop edits can preserve the visible subject position when required.

### M3.18 — Crop position and translation compensation — merged
Branch: `feat/m3-18-crop-position-compensation`
PR #28 — merged
Merge SHA: `f59553d3e7192bae2a00741acfa5177da94e94eb`

Implemented:
- Added an optional per-clip crop content-position model.
- Added backward-compatible crop-position derivation from the crop window.
- Replaced direct media `clip-path` rendering with a fixed crop viewport and separately positioned media content.
- Added Inspector controls for Crop position X/Y and a Center content action.
- Kept crop-position changes in the existing project history engine.
- Cleared stored crop position when crop is fully reset.
- Updated App and Preview regression assertions for the new crop viewport structure.

Validation:
- User confirmed local lint, test, build, Tauri dev, and requested M3.18 manual checks passed on Linux.
- Follow-up fixes for crop-position Inspector naming, optional crop typing, and stale Preview/App assertions were also confirmed passing by the user.

Known limitation:
- Direct crop-content panning and aspect-ratio crop presets remain future work.

Next step:
- M3.19 should add direct crop-content panning while preserving the existing crop viewport, transform/anchor behavior, and history model.

### M3.19 — Direct crop-content panning — in progress
Branch: `feat/m3-19-direct-crop-content-panning`
PR: #29

Implemented:
- Added direct crop-content panning inside the fixed M3.18 crop viewport.
- Added transform-aware crop-position pointer math for scale, rotation, translation, and anchor.
- Constrained the source content position so the crop viewport stays covered by the source media.
- Kept completed pan gestures as one history mutation through the existing crop-position command.
- Preserved the existing canvas move gesture for uncropped visuals and kept crop edge handles separate.
- Added Preview and App regression coverage for direct pan interaction and Undo behavior.

Validation:
- Local validation is pending user verification.

Known limitations:
- Aspect-ratio crop presets remain future work.
- Crop position remains per-clip and is not keyframed in this milestone.

Next step:
- Run local validation on PR #29 before merging M3.19.

## Documentation rule

Every future milestone or meaningful bug fix must add a dated entry here and update `docs/PROJECT_CONTEXT.md`. Record factual validation only after the user reports it.
### M3.14 — Keyframe UX hardening — merged
Branch: `feat/m3-14-keyframe-ux-hardening`

Implemented:
- Focusing a timeline keyframe marker selects its owning clip.
- Active keyframe markers expose `aria-current="time"` for assistive technology.
- Escape cancels an active keyframe drag and avoids committing an unintended keyframe move.
- Added Timeline regression coverage for focus/selection and Escape cancellation.

Merge SHA: `838c5a8dad7ce4214b8e8d4d85084d7e2fd50379`

Validation:
- User reported successful local validation after fixes.
- PR #24 was marked ready and squash-merged.

### M3.13 — Playback stability — merged
Branch: `feat/m3-13-playback-stability`
PR #23 — merged

Merge SHA: `595f7498e503aab19052279979fb389ae8300691`

Implemented:
- Playback no longer waits for every media `play()` promise before entering the playing state.
- Starting playback from the timeline end explicitly targets 00:00.
- Active media elements are aligned to their clip-local source position before playback starts.
- Preview video re-aligns itself to the transport position whenever playback begins.
- Video and audio elements expose their clip ID to the transport controller.
- Added regression coverage for replay alignment.

Implementation commits:
- `bc1f2b870d83e245cbc986b99ca76410e68e7357` — App playback startup/replay fix
- `94a01ec0892c32a6ed980ef464fcb985815d220e` — Preview playback alignment fix
- `030a17a8f4100537fbe72a18a27c25fb763b3a9e` — replay alignment regression test
- `fa630787122cd4133628e6cbcf71863517fb3b5e` — project context documentation
- `e8f4de5a546661ee6a042595574491be281a1e6f` — changelog documentation
- `7cf18d1c4d7cb3c6a2fdb1f0901eb5aea1eedc67` — new-chat handoff prompt
- `fc5ed54ca8bcfb91fe0df8294fd64e34852cd1a6` — context updated with PR #23

Follow-up playback smoothness correction:
- Prevent the video preview effect from seeking `currentTime` on every transport tick while playback is active.
- Keep playback-start re-alignment for replay/start synchronization.
- Added regression coverage for transport ticks during active playback.
- User reported successful local validation on Linux, including the playback behavior targeted by this milestone.

Validation:
- User confirmed the M3.13 validation succeeded locally.
- PR #23 was then marked ready and squash-merged.

### M3.12 — Keyframe keyboard nudging
PR #21 — merged.

Merge SHA:
`9c745f798b73b34fdbf70ca04837de0eaa085036`

Implemented:
- ArrowLeft/ArrowRight moves focused transform keyframes by one frame.
- Shift+Arrow moves by 500 ms.
- Keyframes stay inside clip bounds and cannot cross adjacent keyframes.
- Playhead follows the moved keyframe.
- Existing click-to-seek, dragging, and Delete/Backspace remain intact.
- Timeline regression coverage added.

### M3.11 — Keyframe selection controls
PR #20 — merged.

Merge SHA:
`6470a740818b9f3988d19f66f79fc39387981934`

Implemented:
- Keyframe markers receive keyboard focus.
- Delete/Backspace removes the focused keyframe without deleting the clip.
- Existing marker click and drag behavior preserved.
- Timeline and App integration coverage added.

### M3.10 — Transform keyframe easing
PR #19 — merged.

Merge SHA:
`c4eef9e65bac87c7b3f31e3623ccf85caf714596`

Implemented:
- Linear, Ease in, Ease out, Ease in-out.
- Easing metadata is backward compatible with legacy keyframes.
- Inspector easing control and history command.
- Transform/command/App regression coverage.

### M3.9 — Keyframe editing
PR #18 — merged.

Merge SHA:
`fb9f6fe5fc2186df9351d2abee1246d67b9ef661`

Implemented:
- Draggable transform keyframe markers.
- 500 ms snapping.
- Neighbor collision and clip-bound constraints.
- One history operation per completed drag.

### M3.8 — Keyframe Timeline UI
PR #17 — merged.

Merge SHA:
`031033c1a6036d55a6c22ecc3ad184b376b76175`

Implemented:
- Timeline diamond markers.
- Active marker state.
- Marker click-to-seek.

### M3.7 — Transform keyframe foundation
PR #16 — merged.

Merge SHA:
`6bb225f35638f37d89a1031aae7371b5c95c01d6`

Implemented:
- Transform keyframe model and interpolation.
- Keyframe CRUD commands.
- Inspector controls.
- Preview keyframe evaluation.
- Split preservation.
- Linux local preview pipeline work culminating in localhost HTTP media serving.

### M3.6 — Content-aware transform bounds
PR #15 — merged.

Merge SHA:
`8641304dfe108017f57264d6f902dda274c7888f`

### M3.5 — Precision transform Inspector
Merge SHA:
`110a19d9d0fe1258acecf912ddb85dd2e5d69408`

### M3.4 — Direct canvas manipulation
Merge SHA:
`84bec251aae2c90e00ceb473227a6cf7b01c7281`

### M3.3 — Transform and layer controls
Merge SHA:
`898efee71605a9aa2cd08691ef098708653e2fd2`

### M3.2 — Track management and media routing
Merge SHA:
`d7453426b256e5804c279b6cf72cc8ae379cf1b6`

### M3.1 — Multi-track preview compositor
Merge SHA:
`6a423ca4d73457901d9506026ca7b2ee72ac8605`

### M2.9 — Local media preview foundation
Merge SHA:
`74043de39126ddc3840711e36cc088cf03078cb5`

### M2.8 — Playback and transport foundation
Merge SHA:
`32f56ffc1f41ac61d35c1f5a802a380d30ef2731`

### M2.7 — Undo/Redo engine
Merge SHA:
`388206b60f29363abc7047af49be5f5af6a5ef60`

### M2.6 — Direct mouse timeline editing
Merge SHA:
`7c21c206`

### M1–M2.5
Foundation, media import, Media Bin to Timeline, selection/Inspector/delete, timeline interaction foundation, and core edit commands were completed before the recorded M2.6 merge point. Use repository history when exact older SHAs are needed.

## Documentation rule

Every future milestone or meaningful bug fix must add a dated entry here and update `docs/PROJECT_CONTEXT.md`. Record factual validation only after the user reports it.
