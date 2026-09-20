# FrameFlow Changelog

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

### M3.17 — Direct crop handle manipulation — in progress
Branch: `feat/m3-17-direct-crop-handles`
PR: pending

Implemented:
- Added direct Top, Right, Bottom, and Left crop handles to selected visual preview layers.
- Added transformed pointer-to-content crop math so handles remain meaningful with scale, rotation, translation, and custom transform anchors.
- Added live crop preview during dragging.
- Kept the completed crop interaction as one history edit on pointer release.
- Preserved existing Inspector crop editing and transform/keyframe controls.

Automated coverage:
- Added direct crop pointer-math tests.
- Added Preview crop-handle interaction coverage.
- Added App-level crop history/Undo coverage.

Validation:
- Local lint, test, build, Tauri dev, and manual validation are pending user verification.

Known limitation:
- Aspect-ratio crop presets and crop-position translation compensation are not part of this milestone.

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
