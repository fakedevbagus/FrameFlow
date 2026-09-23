## M3.68 — Non-Centered Transform Anchor Export — in progress — 2026-09-23

- M3.67 Animated Transform Export was user-validated and squash-merged in PR #81 at `783885376209ec56013612147b217a13c8bf1ef7`.
- M3.68 addresses the remaining export limitation for non-centered transform anchors already supported by the editor/Preview.
- Validation on 2026-09-23 found two unused locals in the anchor-aware graph and one stale pipeline test that still expected non-centered anchors to be rejected; these were corrected.
- The anchor composition math was simplified to mirror CSS transform-origin directly: the selected anchor is placed at the transparent surface center before rotation, then X/Y translation is applied in world space.
- The transparent anchor surface now uses the full twice-radius extent required to contain the furthest scaled corner around the pivot.
- The pipeline graph-required check was narrowed so neutral visual-effects metadata does not disable the existing direct renderer.
- Static and animated transforms now have an anchor-aware graph path when scale or rotation makes the anchor visually significant.
- The anchor-aware path keeps the source content in its contained bounds, preserves crop/effects ordering, scales around the selected pivot, compensates pre-rotation placement, rotates around the pivot, then applies world-space X/Y translation.
- Animated anchor-aware transforms reuse the existing X/Y, Scale, Rotation, and Opacity keyframe expressions and easing rules without changing the project schema.
- The graph uses a conservative transparent composition surface sized from the project bounds, maximum animated scale, and anchor offset so rotation can occur without clipping transformed content.
- The export pipeline now routes any graph-required visual metadata through the graph renderer; this also prevents single-source or legacy segment rendering from silently dropping static transforms, crops, visual effects, or keyframes.
- Centered-anchor behavior remains on the existing optimized graph path; anchor-sensitive work is isolated to non-centered scale/rotation cases.
- Added render-graph coverage for static and animated off-center anchors plus pipeline coverage proving static transforms use the graph.
- Local and CI validation are pending for M3.68; PR will remain Draft until user PASS.
- PR #82 is open as Draft; Text Overlay Export remains parked in PR #76; multi-track compositing and audio mixing remain deferred.

- Manual validation on 2026-09-23 also exposed a workspace-layout issue: at the current desktop width the Inspector contents were visibly clipped horizontally, especially the quick-action buttons and two-column form fields.
- Hardened the workspace grid with flexible side-panel bounds and a wider Inspector budget while preserving a minimum editor canvas width.
- Added min-width constraints and intrinsic-width-safe two-column grid tracks for Inspector content so controls shrink within the panel instead of painting past its right edge.
- Kept the PR Draft because this is a UI validation correction and fresh lint/test/build/Tauri validation is still required.

- Follow-up manual screenshot validation showed the first layout correction was insufficient: the Inspector remained clipped at the right edge because section headers with multiple action buttons could still exceed the narrow panel's intrinsic width.
- Hardened the workspace again with a 300–320px Inspector column and a 210–240px media column, while preserving a 420px minimum editor area.
- Inspector section headers and action groups now wrap when necessary instead of forcing horizontal overflow; anchor headers use the same safe behavior.
- This remains a layout-only correction; export/editor data models are unchanged. Fresh local validation is still required.

## M3.67 — Animated Transform Export — merged — 2026-09-23

- PR #81 was user-validated and squash-merged into `main` at `783885376209ec56013612147b217a13c8bf1ef7`.
- Added deterministic FFmpeg graph compilation for transform keyframes across X, Y, Scale, Rotation, and Opacity using the existing easing model.
- Video inputs are normalized to the project frame rate before animated evaluation; opacity uses the normalized frame index.
- Animated visual content is composited onto a project-sized transparent surface, with crop and visual effects applied before animation.
- Animated clips are explicitly routed through the graph renderer rather than direct-source or legacy sequential renderers.
- Centered anchors remain supported; non-centered anchors remain the next focused export gap.
- No project schema change.
- Local validation passed from the user's Linux/Tauri environment; GitHub CI run #181 passed all frontend/Rust validation steps.


## M3.66 — Transition Export — merged — 2026-09-23

- M3.65 image clip export was merged at `0136c1e6d13fd8cdb838dc2bbee8e5792fa86d31`.
- M3.66 implemented dissolve and fade-through-black export in the single-video graph.
- PR #80 was user-validated and squash-merged at `a3bf59055b76de1c485c8d410e2adb13862925d6`.
- CI run #171 passed on the final M3.66 branch head before merge.
- M3.62 Text Overlay Export remains intentionally parked in PR #76.


## M3.64 — Static Crop Export — merged — 2026-09-23

- M3.63 Static Visual Transform Export completed and was squash-merged into main at `67f5e9900fea9424e6e11fd247b4c26143927f27`.
- M3.62 Text Overlay Export Rendering remains intentionally parked in PR #76 Draft because the user's Linux/Tauri/WebKitGTK Preview live-update timing issue remains unresolved.
- M3.64 is a focused export slice for the existing `ClipCrop` and `CropPosition` model on the single video track.
- Preview crop semantics are already defined by a normalized crop viewport plus crop-content position. M3.64 mirrors those semantics in FFmpeg rather than inventing a second crop model.
- RenderPlan now normalizes non-empty crop metadata and its crop position using the existing transform helpers.
- Export applies crop after source fit/effects, then restores the cropped viewport into the original contained-content bounds before static transforms are applied. This keeps crop-before-transform ordering aligned with Preview.
- Static crop is supported with no transform, and static crop composes with the M3.63 X/Y/Scale/Rotation/Opacity export path.
- Default no-crop/no-transform keeps the existing minimal direct graph unchanged.
- Crop is validated as normalized fractions; crop position is clamped through the existing domain helper.
- Transform keyframes, non-centered transform anchors, transitions, images, multi-track compositing, and audio mixing remain deferred.
- Added RenderPlan and render-graph regression coverage for crop normalization, crop positioning, and crop + static transform composition.
- User reported local validation as PASS; PR #78 was squash-merged into `main` at `fd9d889c3975fdd076a87235913f3b37d1cbc50a`.
- Do not close or merge PR #76 as part of M3.64.

## M3.63 — Static Visual Transform Export — merged — 2026-09-23

- M3.62 Text Overlay Export Rendering is intentionally parked as PR #76 Draft because its Linux/Tauri/WebKitGTK Preview live-update path remains functionally usable but not immediate; the known limitation is preserved for later investigation.
- M3.63 is based directly on the current verified `main` and is intentionally independent of the parked M3.62 WebView issue.
- Preview already supports static visual X/Y translation, Scale, Rotation, and Opacity, but the export graph previously rejected any non-default transform.
- M3.63 propagates `transformAnchor` into RenderPlan for explicit validation and adds FFmpeg graph compilation for static centered-anchor transforms.
- Static transform export maps X/Y to canvas-pixel translation, Scale to source-content scaling, Rotation to transparent rotating content, and Opacity to alpha modulation.
- Transformed content is composited onto a transparent project-sized canvas so scaled/rotated content can extend beyond the project bounds and be clipped by the final output frame.
- Default transforms keep the existing minimal direct graph path unchanged.
- Non-centered transform anchors remain deferred and are rejected explicitly rather than silently misrendered.
- Transform keyframes, crop, crop position, transitions, images, multi-track compositing, and audio mixing remain outside this focused slice.
- Added RenderPlan coverage for transform-anchor propagation and render-graph coverage for static transform compilation, default-graph preservation, non-centered-anchor rejection, transform-keyframe rejection, and crop-guard preservation.
- Supplied local validation reached the full suite and found one stale regression assertion: `render-pipeline.test.ts` still expected static transforms to be rejected. The assertion was corrected to use transform keyframes, which remain intentionally deferred. The same supplied run showed 362/363 frontend tests passing, production build passing, and 38/38 Rust tests passing. A fresh validation run is required after the test correction. Keep PR #77 Draft until the user reports PASS.
- Do not close or merge PR #76 as part of M3.63; it remains the parked Text Overlay Export work item.

## M3.62 — Text Overlay Export Rendering — in progress — 2026-09-22

- M3.61 Text Overlay Foundation was completed, user-validated, and squash-merged into main at `947f3c33fcf61b1e07d1d75e275d721755568ae8`.
- M3.62 extends the text overlay foundation into native export/render planning so text visible in Preview can be rendered into exported video.
- The export slice will reuse the existing optional per-clip text overlay model and keep rendering deterministic without introducing a new project schema version.
- Font selection will use a small explicit renderer-owned font family policy rather than relying on arbitrary platform defaults.
- Preserve the existing single-video FFmpeg graph architecture and keep transform/crop/transition interactions explicitly validated.
- Local validation remains required before the M3.62 PR is marked ready.

## M3.61 — Text Overlay Foundation — merged — 2026-09-22

- Follow-up test correction: the invalid-alignment normalization fixture now intentionally bypasses the static union type so the runtime fallback path remains covered without changing production typing.
- PR #75: https://github.com/fakedevbagus/FrameFlow/pull/75
- M3.60 Visual Effects Foundation was completed, user-validated, and squash-merged into main at `bb5ea26ea3598f33dda7f07837eebaf093a4dfce`.
- Repository inspection after M3.60 shows text/captions are the next major editor capability not represented in the product surface.
- M3.61 adds a backward-compatible optional per-visual-clip text overlay model with text content, normalized X/Y position, font size, color, and left/center/right alignment.
- Text overlays are edited through the existing project history mutation path and therefore persist automatically with project files.
- The text-overlay command only accepts clips on video tracks with video/image assets, matching the existing visual-editing safety boundary.
- Preview renders the text overlay above the visual clip for both video and image media and keeps it coupled to the clip transform/opacity.
- The Inspector exposes the text content, position, font size, color, alignment, reset, and quick-access controls.
- Empty text clears the optional overlay state; existing projects remain compatible without a schema version bump.
- Export/render-graph compilation of text is intentionally deferred to a dedicated text-rendering milestone so this foundation does not introduce platform-dependent font assumptions.
- Added domain, timeline-command, and App Inspector/Preview regression coverage.
- Required validation: `git fetch origin --prune`; checkout/pull the feature branch; `npm ci`; `npm run lint`; `npm run test`; `npm run build`; `cd src-tauri && cargo test`; `cd ..`; `npm run tauri dev`.
- User reported local validation as PASS; PR #75 was marked ready and squash-merged at `947f3c33fcf61b1e07d1d75e275d721755568ae8`.

## M3.60 — Visual Effects Foundation — merged — 2026-09-22

- M3.60 adds backward-compatible per-visual-clip Brightness, Contrast, and Saturation adjustments normalized to `-1..1`.
- Neutral adjustments are omitted from persisted clip state, preserving legacy project compatibility without a schema version bump.
- Preview applies equivalent CSS brightness/contrast/saturate filters to image and video media.
- RenderPlan carries normalized visual effects metadata and the existing single-video FFmpeg graph compiles it to an `eq` filter stage.
- Visual-effect mutations use the existing Timeline -> history project mutation path.
- Added helper, project-domain, command, RenderPlan, render-graph, and App workflow regression coverage.
- User reported clean local validation as PASS after the final Inspector discoverability and regression-test corrections.
- GitHub CI run #48 passed on the final branch head.
- PR #74 was marked ready and squash-merged at `bb5ea26ea3598f33dda7f07837eebaf093a4dfce`.

## M3.59 — Project File Persistence Hardening — merged — 2026-09-22

- M3.58 Persistent Waveform Cache was completed and squash-merged into main at `50f90252546fd65a83f31260b123ca185646a816`.
- M3.59 hardened the native project file boundary to require absolute `.frameflow.json` paths and cleaned failed temporary save artifacts after rename errors.
- The filename extension check is case-insensitive and the existing atomic temp-file-then-rename behavior remains intact.
- Added native regression coverage for valid and invalid project paths.
- CI exposed a TypeScript narrowing issue in the persisted waveform cache reader; an explicit type guard corrected that pre-merge build error.
- User reported the corrected M3.59 validation as PASS; PR #73 was marked ready and squash-merged at `b693df59a4a879b7a4bf53067ad20bbba258f181`.

## M3.59 — Project File Persistence Hardening — in progress — 2026-09-22

- M3.58 Persistent Waveform Cache was completed and squash-merged into main at `50f90252546fd65a83f31260b123ca185646a816`.
- Repository persistence is the next focused slice because project save/open already exists but the native file boundary still accepts arbitrary paths.
- M3.59 hardens the native project path boundary to require an absolute file path with the `.frameflow.json` suffix.
- Project filename extension matching is case-insensitive so valid project files remain portable across normal filesystem naming conventions.
- Failed atomic project finalization now removes the temporary `.tmp` file so interrupted saves do not leave stale temporary artifacts.
- Existing temp-file-then-rename save behavior remains unchanged for successful saves.
- No project schema or history semantics change in this milestone.
- Added native regression coverage for valid/invalid project paths.
- CI build exposed a TypeScript narrowing issue in the persisted waveform-store reader; the cache parser now uses an explicit type guard before passing data to typed helpers.
- Required validation: `git fetch origin --prune`; checkout/pull the feature branch; `npm ci`; `npm run lint`; `npm run test`; `npm run build`; `cd src-tauri && cargo test`; `cd ..`; `npm run tauri dev`.
- Keep M3.59 Draft until the user reports clean local validation.

## M3.58 — Persistent Waveform Cache — merged — 2026-09-22

- M3.57 Audio Waveform Region Selection was squash-merged into main at `c8b89684665f61d5f03e78ccbcc66cc52beb28af`.
- M3.58 adds a best-effort persistent waveform cache backed by browser local storage while keeping waveform selection state ephemeral.
- Native Tauri exposes a lightweight audio source fingerprint derived from file size and modification timestamp.
- The frontend uses the fingerprint plus source path and peak count as the persistent cache identity, so changed media regenerates its waveform instead of reusing stale peaks.
- Persistent cache entries are capped at 32 most-recently-used entries to avoid unbounded local storage growth.
- Invalid or unavailable persistent storage is treated as a cache miss; waveform generation remains the source of truth.
- In-flight waveform requests remain deduplicated, while completed requests are eligible for persistent-cache reuse across editor sessions.
- No project schema or history state is changed.
- Existing waveform selection, click-to-seek, audio fades, automation, pan, EQ, compressor, mute, multi-track mixing, RenderPlan, and export paths remain unchanged.
- Added regression coverage for cache reuse, fingerprint invalidation, malformed persisted data, storage failures, and existing waveform normalization behavior.
- User reported local validation as PASS; PR #72 was marked ready and squash-merged.
- A pre-merge CI run exposed stale test mocks/assertions for the new fingerprint invocation path; those tests were corrected before merge. No fresh post-correction CI result is being claimed here.

## M3.57 — Audio Waveform Region Selection — merged — 2026-09-22

- M3.56 was completed and squash-merged into main at `593de1d6858577c4856ecc329eea544885b59bac`.
- M3.57 uses the explicitly deferred waveform region-selection capability as the next focused audio slice.
- Waveform click remains a seek interaction; a drag of at least four CSS pixels becomes a local audio time-range selection.
- Selected ranges are ordered by start/end time regardless of drag direction and remain local to the waveform clip.
- Selection is display/UI state only in this slice; no project schema or history mutation is introduced.
- Escape clears the current waveform selection.
- Enter/Space seeks to the selection midpoint when a region is selected; without a selection they retain midpoint-seek behavior.
- Existing clip move/trim, audio fades, volume automation, pan, EQ, compressor, mute, multi-track mixing, RenderPlan, and export paths remain unchanged.
- Added pure range-mapping coverage plus Timeline regression coverage for reverse-direction drag selection and click-to-seek preservation.
- Required validation: `npm run lint`; `npm run test`; `npm run build`; `cd src-tauri && cargo test`; `cd ..`; `npm run tauri dev`.
- PR #71 was marked ready after user validation and squash-merged at `c8b89684665f61d5f03e78ccbcc66cc52beb28af`.


## M3.56 stabilization — Audio waveform, playback aborts, and test reliability — 2026-09-22

- Current repository inspection confirms M3.56 remains PR #70 (feat/m3-56-audio-waveform-scrubbing) based on main at 8efdd97843fe63a02e9104ee52b369bf3bf3dd7b; the PR is still open and Draft.
- Waveform static tracing found two frontend robustness gaps: native peak arrays could be reduced to an empty result after filtering invalid values, and SVG path construction could receive non-finite peaks.
- Waveform peak normalization now preserves bucket positions, converts non-finite peaks to zero, rejects empty native peak arrays, and keeps the existing native FFmpeg generation architecture unchanged.
- Playback static tracing found App.handleTogglePlayback() surfaced the raw rejection message from HTMLMediaElement.play() through projectNotice. Expected AbortError rejections are now treated as playback interruption rather than a user-facing error, and a request id invalidates stale play promises after pause/seek.
- Vitest's default fork pool uses available parallelism. The latest supplied run showed simultaneous fork worker startup timeouts. The test configuration now caps the forks pool at two workers; this requires fresh local validation before the failure can be considered fully resolved.
- Preview tests now await asynchronous preview effects through a shared test render helper, and the jsdom media play() method has a deterministic resolved default so tests can focus on application behavior.
- Timeline waveform regression coverage now checks left/center/right seeking and verifies waveform pointer interaction does not invoke clip movement.
- Waveform interaction is keyboard-accessible as a button; Enter/Space seeks to the clip midpoint.
- SVG waveform path construction now rejects non-finite dimensions as well as invalid peak data.
- Waveform rendering was visually hardened after manual desktop inspection: reduced vertical amplitude, nonlinear peak compression, and an explicit SVG path fill prevent an overfilled/black-looking waveform.
- Required local validation remains pending in this environment because repository execution is unavailable here: npm run lint; targeted Vitest tests; npm run test; npm run build; cd src-tauri && cargo test; cd ..; npm run tauri dev.

## M3.56 — Audio Waveform Scrubbing — in progress — 2026-09-22

- M3.55 Audio Waveform Foundation is complete and PR #69 was squash-merged at `8efdd97843fe63a02e9104ee52b369bf3bf3dd7b`.
- M3.56 adds direct playhead seeking from the rendered Audio waveform without changing project schema or waveform storage.
- Pointer scrubbing maps the waveform's horizontal position to local clip time, clamps to the clip duration, selects the owning audio clip, and seeks the timeline playhead.
- Waveform interaction stops propagation so normal clip move/trim gestures are not triggered by a waveform seek.
- Existing audio automation markers, fades, track volume/pan, EQ, compressor, mute, multi-track mixing, RenderPlan, export, and history semantics remain unchanged.
- Waveform generation and in-memory caching remain display infrastructure; waveform editing and region selection remain deferred.
- Required validation after implementation: `npm run lint`; `npm run test`; `npm run build`; `cd src-tauri && cargo test`; `cd ..`; `npm run tauri dev`.
- Keep PR draft until the full local validation suite and focused waveform scrubbing checks are reported clean.

## M3.55 — Audio Waveform Foundation — in progress — 2026-09-21

- M3.54 Audio Volume Automation Timeline UX is complete and PR #68 was squash-merged at `21a1d601bed8215ea52c6ec4eb8ddcb2c4e769d2`.
- M3.55 adds a read-only audio waveform foundation for Audio timeline clips.
- Native Tauri/FFmpeg waveform analysis validates local audio sources, downsamples the first audio stream to mono, reduces it into normalized peak buckets, and returns compact waveform data without adding project schema state.
- The frontend caches waveform requests by source path and requested peak count and renders the waveform as an SVG path inside Audio timeline clips.
- Existing audio automation markers, fades, track volume/pan, EQ, compressor, mute, multi-track mixing, RenderPlan, export, and history semantics remain unchanged.
- Waveform data is display-only in this slice; waveform selection, editing, region manipulation, and persistent peak caching remain deferred.
- Required validation after implementation: `npm run lint`; `npm run test`; `npm run build`; `cd src-tauri && cargo test`; `cd ..`; `npm run tauri dev`.
- Keep PR draft until the full local validation suite and focused waveform checks are reported clean.

## M3.54 — Audio Volume Automation Timeline UX — in progress — 2026-09-21

- M3.53 Audio Clip Volume Automation is complete and PR #67 was squash-merged at `fafe6e183ba4eb350db0f1b9873861d9c5543689`.
- M3.54 adds Timeline UX for persisted audio volume automation keyframes.
- Audio clips expose volume automation markers with accessible timestamp/percentage labels.
- Markers select the owning clip, seek the playhead, support direct drag with existing timeline snapping, constrain movement between neighboring keyframes, and commit once on release.
- Focused audio volume keyframes support Delete/Backspace removal, Arrow nudging by one frame, Shift+Arrow nudging by 500 ms, and Escape cancellation of active drags.
- Keyframe movement persists through the existing project/history path and preserves each keyframe's volume value.
- Existing audio track volume, pan, mute, clip fades, EQ, compressor, preview, RenderPlan, FFmpeg automation, and transform keyframe UX remain unchanged.
- Required validation after implementation: `npm run lint`; `npm run test`; `npm run build`; `cd src-tauri && cargo test`; `cd ..`; `npm run tauri dev`.
- Keep PR draft until the full local validation suite and focused Timeline automation checks are reported clean.

## M3.53 — Audio Clip Volume Automation — in progress — 2026-09-21

- M3.52 Audio Clip Dynamics Compressor is complete and PR #66 was squash-merged at `da0b5dc957be094738ac4e657007523f8684fdd8`.
- M3.53 adds backward-compatible per-audio-clip volume automation keyframes.
- Scope: local clip-time volume keyframes, linear interpolation, selected-audio Inspector editing at the playhead, split preservation, Web Audio preview application, RenderPlan propagation, and native FFmpeg frame-evaluated volume envelopes.
- The automation is independent from Audio track volume; effective preview/export gain is the track volume multiplied by the clip automation envelope and existing fade gain.
- Existing EQ, compressor, pan, mute, fades, multi-track mixing, and history behavior remain unchanged.
- Timeline keyframe marker/drag UX is intentionally deferred to a follow-up slice after the model, commands, preview, and export path are validated.
- Required validation after implementation: `npm run lint`; `npm run test`; `npm run build`; `cd src-tauri && cargo test`; `cd ..`; `npm run tauri dev`.
- Keep PR #67 draft until the full local validation and focused audio automation checks are reported clean.

## M3.52 — Audio Clip Dynamics Compressor — merged — 2026-09-21

- M3.52 is complete and PR #66 was squash-merged at `da0b5dc957be094738ac4e657007523f8684fdd8`.
- Added backward-compatible clip-level dynamics compressor state, Inspector controls, Web Audio preview, RenderPlan propagation, and native FFmpeg `acompressor` export.
- Added regression coverage across domain, commands, RenderPlan, audio graph, and App workflow.
- User approved continuation with pass after the final validation corrections.
- Known non-blocking React act() and jsdom media-play warnings remain.

## M3.51 — Audio Clip 3-Band EQ — merged — 2026-09-21

- M3.51 is complete and PR #65 was squash-merged at `52844a8c5f1a1f0605e6c9508d87c52c90ead7de`.
- Added backward-compatible per-audio-clip three-band EQ state with Low/Mid/High gains from -12 dB to +12 dB and an enabled flag.
- Added validated project/history updateAudioClipEq() command and selected-audio Inspector controls.
- Added best-effort Web Audio low-shelf, peaking, and high-shelf preview processing.
- Propagated audio EQ through RenderPlan and native FFmpeg audio rendering.
- Added regression coverage across domain normalization, commands, RenderPlan, audio graph, and App workflow.
- User approved M3.51 after the final local validation cycle.
- Known non-blocking test-environment warnings remain around React act() and jsdom HTMLMediaElement.play().
- Next milestone: M3.52 — Audio Clip Dynamics Compressor.

## M3.51 Audio Clip 3-Band EQ — implementation checkpoint — 2026-09-21

- M3.50 Export Progress and Cancellation is complete and PR #64 was squash-merged at e239c4b355d64c62a090067ad1aaaa80cefe9f55.
- M3.51 starts from the verified M3.50 main state and adds a backward-compatible per-audio-clip three-band EQ.
- Audio EQ uses Low/Mid/High gain controls with a normalized range of -12 dB to +12 dB and a persisted enabled flag.
- Audio EQ is intentionally clip-level so existing Audio track volume, pan, mute, fade, multi-track mix, and export sequencing remain independent.
- Preview uses a best-effort Web Audio chain of low-shelf, peaking, and high-shelf filters before the existing stereo pan stage.
- RenderPlan carries normalized EQ metadata; the native FFmpeg audio graph applies matching three-band equalizer filters before clip fades and timeline delay.
- The selected-audio Inspector exposes an Enable EQ toggle and Low/Mid/High gain editors through the existing project/history command path.
- Added regression coverage across domain normalization, command validation/persistence, RenderPlan propagation, FFmpeg graph compilation, and App Inspector workflow.
- Local validation is still required before marking M3.51 ready.

## M3.50 merge reconciliation — 2026-09-21

- PR #64 Export Progress and Cancellation was marked ready after user validation and squash-merged.
- Merge SHA: e239c4b355d64c62a090067ad1aaaa80cefe9f55.
- User validation passed npm lint, 285/285 frontend tests, the production build, and then the post-fix Rust/Tauri validation after the HashSet cancellation cleanup correction.
- Known non-blocking React `act(...)` and jsdom `HTMLMediaElement.play()` warnings remain test-environment noise.
- M3.50 export progress and cancellation is now part of main.

## M3.49 merge reconciliation and M3.50 kickoff — 2026-09-21

- M3.49 Audio Track Pan Control is complete and PR #63 was squash-merged.
- M3.49 merge SHA: 7fbb75a222bcccfc92cb2ee211e1df0db9748233.
- User approved M3.49 continuation with pass after local validation.
- Reported M3.49 validation before approval: lint passed; 28 Vitest files passed with 279/279 tests; production build passed after the final import/fixture corrections; Rust tests passed 28/28; Tauri dev launched successfully.
- M3.50 starts from the verified M3.49 merge and focuses on export progress streaming and cancellation.
- Native FFmpeg export processes now expose progress events keyed by export job ID.
- A Tauri cancellation command terminates the active FFmpeg process and also handles cancellation requested between sequential render stages.
- Export progress remains monotonic in the frontend; two-stage video-plus-audio exports map video to 80% and final audio mixing to the remaining 20%.
- ExportPanel now shows a progress bar and Cancel export control, with a cancelled terminal state.
- Deferred: full audio effects/EQ/compression stack, audio automation, waveform editing.
- M3.50 local validation was completed before merge.

## M3.49 validation correction — test declaration restoration — 2026-09-21

- The first local validation exposed three parser errors in test files introduced while adding M3.49 coverage.
- Root cause: inserting new test blocks replaced the existing it/describe declaration lines while leaving their bodies in place.
- Restored the declarations in domain.test.ts, commands.test.ts, and render-plan.test.ts.
- Production M3.49 code was not changed by this correction.

## M3.49 Audio Track Pan Control — implementation checkpoint — 2026-09-21

- M3.49 adds backward-compatible pan state to Audio tracks with a centered 0 default and normalized range -1 to +1.
- Added validated updateTrackPan() command using the existing App -> history path.
- Timeline exposes compact per-track Pan control alongside Volume.
- Preview applies pan through a best-effort Web Audio StereoPannerNode when the runtime supports AudioContext.
- RenderPlan carries trackPan and the native FFmpeg audio graph applies a constant-power stereo balance before clip fades and timeline delay.
- Existing mute, volume, fade, trim, multi-track mix, and project schema behavior remain unchanged.
- Deferred: full audio effects/EQ/compression stack, automation, waveform editing, render progress/cancellation.

## M3.48 test assertion correction — 2026-09-21

- The multi-track regression fixture now gives Track 0 a 0–2 second source range and Track 1 a 1–3 second source range.
- Assertions now match the deterministic compiler ordering: trackIndex 0 -> input 0, trackIndex 1 -> input 1.
- The test also verifies source-path order and per-track timeline delay to guard against accidental input reordering.
- No production audio graph behavior changed in this correction.

## M3.48 validation correction — 2026-09-21

- User validation reached 268/269 tests with build and Rust green.
- The lint failure came from the inherited M3.46 AudioFadeInspector setState-in-effect pattern on the M3.48 baseline.
- Reused the stable ref-based Inspector draft synchronization already established for M3.47, preserving transient edit state without synchronous setState calls in an effect.
- The sole M3.48 audio graph test failure was a fixture assertion mismatch: the second track still inherited a 1000–3000 ms source range while the test expected 0–2000 ms. The fixture now explicitly uses sourceStartMs=0 and sourceEndMs=2000.

## M3.48 Multiple Audio Track Mix — implementation checkpoint — 2026-09-21

- M3.48 extends the deterministic audio RenderPlan compiler to accept multiple independent Audio tracks.
- Audio clips from separate Audio tracks are normalized, trimmed, volume-scaled, fade-processed, timeline-delayed, and mixed into the same [aout] project bus.
- Audio track ordering is deterministic by RenderPlan track index and then clip timeline position.
- Existing mute, track volume, clip fades, trim, and timeline placement semantics remain unchanged.
- The native Tauri audio/video mix boundary already accepts multiple audio input paths, so no new native command contract is introduced.
- A backward-compatible compileSingleAudioTrackGraph alias remains available while export switches to compileAudioTracksGraph.
- Deferred: audio effects/EQ/compression, keyframed automation, render progress/cancellation, waveform editing.

## M3.46 merge reconciliation — 2026-09-21

- M3.46 Audio Clip Fades is complete and PR #59 was squash-merged.
- Merge SHA: 76d0a1cadd9ae7ab31d471f46c4d6cb9ddba0b40.
- The milestone adds backward-compatible audio fade-in/fade-out clip state, command validation, trim/split preservation, Inspector editing, preview gain envelopes, RenderPlan propagation, and FFmpeg afade stages.
- The final Inspector correction uses controlled transient draft values so adjacent fade edits remain stable during React rerenders; persisted values still flow exclusively through project history and updateAudioClipFades().
- User approved M3.46 with pass after receiving the branch patch.
- The latest reported validation before approval had lint/build/Rust/Tauri successful; the deterministic App fade test was corrected afterward and the user approved continuation.
- Known non-blocking test-environment warnings remain around HTMLMediaElement.play() and React act() handling.
- Deferred: audio effects, multiple independent Audio tracks, keyframed audio automation, render progress, and cancellation.
- Next milestone: M3.47 — Timeline Audio Fade Handles.
## M3.46 Inspector fade draft-state correction — 2026-09-21

- The previous per-input React-key fix did not pass the user's fresh validation run: the suite remained at 268/269 with the same Fade out Inspector failure.
- Root cause after that validation: the two Inspector fields were still uncontrolled `defaultValue` inputs whose persisted project rerenders could overwrite the effective edit flow. The UI needed an explicit ephemeral draft representation separate from persisted project state.
- Fix: introduced a small `AudioFadeInspector` UI component with controlled draft strings for the two inputs. The draft state is synchronized from the selected clip's persisted fade values after project changes, while commits still go through `handleUpdateSelectedAudioFades()` and the existing history command.
- This does not create a second project state model: persisted fade values remain owned by the project/history layer; the component only owns transient text currently being edited.
- Regression coverage now also asserts that the Fade out input receives the requested 1500 ms value immediately after its change event before blur/commit.
- User validation before this correction: lint completed; production build completed; Rust tests 28/28 passed; Tauri dev launched; Vitest remained 268/269.
- Fresh validation is required after this correction.
## M3.46 Inspector fade edit fix — 2026-09-21

- Root cause: the Audio fades Inspector placed a React key derived from both fade values on the shared two-input grid. Committing one fade changed that key and remounted both inputs, which detached the sibling input before its pending edit could be committed.
- Fix: removed the shared grid key and applied synchronization keys to the individual Fade in and Fade out inputs. A committed field can now resync itself without remounting the sibling field.
- Regression coverage: the App workflow test now explicitly verifies that the Fade out input remains mounted after the Fade in blur and still accepts its 1500 ms edit.
- Validation status: source-level reconciliation and targeted code review are complete. This connector environment cannot execute the repository npm/Cargo/Tauri commands, so local validation remains pending.
## M3.46 validation correction — 2026-09-21

- User local validation of PR #59 exposed test-only/import issues plus one deliberately incorrect domain expectation.
- `src/features/timeline/commands.test.ts` was missing the `updateAudioClipFades` import, causing five command-test failures and corresponding TypeScript errors.
- The domain normalization test expected 2999 ms, while the implemented non-overlap rule correctly clamps a 4000 ms requested fade-out to 3000 ms after a 2000 ms fade-in on a 5000 ms clip.
- These issues are corrected on the M3.46 branch.
- The same run reported three Vitest worker timeouts/unhandled worker errors after the test failures; because the core deterministic failures are now fixed, a fresh full test run is required before attributing those timeouts to the implementation.
- Rust tests remained green at 28/28 and `tauri dev` launched successfully in the reported run.
- Local validation remains pending.

## M3.46 implementation checkpoint — 2026-09-21

- Branch: feat/m3-46-audio-clip-fades.
- M3.45 and correction PR #58 are complete; latest correction merge is 6f06f473b2a552cc04233ff4ada5c6bba07b7274.
- M3.46 adds backward-compatible per-audio-clip fade-in/fade-out state.
- Audio fades are edited in the selected audio clip Inspector; the Timeline track volume control remains independent.
- Preview applies the fade envelope to the native HTMLAudioElement using clip-local timeline position.
- RenderPlan carries audio fade durations, and the FFmpeg audio graph applies afade filters before timeline delay/mixing.
- Locked tracks, visual clips, invalid durations, and overlapping fade ranges are rejected by the project command boundary.
- Split/trim paths clamp or preserve fade semantics to avoid invalid durations.
- Multiple independent Audio tracks, audio effects, automation, render progress, and cancellation remain deferred.
- Local validation is pending user verification.

## M3.45 correction merge reconciliation — 2026-09-21

- M3.45 correction PR #58 (fix/m3-45-audio-volume-slider-visibility) was marked ready after user validation and squash-merged.
- Correction merge SHA: 6f06f473b2a552cc04233ff4ada5c6bba07b7274.
- The correction wires the volume callback through Timeline -> TimelineTrack and widens the track label column so the Audio-track volume slider is visible.
- Preview volume is assigned directly to the native HTMLAudioElement and synchronized when track volume changes.
- Existing audio graph coverage now includes the explicit default volume stage.
- M3.45 is now complete with both the original feature and the visibility/wiring correction merged.
- Deferred items remain: audio fades/effects, multiple independent Audio tracks, and render progress/cancellation.

## M3.45 merge reconciliation — 2026-09-21

- Current milestone: M3.45 — Audio Track Volume Control.
- PR #57 (feat/m3-45-audio-track-volume) was marked ready after user local validation and squash-merged.
- M3.45 merge SHA: 9ce1bcf1c7a8729f62c65121274029d960eccddb.
- User local validation report: npm run lint passed; Vitest passed with 253/253 tests across 28 test files; npm run build completed successfully; Rust tests passed 28/28; npm run tauri dev launched successfully.
- The initial git pull --ff-only origin feat/m3-45-audio-track-volume step did not fast-forward because the local branch had diverged. This was a repository synchronization issue only; the subsequent validation suite completed successfully.
- M3.45 adds backward-compatible per-track volume state with a 1.0 default, a validated update command, an Audio-track Timeline slider, preview volume application, RenderPlan propagation, and FFmpeg graph volume application.
- Existing mute behavior remains separate from continuous volume.
- Audio fades/effects, multiple independent Audio tracks, and render progress/cancellation remain deferred.
- M3.46 must be based on the verified post-M3.45 main state rather than stale local branch history.

## M3.44 implementation checkpoint — 2026-09-21

- Branch: `feat/m3-44-project-audio-mix`.
- M3.43 is complete and provides a dedicated native audio-graph boundary.
- M3.44 connects an explicit Audio track to complete project export.
- The existing video renderer remains responsible for the base video and embedded video-clip audio.
- The compiled Audio track is mixed into that base audio in a final native FFmpeg pass.
- When the base video has no audio, native mixing supplies project-duration stereo silence before mixing.
- Single-source and sequential multi-segment video rendering paths remain unchanged.
- User approved M3.44 after local validation.
- PR #56 was squash-merged at `33c36f19735df4967b149e1c16d60e88f1ccf4a4`.
- Audio effects, multiple Audio tracks, and progress/cancellation remain deferred.

## M3.43 implementation checkpoint — 2026-09-21

- Branch: `feat/m3-43-native-audio-render`.
- M3.42 is complete at merge SHA `5c338d0462206d88e6e258b8e433afe2ce897c43`.
- M3.43 added a dedicated native Tauri audio-graph render command.
- The command validates absolute audio inputs, MP4 output, non-empty filter graph, and the fixed `[aout]` map.
- FFmpeg execution uses structured process arguments rather than shell interpolation.
- Output is encoded as AAC stereo 48 kHz in an MP4 container.
- The compiler/native bridge use dense local audio input indices so filter references match the native input list.
- User approved M3.43 after local validation.
- PR #54 was squash-merged at `fff690250c1e0ffafe2aae41e09d8ef91be65daa`.
- Full project A/V audio composition remains the next focused slice.

## M3.42 implementation checkpoint — 2026-09-21

- Branch: `feat/m3-42-audio-track-graph`.
- M3.41 is complete at merge SHA `0cfaba472aa57b0606252c82fd15c998775ad6db`.
- M3.42 adds a pure audio filter-graph compilation layer on top of the existing RenderPlan.
- The first slice handles one explicit Audio track, source trimming, timeline delay, stereo 48 kHz normalization, project-duration silence, and track mute.
- The compiler emits a dedicated `[aout]` map but does not invoke FFmpeg yet.
- Embedded audio from video clips is intentionally left for the native mixing slice because source audio availability must be probed at runtime.
- Multiple audio tracks, audio effects/transitions, and progress/cancellation remain deferred.
- Local validation passed before merge.

## M3.41 implementation checkpoint — 2026-09-21

- Branch: `feat/m3-41-multisegment-audio`.
- M3.40 is complete at merge SHA `4d9e15a27dda3c5d5d42f18c2161a9a3d6a6b415`.
- M3.41 adds synchronized audio to the native multi-segment sequential renderer.
- Each temporary segment is normalized to one video stream and one AAC audio stream so concat demuxing has a stable stream layout.
- Clips with source audio use the first source audio stream; clips without audio get generated silence.
- Timeline gaps use black video and generated silence.
- This remains sequential one-video-track composition; independent Audio Track mixing is a later milestone.
- Local validation passed before merge.

## M3.37 implementation checkpoint — 2026-09-21

- Branch: `feat/m3-37-native-render-graph-wiring`.
- The milestone wires the existing deterministic `compileSingleVideoTrackGraph()` output into the native Tauri/FFmpeg execution boundary.
- `src-tauri/src/lib.rs` now accepts multiple absolute video inputs, a generated `filter_complex`, the fixed `[vout]` output map, output dimensions, and frame rate.
- FFmpeg paths and graph text are passed as structured `Command` arguments; no shell command interpolation is introduced.
- `src/features/export/export-renderer.ts` exposes the native graph-render invoke boundary.
- `src/features/export/render-pipeline.ts` connects `RenderPlan → compileSingleVideoTrackGraph() → renderVideoGraphToMp4()`.
- M3.37 keeps the graph video-only and does not yet attach ExportPanel, job progress, cancellation, audio mixing, multi-track compositing, images, transforms, crops, keyframes, or transitions.
- Regression coverage covers the native argument contract, Tauri invoke bridge, and the RenderPlan-to-native pipeline adapter.
- Local validation is pending user verification.

## M3.36 merge reconciliation — 2026-09-21

- Current `main`: `3b0f3b2f0c5a54ee821fcda1f2a98a611145e814`.
- M3.36 — FFmpeg video filter graph, PR #47, squash-merged at `3b0f3b2f0c5a54ee821fcda1f2a98a611145e814`.
- User confirmed the corrected M3.36 local validation passed.
- The graph compiler remains pure TypeScript and the native renderer remains a separate Tauri boundary.
- M3.37 is the next focused slice: wire the compiled graph into native FFmpeg execution.

## M3.36 implementation checkpoint — 2026-09-21

- `compileSingleVideoTrackGraph()` is the first filter-graph compiler layered on top of `RenderPlan`.
- Each video segment becomes a trim/setpts/scale/pad/fps/setsar chain.
- Timeline gaps are represented with generated black color sources and joined through FFmpeg concat.
- The compiler deliberately handles only one video track with video assets and no audio/mutable/transform/transition semantics yet.
- This keeps the graph deterministic and testable before wiring it into the native render command.
- Next graph layer: connect the compiled filter graph to the native renderer and then add audio/video composition as separate focused slices.

## M3.35 implementation checkpoint — 2026-09-21

- `src/features/export/render-plan.ts` is the first project-to-render compilation boundary.
- The compiler is intentionally pure TypeScript: it does not invoke FFmpeg and does not mutate project/history state.
- Render segments retain the timeline/source correspondence required by a later FFmpeg filter graph.
- Multiple video/audio tracks are represented as separate segments; ordering follows project track order and each track's timeline order.
- Gaps remain explicit through segment timestamps rather than being silently collapsed.
- Visual transforms, crops, keyframes, transitions, and track mute metadata are preserved but not yet converted into FFmpeg filters.
- Deferred next layer: translate RenderPlan into an actual FFmpeg filter graph and connect it to the native renderer boundary.

## M3.34 implementation checkpoint — 2026-09-21

- `src-tauri/src/lib.rs` now exposes `render_single_source_to_mp4`.
- Native validation rejects non-video sources, non-absolute/non-MP4 outputs, missing output directories, invalid dimensions, and invalid frame rates.
- Native output uses FFmpeg directly via `Command::new("ffmpeg")`, preserving paths as individual process arguments rather than a shell string.
- Current render primitive is intentionally single-source and does not interpret timeline clips, transforms, crops, transitions, mute state, or layered audio.
- `src/features/export/export-renderer.ts` provides the frontend invoke boundary for the future render-job orchestration layer.
- Deferred: project-level render graph, timeline compositing, transition rendering, audio mixing, progress events, cancellation, and UI wiring for a long-running render.

## Current live reconciliation — M3.34 — 2026-09-21

- Current `main`: `a6c40943d2673d3688e218d1d45d79e828b5f39a`.
- M3.33 — Export destination and render-job boundary is merged as PR #44 at `a6c40943d2673d3688e218d1d45d79e828b5f39a`.
- User confirmed M3.33 validation and the PR was squash-merged.
- Active work: M3.34 — native FFmpeg render invocation boundary.
- The repository already invokes FFmpeg natively for preview generation in `src-tauri/src/lib.rs`; M3.34 should reuse that native execution approach rather than introduce a second runtime.
- M3.34 target: expose a narrowly scoped Tauri render command that receives a validated export request, constructs FFmpeg arguments without shell interpolation, and returns a controlled success/error result.
- The full timeline render graph, compositing, audio/video muxing policy, streaming progress, cancellation, and long-running job orchestration remain separate slices.

## M3.33 validation correction — 2026-09-21

- User local validation: lint passed; the full test suite executed with 215/215 tests passing, but the ExportPanel suite failed to initialize because its Vitest mock referenced a hoisted module value before initialization.
- The failure is isolated to the test mock setup, not export behavior. `ExportPanel.test.tsx` now creates the mocked `chooseExportOutputPath` with `vi.hoisted`.
- Build completed successfully and `tauri dev` launched successfully in the same local run.
- Fresh local test rerun is required after the test-only correction.

## M3.33 — Export destination and render-job boundary — 2026-09-21

- Active branch: `feat/m3-33-export-destination-job-boundary`.
- `src/features/export/export-dialog.ts` wraps the existing Tauri save dialog for MP4 output destination selection.
- `ExportPanel` now stores and displays the selected destination path. Selecting a destination does not mutate project/history state.
- `src/features/export/export-job.ts` defines an explicit renderer-agnostic job contract and deterministic state helpers.
- The current Export button remains disabled because no renderer is connected yet; this avoids claiming successful export before FFmpeg integration exists.
- Regression coverage was added for output selection UI and export-job state transitions.
- Deferred: native render invocation, render graph, compositing, audio/video muxing, progress transport, cancellation, and result/error delivery.

## Current live reconciliation — M3.33 — 2026-09-21

- Current `main`: `c81df8e7b0901a54c08b19dba2f5df3ee6a63adf`.
- M3.32 — Export settings foundation is merged as PR #43 at `c81df8e7b0901a54c08b19dba2f5df3ee6a63adf`.
- User approved M3.32 with `pass`; no additional product-code changes were required after the final assertion corrections.
- Active work: M3.33 — Export destination and render-job boundary.
- M3.33 will add native output-file selection using the existing Tauri dialog plugin and define a small render-job request/status/result contract that the UI can use.
- Full FFmpeg render graph, timeline compositing, audio/video muxing, progress streaming, cancellation, and renderer optimization remain separate follow-up slices.

## M3.32 validation correction — 2026-09-21

The first M3.32 local validation run showed the export implementation building and launching successfully. Test failures were limited to two assertions: the default 1080×1920 project correctly produces an even 406×720 720p target, and the filename is an input value. The tests were corrected without changing export behavior. Fresh local validation is still required.

## Live state reconciliation — M3.32 — 2026-09-21

- Current `main`: `3a2a77aca9b30779870e16863fe709661cd02f3e`.
- M3.31 — Playback smoothness / render-throttle is merged as PR #42 at `3a2a77aca9b30779870e16863fe709661cd02f3e`.
- User confirmed the M3.31 validation pass before merge.
- Historical PR #22 remains open as a stale draft and is not active.
- Active branch: `feat/m3-32-export-settings`.
- M3.32 establishes the first export workflow boundary: export settings are explicit UI/domain data, separate from project history, while actual rendering remains a future pipeline milestone.
- `src/features/export/export.ts` owns export settings defaults, normalization, standard quality dimension calculation, and filename sanitization.
- `src/features/export/ExportPanel.tsx` provides the current Export Settings UI and derives source/1080p/720p output dimensions from the project canvas aspect ratio.
- App toolbar and Workspace Export navigation now open the Export Settings panel.
- MP4/H.264 is the current renderer target, but no render job, output file selection, or FFmpeg invocation is introduced in this milestone.
- Regression coverage covers the pure export model, panel behavior, and App workflow.
- M3.32 local validation is pending user verification.
- Deferred: actual FFmpeg render graph, output path selection, export progress/cancel, render-job lifecycle, audio/video muxing validation, and render-result handling.

## M3.31 validation correction — 2026-09-21

The first M3.31 local validation run reached the full suite: 18 test files passed, with one failure in the newly added App playback-throttle regression because `addAssetToTimeline` was not imported in `App.test.tsx`. The production build reported the same missing symbol. Lint passed and Tauri dev launched. The regression test import was corrected in commit `a9e1b5111a1338fd758186969114eee2ab624612`; fresh validation is still required.

## Live state reconciliation — M3.31 — 2026-09-21

- Current `main` tip: `dedeeccf309238b483e38d041d4928b23227f0a1`.
- M3.30 — Transition Browser / Picker is merged as PR #41 at `dedeeccf309238b483e38d041d4928b23227f0a1`.
- User confirmed the M3.30 validation pass before merge.
- Historical PR #22 remains open as a stale draft and is not active.
- Active branch: `feat/m3-31-playback-smoothness`.
- M3.31 addresses the newly observed playback stutter by reducing React UI-clock publication frequency during playback while leaving the internal playback clock at animation-frame cadence.
- This is a performance-focused vertical slice: no changes to transition state, media preparation, FFmpeg, project history, or native playback APIs.
- `src/features/playback/playback.ts` owns the UI-publish interval decision so the behavior is deterministic and testable.
- `src/App.tsx` advances `playbackTimeRef` every animation frame but publishes `currentTimeMs` to React only when the configured interval has elapsed, with an immediate final publish at the timeline end.
- Added playback helper and App integration regression coverage.
- M3.31 local validation is pending user verification.
- Deferred after this slice: deeper media-clock synchronization, decode/render profiling, compositor virtualization, GPU acceleration, and broader performance architecture changes unless measurements show they are required.

## Live state reconciliation — M3.30 — 2026-09-21

- Current main after M3.29: 1aa5dee0da89a0f80357ad294273025164254a90.
- M3.29 PR #40 was squash-merged after the user's clean local validation report.
- Active branch: feat/m3-30-transition-browser.
- M3.30 adds a focused transition browser/picker for the existing transition types: None, Dissolve, and Fade through black.
- The picker is presentation-only and reuses the existing TransitionInspector onChange contract and history-backed updateClipTransition flow.
- Existing transition duration editing remains unchanged.
- Existing select control remains available as an accessibility/keyboard fallback; no second transition state model is introduced.
- Regression coverage was added in src/features/transition/TransitionInspector.test.tsx.
- M3.30 local validation is pending user verification.
- The environment could not execute the repository locally because direct GitHub cloning failed on DNS resolution, so no automated result is being claimed.
- Deferred items remain: richer draggable transition placement UX, transition browser with thumbnails, audio transitions, custom transition profiles, and responsive workspace redesign unless a future focused milestone explicitly requires them.

## Live state reconciliation — 2026-09-21

Verified repository state:
- main: 468d1d3f0bbcbe28028b547097e5a8810564c5e8
- Latest merged milestone: M3.28 — Transition lifecycle integrity
- PR #39 merge SHA: 2e77190ef6474b3ede1ad72af0682a9c5bfb7c61
- Older checkpoint SHA 7d9400634c0f9a4650212110b938a17e0fa685da is stale and superseded by live GitHub state.
- User reports the latest local validation run completed without errors. This is user-reported; exact local command output and local HEAD were not independently observed.
- Open PR #22 is a stale draft for preserving keyframe easing during marker movement and is not active project work.
- No M3.29 branch was present before this work.

## M3.29 — Fade through black transition — in progress

Branch: feat/m3-29-fade-through-black-transition

Scope:
Add one additional visual transition type while reusing the current transition model, history engine, preview compositor, Inspector, and Timeline interaction model.

Implementation:
- Add fade-through-black to ClipTransition.
- Preserve transition type during normalization and adjacency sanitization.
- Add shared transition visual-state calculation with dissolve and fade-through-black behavior.
- Render a black midpoint overlay in the existing Preview layer stack.
- Generalize transition type labels and Timeline duration editing.
- Cover command, math, preview, Timeline, and App Inspector regressions.

Architecture:
- Project/history mutations still use the existing updateClipTransition path.
- Playback transport remains independent from history.
- Transition interaction state remains transient UI state and is committed once at gesture completion.
- The fade overlay is local to the incoming transition preview layer's existing stacking context instead of introducing a parallel compositor/state system.

Validation:
- M3.28 baseline: user-reported clean latest validation.
- M3.29: pending user local validation.

Known limitations:
- Dissolve and Fade through black are the only transition types.
- Transitions still require directly adjacent visual clips.
- Transition browser, richer placement UX, audio transitions, and custom transition profiles remain deferred.

Next step:
- User validates M3.29 branch before the draft PR is marked ready and merged.

# FrameFlow Project Context

## Purpose

FrameFlow is a Linux-native desktop video editor inspired by the workflow and usability of modern editors such as CapCut, but implemented as a real Linux desktop application without Wine.

The project is being built incrementally. Every milestone must be small, testable, reversible, and documented before the next milestone starts.

## Repository

- GitHub: https://github.com/fakedevbagus/FrameFlow
- Current default branch: `main`
- Current `main` tip at this continuity checkpoint: `7d9400634c0f9a4650212110b938a17e0fa685da` (`docs: clarify M3.28 local validation status`).
- M3.25 was merged as PR #36 with merge SHA `01c90688fe4256278fe7dc1f94c1c94463e6eb6e`.
- M3.26 was merged as PR #37 with merge SHA `74ebee88b79b99fe9be7c2b8cd641cb28194a7ae`.
- M3.27 was merged as PR #38 with merge SHA `9eb1512e733e47ab84d37fdbddfe30e24856a2e0`.
- M3.28 was merged as PR #39 with merge SHA `2e77190ef6474b3ede1ad72af0682a9c5bfb7c61`.
- M3.13 was merged as PR #23 with merge SHA `595f7498e503aab19052279979fb389ae8300691`.
- M3.14 was merged as PR #24 with merge SHA `838c5a8dad7ce4214b8e8d4d85084d7e2fd50379`.
- M3.15 was merged as PR #25 with merge SHA `69c2b5edee8e4ea5e5d530c2402e0c9ce7281abc`.
- M3.16 was merged as PR #26 with merge SHA `cb61fb6277d8b800f30978098ba5abfaf2acc97f`.
- M3.17 was merged as PR #27 with merge SHA `dd4333deccc420bfe07dd68f05c2cb49ae865bdb`.
- M3.18 was merged as PR #28 with merge SHA `f59553d3e7192bae2a00741acfa5177da94e94eb`.
- M3.19 was merged as PR #29 with merge SHA `549b1423e365ed11116a14b1005aa5a38f7b35ad`.
- M3.20 was merged as PR #30 with merge SHA `8c366b12e6320fe8844096b0c8fda75234de4b61`.
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

## Current continuity checkpoint — 2026-09-21

Canonical current state:
- Repository: `fakedevbagus/FrameFlow`.
- Default branch: `main`.
- Current `main` tip: `7d9400634c0f9a4650212110b938a17e0fa685da`.
- M3.25, M3.26, M3.27, and M3.28 are all present on `main).
- M3.28 PR #39 is merged with SHA `2e77190ef6474b3ede1ad72af0682a9c5bfb7c61`.
- No M3.29 implementation has been started or approved in the repository at this checkpoint.
- The old M3.28 feature branch still exists, but it is historical and must not be used as the base for new work.

Validation truth:
- M3.27 was explicitly validated locally by the user before merge.
- M3.28 was merged remotely after follow-up fixes to reported lint/test/build issues.
- The latest local log available to this project history was captured before those follow-up fixes: it showed one lint error (`prefer-const`), two failing lifecycle tests, and two TypeScript build errors; Tauri dev nevertheless launched successfully. Do not treat that old failing log as the current state of `main`, but also do not treat the remote merge as proof of fresh local validation.
- This chat has no separate user report confirming a post-fix local M3.28 validation run.
- Therefore the current M3.28 local-validation status is: **not confirmed in this chat**.

Working-tree safety:
- The latest local log showed user-modified `src-tauri/Cargo.lock` and `src-tauri/Cargo.toml`. Preserve those changes; never use a blanket reset that destroys unrelated local work.

Continuity protocol:
- A new chat must read `docs/SESSION_HANDOFF.md` first, then verify `docs/PROJECT_CONTEXT.md`, `docs/CHANGELOG.md`, current `main`, and open PRs before making code changes.
- Never infer the latest milestone from model memory or from a stale pasted log.
- Never mark local validation as passed merely because a PR was merged.
- At the end of every meaningful milestone, update `docs/SESSION_HANDOFF.md`, `docs/PROJECT_CONTEXT.md`, and `docs/CHANGELOG.md` with the exact branch, PR, merge SHA, validation state, and next step.
- When a new chat starts, produce a concise state report first. Only then continue implementation from the verified state.

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
15. For cross-chat continuity, read `docs/SESSION_HANDOFF.md` before continuing work; use `docs/NEW_CHAT_PROMPT.md` as the reusable continuation prompt.

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

Canvas behavior:

- The project canvas supports selectable aspect-ratio presets in the editor toolbar: 16:9, 9:16, 1:1, 4:5, and 4:3.
- Canvas preset changes are committed through the existing history engine and preserve frame rate, tracks, clips, and normalized transform/crop state.
- The preview viewport derives its displayed aspect ratio from project.canvas, so landscape/square/portrait projects render with matching framing instead of a hardcoded 9:16 canvas.
- The preview canvas is fitted from the measured available stage region using ResizeObserver (with a window-resize fallback), so its width and height always respect the current viewport while preserving the project aspect ratio.
- Custom canvas dimensions loaded from a project remain displayable and are shown as Custom in the preset selector.


Visual clips may contain:

- static transform
- optional transform keyframes
- transform keyframe easing metadata
- optional transform anchor point
- optional per-edge crop insets
- optional crop content-position source point

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

## M3.16 — Crop foundation — completed

Branch: `feat/m3-16-crop-foundation`
PR: #26
Merge SHA: `cb61fb6277d8b800f30978098ba5abfaf2acc97f`

Scope delivered:
- Added a backward-compatible per-clip crop model with zero-crop as the default.
- Added Top, Right, Bottom, and Left crop controls to the Transform Inspector.
- Applied crop in the preview using media-element clipping.
- Kept crop edits inside the existing project history engine and separate from transform keyframes for this milestone.
- Preserved crop state across clip splitting.
- Added transform-domain, timeline-command, preview, and App regression coverage.

Architecture decisions:
- Crop is represented as normalized per-edge insets (0..1) on the clip.
- Horizontal and vertical crop totals must remain below 1 so the entire visual content cannot be removed.
- Crop is applied before the existing clip transform effect on the media element, leaving transform handles available outside the clipped media.
- Legacy clips without crop data render with zero crop.

Validation:
- User confirmed local validation succeeded after the unused `getClipCrop` import in `src/features/timeline/commands.ts` was removed.
- User confirmed the lint, test, build, Tauri dev, and requested manual crop checks passed locally on Linux.
- The automated test suite had already reported 17 test files and 136 tests passing before the final lint/build correction.

Known limitation:
- Direct crop-handle manipulation, aspect-ratio presets, and crop-position translation compensation remain future work.

Next step:
- Start the next focused transform-interaction milestone from updated `main`, prioritizing direct crop-handle manipulation while preserving the current history and transform architecture.

## M3.17 — Direct crop handle manipulation — completed

Branch: `feat/m3-17-direct-crop-handles`
PR: #27
Merge SHA: `dd4333deccc420bfe07dd68f05c2cb49ae865bdb`

Scope delivered:
- Added direct Top, Right, Bottom, and Left crop handles to the selected visual preview.
- Converted pointer coordinates through the active transform and anchor so crop editing targets the underlying media content.
- Added live crop feedback during pointer movement.
- Committed a single crop history operation on pointer release.
- Preserved existing Inspector crop editing, transform controls, keyframes, playback behavior, and split preservation.

Architecture decisions:
- Crop remains stored as normalized per-edge insets on the existing `Clip.crop` model.
- Direct crop math lives in `src/features/preview/canvasManipulation.ts`.
- Crop handles are rendered as an interaction overlay.
- Crop commits continue through the existing App history engine and `updateClipCrop` command.

Automated coverage:
- Direct crop pointer mapping without transform.
- Crop mapping through scale, rotation, translation, and non-center anchor.
- Protection against removing all visible content.
- Preview crop-handle interaction.
- App crop history and Undo workflow.

Validation:
- User confirmed local lint, test, build, Tauri dev, and the requested M3.17 manual crop-handle checks passed on Linux.

Known limitation:
- Aspect-ratio crop presets and crop-position translation compensation remain future work.

Next step:
- Start M3.18 with crop-position translation compensation so changing the crop can optionally preserve the visible content position.

## M3.18 — Crop position and translation compensation — completed

Branch: `feat/m3-18-crop-position-compensation`
PR: #28
Merge SHA: `f59553d3e7192bae2a00741acfa5177da94e94eb`

Scope delivered:
- Added a backward-compatible per-clip crop content-position model.
- Kept legacy clips without `cropPosition` aligned to the existing crop window by deriving the source point from the crop insets.
- Added Crop position X/Y controls and a Center content action to the Inspector.
- Reworked preview crop rendering to use a fixed crop viewport with separately positioned media content.
- Kept crop-position mutations inside the existing project history engine.
- Cleared stored crop position when crop is fully reset.

Architecture decisions:
- `Clip.cropPosition` stores the normalized source point (0..1) aligned to the center of the crop viewport.
- Missing `cropPosition` is interpreted from the existing crop window center, preserving legacy M3.16/M3.17 visual behavior.
- Crop clipping is represented by a fixed viewport wrapper; the media element is positioned inside that viewport.
- Existing transform/keyframe behavior remains owned by the outer content layer and is not mixed with crop-position history.

Automated coverage added or updated:
- Crop-position derivation, normalization, and command behavior.
- Clearing stored crop position on crop reset.
- Preview crop viewport dimensions and explicit source-content positioning.
- App-level Crop position X/Y and Center content workflow.
- Regression assertions updated for the post-M3.18 preview DOM structure.

Validation:
- User confirmed local lint, test, build, Tauri dev, and requested M3.18 manual checks passed on Linux.
- User also confirmed the follow-up regression fixes passed validation before this milestone was merged.

Known limitation:
- Direct crop-content panning with pointer dragging and aspect-ratio crop presets remain future work.

Next step:
- Start M3.20 from the updated `main`, focusing on aspect-ratio crop presets while preserving crop, transform, anchor, keyframe, and history behavior.

## M3.19 — Direct crop-content panning — completed

Branch: `feat/m3-19-direct-crop-content-panning`
PR: #29
Merge SHA: `549b1423e365ed11116a14b1005aa5a38f7b35ad`

Scope delivered:
- Added direct pointer panning for source content inside the fixed M3.18 crop viewport.
- Kept the crop viewport fixed while changing the source point aligned to its center.
- Accounted for the active transform scale, rotation, translation, and anchor during pointer mapping.
- Constrained crop content movement so the crop viewport remains fully covered by source content.
- Committed one crop-position history operation per completed pan gesture.
- Preserved existing canvas move behavior for uncropped visuals and existing crop edge/transform handles.

Interaction design:
- A selected visual with non-zero crop exposes a transparent pan surface inside the crop viewport while playback is stopped.
- Dragging inside that surface changes `Clip.cropPosition`; crop edge handles continue to edit `Clip.crop`.
- Uncropped visuals do not enable the pan surface, so their existing canvas move interaction is unchanged.

Architecture decisions:
- Direct crop-content panning reuses the existing transformed pointer-to-content mapping rather than introducing a parallel coordinate system.
- The source point is clamped to the mathematically valid range for the current crop viewport, preventing uncovered gaps at the viewport edges.
- Pan gestures update live UI state but create a single history mutation on pointer release through the existing crop-position command.

Automated coverage added:
- Crop-content pointer math and directionality.
- Crop-position bounds while panning.
- Transform-aware pan mapping.
- Preview direct pan gesture.
- App direct pan workflow, Inspector synchronization, and Undo history.

Validation:
- User confirmed the M3.19 local validation passed on Linux after the final crop-pan regression fixture correction.
- The final App-level regression fixture uses both top and right crop so horizontal crop-position movement is mathematically available; the test also verifies Undo restores the prior crop position.

Known limitations:
- Aspect-ratio crop presets remain future work.
- Crop position remains per-clip and is not keyframed in this milestone.

Next step:
- Start M3.20 from the updated `main`, focusing on aspect-ratio crop presets while preserving the current crop viewport, crop-position, transform/anchor, keyframe, and history architecture.

## M3.20 — Aspect-ratio crop presets and responsive canvas — completed

Branch: `feat/m3-20-crop-aspect-presets`
PR: #30
Merge SHA: `8c366b12e6320fe8844096b0c8fda75234de4b61`

Scope delivered:
- Added common crop aspect-ratio presets: Original, 16:9, 9:16, 1:1, 4:5, and 4:3.
- Derived normalized crop insets from intrinsic video/image dimensions.
- Preserved the current crop-content source position when possible and clamped it when the target viewport required a valid source range.
- Treated Original as a full crop reset and cleared stored crop position.
- Committed crop and crop-position changes as one history mutation.
- Preserved direct crop handles, direct crop-content panning, transform/anchor behavior, keyframes, playback, and multi-layer preview behavior.
- Added project canvas aspect-ratio presets: 16:9, 9:16, 1:1, 4:5, and 4:3.
- Made the preview canvas follow the project canvas aspect ratio instead of a fixed 9:16 presentation.
- Fitted the preview canvas to the measured available editor space and prevented document-level fullscreen scrolling by keeping side-panel scrolling internal.

Architecture decisions:
- Crop aspect-ratio math remains in `src/features/transform/transform.ts`.
- Crop preset edits use the atomic `updateClipCropWithPosition` command and the existing history engine.
- Canvas aspect-ratio changes use `updateCanvasDimensions` and remain project-history mutations.
- Preview media elements expose clip identity and intrinsic dimensions through the existing DOM/media path.
- The preview canvas uses a dedicated measured stage region with ResizeObserver and a window-resize fallback while preserving the project's aspect ratio.
- Custom canvas dimensions loaded from a project remain representable as `Custom` in the canvas selector.

Automated coverage:
- Crop preset catalogue and crop-ratio math.
- Crop-position preservation and clamping.
- Original reset behavior.
- Atomic crop + crop-position command behavior.
- Canvas dimension command validation.
- App/Inspector crop preset workflow and Undo.
- App canvas aspect-ratio workflow, preview framing, and Undo.

Validation:
- User confirmed the M3.20 local validation passed on Linux.
- The validation sequence reached lint success, 17 test files / 161 tests passing, and successful Tauri dev startup during the final validation cycle. The production build required follow-up CSS corrections before the user confirmed the milestone passed.

Known limitations:
- Crop position remains per-clip and is not keyframed.
- Crop presets are fixed common ratios; custom user-entered crop ratios are deferred.
- Canvas presets use fixed common output dimensions; arbitrary custom canvas editing is not yet exposed in the UI.

Next step:
- Continue with the next focused transform milestone from the updated `main`.

## M3.21 — Transform anchor compensation — completed

Branch: `feat/m3-21-anchor-compensation`
PR: #32
Merge SHA: `0da298e3f5c047e13c7c43c7ac391ba31f33a181`

Scope delivered:
- Preserved the rendered visual position when changing a visual clip's transform anchor.
- Compensated X/Y translation using the anchor delta, active transform scale/rotation, and the intrinsic media bounds after fit-to-canvas.
- Applied equivalent compensation to all transform keyframes.
- Kept anchor changes inside the existing history engine as one mutation.
- Fell back to the existing anchor command when intrinsic media dimensions are not available yet.

Architecture decisions:
- Compensation math lives in `src/features/transform/transform.ts` as a pure domain helper.
- The timeline command performs the atomic anchor + transform/keyframe update.
- The UI derives contained media bounds with the existing `getContainedContentPercentageBounds` helper.
- No second preview transform pipeline was introduced.

Automated coverage:
- Anchor compensation math for scale and rotation.
- Command-level compensation and history timestamp behavior.
- Compensation across transform keyframes.
- App-level anchor change workflow with intrinsic media dimensions and Undo.

Validation:
- User confirmed the M3.21 local validation passed on Linux.
- The final validation cycle reported lint success, 17 test files / 161 tests passing, successful production build after the final CSS corrections, and successful Tauri dev startup.

Known limitation:
- Changing anchor before intrinsic media metadata is available uses the legacy anchor command and may not preserve the rendered position.

Next step:
- Start M3.22 from the updated `main`, focusing on direct on-canvas anchor manipulation.

## M3.22 — Direct on-canvas anchor manipulation — completed

Branch: `feat/m3-22-direct-anchor-manipulation`
PR: #33
Merge SHA: `0dcae3d91fd298b36b99393921601e34a0e217c0`

Scope delivered:
- Added a visible transform-anchor handle to selected visual preview layers.
- Added direct pointer dragging for the transform anchor.
- Resolved pointer coordinates into transformed content space.
- Preserved the rendered visual position during live anchor movement using M3.21 compensation.
- Committed completed anchor changes through the existing compensated anchor history command as one project/history mutation.
- Preserved the Inspector anchor grid as the precision control.
- Preserved existing crop, transform, keyframe, playback, and multi-layer preview architecture.

Architecture decisions:
- Pointer-to-anchor mapping lives in `src/features/preview/canvasManipulation.ts`.
- Live anchor transforms reuse `compensateTransformForAnchorChange`; no parallel transform pipeline was introduced.
- Intrinsic media dimensions are reported from Preview to editor state and cached in a synchronous ref so anchor compensation uses current dimensions even before the next React render.
- The existing timeline anchor-compensation command remains the single history commit path.
- The direct anchor handle is rendered inside the transformed content layer so it tracks the actual pivot location.

Automated coverage:
- Pointer-to-anchor mapping without and with scale/rotation.
- Preview direct anchor-drag commit.
- App-level direct anchor drag, compensation, media-dimension readiness, and Undo.
- Full suite validation completed at 169 tests.

Validation:
- User confirmed local validation passed on Linux after the final anchor-compensation regression assertion correction.
- `npm run lint` passed.
- `npm run test` passed with 17 test files / 169 tests.
- `npm run build` passed.
- `npm run tauri dev` started successfully.
- User also confirmed the requested manual anchor/transform/crop/keyframe/Undo checks passed.

Known limitations:
- Anchor dragging remains disabled while playback is active.
- If intrinsic media dimensions are unavailable, the existing fallback anchor command is used and rendered-position preservation may not apply.

UI/layout direction:
- The current workspace layout is intentionally kept stable while core editor behavior is being built and hardened.
- The preview canvas already follows the selected project aspect ratio, including portrait and landscape modes.
- A later dedicated responsive-workspace milestone should reflow the editor when the project is portrait/landscape, including moving/resizing the preview relative to the Inspector and timeline rather than introducing this large layout change inside a transform milestone.
- That responsive redesign is planned as a UX/layout phase after the core editing primitives are sufficiently stable.

Next step:
- Start M3.23 from the updated `main`, focusing on the next small transform/crop interaction hardening slice.


## M3.23 — Transform/crop interaction hardening — completed

Branch: `feat/m3-23-transform-crop-interaction-hardening`
PR: #34
Merge SHA: `e12a86d1041dfa9a67b962ec95fbdbf9340eba30`

Scope delivered:
- Added Escape cancellation for direct transform movement.
- Added Escape cancellation for direct transform-anchor dragging.
- Added Escape cancellation for crop-edge dragging.
- Added Escape cancellation for crop-content panning.
- Released pointer capture during cancellation.
- Kept cancellation out of project history by clearing live gesture state without invoking commit callbacks.
- Preserved normal completed gesture commit behavior.

Architecture decisions:
- Escape cancellation is owned by `PreviewVisualLayer`, where the direct manipulation state already lives.
- Cancellation changes only transient gesture state; it does not introduce a second history or transform pathway.
- Existing transform, anchor, crop, crop-position, and history commands remain unchanged.

Automated coverage:
- Escape cancellation for direct transform movement.
- Escape cancellation for direct anchor dragging.
- Escape cancellation for crop-edge dragging.
- Escape cancellation for crop-content panning.

Validation:
- User confirmed local validation passed on Linux.
- `npm run lint` passed.
- `npm run test` passed.
- `npm run build` passed.
- `npm run tauri dev` started successfully.
- User confirmed the manual cancellation and normal-commit checks passed.

UI/layout direction:
- No workspace reflow was introduced in this milestone.
- Portrait/landscape responsive workspace behavior remains planned as a dedicated UX/layout milestone.

Next step:
- Start the next focused editor feature from updated `main`, while preserving the current responsive-layout deferral.

## M3.28 — Transition lifecycle integrity — completed

Branch: `feat/m3-28-transition-lifecycle-integrity`
PR: #39
Merge SHA: `2e77190ef6474b3ede1ad72af0682a9c5bfb7c61`

Scope delivered:
- Added transition-pair normalization and edited-track sanitization helpers.
- Cleared stale transition metadata when move, remove, or trim operations break adjacency.
- Clamped an existing transition when trimming an adjacent clip reduces the available duration.
- Preserved an outgoing transition on the second split segment instead of duplicating it across both split segments.
- Scoped lifecycle sanitization to the edited track.
- Added regression coverage for transition cleanup across move, delete, trim-start, trim-end, and split operations.

Architecture decisions:
- Transition lifecycle integrity is enforced through existing timeline-edit commands and shared transition helpers rather than a second transition state manager.
- Sanitization is limited to the edited track to avoid unrelated project mutations.
- Existing history behavior remains the single mutation path for timeline edits.

Automated coverage:
- Transition cleanup after move, delete, incoming trim-start, outgoing trim-end, and split operations.
- Transition duration clamping after adjacent clip shortening.
- Preservation of the outgoing transition on the correct split segment.

Validation:
- Remote PR #39 was merged after follow-up fixes for the reported lint/build/test/fixture issues.
- Local post-fix validation is not confirmed in this chat yet.

Known limitations:
- Only dissolve transitions are supported.
- No transition browser, drag-and-drop transition placement, or audio transitions yet.
- Transition placement remains tied to directly adjacent clips.

Next step:
- Start the next focused editor milestone from updated `main`; verify current transition behavior before extending scope.

## M3.27 — Direct timeline transition-duration manipulation — completed

Branch: `feat/m3-27-direct-transition-duration`
PR: #38
Merge SHA: `9eb1512e733e47ab84d37fdbddfe30e24856a2e0`

Scope:
- Expose a draggable duration handle on the existing dissolve transition indicator.
- Preview the transition duration live while dragging.
- Commit one transition-duration history mutation on pointer release.
- Support Escape cancellation without creating history.
- Support ArrowLeft/ArrowRight duration nudging from the focused handle.
- Preserve the Inspector as the precise configuration surface.

Architecture decisions:
- Transition duration editing remains derived from the existing `ClipTransition` metadata.
- Timeline interaction owns only transient drag state; the project mutation still goes through the existing App/history update path.
- Duration is clamped to the existing dissolve bounds and both adjacent clip durations.
- No second transition model or preview pipeline is introduced.

Automated coverage:
- Pointer drag commits exactly one duration update.
- Escape cancels without a duration update.
- Keyboard nudge updates duration in 50 ms steps.

Validation:
- User confirmed local Linux validation passed.
- User confirmed lint, tests, build, Tauri dev, and the requested drag, Escape, keyboard, and Undo/Redo duration-editing checks passed.

Known limitations:
- Only dissolve transitions are supported.
- The duration handle is not a full draggable transition block with arbitrary transition placement.

Next step:
- Start M3.28 from the updated `main`, focusing on transition lifecycle integrity after timeline structure edits.

## M3.26 — Timeline transition indicator — completed

Branch: `feat/m3-26-transition-timeline-indicator`
PR: #37
Merge SHA: `74ebee88b79b99fe9be7c2b8cd641cb28194a7ae`

Scope:
- Show a compact transition indicator at the boundary of an active outgoing dissolve transition.
- Make the indicator keyboard accessible and clickable.
- Selecting the indicator selects the outgoing clip so the existing Inspector transition controls remain the single configuration surface.
- Keep the indicator derived from existing transition metadata and adjacency helpers; no second transition state is introduced.

Automated coverage:
- Timeline renders a dissolve indicator only for a valid adjacent visual transition.
- Indicator activation selects the outgoing clip.
- Existing timeline interaction behavior remains covered by the existing suite.

Validation:
- User confirmed local Linux validation passed.
- User confirmed lint, tests, build, Tauri dev, and the requested manual transition-indicator checks passed.

Known limitations:
- The indicator is not itself a draggable transition-duration control.
- Only dissolve transitions are represented.
- Transition configuration remains in the Inspector.

Next step:
- Start M3.27 from the updated `main`, focusing on direct timeline transition-duration manipulation.

## M3.25 — Dissolve transition foundation — completed

Branch: `feat/m3-25-dissolve-transition-foundation`
PR: #36
Merge SHA: `01c90688fe4256278fe7dc1f94c1c94463e6eb6e`

Scope:
- Add a clip-level outgoing transition model.
- Support a single `dissolve` transition between directly adjacent visual clips.
- Add transition duration controls with bounded duration normalization.
- Render outgoing/incoming visual layers with complementary dissolve opacity in preview.
- Expose transition configuration in the Inspector.
- Keep transition edits in the existing project history engine.

Architecture decisions:
- Transition metadata remains optional on `Clip` so existing projects without transition data remain compatible.
- The transition is attached to the outgoing clip and only activates when the next visual clip is directly adjacent on the same video track.
- Preview evaluation handles the transition without allowing timeline clip overlap; normal timeline overlap constraints remain unchanged.
- The first transition slice supports only `dissolve`; additional transition types remain future work.

Automated coverage:
- Transition normalization and adjacency helpers.
- Dissolve opacity interpolation.
- Transition command validation, creation, and removal.
- Preview layer activation during the dissolve window.
- Inspector workflow and history behavior at the App level.

Validation:
- User confirmed local validation passed on Linux.
- User confirmed the automated lint/test/build/Tauri validation passed.
- User confirmed the manual dissolve, duration, history, hard-cut, adjacency, and regression checks passed.

Known limitations:
- No transition browser or draggable transition blocks yet.
- No audio transitions.
- Transition configuration does not automatically repair itself when a clip is later moved away from adjacency.

Next step:
- Start the next focused transition UX milestone from updated `main`.

## M3.24 — Timeline clip interaction hardening (merged)

Branch: `feat/m3-24-timeline-interaction-hardening`
PR: #35 — merged
Merge SHA: `0c190a82a18e87bf56f2aea72a4d280265858ad5`

Scope:
- Allow Escape to cancel an active timeline clip move gesture.
- Allow Escape to cancel timeline trim-start and trim-end gestures.
- Release the active clip pointer capture when cancellation occurs.
- Keep cancellation out of project history.

Architecture decisions:
- Cancellation is owned by `Timeline`, where clip interaction state already lives.
- The timeline stores the current clip interaction target only for pointer-capture cleanup.
- Completed move/trim history callbacks remain unchanged.

Automated coverage:
- Escape cancellation for move, trim-start, and trim-end interactions.

Validation:
- User confirmed local validation passed.

Next step:
- Start the next focused editor feature from updated `main`.

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