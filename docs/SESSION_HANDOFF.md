## M3.56 kickoff — Audio Waveform Scrubbing — 2026-09-22

- M3.55 Audio Waveform Foundation was squash-merged as PR #69 at `8efdd97843fe63a02e9104ee52b369bf3bf3dd7b`.
- M3.56 scope: make the existing Audio timeline waveform directly scrub the owning clip's playhead position.
- The waveform maps pointer X to local clip time with clamping and integer-millisecond normalization.
- Scrubbing selects the owning audio clip and uses the existing Timeline current-time callback; waveform pointer events are isolated from clip dragging.
- No project schema changes are introduced, and waveform generation remains read-only.
- Required validation: `npm run lint`; `npm run test`; `npm run build`; `cd src-tauri && cargo test`; `cd ..`; `npm run tauri dev`.
- Keep PR draft until the full validation suite and focused waveform scrubbing checks are clean.

## M3.55 kickoff — Audio Waveform Foundation — 2026-09-21

- M3.54 Audio Volume Automation Timeline UX was squash-merged as PR #68 at `21a1d601bed8215ea52c6ec4eb8ddcb2c4e769d2`.
- M3.55 scope: add a native waveform-analysis command and display the result inside Audio timeline clips.
- Native analysis uses FFmpeg to decode the first audio stream to mono floating-point PCM at a bounded sample rate, then reduces the stream into a compact normalized peak array.
- Frontend waveform requests are cached in memory and rejected requests are evicted so later retries are possible.
- Audio waveforms are read-only; automation markers and existing Inspector volume editing remain separate controls.
- Required validation: `npm run lint`; `npm run test`; `npm run build`; `cd src-tauri && cargo test`; `cd ..`; `npm run tauri dev`.
- Keep PR draft until the full local validation suite and focused waveform checks are clean.

## M3.54 kickoff — Audio Volume Automation Timeline UX — 2026-09-21

- M3.53 Audio Clip Volume Automation was squash-merged as PR #67 at `fafe6e183ba4eb350db0f1b9873861d9c5543689`.
- M3.54 surfaces persisted audio volume keyframes directly on Audio clips in the Timeline.
- Each marker supports keyboard focus, playhead seeking, Delete/Backspace removal, one-frame Arrow nudging, Shift+Arrow 500 ms nudging, and Escape cancellation for active dragging.
- Pointer dragging uses the existing timeline snap grid and prevents collisions by constraining movement between neighboring keyframes.
- A completed drag commits through App -> moveAudioClipVolumeKeyframe() exactly once.
- Marker movement is independent from selected-audio Inspector volume editing.
- Required validation: `npm run lint`; `npm run test`; `npm run build`; `cd src-tauri && cargo test`; `cd ..`; `npm run tauri dev`.
- Keep PR draft until the full validation suite and focused Timeline automation checks are clean.

## M3.53 kickoff — Audio Clip Volume Automation — 2026-09-21

- M3.52 Audio Clip Dynamics Compressor was squash-merged as PR #66 at `da0b5dc957be094738ac4e657007523f8684fdd8`.
- M3.53 scope: add backward-compatible per-audio-clip volume automation keyframes with linear interpolation.
- Inspector edits operate at the selected clip's local playhead time and commit through the existing project/history command path.
- Preview multiplies track volume by the interpolated clip automation and the existing audio fade gain.
- RenderPlan carries normalized audio volume keyframes and the native FFmpeg audio graph emits a frame-evaluated volume envelope.
- Audio keyframes are preserved across clip splits by materializing the split-time interpolated value on both resulting clips.
- Timeline marker/drag UX is deferred to a follow-up slice; M3.53 focuses on the end-to-end data, edit, preview, and export foundation.
- Required validation: `npm run lint`; `npm run test`; `npm run build`; `cd src-tauri && cargo test`; `cd ..`; `npm run tauri dev`.
- Keep PR #67 draft until the full validation suite and focused manual audio-automation checks are clean.

## M3.52 kickoff — Audio Clip Dynamics Compressor — 2026-09-21

- M3.51 Audio Clip 3-Band EQ was squash-merged as PR #65 at `52844a8c5f1a1f0605e6c9508d87c52c90ead7de`.
- M3.52 adds a focused, backward-compatible clip-level dynamics compressor for Audio clips.
- Scope: enabled flag plus threshold, ratio, attack, and release; preserve existing EQ, pan, volume, mute, fades, multi-track mixing, and export orchestration semantics.
- Preview uses Web Audio DynamicsCompressorNode when supported.
- Native FFmpeg rendering will use the acompressor filter with normalized threshold/ratio/attack/release values.
- Required validation after implementation: npm run lint; npm run test; npm run build; cd src-tauri && cargo test; cd ..; npm run tauri dev.
- Keep the PR draft until the full local validation suite and focused manual compressor checks are reported clean.
- Deferred: audio automation and waveform editing.

## M3.51 Audio Clip 3-Band EQ — 2026-09-21

- Base: M3.50 merge SHA e239c4b355d64c62a090067ad1aaaa80cefe9f55.
- Scope: add a focused clip-level three-band EQ without changing track volume, pan, mute, fades, or multi-track mixing semantics.
- Backward-compatible optional `audioEq` stores enabled state plus Low/Mid/High gain values from -12 dB to +12 dB.
- Inspector exposes Enable EQ and three gain editors on the selected audio clip.
- Preview applies low-shelf, peaking, and high-shelf Web Audio filters through the existing audio routing cache.
- RenderPlan carries EQ metadata and the native FFmpeg graph compiles the EQ filters before fades and timeline delay.
- Regression coverage added across domain, command, RenderPlan, audio graph, and App.
- Required validation: `npm run lint`; `npm run test`; `npm run build`; `cd src-tauri && cargo test`; `cd ..`; `npm run tauri dev`.
- Keep M3.51 unmerged until the user reports the full validation suite clean.

## M3.50 merge reconciliation — 2026-09-21

- PR #64 was marked ready after the user reported the corrected local validation as passing and squash-merged.
- Merge SHA: e239c4b355d64c62a090067ad1aaaa80cefe9f55.
- M3.50 is now part of main and provides export progress streaming plus safe cancellation.

## M3.49 validation correction — 2026-09-21

- Local validation reported three parser errors in test files at their closing lines, while Rust tests 28/28 and Tauri dev startup were successful.
- Restored the missing test declarations; this was a test-structure-only correction.
- Re-run the full frontend validation before merging PR #63.

## M3.49 Audio Track Pan Control — 2026-09-21

- Started M3.49 after M3.47 and M3.48 were merged.
- Scope: add track-level left/center/right audio balance without introducing the deferred full effects stack.
- Pan is backward compatible, defaulting to center for older project data.
- Persistence uses the existing track command/history architecture.
- Required validation: npm run lint; npm run test; npm run build; cd src-tauri && cargo test; npm run tauri dev.

## M3.48 test assertion correction — 2026-09-21

- Corrected the sole failing multi-track audio test after validation exposed an input-order expectation mismatch.
- The production compiler remains unchanged by this test-only correction.

## M3.48 validation correction — 2026-09-21

- Latest local validation reported 268/269 Vitest tests, with build, Rust tests, and Tauri launch successful.
- Corrected the inherited Inspector lint violation and the single multi-track audio assertion mismatch.
- Re-run the full validation suite before marking PR #61 ready.

## M3.48 Multiple Audio Track Mix — 2026-09-21

- Started the next audio milestone from the verified M3.46 main line while M3.47 UI correction remains under validation.
- Scope: allow more than one independent Audio track to participate in the existing project audio mix graph.
- Track order is deterministic; clips retain their existing trim, fade, track volume, mute, and timeline-delay behavior.
- No new native FFmpeg command is required because the existing video/audio mix boundary already accepts a list of audio input paths.
- Required validation: npm run lint; npm run test; npm run build; cd src-tauri && cargo test; npm run tauri dev.

## M3.47 kickoff — 2026-09-21

- M3.46 PR #59 was squash-merged at 76d0a1cadd9ae7ab31d471f46c4d6cb9ddba0b40.
- Current main base for M3.47 is the merge above.
- M3.47 scope: add direct Timeline drag handles for audio clip fade-in and fade-out durations.
- Handle interaction is transient until pointer release; completed changes commit exactly once through the existing App callback -> updateAudioClipFades() -> history path.
- Escape cancels an active fade-handle drag without changing project history.
- Keyboard interaction will support predictable 100 ms duration nudging.
- Fade handles must clamp to clip duration and preserve the existing non-overlap rule.
- Deferred: waveform rendering/editor, audio effects, multiple independent Audio tracks, automation, render progress, and cancellation.
- Required validation after implementation: npm run lint; npm run test; npm run build; cd src-tauri && cargo test; npm run tauri dev.
- Pull patch must be provided with the milestone handoff.
## M3.46 Inspector fade draft-state correction — 2026-09-21

- Latest user validation after commit 10c75b5 still showed 268/269 tests.
- The prior sibling-remount hypothesis was insufficient because the Fade out input remained in the document but its edit still did not persist.
- Current correction introduces `AudioFadeInspector` with controlled transient draft strings for both fields. Project persistence and history remain unchanged and continue through `handleUpdateSelectedAudioFades()` -> `updateAudioClipFades()`.
- The App regression test now checks the 1500 ms DOM value immediately after the Fade out change before committing on blur.
- User-reported validation before this correction: lint completed; build completed; Rust 28/28 passed; Tauri dev launched successfully; Vitest 268/269.
- Required next validation after this correction: npm run lint; npm run test; npm run build; cd src-tauri && cargo test; npm run tauri dev.
- Keep PR #59 draft until the fresh local test run is clean.

## M3.46 Inspector fade edit fix — 2026-09-21

- Branch: feat/m3-46-audio-clip-fades.
- Root cause was a shared React key on the Audio fades two-input grid. The key changed after one field commit, remounting the sibling input and losing the pending edit event.
- The fix removes the shared grid key and gives each fade input its own synchronization key, so only the field whose persisted value changes is remounted.
- The App regression test now checks sibling-input continuity after the first blur and verifies the final 1000/1500 ms values.
- PR #59 remains draft pending fresh local validation.
- Connector limitation: repository npm/Cargo/Tauri commands cannot be executed from this runtime.
- Required next validation: npm run lint, npm run test, npm run build, cd src-tauri && cargo test, then npm run tauri dev.
- Do not merge until that validation is reported clean.
## M3.46 validation correction — 2026-09-21

- User local validation of PR #59 found five command-test failures because `updateAudioClipFades` was not imported in `commands.test.ts` and one domain test expected an incorrect 2999 ms value instead of the implemented 3000 ms clamp.
- These issues are corrected on `feat/m3-46-audio-clip-fades`.
- The same run reported three Vitest worker startup timeouts/unhandled errors after the deterministic failures. Do not treat those as resolved until a fresh full run completes.
- Rust validation in that run: 28 passed, 0 failed.
- `tauri dev` launched successfully.
- Local validation remains pending user verification.

## M3.46 implementation checkpoint — 2026-09-21

- Branch: feat/m3-46-audio-clip-fades.
- Latest completed milestone: M3.45 Audio Track Volume Control plus correction PR #58.
- M3.45 correction merge SHA: 6f06f473b2a552cc04233ff4ada5c6bba07b7274.
- M3.46 adds per-audio-clip fade-in/fade-out state, Inspector controls, preview envelope handling, RenderPlan propagation, and FFmpeg afade stages.
- Fade commands are history-compatible and validate non-negative integer durations, clip duration bounds, and non-overlapping fade ranges.
- Audio trim operations clamp fade durations; audio split keeps fade-in on the first segment and fade-out on the second segment.
- Local validation is pending user verification.
- Deferred: audio effects, multiple Audio tracks, audio automation, render progress, and cancellation.

## M3.45 correction merge reconciliation — 2026-09-21

- M3.45 correction PR #58 (fix/m3-45-audio-volume-slider-visibility) was marked ready after user validation and squash-merged.
- Correction merge SHA: 6f06f473b2a552cc04233ff4ada5c6bba07b7274.
- The correction wires the Audio-track volume callback through Timeline -> TimelineTrack.
- The correction widens the Timeline track-label column so the Audio volume slider and percentage are visible.
- Preview volume is assigned directly to the native HTMLAudioElement and synchronized on track-volume changes.
- The existing audio graph regression assertion now accounts for the explicit default volume stage.
- M3.45 is complete. Deferred: audio fades/transitions/effects, multiple independent Audio tracks, render progress, and cancellation.
- User approved completion with pass.

## M3.45 merge reconciliation — 2026-09-21

- Repository: fakedevbagus/FrameFlow
- Default branch: main
- Current main tip after M3.45 correction reconciliation: 5cf54ec224d6912a5f6129006469e51c9b9f58b2
- Current main tip after this documentation update: c8539637ddf008af1964906955e19a827a81322a
- Latest completed milestone: M3.45 — Audio Track Volume Control
- M3.45 PR: #57
- M3.45 merge SHA: 9ce1bcf1c7a8729f62c65121274029d960eccddb
- M3.45 branch: feat/m3-45-audio-track-volume
- User local validation: npm run lint passed; 28 Vitest files passed with 253/253 tests; npm run build passed; Rust tests passed 28/28; tauri dev launched successfully.
- The local git pull --ff-only step reported divergent branches and did not fast-forward. No reset or overwrite was performed; the validation commands that followed completed successfully.
- M3.45 scope is complete: per-track volume defaults to 1.0, the Audio-track Timeline slider updates project state, preview applies the volume, RenderPlan preserves it, and the explicit Audio FFmpeg graph applies it before timeline placement/mixing.
- Mute remains a separate binary track state.
- Deferred: audio fades/transitions/effects, multiple independent Audio tracks, progress streaming, and cancellation.
- Next milestone work must start from this verified post-M3.45 main state.

## Working-tree safety

Never reset or overwrite unrelated local changes.

The latest local validation log showed that the synchronization step could not fast-forward because the local branch had diverged. This does not justify destructive cleanup. Preserve user-local Cargo changes and other unrelated working-tree changes when continuing locally.

## M3.41 implementation checkpoint — 2026-09-21

- Branch: `feat/m3-41-multisegment-audio`.
- M3.40 is completed and squash-merged as PR #51 at `4d9e15a27dda3c5d5d42f18c2161a9a3d6a6b415`.
- M3.41 extends the native multi-segment renderer so sequential source clips and timeline gaps can be assembled as synchronized A/V segments.
- Every normalized segment will contain exactly one video stream and one stereo AAC audio stream; source clips use their first audio stream when available and otherwise receive generated silence.
- Timeline gaps receive black video plus generated silent audio.
- The final assembly continues to use the concat demuxer with no filter_complex timeline assembly.
- Independent audio-track editing/mixing, transitions/effects, and multi-track compositing remain deferred.
- Local validation for M3.41 is pending.
## M3.37 implementation checkpoint — 2026-09-21

- Branch: `feat/m3-37-native-render-graph-wiring`.
- M3.36 is completed and squash-merged as PR #47 at `3b0f3b2f0c5a54ee821fcda1f2a98a611145e814`.
- User confirmed the corrected M3.36 local validation passed after the filter-label and multi-track regression test fixes.
- M3.37 connects the deterministic M3.36 video graph to a native Tauri/FFmpeg renderer through a dedicated request boundary.
- Added `render_video_graph_to_mp4` in Rust, with structured input arguments, `-filter_complex`, `[vout]` mapping, video-only output, validation, and controlled FFmpeg errors.
- Added a TypeScript bridge plus `renderVideoPlanToMp4()` adapter so a RenderPlan can flow through graph compilation into the native renderer without coupling project/history state to process execution.
- M3.37 deliberately defers audio mixing, multi-track compositing, images, advanced visual filters, progress streaming, cancellation, and ExportPanel UI activation.
- Local validation is pending user verification on M3.37.

## Current live reconciliation — M3.36 — 2026-09-21

- Current `main` tip: `3b0f3b2f0c5a54ee821fcda1f2a98a611145e814`.
- Completed milestone: M3.36 — FFmpeg video filter graph, PR #47, squash merge SHA `3b0f3b2f0c5a54ee821fcda1f2a98a611145e814`.
- User approved M3.36 with `pass`; the follow-up validation run passed after the two reported regression-test issues were corrected.
- Historical PR #22 remains open and is not active project work.
- Immediate next slice: M3.37 — native render graph wiring.

## M3.36 implementation checkpoint — 2026-09-21

- Branch: `feat/m3-36-ffmpeg-filter-graph`.
- Added `src/features/export/render-graph.ts` to compile a `RenderPlan` into a deterministic FFmpeg video filter graph.
- The current graph supports one video track, sequential video clips, source trimming, canvas scale/pad, frame-rate normalization, and black-frame gaps.
- Filter input paths remain separate process arguments; the graph itself contains no shell command interpolation.
- Multi-track compositing, image sources, audio mixing, transitions, transforms, crops, keyframes, and mute-state rendering are rejected explicitly until their graph semantics are implemented.
- Added regression coverage for the basic graph and its unsupported-state boundaries.
- M3.36 local validation is pending user verification.

## M3.35 implementation checkpoint — 2026-09-21

- Branch: `feat/m3-35-render-plan`.
- Added `src/features/export/render-plan.ts` to compile the project timeline into an ordered, renderer-agnostic set of render segments.
- Each segment preserves source path, source timing, timeline timing, track identity/type, mute state, transform/crop/keyframe metadata, and transition metadata for later graph compilation.
- The plan resolves export quality dimensions from the existing export settings model and calculates the actual project timeline duration represented by the segments.
- The planner rejects missing assets, empty source paths, non-positive clip durations, invalid timeline starts, and overlapping clips on the same track.
- Added regression coverage for timing, quality sizing, invalid references, overlap detection, and preservation of render metadata.
- M3.35 local validation is pending user verification.

## M3.34 implementation checkpoint — 2026-09-21

- Added `render_single_source_to_mp4` as a narrowly scoped native Tauri command.
- The command validates video input, MP4 output paths, even output dimensions, and frame-rate bounds before invoking FFmpeg.
- FFmpeg arguments are passed as structured process arguments through `std::process::Command`; no shell command interpolation is used.
- The primitive produces a single-source MP4 with H.264/AAC and requested canvas dimensions. It is not yet the project timeline renderer.
- Added Rust regression coverage for settings validation and FFmpeg argument construction.
- Added a TypeScript renderer wrapper and regression test for the Tauri invoke boundary.
- M3.34 local validation is pending user verification.

## Current live reconciliation — M3.34 — 2026-09-21

- Current `main` tip: `a6c40943d2673d3688e218d1d45d79e828b5f39a`.
- Completed milestone: M3.33 — Export destination and render-job boundary, PR #44, squash merge SHA `a6c40943d2673d3688e218d1d45d79e828b5f39a`.
- User approved M3.33 with `pass`; PR #44 was marked ready and squash-merged.
- M3.33 added native output destination selection and a renderer-agnostic export-job contract while intentionally deferring FFmpeg rendering.
- Historical PR #22 remains open and is not active project work.
- Immediate next slice: M3.34 — native FFmpeg render invocation boundary. The goal is to connect the existing export-job request to one controlled Tauri/Rust FFmpeg command path with safe argument construction and deterministic error handling; broader render graph work remains separate.

## M3.33 validation correction — 2026-09-21

- User local validation: lint passed; the full test suite executed with 215/215 tests passing, but the ExportPanel suite failed to initialize because its Vitest mock referenced a hoisted module value before initialization.
- The failure is isolated to the test mock setup, not export behavior. `ExportPanel.test.tsx` now creates the mocked `chooseExportOutputPath` with `vi.hoisted`.
- Build completed successfully and `tauri dev` launched successfully in the same local run.
- Fresh local test rerun is required after the test-only correction.

## M3.33 — Export destination and render-job boundary — 2026-09-21

- Branch: `feat/m3-33-export-destination-job-boundary`.
- Added `src/features/export/export-dialog.ts` using the existing Tauri dialog plugin to choose a real MP4 output file.
- Added `src/features/export/export-job.ts` with a small renderer-agnostic job request/state contract for queued, running, completed, failed, and cancelled states.
- Export Settings now exposes output destination selection without coupling it to project history.
- Actual FFmpeg render invocation, timeline compositing, audio/video muxing, progress streaming, and cancellation wiring remain deferred.
- Local validation is pending user verification.

## Current live reconciliation — M3.33 — 2026-09-21

- Current `main` tip: `c81df8e7b0901a54c08b19dba2f5df3ee6a63adf`.
- Completed milestone: M3.32 — Export settings foundation, PR #43, squash merge SHA `c81df8e7b0901a54c08b19dba2f5df3ee6a63adf`.
- User approved M3.32 with `pass`; PR #43 was marked ready and squash-merged.
- M3.32 delivered the export settings model/UI and regression coverage. Actual output-path selection and FFmpeg rendering remain deferred.
- Historical PR #22 remains open and is not active project work.
- Immediate next slice: M3.33 — Export destination and render-job boundary, focused on selecting an output file and establishing a testable native render-job contract without yet expanding into a full render graph.

## M3.32 validation correction — 2026-09-21

- First M3.32 local run: lint passed; 19/21 test files passed with 213/215 tests passing. The two failures were test assertions only: the default project canvas is portrait (1080×1920), so 720p output is normalized to an even 406×720 width; and the filename is rendered in an input value rather than a text node. Build and Tauri dev both succeeded.
- Follow-up test-only corrections use dialog text content for the computed resolution and `getByRole("textbox")` for the filename value.
- PR #43 remains draft and requires a fresh local rerun.

## Current live reconciliation — M3.32 — 2026-09-21

- Current `main` tip: `3a2a77aca9b30779870e16863fe709661cd02f3e`.
- Completed milestone: M3.31 — Playback smoothness / render-throttle, PR #42, squash merge SHA `3a2a77aca9b30779870e16863fe709661cd02f3e`.
- User reported M3.31 validation passed after the follow-up regression-test import fix.
- Historical PR #22 remains open and is not active project work.
- Active milestone: M3.32 — Export settings foundation.
- Branch: `feat/m3-32-export-settings`.
- M3.32 scope: establish an export configuration model and a real Export Settings workflow in the existing workspace without coupling it to project history or prematurely implementing the full FFmpeg renderer.
- Export settings support MP4/H.264 as the first renderer target, source/1080p/720p quality presets, project aspect-ratio-preserving dimensions, project frame rate, and sanitized output filenames.
- The Export Settings panel is opened from the existing toolbar Export action or the workspace Export navigation item.
- Export rendering and output-path selection remain deliberately deferred to the next export-pipeline slice.
- Automated regression coverage has been added for export settings normalization, quality dimensions, filename sanitization, panel interaction, and App wiring.
- Local validation: pending user verification on the M3.32 branch.
- Next step: user validates lint, tests, build, Tauri dev, and manual Export Settings checks before PR #43 is marked ready and merged.

## M3.31 validation correction — 2026-09-21

- User local run: lint passed; 18 test files ran with 206 passing tests and 1 failing App regression due to `addAssetToTimeline` missing from the test import. Build also failed only on that same TypeScript symbol; Tauri dev still launched successfully. The implementation itself did not produce a runtime/test failure.
- Follow-up commit `a9e1b5111a1338fd758186969114eee2ab624612` imports the existing timeline command in `src/App.test.tsx`.
- PR #42 remains draft and requires one fresh local rerun.

## Current live reconciliation — M3.31 — 2026-09-21

- Current `main` tip: `dedeeccf309238b483e38d041d4928b23227f0a1`.
- Completed milestone: M3.30 — Transition Browser / Picker, PR #41, squash merge SHA `dedeeccf309238b483e38d041d4928b23227f0a1`.
- User reported the M3.30 local validation passed, so PR #41 was marked ready and squash-merged.
- Historical PR #22 remains open and is not active project work.
- Active milestone: M3.31 — Playback smoothness / render-throttle.
- Branch: `feat/m3-31-playback-smoothness`.
- M3.31 scope: reduce React render pressure during playback by throttling playback-driven UI clock publications to at most approximately 30 Hz while keeping the internal playback clock at requestAnimationFrame cadence.
- Native media elements continue their own playback; this milestone does not add a second media clock, change FFmpeg preview generation, or modify project/history state.
- Added regression coverage for the publish-throttling helper and an App integration test covering multiple animation-frame callbacks.
- Local validation: pending user verification on the new branch.
- Next step: user validates lint, tests, build, Tauri dev, and manual smooth-playback checks before PR #42 is marked ready and merged.

## Current live reconciliation — M3.30 — 2026-09-21

- Current main after M3.29 squash merge: 1aa5dee0da89a0f80357ad294273025164254a90.
- Completed milestone: M3.29 — Fade through black transition, PR #40, squash merge SHA 1aa5dee0da89a0f80357ad294273025164254a90.
- User reported the M3.29 local validation passed without errors, including the requested transition behavior checks.
- Historical PR #22 remains open and is not active project work.
- Active milestone: M3.30 — Transition Browser / Picker.
- Branch: feat/m3-30-transition-browser.
- M3.30 scope: replace transition selection as a text-only control with a discoverable picker for None, Dissolve, and Fade through black while preserving the existing transition mutation and duration editing paths.
- M3.30 implementation: picker buttons use the same onChange contract as the existing select; existing select remains as an accessibility/keyboard fallback so current integration coverage is preserved.
- M3.30 automated coverage: added TransitionInspector.test.tsx for option rendering, selection, duration preservation, and ineligible-state behavior.
- M3.30 validation: not yet locally validated by the user. Automated execution could not be performed in this environment because direct repository cloning was blocked by network/DNS resolution.
- Next step: user validates the M3.30 branch with lint, tests, build, Tauri dev, and visual picker checks before the PR is marked ready and merged.

## Current live reconciliation — 2026-09-21

- Verified live main tip: 468d1d3f0bbcbe28028b547097e5a8810564c5e8.
- Latest completed milestone remains M3.28 — Transition lifecycle integrity.
- M3.28 PR: #39.
- M3.28 merge SHA: 2e77190ef6474b3ede1ad72af0682a9c5bfb7c61.
- The older checkpoint in this document (7d9400634c0f9a4650212110b938a17e0fa685da) is stale relative to live GitHub and is superseded by live repository state.
- User has now reported that the latest local validation run completed without errors. The exact local command output and local HEAD SHA are not recorded here, so this is recorded as user-reported validation rather than independently executed validation.
- PR #22 remains open as a historical draft for keyframe easing preservation; it is not the active milestone branch.
- No M3.29 merge exists yet.

## M3.29 — Fade through black transition — in progress

Branch: feat/m3-29-fade-through-black-transition
PR: #40 (draft)
Base: 468d1d3f0bbcbe28028b547097e5a8810564c5e8

Implementation summary:
- Extended the backward-compatible clip transition model with a fade-through-black transition type.
- Preserved the existing transition lifecycle sanitizer and history mutation architecture.
- Added transition-type-preserving normalization and shared transition visual-state math.
- Added a per-transition black overlay in the preview compositor without introducing a second project state system.
- Generalized Inspector and Timeline duration controls so they preserve the selected transition type.
- Added regression tests for command creation, normalization, preview math, preview overlay rendering, Timeline controls, and App Inspector workflow.

Architecture decisions:
- ClipTransition remains a discriminated union and transition mutations continue through updateClipTransition and the existing history path.
- Fade-through-black uses full outgoing/incoming clip opacity with a transient black overlay that peaks at the midpoint.
- The overlay is rendered inside the incoming transition layer's existing preview stacking context so higher video tracks remain above it.
- Existing duration limits and adjacency rules remain unchanged.

Tests:
- New regression coverage has been added, but this branch has not been locally executed in this environment.
- Current M3.28 baseline validation is recorded from the user's latest clean local test report.

Exact validation status:
- M3.28: user-reported latest tests clean; exact command output not captured here.
- M3.29: not yet locally validated by the user.

Known limitations:
- Only two visual transition types exist: Dissolve and Fade through black.
- Transition placement remains limited to directly adjacent visual clips.
- No transition browser or audio transitions are included.
- Custom transition easing or non-linear fade profiles are deferred.

Next step:
- Draft PR #40 is open.
- User validates the branch locally with lint, tests, build, Tauri dev, and manual transition checks.

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