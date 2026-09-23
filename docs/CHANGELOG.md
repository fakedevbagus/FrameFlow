## 2026-09-22 — M3.62 Text Overlay Export Rendering — in progress

Branch: feat/m3-62-text-overlay-export-rendering

Base:
- M3.61 squash merge SHA: 947f3c33fcf61b1e07d1d75e275d721755568ae8

Scope:
- Extend the existing text overlay model into native video export/render-plan compilation.
- Preserve the Preview/export semantic contract for text content, position, size, color, and alignment.
- Keep the implementation deterministic with an explicit font policy and no project schema change.
- Preserve existing single-video FFmpeg graph behavior and regression coverage.

Validation:
- Local validation pending implementation.
- Keep PR Draft until user reports PASS.

## 2026-09-22 — M3.62 Text Overlay live-edit stabilization — in progress

Branch: feat/m3-62-text-overlay-export-rendering
PR: #76

Observed WebView behavior:
- The Text/X/Y/Size control values visibly changed while editing, but Preview did not update until blur/outside click.
- This means the DOM value path can advance even when React event delivery is delayed or absent.

Current fix:
- Keep the transient edit session outside committed project/history state through a synchronous `useSyncExternalStore` store.
- Use normal `input`/`change` handlers as the fast path.
- Poll the actual Text/X/Y/Size DOM controls every 50 ms while a visual clip is selected.
- When polling detects a difference, update the external edit session and imperatively update the matching Preview overlay DOM element in the same poll cycle.
- Keep a hidden Preview overlay target mounted for the selected visual clip even when there is no committed text, so the imperative fallback never depends on React creating the node first.
- The imperative patch updates `textContent`, left/top, font size, color, text alignment transform, and visibility.
- No polling path uses `document.activeElement`; no blur is required to display the live value.
- The earlier native listener / keyboard fallback / `flushSync` chain is removed.

Regression coverage:
- Standard event-driven live Text/X/Y/Size changes.
- Direct DOM value changes without input/change/keyup.
- No Undo history entry while an edit remains uncommitted.
- Single history entry on commit with Undo/Redo and Reset.
- External edit-session publish/deduplication/replacement/clear behavior.

Validation:
- Local Linux/Tauri validation pending user verification.
- GitHub CI must be rechecked on the latest branch head.
- Merge status: not merged; PR #76 remains Draft until the user reports PASS.

## 2026-09-22 — M3.61 Text Overlay Foundation — merged

Merge SHA:
- 947f3c33fcf61b1e07d1d75e275d721755568ae8

Validation:
- User reported local validation as PASS.
- GitHub CI run #61 passed for the final validated head.
- PR #75 was marked ready and squash-merged.


Validation fix:
- Corrected the domain normalization fixture so its intentionally invalid alignment value is accepted by the test compiler while still exercising the runtime fallback to center.

Branch: feat/m3-61-text-overlay-foundation
PR: #75 — draft

Base:
- M3.60 squash merge SHA: bb5ea26ea3598f33dda7f07837eebaf093a4dfce

Scope:
- Add backward-compatible optional per-visual-clip text overlays.
- Support text content, X/Y position, font size, color, and left/center/right alignment.
- Expose the controls in the visual-clip Inspector with a Text quick-access action and Reset.
- Render text overlays in Preview for video and image clips.
- Keep text overlay mutations inside the existing project/history path so they persist with project files.
- Clear the optional overlay when the text is empty.
- Keep text export/render-graph compilation deferred until a dedicated text-rendering milestone so font selection remains deterministic and platform-safe.
- Text overlay command validation is limited to editable visual clips on video tracks.

Tests:
- Added project-domain normalization coverage.
- Added text-overlay timeline-command coverage.
- Added App Inspector/Preview workflow coverage.

Validation:
- Local validation is pending user verification.
- Keep PR Draft until the user reports PASS.

## 2026-09-22 — M3.60 Visual Effects Foundation — merged

Branch: feat/m3-60-visual-effects-foundation

Merge SHA:
- bb5ea26ea3598f33dda7f07837eebaf093a4dfce

Implemented:
- Backward-compatible per-visual-clip Brightness, Contrast, and Saturation adjustments.
- Inspector controls and discoverability improvements for Color adjustments.
- CSS preview filters and FFmpeg eq propagation.
- Regression coverage across domain, commands, RenderPlan, render graph, and App workflow.

Validation:
- User reported the corrected local validation as PASS.
- GitHub CI run #48 passed on the final head.
- PR #74 was marked ready and squash-merged.

## 2026-09-22 — M3.59 Project File Persistence Hardening — merged

Branch: feat/m3-59-project-persistence-hardening

Base:
- M3.58 squash merge SHA: 50f90252546fd65a83f31260b123ca185646a816

Scope:
- Require native project open/save paths to be absolute.
- Require the .frameflow.json suffix, case-insensitively.
- Preserve successful temp-file-then-rename atomic saves.
- Remove stale .tmp project artifacts when finalization fails.
- Keep project schema/history semantics unchanged.

Tests:
- Added native project-path validation coverage.

Validation:
- User reported the corrected local validation as PASS.
- PR #73 was marked ready and squash-merged at b693df59a4a879b7a4bf53067ad20bbba258f181.
- GitHub CI run #40 passed for the final corrected branch head.
- An earlier build failure was caused by TypeScript narrowing in the M3.58 waveform cache reader; that issue was corrected before the successful CI run.

## 2026-09-22 — M3.57 Audio Waveform Region Selection — merged

Branch: feat/m3-57-audio-waveform-region-selection

Base:
- M3.56 squash merge SHA: 593de1d6858577c4856ecc329eea544885b59bac

Scope:
- Preserve waveform click-to-seek.
- Add drag-to-select ordered local audio time ranges.
- Keep selection as ephemeral UI state with no project schema/history changes.
- Add Escape clearing and midpoint seek for keyboard activation when a region is selected.

Tests:
- Added waveform selection-range helper coverage.
- Added Timeline regression coverage for reverse-direction drag selection and click-seek compatibility.

Validation:
- User reported local validation as PASS; PR #71 was squash-merged at `c8b89684665f61d5f03e78ccbcc66cc52beb28af`.
- CI validation is also running for lint, frontend tests, production build, and Rust tests.

## 2026-09-22 — M3.56 stabilization — validation pending

Branch: feat/m3-56-audio-waveform-scrubbing

Implemented:
- Hardened waveform peak normalization and SVG path generation against empty and non-finite peak data.
- Rejected empty native waveform results at the frontend boundary.
- Prevented expected HTMLMediaElement.play() AbortError interruptions from surfacing raw abort text in the project status.
- Added playback request invalidation so stale play promises cannot overwrite later pause/seek state.
- Awaited Preview asynchronous effects in interaction tests and added a deterministic jsdom media play() mock.
- Reduced Vitest fork-worker concurrency to two workers as a targeted worker-startup stability mitigation.
- Expanded Timeline waveform scrubbing regression coverage to left/center/right pointer positions, keyboard seeking, and drag isolation.
- Made the interactive waveform keyboard-focusable and prevented non-finite SVG dimensions from producing malformed path data.
- Refined waveform presentation after desktop inspection so the audio clip no longer renders as an overfilled/black-looking block: waveform amplitude is reduced, peak dynamics are compressed, and the SVG path fill is explicit.

Validation:
- Repository execution is not available in this connector environment, so fresh npm, Vitest, build, Cargo, and Tauri results are intentionally not claimed here.
- Before marking PR #70 ready, run the required local validation gate and the manual waveform/playback checks from the M3.56 handoff.


## 2026-09-21 — M3.55 Audio Waveform Foundation — in progress

Branch: `feat/m3-55-audio-waveform-foundation`

Scope:
- Add native FFmpeg waveform analysis for local audio sources.
- Return compact normalized peak buckets without changing project schema.
- Cache waveform requests in the frontend by source path and peak count.
- Render the waveform as an SVG inside Audio timeline clips.
- Preserve existing audio automation, fades, volume, pan, EQ, compressor, mute, mix, and export behavior.

Validation:
- Local npm/Cargo/Tauri validation is required before merge.
- Waveform editing, selection, and persistent waveform-cache storage remain deferred.

## 2026-09-21 — M3.54 Audio Volume Automation Timeline UX — in progress

Branch: `feat/m3-54-audio-volume-automation-timeline`

Scope:
- Add Timeline markers for persisted audio volume automation keyframes.
- Allow marker click/focus to select and seek the owning audio clip.
- Add direct marker dragging with existing timeline snapping and neighbor constraints.
- Add Delete/Backspace removal plus Arrow/Shift+Arrow keyboard nudging.
- Cancel active marker drags with Escape without committing history.
- Preserve keyframe volume values while moving timestamps through a validated command.

Validation:
- Local npm/Cargo/Tauri validation is required before merge.
- Existing audio automation, fades, pan, EQ, compressor, mute, mixing, and export semantics remain unchanged.

## 2026-09-21 — M3.53 Audio Clip Volume Automation — in progress

Branch: `feat/m3-53-audio-volume-automation`

Scope:
- Add backward-compatible per-audio-clip volume automation keyframes.
- Provide linear interpolation between local clip-time keyframes.
- Expose playhead-based Add/Update/Remove keyframe controls in the selected-audio Inspector.
- Apply the automation in Web Audio preview.
- Propagate keyframes through RenderPlan and compile a frame-evaluated FFmpeg volume envelope.
- Preserve automation semantics across clip splits.

Validation:
- Local npm/Cargo/Tauri validation is required before merge.
- Timeline marker/drag UX is deferred to a follow-up slice.

## 2026-09-21 — M3.52 Audio Clip Dynamics Compressor — merged

PR #66 — squash-merged
Merge SHA: da0b5dc957be094738ac4e657007523f8684fdd8

Implemented:
- Backward-compatible clip-level compressor state.
- Threshold, ratio, attack, and release Inspector controls.
- Web Audio DynamicsCompressorNode preview processing.
- RenderPlan propagation and native FFmpeg `acompressor` export.
- Regression coverage across domain, commands, RenderPlan, audio graph, and App.

## 2026-09-21 — M3.51 Audio Clip 3-Band EQ — merged

PR #65 — squash-merged
Merge SHA: 52844a8c5f1a1f0605e6c9508d87c52c90ead7de

Implemented:
- Backward-compatible clip-level three-band EQ.
- Validated history command and selected-audio Inspector controls.
- Best-effort Web Audio preview EQ.
- RenderPlan propagation and native FFmpeg equalizer filters.
- Regression coverage across domain, commands, RenderPlan, audio graph, and App.

Validation:
- User approved continuation with pass after the final local validation cycle.
- Non-blocking React act() and jsdom media-play test warnings remain known.

Next:
- M3.52 — Audio Clip Dynamics Compressor.

## 2026-09-21 — M3.52 Audio Clip Dynamics Compressor — in progress

Branch: `feat/m3-52-audio-clip-compressor`

Scope:
- Add backward-compatible per-audio-clip compressor state.
- Expose threshold, ratio, attack, and release controls in the selected-audio Inspector.
- Apply the same compressor semantics in Web Audio preview and native FFmpeg export.
- Preserve existing EQ, pan, volume, mute, fades, multi-track mix, and history behavior.

Validation:
- Local npm/Cargo/Tauri validation is required before merge.
- Keep PR draft until the full validation suite and manual compressor checks are clean.

## 2026-09-21 — M3.51 Audio Clip 3-Band EQ — implementation

Branch: feat/m3-51-audio-clip-eq

Implemented:
- Backward-compatible optional per-audio-clip EQ state with enabled flag and Low/Mid/High gains from -12 dB to +12 dB.
- Selected audio Inspector controls for Enable EQ and three gain values.
- Web Audio preview processing with low-shelf, peaking, and high-shelf filters.
- RenderPlan EQ propagation and FFmpeg three-band equalizer filters.
- Regression coverage across domain, commands, RenderPlan, audio graph, and App.

Validation:
- Local npm/Cargo/Tauri validation is required after pulling the branch.

## 2026-09-21 — M3.50 Export Progress and Cancellation — merged

PR #64 — squash-merged
Merge SHA: e239c4b355d64c62a090067ad1aaaa80cefe9f55

Implemented:
- Native FFmpeg progress streaming keyed by export job ID.
- Safe cancellation for active exports and the boundary between sequential video/audio stages.
- Monotonic two-stage progress aggregation and ExportPanel cancellation UI.

Validation:
- User reported the corrected full local validation as passing.

## 2026-09-21 — M3.49 Audio Track Pan Control — merged

PR #63 — squash-merged
Merge SHA: 7fbb75a222bcccfc92cb2ee211e1df0db9748233

Implemented:
- Backward-compatible Audio-track pan from -1 (left) through 0 (center) to +1 (right).
- Validated project/history command integration.
- Compact Timeline Pan control with accessible value feedback.
- Best-effort StereoPannerNode routing for native preview.
- RenderPlan pan propagation and FFmpeg stereo balance before fades/delay.
- Regression coverage across domain, commands, RenderPlan, audio graph, Preview, and App.
- Final build-only import/fixture corrections were applied before approval.

Validation:
- User approved continuation with pass.
- 28 frontend test files passed with 279/279 tests.
- Production build passed after the final corrections.
- Rust tests: 28 passed, 0 failed.
- Tauri dev launched successfully.

Deferred:
- Full audio effects/EQ/compression.
- Audio automation.
- Waveform editing.

## 2026-09-21 — M3.49 test declaration restoration

- Restored three accidentally removed test declarations that caused parser errors.
- No production behavior changed.

## 2026-09-21 — M3.49 Audio Track Pan Control — implementation

Implemented:
- Backward-compatible Audio track pan (-1 left, 0 center, +1 right).
- Validated project command and history integration.
- Compact Timeline pan slider with accessible value text.
- Web Audio preview panning with a safe no-op fallback when unsupported.
- RenderPlan propagation and FFmpeg pan filter.
- Domain, command, RenderPlan, audio graph, and App regression coverage.

Validation:
- Local npm/Cargo/Tauri validation is required after pulling this branch.

## 2026-09-21 — M3.48 multi-track test assertion correction

- Corrected the expected input/filter ordering to match deterministic trackIndex ordering.
- Added source-path and delay assertions for the two independent Audio tracks.

## 2026-09-21 — M3.48 validation correction

- Fixed the inherited AudioFadeInspector lint violation by using the stable ref-based draft synchronization.
- Corrected the multi-track graph regression fixture so its expected second input source range matches the fixture data.

## 2026-09-21 — M3.48 Multiple Audio Track Mix — implementation started

Implemented:
- Multi-track audio graph compilation with deterministic track/clip ordering.
- Reused existing per-clip trim, volume, fade, mute, delay, stereo normalization, and project-silence stages.
- Export pipeline now calls the multi-track compiler.
- Added regression coverage for two independent Audio tracks being mixed into [aout].

Validation:
- Local npm/Cargo/Tauri validation is required after pulling the branch.

## 2026-09-21 — M3.46 Audio Clip Fades — merged

PR #59 — squash-merged
Merge SHA: 76d0a1cadd9ae7ab31d471f46c4d6cb9ddba0b40

Implemented:
- Backward-compatible per-audio-clip fade-in/fade-out state.
- Validated fade update command with overlap and duration checks.
- Preview and FFmpeg fade behavior.
- Trim/split fade preservation.
- Inspector fade controls with controlled draft-state correction.
- Regression coverage across domain, commands, Preview, RenderPlan, audio graph, and App.

User approved continuation with pass.

Next:
- M3.47 — Timeline Audio Fade Handles.
## 2026-09-21 — M3.46 Inspector fade draft-state correction — validation required

- The user's fresh validation after the prior key-based fix still reported 268/269 tests, with only the Fade out Inspector test failing.
- Replaced the uncontrolled `defaultValue` audio fade inputs with controlled transient draft values inside `AudioFadeInspector`.
- Persisted project values remain owned by the existing project/history state and `updateAudioClipFades()` command; the new component only tracks the text currently being edited.
- Strengthened the integration test to assert that Fade out reaches 1500 ms immediately after the change event before blur.
- Latest user validation evidence: lint completed, build completed, Rust 28/28 passed, and Tauri dev launched; Vitest still had 1 deterministic failure before this correction.

## 2026-09-21 — M3.46 Inspector fade edit fix — pending validation

Root cause:
- The Audio fades Inspector used one React key on the shared Fade in/Fade out grid, derived from both values.
- Updating one field therefore remounted the sibling input and interrupted the second edit in the same interaction sequence.

Fix:
- Removed the shared grid key.
- Added per-field synchronization keys to the Fade in and Fade out inputs.
- Preserved the existing project/history command path.

Regression:
- Strengthened the App integration test to assert the sibling Fade out input remains mounted after the Fade in blur and then accepts the 1500 ms value.

Validation:
- Repository source reconciliation complete.
- Local npm/Cargo/Tauri validation is still required; this connector runtime cannot execute those repository commands.
## 2026-09-21 — M3.46 validation correction — in progress

- Corrected missing `updateAudioClipFades` test import.
- Corrected the audio fade normalization test expectation to reflect the non-overlap rule.
- Rust tests remained 28/28 in the reported run; Tauri dev launched successfully.
- Fresh full validation is still required because the reported Vitest run also contained three worker timeouts/unhandled worker errors.

## 2026-09-21 — M3.46 audio clip fade controls — in progress

Branch: feat/m3-46-audio-clip-fades

Implemented:
- Added optional per-audio-clip fade-in and fade-out state with zero defaults.
- Added validated updateAudioClipFades() command with duration and overlap checks.
- Preserved/clamped fade state through audio clip trim operations and split audio clips into endpoint-specific fades.
- Added Audio fades controls to the selected audio clip Inspector.
- Applied fade envelope to audio preview playback.
- Carried audio fade durations through RenderPlan.
- Added FFmpeg afade stages before timeline delay/mixing.
- Added regression coverage across domain, commands, render plan, audio graph, Preview, and App.

Deferred:
- Audio effects/EQ/compression.
- Multiple independent Audio tracks.
- Keyframed audio automation.
- Render progress and cancellation.

Validation:
- Local validation is pending user verification.

## 2026-09-21 — M3.45 audio track volume control — correction merged

PR #58 — merged
Merge SHA: 6f06f473b2a552cc04233ff4ada5c6bba07b7274

Correction:
- Wired the Audio-track volume callback through the Timeline track wrapper.
- Widened the Timeline track-label column so the volume slider and percentage are visible.
- Assigned preview volume directly to the native HTMLAudioElement.
- Updated the audio graph regression assertion for the explicit default volume stage.

## 2026-09-21 — M3.45 audio track volume control — merged

Branch: feat/m3-45-audio-track-volume
PR #57 — merged
Merge SHA: 9ce1bcf1c7a8729f62c65121274029d960eccddb

Implemented:
- Added backward-compatible per-track volume state with 1.0 as the default.
- Added a validated volume update command with project timestamp updates.
- Added a compact Audio-track Timeline volume slider with accessible percentage feedback.
- Applied track volume to Audio-track preview playback.
- Carried track volume into RenderPlan and applied it inside the explicit Audio-track FFmpeg graph before timeline placement/mixing.
- Preserved the existing binary mute behavior as a separate control.
- Added domain, command, render-plan, graph, Preview, Timeline, and App regression coverage.

Validation:
- User local Linux validation reported lint passing.
- Vitest: 28 test files passed, 253/253 tests passed.
- Production build completed successfully.
- Rust tests: 28 passed, 0 failed.
- tauri dev launched successfully.
- The initial git pull --ff-only step did not fast-forward because the local branch had diverged; subsequent validation completed successfully.

Deferred:
- Audio fades, transitions, and effects.
- Multiple independent Audio tracks.
- Progress streaming and cancellation.

## 2026-09-21 — M3.44 full project audio-track export — merged

Branch: `feat/m3-44-project-audio-mix`
PR #56 — merged
Merge SHA: `33c36f19735df4967b149e1c16d60e88f1ccf4a4`

Implemented:
- Routed projects with an explicit Audio track through the existing base video renderer first.
- Compiled the Audio track with dense native input indices.
- Mixed the compiled Audio track into the base video's first audio stream.
- Generated timeline-duration silence when the base video had no audio stream.
- Preserved existing single-source and sequential multi-segment video audio behavior.
- Added regression coverage for project routing, native video/audio mix arguments, request validation, and the invoke bridge.
- Used a temporary native mix output before finalizing the requested MP4.

Validation:
- User confirmed M3.44 local validation passed.
- Frontend lint passed.
- 253/253 Vitest tests passed.
- Production build passed.
- 28/28 Rust tests passed.
- `tauri dev` started successfully.

Deferred:
- Audio volume/gain controls.
- Fades, transitions, and audio effects.
- Multiple independent audio tracks.
- Progress streaming and cancellation.

## 2026-09-21 — M3.43 native audio render boundary — merged

Branch: `feat/m3-43-native-audio-render`

Implemented:
- Added a dedicated native Tauri audio-graph render command.
- Validated absolute audio inputs, existing files, MP4 output path, non-empty filter graphs, and fixed `[aout]` mapping.
- Executed FFmpeg through structured `Command` arguments without shell interpolation.
- Normalized native output to AAC stereo 48 kHz.
- Exposed the native audio graph invoke bridge and regression coverage.
- Kept existing video rendering paths unchanged.

Validation:
- User approved M3.43 after local validation.
- PR #54 was squash-merged at `fff690250c1e0ffafe2aae41e09d8ef91be65daa`.

## 2026-09-21 — M3.42 audio-track graph compiler — merged

- PR #53 `feat: add audio track render graph compiler` was squash-merged.
- Merge SHA: `5c338d0462206d88e6e258b8e433afe2ce897c43`.
- M3.42 established pure audio graph compilation above the RenderPlan boundary.

## 2026-09-21 — M3.41 multi-segment audio — merged

- PR #52 `feat: add audio to multi-segment video export` was squash-merged.
- Merge SHA: `0cfaba472aa57b0606252c82fd15c998775ad6db`.
- User approved M3.41 after local validation.
- Native sequential multi-segment export now normalizes each segment to synchronized video plus audio, with generated silence for clips without audio and timeline gaps.
- A follow-up Rust syntax correction removed a duplicate legacy concat argument block before the final merge.

## 2026-09-21 — M3.40 multi-segment video renderer — merged

- PR #51 `feat: add native multi-segment video export` was squash-merged.
- Merge SHA: `4d9e15a27dda3c5d5d42f18c2161a9a3d6a6b415`.
- User approved M3.40 after successful local multi-clip export verification.
## 2026-09-21 — M3.39 single-source audio — merged

- PR #50 `feat: add audio to single-source export` was squash-merged.
- Merge SHA: `2808ba584932967f7dccf2b273faf79e61e27a9d`.
- User approved M3.39 after validation of the single-source audio export.
- Direct single-clip exports now mux the first source audio stream when available.

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