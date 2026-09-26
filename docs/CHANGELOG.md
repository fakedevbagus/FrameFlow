### M3.126 — Strict Transition Clip Endpoint Safety — active — 2026-09-26

- Branch: `fix/m3-126-transition-endpoint-safety`.
- Fresh audit found `getClipEndMs()` still derived clip timeline endpoints with unchecked millisecond addition after M3.125 hardened timeline commands.
- Added checked safe-integer endpoint arithmetic to the transition clip-end helper.
- Transition adjacency and visual-state calculations retain existing behavior for valid safe values.
- Added focused regression coverage at `Number.MAX_SAFE_INTEGER` and the first unsafe endpoint.
- No project schema change.
- Implementation is complete; user local validation is pending.
- Next step: complete local validation before the standard PASS merge/reconciliation workflow.

### M3.125 — Strict Timeline Command Endpoint Safety — completed — 2026-09-26

- Branch: `fix/m3-125-timeline-command-endpoint-safety`.
- PR #140; squash-merged at `b0dea9912be36a961d61c9f3e57b44e6a27d6888`.
- Fresh audit found unchecked derived timeline endpoint arithmetic in add, move, trim-start, trim-end, split, overlap checking, and transition adjacency validation.
- Added one checked safe-integer timeline addition helper and applied it to the affected command-level endpoint calculations.
- Added focused regression coverage for unsafe derived endpoints across add, move, trim-start, trim-end, split, and overlap paths.
- No project schema change.
- User reported PASS.
- PR head `ab89f60ebb6eea3448c73f23ee6a765bf3762081` was verified before merge.
- `main` was verified after merge at `b0dea9912be36a961d61c9f3e57b44e6a27d6888`.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh audit from verified `main`.

### M3.124 — Strict Render-Plan Timeline Endpoint Safety — active — 2026-09-26

- Branch: `fix/m3-124-render-plan-safe-endpoints`.
- Fresh audit found that `createRenderPlan()` derives `timelineEndMs` by adding two safe millisecond values without checking whether the result remains a safe integer.
- Added checked endpoint arithmetic at the export render-plan boundary.
- Exact safe boundaries remain valid; unsafe derived endpoints are rejected.
- No project schema change.
- Implementation is complete; user local validation is pending.
- Next step: complete local validation before the standard PASS merge/reconciliation workflow.

### M3.124 — Strict Render-Plan Timeline Endpoint Safety — completed — 2026-09-26

- Branch: `fix/m3-124-render-plan-safe-endpoints`.
- PR #139; squash-merged at `4a1254dc80d3e9241c657a767d78eb60078424d4`.
- Fresh audit found that `createRenderPlan()` could derive an unsafe `timelineEndMs` by adding two individually safe millisecond values without checking the result.
- Added checked safe-integer arithmetic for render-plan source and timeline endpoints.
- Exact `Number.MAX_SAFE_INTEGER` endpoints remain valid; derived endpoints above the safe-integer range are rejected.
- Added focused regression coverage.
- No project schema change.
- User reported PASS.
- PR head `4fd7f0d7800948010eebeaae9e0d328fdaf4da20` was verified before merge and `main` was verified after merge at `4a1254dc80d3e9241c657a767d78eb60078424d4`.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh audit from verified `main` for the next focused runtime/persistence timeline arithmetic gap.

### M3.123 — Safe Integer Millisecond Contract — completed — 2026-09-26

- Branch: `fix/m3-123-safe-integer-milliseconds`.
- PR #138; squash-merged at `86eae9a70a5222948ac3d10d9bf5aedcb6a7506d`.
- Fresh audit found that persisted millisecond fields used `Number.isInteger` without requiring `Number.isSafeInteger`.
- Applied the safe-integer requirement to asset durations, clip timeline/source boundaries, Transform Keyframe times, Audio Volume Keyframe times, and audio fade durations.
- Added focused regression coverage.
- No project schema change.
- User reported PASS.
- `main` was verified after merge at `86eae9a70a5222948ac3d10d9bf5aedcb6a7506d`.
- Validation is recorded from the user's explicit PASS only; no additional local checks are inferred.
- Next step: fresh audit from verified `main`.

### M3.122 — Strict Single-Source Duration Semantics — completed — 2026-09-26

- Branch: `fix/m3-122-strict-single-source-duration-semantics`.
- PR #137; squash-merged at `c429f3a74bd012693170e29d3e3b3a81b495ddb7`.
- Fresh audit found that an explicitly supplied single-source duration of zero was silently ignored by FFmpeg argument construction.
- Tightened the shared native source-range validator so supplied durations must be positive.
- Omitted durations and positive durations retain their existing semantics.
- Added focused native regression coverage.
- No project schema change.
- User reported PASS.
- Validation status is recorded as passed only from the user's explicit PASS; no additional local checks are inferred.
- `main` was verified after merge at `c429f3a74bd012693170e29d3e3b3a81b495ddb7`.
- Next step: fresh audit from verified `main` for the next concrete persisted/runtime/native invariant.

### M3.121 — Strict Legacy Source-Range Bounds — completed — 2026-09-26

- Branch: `fix/m3-121-strict-legacy-source-bounds`.
- PR #136; squash-merged at `86ec5c5e4943a9b282aa97e9631b73fa0d9fb094`.
- Fresh audit found that the direct single-source and multi-segment native video export paths passed file-backed source ranges to FFmpeg without checking actual source duration.
- Added shared checked source-range validation for `render_single_source_to_mp4` and `render_video_segments_to_mp4`.
- Exact source-end boundaries remain valid; start/duration overruns and arithmetic overflow are rejected.
- Reused duration probes for repeated media paths in a multi-segment render and preserved black gap segments.
- Added focused native regression coverage.
- No project schema change.
- User reported PASS.
- Validation status is recorded as passed only from the user's explicit PASS; no additional local checks are inferred.
- `main` was verified after merge at `86ec5c5e4943a9b282aa97e9631b73fa0d9fb094`.
- Next step: fresh audit from verified `main` for the next concrete persisted/runtime/native invariant.

### M3.120 — Strict Source-Audio Media Duration Bounds — completed — 2026-09-26

- Branch: `fix/m3-120-source-audio-duration-bounds`.
- PR #135; squash-merged at `c0b1ee692156a2b7f11cf130ba79f65efad81dd0`.
- Fresh audit found that native unified AV source-audio segments were not checked against actual source media duration.
- Added duration probing, checked source-range validation, and source-duration caching by video input index before FFmpeg filter construction.
- Added regression coverage for exact boundaries, overruns, and arithmetic overflow.
- No project schema change.
- User reported PASS.
- Validation status is recorded as passed only from the user's explicit PASS; no additional local checks are inferred.
- `main` was verified after merge at `c0b1ee692156a2b7f11cf130ba79f65efad81dd0`.
- Next step: fresh audit from verified `main` for the next concrete persisted/runtime/native invariant.

### M3.119 — Strict Unified AV Source-Audio Segment Contract — completed — 2026-09-26

- Branch: `fix/m3-119-strict-unified-av-audio-segments`.
- PR #134; squash-merged at `91179b94d6b986e9c687ef768a23277088abfc28`.
- Fresh audit found that native unified AV source-audio segment metadata was only partially validated before FFmpeg filter construction.
- Added native range/precision checks for track volume/pan, fades, volume keyframes, EQ gains, and compressor parameters.
- Invalid values are now rejected instead of being silently clamped by filter-generation helpers.
- Added focused native regression coverage.
- No project schema change.
- User reported PASS.
- Validation status is recorded as passed only from the user's explicit PASS; no additional local checks are inferred.
- `main` was verified after merge.
- Next step: fresh audit from verified `main` for the next concrete persisted/runtime/native invariant.

### M3.118 — Strict Video Graph Input Media-Type Contract — completed — 2026-09-26

- Branch: `fix/m3-118-strict-video-graph-media-types`.
- PR #133; squash-merged at `6ef44fd0af0c000cd3a122bbcf99b32627514ba7`.
- Fresh audit found that native video-graph input media types were only count-checked even though FFmpeg argument construction uses them to decide image looping.
- Native video-graph media-type metadata now accepts only `video` or `image` when supplied.
- Native video-graph rendering now checks each supplied media-type declaration against the detected input file type before FFmpeg execution.
- Existing empty media-type compatibility behavior is preserved.
- Added focused native regression coverage.
- No project schema change.
- User reported PASS.
- Validation status is recorded as passed only from the user's explicit PASS; no additional local checks are inferred.
- `main` was verified after merge.
- Next step: fresh audit from verified `main` for the next concrete persisted/runtime/native invariant.

### M3.117 — Strict Export Settings Native Contract — completed — 2026-09-26

- Branch: `fix/m3-117-export-settings-native-contract`.
- PR #132; squash-merged at `51cc63f8a922cb0189c90d87027f845f3a722d35`.
- Fresh audit found that `normalizeExportSettings()` could preserve odd positive dimensions and frame rates above the native 240 FPS ceiling.
- Normalized positive dimensions are now canonicalized to even values with a minimum of 2.
- Export frame rates above 240 FPS now fall back to the validated project frame rate.
- Added focused export normalization regression coverage.
- No project schema change.
- User reported PASS.
- Validation status is recorded as passed only from the user's explicit PASS; no additional local checks are inferred.
- `main` was verified after merge.
- Next step: fresh audit from verified `main` for the next concrete persisted/runtime/native invariant.

### M3.116 — Strict Project Canvas Dimension Contract — completed — 2026-09-26

- Branch: `fix/m3-116-project-canvas-dimensions`.
- PR #131; squash-merged at `95f5268708f0250e3305d318410ccdbe47d54309`.
- Fresh audit found that persisted canvas width/height accepted any positive integer while native export requires positive even dimensions.
- Added strict positive-even integer validation for persisted canvas width/height.
- Tightened `updateCanvasDimensions()` to reject odd or sub-minimum dimensions before mutation.
- Added regression coverage for the minimum valid boundary and odd width/height.
- No project schema change.
- User reported PASS.
- Validation status is recorded as passed only from the user's explicit PASS; no additional local checks are inferred.
- `main` was verified after merge.
- Next step: fresh audit from verified `main` for the next concrete persisted/runtime invariant.

### M3.115 — Strict Project Canvas Frame-Rate Range — completed — 2026-09-26

- Branch: `fix/m3-115-project-framerate-range`.
- PR #130; squash-merged at `05a474a2525d51bf51099e4f335081728652b2e8`.
- Fresh audit found that persisted project canvas frame rates accepted any positive finite value while native export rejects values above 240 FPS.
- The project canvas frame rate is used as the default export frame rate, so values above 240 could create an export-invalid project state.
- Added a persisted upper bound of 240 FPS while preserving fractional rates such as 29.97.
- Added regression coverage for the 240 FPS boundary and values above it.
- No project schema change.
- User reported PASS.
- Validation status is recorded as passed only from the user's explicit PASS; no additional local checks are inferred.
- `main` was verified after merge.
- Next step: fresh audit from verified `main` for the next concrete persisted/runtime invariant.

### M3.114 — Canonical Clip Command Times — completed — 2026-09-26

- Branch: `fix/m3-114-canonical-clip-command-times`.
- PR #129; squash-merged at `be77ca4e2966f1ac65268b3886f64a9ade40c2e7`.
- Closed the command-boundary gap left by M3.101 for clip timeline/source timing.
- Canonicalized add, move, trim-start, trim-end, and split timing inputs before mutation.
- Split timing is normalized before deriving resulting clip boundaries and related keyframe/audio automation timing.
- Existing negative/non-finite/range/overlap/adjacency protections remain intact.
- Audio fade clamping remains aligned with canonicalized trim boundaries.
- Added regression coverage plus serialization checks for command-produced projects.
- No project schema change.
- User reported PASS.
- Validation status is recorded as passed only from the user's explicit PASS; no additional local checks are inferred.
- Next step: fresh audit from current `main` for the next concrete persisted/runtime invariant.

### M3.113 — Canonical Transform Keyframe Times — completed — 2026-09-25

- Branch: `fix/m3-113-canonical-transform-keyframe-times`.
- PR #128; squash-merged at `7672e1d9d603ab573178f3c908bd0807d0bfa4f1`.
- Transform keyframe timestamps are canonicalized to integer milliseconds for storage and lookup.
- Transform keyframe commands canonicalize add/update/move/easing/removal times.
- Persisted Transform Keyframe timestamps with fractional milliseconds are rejected.
- Runtime interpolation remains able to evaluate at fractional playback time between integer keyframes.
- Added regression coverage for normalization, command behavior, and persisted-value rejection.
- No project schema change and no media/preview/export contract change.
- User reported PASS.
- Next milestone: fresh audit from updated `main`.

### M3.112 — Canonical Text Overlay Position Precision — completed — 2026-09-25

- Branch: `fix/m3-112-canonical-text-overlay-position-precision`.
- PR #127; squash-merged at `fc5ce918cf5f73dce0bb0d6e57f0ea43329cf98f`.
- Text Overlay X/Y now use two-decimal canonical normalization after range clamping, matching the Inspector's integer-percent position input contract.
- Persisted Text Overlay X/Y values with more than two decimal places are rejected.
- Added regression coverage for runtime normalization, command behavior, and persisted-value rejection.
- No direct canvas Text Overlay positioning path was found during audit.
- No project schema change and no Preview/Export behavior change.
- User reported PASS.
- Next milestone: fresh audit from updated `main`.

### M3.111 — Strict Persisted Transform Rotation Range — completed — 2026-09-25

- Branch: `fix/m3-111-strict-transform-rotation-range`.
- PR #126; squash-merged at `eb7ab0fe11c0c279e7daf70c2e31317bf972394f`.
- Persisted Transform Rotation values are now restricted to `-180..180` degrees, matching the existing Inspector/runtime range.
- Added parser regression coverage for `181` and `-181`.
- User reported PASS.
- No project schema change.

### M3.110 — Canonical Transform Opacity Precision — completed — 2026-09-25

- Branch: `fix/m3-110-canonical-transform-opacity-precision`.
- PR #125; squash-merged at `40c0fd1df662754e814e7e658f9a56e0ce615b78`.
- Transform Opacity now uses two-decimal canonical normalization after range clamping.
- Persisted Transform Opacity values with more than two decimal places are rejected, including keyframe transforms.
- Added regression coverage for runtime normalization, command behavior, and persisted-value rejection.
- Existing Opacity range `0..1` remains unchanged.
- User reported PASS.
- No project schema change and no change to X/Y, Rotation, Crop, Preview, or Export contracts beyond canonicalizing Opacity.
- Next milestone: audit remaining persisted visual-transform precision and control normalization from updated `main`.

## M3.109 — Canonical Transform Scale Precision — completed — 2026-09-25

- Branch: `fix/m3-109-canonical-transform-scale-precision`.
- PR #124; squash-merged at `d7c31e4dcd9c0da664fd76c3de673bbd6d2fedcc`.
- Transform Scale now uses two-decimal canonical normalization after range clamping.
- Persisted Transform Scale values with more than two decimal places are rejected, including transform keyframe transforms.
- Existing Scale range `0.05..10` remains unchanged.
- Added regression coverage for runtime normalization, command behavior, and persisted-value rejection.
- User reported PASS.
- No project schema change and no change to X/Y, Rotation, Opacity, Crop, Preview, or Export contracts.
- Next milestone: M3.110 — audit remaining persisted visual-transform precision and control normalization.

### M3.108 — Canonical Track Volume/Pan Precision — completed — 2026-09-25

- Branch: `fix/m3-108-canonical-track-audio-precision`.
- PR #123; squash-merged at `317f09aa66f6f7e1196fdd6d8ce86e07fdd07cd8`.
- Track Volume/Pan now use shared two-decimal canonical normalization in getters and update commands.
- Persisted Track Volume/Pan values with more than two decimal places are rejected.
- Added regression coverage for getter normalization, command normalization, and persisted-value rejection.
- User reported PASS.
- No project schema change and no change to preview/export/media behavior beyond canonicalizing existing track controls.
- Next milestone: M3.109 — audit remaining persisted visual-transform precision and control normalization.

### M3.107 — Canonical Project Name Trimming — completed — 2026-09-25

- Branch: `fix/m3-107-canonical-project-name`.
- PR #122; squash-merged at `a66fdc25ad5eebcbdd2a5b70451c4a4ecaacdcea`.
- Persisted project `name` values now require an already-trimmed canonical form.
- Added parser regression coverage for leading/trailing whitespace.
- User reported PASS.
- No project schema change and no change to canonical runtime/editor/preview/export behavior.
- Next milestone: M3.108 — Canonical Track Volume/Pan Precision.

### M3.106 — Canonical Audio Volume Automation Precision — completed — 2026-09-25

- Branch: `fix/m3-106-canonical-audio-volume`.
- PR #121; squash-merged at `223856cd70bfaef8d149cc38860d9f9f86745672`.
- Persisted Audio Volume Automation keyframe `volume` values now require at most three decimal places.
- Added parser regression coverage for over-precise volume keyframe values.
- User reported PASS.
- No project schema version change and no change to canonical runtime/editor/preview/export behavior.

### M3.105 — Canonical Audio Compressor Precision — completed — 2026-09-25

- Branch: `fix/m3-105-canonical-audio-compressor`.
- PR #120; squash-merged at `6cc2a230ed351b44db8dc9551e58a17b1305ed94`.
- Persisted Audio Compressor threshold/ratio values now require at most one decimal place; attack/release values require at most two decimal places.
- Added parser regression coverage for all four over-precision cases.
- User reported PASS.
- No project schema version change and no change to canonical runtime/editor/preview/export behavior.

### M3.104 — Canonical Audio EQ Precision — completed — 2026-09-25

- Branch: `fix/m3-104-canonical-audio-eq`.
- PR #119; squash-merged at `c83479fec28f6403fedefad9add5ada8ddecfc30`.
- Persisted Audio EQ low/mid/high gains now require at most one decimal place.
- Added parser regression coverage for over-precise low, mid, and high gains.
- User reported PASS.
- No project schema version change and no change to canonical runtime/editor/preview/export behavior.

### M3.103 — Canonical Visual Effects Precision — completed — 2026-09-25

- Branch: `fix/m3-103-canonical-visual-effects`.
- PR #118; squash-merged at `c4ae88dc9cf1cde64a1f39672809b74bc25e266e`.
- Persisted visual-effect brightness/contrast/saturation values now require at most two decimal places.
- Added parser regression coverage.
- User reported PASS.
- No project schema version change and no change to canonical runtime/editor/preview/export behavior.

### M3.102 — Canonical Text Overlay Payload — completed — 2026-09-25

- Branch: `fix/m3-102-canonical-text-overlay`.
- PR #117; squash-merged at `834a8ee84367f79bc1cdf02ef1d75f13072aa928`.
- Persisted text overlay text must already be trimmed, x/y positions use at most three decimal places, and colors use lowercase six-digit hex notation.
- Added parser regression coverage.
- User reported PASS.
- No project schema version change and no change to canonical runtime/editor/preview/export behavior.

### M3.99 — Canonical Integer Audio Keyframe Times — completed — 2026-09-25

- Branch: `fix/m3-99-integer-audio-keyframe-times`.
- PR #114; merge SHA `2918b809edf39306e15fdf884ce11ae3558fee7f`.
- Persisted Audio Volume Automation keyframe `timeMs` values now require integer milliseconds.
- This matches the runtime normalizer, which rounds audio automation timestamps before ordering/deduplication.
- Added parser regression coverage for fractional persisted audio keyframe times.
- User reported PASS.
- No project schema version change and no change to canonical runtime/editor/preview/export behavior.

### M3.98 — Unique Native Project Save Temp Paths — completed — 2026-09-25

- Branch: `fix/m3-98-unique-project-save-temp`.
- PR #113; merge SHA `d3e93c9a3af3333fd2a2fd33baecf33a38f9fa74`.
- Native project save temp paths use process ID + atomic per-process counter.
- Added Rust regression coverage for temp-path uniqueness.
- User reported PASS.
- No project format or React-side persistence behavior change.

### M3.97 — Strict Persisted Transform Keyframe Payload — completed — 2026-09-25

- Branch: `fix/m3-97-strict-transform-keyframe-payload`.
- PR #112; merge SHA `3bca10042a369191a14e441acabc891a21a09135`.
- Persisted transform keyframes require a structured `transform` object.
- Added parser regressions for missing and null transform payloads.
- User reported PASS.
- No project schema, runtime/editor, preview, or export behavior change.

### M3.96 — Strict Persisted Keyframe Ordering — completed — 2026-09-25

- Branch: `fix/m3-96-strict-persisted-keyframe-order`.
- PR #111; merge SHA `95fba85c4eee193af70bb306e5a86535e0b601b1`.
- Persisted transform keyframes and Audio Volume Automation keyframes must use strictly increasing `timeMs` order.
- Duplicate timestamps remain rejected with their existing validation error.
- Added focused parser regression coverage for out-of-order persisted keyframes.
- User reported PASS.
- No project schema, runtime normalization, Timeline editing, preview, or export behavior change.

### M3.95 — Strict Project Timestamp Validation — completed — 2026-09-25

- Branch: `fix/m3-95-strict-project-timestamps`.
- PR #110; merge SHA `e775ef3eeab26ed4557303b723778748182b6488`.
- Persisted `createdAt`/`updatedAt` require canonical UTC ISO timestamps with millisecond precision.
- Persisted `updatedAt` must be the same as or later than `createdAt`.
- Added focused parser regression coverage.
- User reported PASS.
- No project schema, preview, timeline, playback, waveform, or export behavior change.

### M3.90 — Project Persistence Validation Hardening — completed — 2026-09-25

- Branch: `feat/m3-90-project-validation-hardening`.
- PR #105; merge SHA `c91efb620ddde050487bb11152ebf3c5d563b0d1`.
- Hardened the JSON parsing boundary for asset/track/clip identity, references, ranges, known source duration bounds, media/track compatibility, and persisted Audio Fade/EQ/Compressor/Volume Automation fields.
- Added regression coverage for valid media round-tripping and malformed persisted project cases.
- User reported PASS.
- No project schema, preview, timeline, export, or DSP behavior change.
- Follow-up gap addressed by M3.91: persisted visual payload fields now receive focused parser validation.

### M3.89 — Waveform Selection Lifecycle Hardening — completed — 2026-09-25

- Branch: `fix/m3-89-waveform-selection-lifecycle`.
- PR #104; merge SHA `fbdd60f45508c577046331255e024eea93b5960b`.
- Clears stale Timeline waveform selection when source path, source start/end, or clip duration changes.
- Added regression coverage for waveform selection followed by a source-end trim.
- User reported PASS.


### M3.86 — Waveform Trim-Range Alignment — completed — 2026-09-25

Branch: `feat/m3-86-waveform-trim-range-alignment`
PR #101
Merge SHA: `afd49629d25bef4f399f2886f494d97dc6e9abdd`

Implementation:
- Timeline waveform now follows the clip's actual source range after trim.
- Cached full-source peaks are cropped/resampled into the visible source range without a second FFmpeg decode.
- Behavior applies to explicit Audio clips and embedded-audio Video clips.
- Added waveform range/resampling regression coverage.
- User reported PASS.
- No project schema or export renderer change.

### M3.84 — Embedded Video Source-Audio Timeline Parity — completed — 2026-09-25

Branch: `feat/m3-84-video-source-audio-timeline-parity`
PR #99
Merge SHA: `01bf4c2301afc0bdba40d4afcae443d12d6079e0`

Implementation:
- Exposed existing Audio Fade regions/handles for Video-track Video clips.
- Reused pointer drag/cancel/release and keyboard nudge behavior.
- Kept Audio waveform rendering Audio-only and Image clips audio-free.
- Added Video fade-handle commit and Image exclusion regression coverage.
- User reported PASS.
- No project schema or export DSP change.

### M3.83 — Embedded Video Source-Audio Inspector Parity — completed — 2026-09-24

Branch: `feat/m3-83-video-source-audio-inspector-parity`
PR #98
Merge SHA: `5f52dfca80d3c453252c59dd1428a64b58be6d6c`

Implementation:
- Exposed shared Audio Fade/EQ/Compressor Inspector controls to embedded-audio Video clips.
- Extended existing commands to Video-track Video clips.
- Preserved Image exclusion, Audio-track behavior, validation, normalization, and history.
- Added command and App regression coverage.
- User reported PASS.
- No project schema change.


### M3.82 — Embedded Video Source-Audio Compressor Export — completed — 2026-09-24

Branch: `feat/m3-82-video-source-audio-compressor-export`
PR #97
Merge SHA: `2d4b1b7d180bb8fb8d334968a024a89adc9152c2`

Implementation:
- Extended the existing per-clip AudioCompressor path to embedded Video source audio.
- Enabled Video compression routes through unified AV export; disabled compression keeps fast paths.
- Native filtering reuses Audio-track compressor semantics and preserves processing order.
- Added RenderPlan, pipeline, mixed-payload, fast-path, and Rust regression coverage.
- User reported PASS.
- No project schema change.


### M3.81 — Embedded Video Source-Audio EQ Export — completed — 2026-09-24

Branch: `feat/m3-81-video-source-audio-eq-export`

PR #95; post-merge correction PR #96  
Merge SHAs: `eae0f97a52343c794c337200ce8f3808feab2800`, then `8a2c8c285dcbb8ddf9df640fc089673b37baa4fb`

Implementation:
- Extended RenderPlan/native/source-audio pipeline coverage for embedded Video clip EQ.
- Reused existing three-band EQ semantics and preserved existing processing order.
- PR #96 restored missing `audioEq` propagation into the unified source-audio payload and added a focused regression test.
- User reported PASS for the correction validation.
- No project schema change.

### M3.79 — Embedded Video Source-Audio Fade Export — completed — 2026-09-24

Branch: `feat/m3-79-video-source-audio-fade-export`
PR #93
Merge SHA: `eb6e43e9d923e63c92f258fa378d6936924f07e1`

Scope:
- Make exported embedded Video source audio honor the existing clip Fade In/Fade Out metadata consistently with Video preview.
- Preserve schema and existing Audio-track fade behavior.

Implementation:
- RenderPlan carries normalized Video fade durations for Video assets.
- Unified source-audio metadata carries non-zero Video fade durations.
- Video-only exports with active Video source-audio fades route through unified AV rendering instead of fast paths.
- Native source-audio filtering applies duration-clamped FFmpeg `afade` filters before timeline delay.
- Added RenderPlan, pipeline, and Rust regression coverage.

Validation:
- User reported PASS after local validation of M3.79, including embedded Video source-audio Fade In/Fade Out export checks.

Known limitations:
- Video source-audio EQ/compressor export remains future work.
- No project schema change.

### M3.78 — Embedded Video Audio Preview Consistency — completed — 2026-09-24

Branch: `feat/m3-78-video-source-audio-preview`
PR #92
Merge SHA: `bd583a3891c9acf68ab827e31469008ce1f8e015`

Scope:
- Make embedded audio played by Video clips honor the same audio controls already used by Audio-track preview/export.
- Preserve schema and existing export behavior.

Implementation:
- Generalized preview Web Audio routing to video media elements.
- Applied Track Volume, Track Pan, clip Volume Automation, and Fade gain to Video preview.
- Reused the existing EQ/compressor routing implementation without adding Video-specific controls.
- Re-ran Video audio routing when the prepared preview source URL becomes available.
- Added regression coverage for the combined Video embedded-audio gain path.

Validation:
- User reported PASS after local validation of the M3.78 embedded Video audio preview scope.

Known limitations:
- Export behavior for embedded Video source audio remains unchanged in M3.78.
- Video source-audio export fade handling is deferred to M3.79.
- Video source-audio export EQ/compressor remains future work.

### M3.77 — Per-Clip Volume Automation for Embedded Video Audio — completed — 2026-09-24

Branch: `feat/m3-77-video-clip-volume-automation`

Scope:
- Extend the existing clip-level Audio Volume Automation feature to Video clips with embedded source audio.
- Keep the project schema and existing automation model unchanged.

Implementation target:
- Expose the existing volume automation Inspector and Timeline keyframes for Video clips.
- Carry keyframes into source-audio render metadata.
- Apply the same normalized/interpolated volume curve in native FFmpeg.
- Route automated Video source audio through the unified graph path instead of fast paths that cannot represent clip automation.

Implementation completed in the branch:
- Extended the existing clip-volume automation workflow to embedded Video source audio.
- Added command, Timeline, App, render-plan, render-pipeline, and native regression coverage.
- Preserved the existing audio-track workflow and project schema.

Validation:
- User reported PASS after local validation of Video clip volume automation.
- PR #91 was marked ready and squash-merged at `f5ae54f3deb5b2ba265736aec1a2aefd951bfdb2`.
### M3.76 — Video-Only Embedded Source Audio — completed — 2026-09-24

Branch: `feat/m3-76-video-only-source-audio`

Scope:
- Preserve embedded Video source audio when a video-only project must use the native visual graph renderer.
- Reuse the existing M3.73 source-audio mechanism instead of introducing a second audio pipeline.
- Keep direct single-source and sequential-segment fast paths unchanged.

Implementation target:
- Route graph-required video-only plans through the unified AV native renderer.
- Use a generated silent base audio graph when no explicit Audio-track inputs exist.
- Preserve mute state and source/timeline timing through the existing source-audio metadata path.
- No project schema change.

Validation:
- User reported PASS after correcting the two stale local Rust fixture fields.
- Local validation showed lint passed, frontend tests passed 33/33 files and 400/400 tests, production build completed, and Tauri development startup succeeded.
- The Rust compilation issue was limited to stale local fixture fields not present on the M3.76 structs.
### M3.75 — Timeline Track Header Layout — completed — 2026-09-24

Branch: `fix/m3-75-timeline-track-header-layout`

Scope:
- Restore the canonical timeline ruler/track header width so the Video-track Volume/Pan controls are not compressed or clipped.
- Keep export, audio processing, and project schema unchanged.

Implementation:
- Corrected the later duplicate CSS override that reduced `.track` from 156px to 72px.
- Restored `.timeline-ruler` to the same 156px track-label column used by `.track`.
- No behavior or schema changes.

Validation:
- User confirmed the timeline header no longer appears cramped/clipped after M3.74 Video-track Volume/Pan controls were exposed.
- PR #89 was marked ready and squash-merged at `ca48be24adc4a12a6b7dcce89358b9eef3ecdc51`.

### M3.74 — Video Track Volume/Pan for Embedded Source Audio — completed — 2026-09-24

Branch: `feat/m3-74-source-audio-track-controls`
PR: Draft

Implemented:
- Exposed Volume/Pan controls on video tracks using the existing track update callbacks and history commands.
- Routed video-track Volume/Pan into unified source-audio export metadata.
- Applied clamped Volume and constant-power stereo Pan to embedded video source audio in native FFmpeg.
- Added Timeline, App, pipeline, and Rust regression coverage.
- No project schema change.

Validation:
- A follow-up local run exposed a parse failure in `commands.test.ts`; the branch copy had been accidentally truncated to a fragment. Restored the complete test file from `main` while retaining the M3.74 pan-test correction in commit `9ab4a029a1760eeee43bc347a0271516dad755df`.
- The earlier local rerun passed lint, production build, and all 43 Rust tests; Tauri development startup also completed successfully.
- Frontend tests reached 400/401 tests with one stale command test still expecting Video-track Pan to be rejected.
- The failing assertion was in the test named "rejects invalid pan values and non-audio tracks"; M3.74 intentionally permits Pan on Video tracks.
- Updated that stale test to validate invalid values and unknown tracks only. The existing positive Video-track Volume/Pan command coverage remains.
- User reported PASS after the corrected frontend test rerun and manual export verification. PR #88 was marked ready and squash-merged as a93ea6764dfb363304385f206e6a2e7204e39fe1.

Post-merge UI note:
- User reported that the Video-track Volume/Pan controls make the compact track header visually cramped/clipped in the current timeline layout. This is tracked as the next focused UI-fix milestone.

Next step:
- Rerun lint, frontend tests, production build, Rust tests, Tauri startup, and the manual export check.

### M3.73 — Preserve Source Audio in Unified AV Export — merged — 2026-09-24

Branch: `feat/m3-73-source-audio-unified-export`
PR #87
Merge SHA: `8c7292f1b4484c9a2156484c2d06f4980760c468`

Implemented:
- Preserved embedded audio from non-muted video clips on the unified AV export path.
- Trimmed and delayed source audio according to source and timeline placement.
- Mixed preserved source audio with explicit Audio-track output in one native FFmpeg invocation.
- Added regression coverage for source-audio routing and native FFmpeg graph construction.
- No project schema change.

Validation:
- User reported PASS for lint, all 397 frontend tests, production build, Rust tests, Tauri startup, and manual export verification.

Known limitation:
- Video-track volume and pan are not yet applied to preserved embedded source audio.

Next step:
- M3.74 — Preserve Video-Track Volume and Pan for Embedded Source Audio.

### M3.73 — validation correction — 2026-09-24

- User validation passed lint, 33/33 frontend test files, 397/397 frontend tests, and production build.
- Rust/Tauri failed on compile issues in the first implementation pass.
- Corrected duplicate serde attributes, missing unified-request test fields, the missing builder argument, and test-scope native type coverage in commit `66afae8ad3307bddebcf3ca320cee51c1c936913`.
- Fresh Rust/Tauri validation remains required.

### M3.73 — Preserve Source Audio in Unified AV Export — in progress — 2026-09-24

Branch: `feat/m3-73-source-audio-unified-export`
PR #87 — Draft

Scope:
- Preserve embedded audio from non-muted video clips when explicit Audio tracks use the unified AV export path.

Implemented:
- Added source-audio timing metadata to the unified render request.
- Rebased source-audio input indexes alongside the visual graph inputs.
- Native renderer probes referenced video inputs and preserves only inputs that actually contain audio.
- Source audio is trimmed to the clip source range, delayed to its timeline position, converted to the unified 48 kHz stereo format, and mixed with explicit Audio-track output.
- Added frontend and Rust regression coverage.
- No project schema change.

Validation:
- Pending user local validation.

Known limitations:
- Scope is limited to the unified AV path with explicit Audio tracks.
- Only source stream `a:0` is preserved.

Next step:
- User local validation and actual export verification.

### M3.72 — Multi-Track + Audio Export Integration — merged — 2026-09-24

Branch: `feat/m3-72-multitrack-audio-export`
PR #86
Merge SHA: `8aaae96d09bd7275c9171dc08cf89b74e1dd8e38`

Implemented:
- Removed obsolete audio-rejection guards from the visual graph compilers.
- Enabled multi-video-track visual graphs to coexist with explicit Audio track segments.
- Routed multi-video + explicit-audio projects through the M3.71 unified AV renderer in one native FFmpeg invocation.
- Preserved visual input rebasing and audio input offsetting.
- Added regression coverage for graph compilation and unified routing.
- No project schema change.

Validation:
- User reported PASS for the requested local lint, frontend tests, production build, Rust tests, and Tauri development startup.

Known limitation:
- Embedded source-audio preservation for graph-rendered visual clips remains deferred.

Next step:
- M3.73 — Preserve Source Audio in Unified AV Export.

## 2026-09-24 — M3.72 validation correction

- User validation passed lint, production build, 42/42 Rust tests, and Tauri development startup.
- Frontend tests reported 32/33 files and 395/396 tests passing; the sole failure was a stale assertion expecting `track_1_sequence` instead of the actual `track_2_sequence` in the test fixture's track ordering.
- Corrected only that regression assertion in commit `230dcf7c0d09e01319602c662bb3a50d33f1d320`.
- Fresh frontend validation is required before M3.72 can be marked PASS.

## 2026-09-24 — M3.72 Multi-Track + Audio Export Integration — implementation

Branch: `feat/m3-72-multitrack-audio-export`
PR: Draft

Implemented:
- Removed obsolete audio-rejection guards from the single- and multi-video-track visual graph compilers.
- Allowed the existing visual graph compiler to operate alongside explicit Audio track segments so M3.71 can combine both graphs in one native FFmpeg invocation.
- Added regression coverage for single-track graphs with audio, multi-track graphs with audio, and end-to-end multi-video + explicit-audio unified routing.
- Preserved input-index rebasing and audio-input offsetting from M3.71.
- No project schema change.

Validation:
- Pending user local validation.

## 2026-09-24 — M3.71 Unified AV Export Foundation — completed

Branch: `feat/m3-71-unified-av-export`
PR #85
Merge SHA: `3ae70e91ad5ff0dc2a11bcde59c32a39cab3ab89`

Implemented:
- Unified explicit Audio-track export with the visual FFmpeg graph in a single native invocation.
- Rebased visual input indexes and offset audio graph indexes.
- Preserved image-input handling and existing video-only fast paths.
- Added frontend and Rust regression coverage for routing, index rebasing, validation, input ordering, and FFmpeg argument construction.

Validation:
- User reported PASS after clean local validation.
- GitHub CI completed successfully for the validated M3.71 head.

## 2026-09-24 — M3.70 Text Overlay Export Rendering — completed

- PR #84 was user-validated and squash-merged at `c78f23e6108d557f1dd3b84c38f2650a609c76c3`.
- Final user validation passed 33/33 frontend test files and 393/393 frontend tests, plus production build and 39/39 Rust tests.
- M3.70 preserved the parked PR #76 boundary; Linux/Tauri/WebKitGTK repaint investigation remains separate.

## 2026-09-23 — M3.70 crop-order test correction

- User validation found one failing regression assertion in `render-graph.test.ts`.
- The failure was caused by the test expecting a 0.85 visible crop width, while the fixture uses left/right crop values of 0.1 each, producing a 0.8 visible width. The configured top/bottom crop values produce a 0.9 visible height.
- Corrected only the test assertion from `crop=w=trunc(iw*0.85):h=trunc(ih*0.9)` to `crop=w=trunc(iw*0.8):h=trunc(ih*0.9)`.
- Commit: `273dce5e8f0acc041b14fa462a48345c7e5ae3cb`.
- The same validation run had lint, production build, and all 39 Rust tests passing.
- Existing React `act(...)` warnings remain non-fatal.
- Fresh frontend test/build validation is required before M3.70 can be considered clean; PR #84 remains Draft.

## 2026-09-23 — M3.70 export coverage and resolution scaling

Branch: `feat/m3-70-text-overlay-export`
PR: #84 — Draft

Updated:
- Scaled rendered Text Overlay `fontSize` with the export canvas so lower export qualities preserve project-space visual scale.
- Added 720p RenderPlan regression coverage for text scaling.
- Strengthened drawtext escaping coverage with a real newline plus apostrophe, comma, colon, semicolon, backslash, and long-text limits.
- Added graph coverage for text on image clips.
- Added graph ordering coverage for effects → crop → text → transforms, including animated and anchor-aware transform paths.
- Added transition coverage for text across dissolve and fade-through-black.
- Corrected a crop assertion typo in the new ordering test.

Validation:
- These latest changes have not yet received a fresh user local PASS.
- Existing CI run #212 passed the earlier M3.70 head; a fresh CI run for the latest commits is required before treating the branch as cleanly validated.
- PR #84 remains Draft.

## 2026-09-23 — M3.70 validation correction

- The supplied local validation found one failing multi-track text-overlay regression assertion: the test expected `track_2_sequence`, while the generated graph correctly uses `track_1_sequence` for the second video track.
- Corrected the test expectation to match the actual project track index assigned by `addTrack("video")`.
- The failure was isolated to the test assertion; the same run showed the production build and all 39 Rust tests passing. fileciteturn1176file0L253-L271 fileciteturn1176file0L276-L287
- PR #84 remains Draft pending a clean rerun after this correction.

## 2026-09-23 — M3.70 Text Overlay Export Rendering — implementation

Branch: `feat/m3-70-text-overlay-export`

Implemented:
- Carried normalized per-clip text overlays into RenderPlan.
- Rendered text overlays through the existing FFmpeg drawtext graph using an explicit DejaVu Sans renderer font.
- Preserved normalized X/Y placement and left/center/right alignment.
- Escaped drawtext text delimiters and multiline content.
- Inserted text after visual effects/crop preparation and before transform stages.
- Routed text-bearing clips through the graph pipeline, including M3.69 multi-track visual compositing.
- Added renderer, RenderPlan, graph, pipeline, and multi-track regression tests.
- No project schema change.
- Parked PR #76 remains separate and unmerged because its Linux/WebKitGTK repaint investigation is not part of this milestone.

Validation:
- Pending user local validation and CI.
- PR remains Draft.


## 2026-09-23 — M3.69 merged / M3.70 started

- PR #83 was user-validated and squash-merged at `5bac39d156aae38f2ab3c6a61d3851e816535128`.
- GitHub CI run #207 completed successfully.
- M3.70 starts from the updated `main` and focuses on deterministic Text Overlay Export Rendering.
- Parked PR #76 remains separate because it contains both export work and the previously investigated Linux/Tauri/WebKitGTK Preview repaint issue; it will not be merged wholesale.

## 2026-09-23 — M3.69 Multi-Track Video Compositing Foundation — implementation

Branch: `feat/m3-69-multi-track-video-compositing`
PR: #83 — Draft

Implemented:
- Added multi-video-track graph compilation while preserving the existing single-track graph path.
- Composed tracks from lower to higher project track order onto a transparent project canvas.
- Kept per-track gaps and clip letterboxing transparent for correct layer compositing.
- Reused existing transform, crop/effects, anchor-aware transform, keyframe, and same-track transition compilation.
- Added stable per-track graph label namespaces.
- Preserved video-track mute semantics for the multi-track compositor.
- Corrected native `inputMediaTypes` ordering to match graph input order.
- No project schema change; audio mixing remains separate.

Validation:
- Pending user local validation and CI.
- PR will remain Draft.


## 2026-09-23 — M3.68 merged / M3.69 started

- PR #82 (M3.68 Non-Centered Transform Anchor Export) was marked ready and squash-merged at `ba34a0aed73f56b85217f0c4c9584299f4544ff8`.
- The final Inspector spacing refinement was included before merge.
- M3.69 starts from the updated `main` and focuses on multi-track video compositing in the existing visual FFmpeg graph.
- No project schema change is planned; audio mixing remains separate.

## 2026-09-23 — M3.68 Inspector layout validation correction

- The supplied Linux/Tauri screenshot showed the right-side Inspector content clipped at the panel edge, with form controls and quick-action UI extending beyond the visible width.
- Adjusted the workspace columns to give the Inspector a flexible 270–300px budget while retaining a 420px minimum central editor area.
- Hardened Inspector grid tracks and section containers with zeroable minimum widths so controls can shrink without horizontal overflow.
- Kept action buttons non-shrinking and summary/readout values allowed to wrap where necessary.
- No project schema, export graph, or editing behavior was changed.
- Fresh local validation remains required; PR #82 stays Draft until the user reports PASS.

## 2026-09-23 — M3.68 Inspector layout follow-up

- A second manual screenshot check showed the initial Inspector-width correction still allowed header actions and some Inspector controls to clip at the right edge.
- Increased the Inspector workspace allocation to a flexible 300–320px column and reduced the media column budget to 210–240px to preserve the central editor.
- Inspector section headers and action groups now wrap rather than forcing their parent section wider than the panel.
- Anchor headers receive the same wrapping behavior.
- No project schema or export behavior changed.
- Fresh local validation remains required; PR #82 stays Draft.

## 2026-09-23 — M3.68 Inspector spacing refinement

- Added a small extra right inset to the Inspector panel after the latest Linux screenshot showed the content was fixed but still visually too close to the application edge.
- This is a CSS-only visual refinement; no editor state, export graph, or project schema behavior changed.
- A fresh local validation is required after this final UI adjustment before M3.68 can be marked ready and merged.

## 2026-09-23 — M3.68 validation correction

- User validation found two unused locals in `render-graph.ts` and a stale pipeline test that still expected non-centered animated anchors to be rejected. fileciteturn920file0L24-L35 fileciteturn920file0L129-L140 fileciteturn920file0L263-L280
- Removed the unused locals and converted the stale rejection test to the still-deferred multi-track graph boundary.
- Simplified off-center anchor composition to place the selected pivot at the transparent surface center before rotation, matching the Preview transform-origin model more directly.
- Corrected transparent surface sizing so its side length covers twice the maximum pivot-to-corner radius.
- Narrowed pipeline graph routing so neutral visual-effects state does not unnecessarily bypass the direct renderer.
- Build and Rust tests were already passing in the supplied run; the remaining frontend failures are addressed by this correction. fileciteturn920file0L289-L305 fileciteturn920file0L305-L349
- PR #82 remains Draft until a fresh local validation reports PASS.

## 2026-09-23 — M3.68 Non-Centered Transform Anchor Export — implementation

Branch: `feat/m3-68-non-centered-transform-anchor-export`
PR #82 — Draft

Implemented:
- Added an anchor-aware FFmpeg composition path for non-centered static and animated transform scale/rotation.
- Preserved Preview transform semantics by keeping the anchor pivot fixed during scale/rotation and applying X/Y translation in world space.
- Preserved crop/effects ordering and image/video graph compatibility.
- Reused the existing animated keyframe expressions and easing model.
- Routed graph-required single-video metadata through the graph renderer so static transforms are not silently bypassed by direct/legacy native renderers.
- Added graph tests for static and animated off-center anchors and pipeline routing coverage.
- No project schema change.

Validation:
- Pending user local validation and CI.
- PR remains Draft.

## 2026-09-23 — M3.68 Non-Centered Transform Anchor Export — started

- M3.67 was completed after user PASS and squash-merged in PR #81 at `783885376209ec56013612147b217a13c8bf1ef7`.
- Repository audit after the merge shows non-centered transform anchors remain an explicit export limitation while the editor and Preview already support anchor-aware transform behavior.
- M3.68 will make static and animated export honor non-centered transform anchors using the existing transform model and crop/effects ordering, without a schema change.
- Validation must cover scaling and rotation around off-center pivots, animated keyframes, image/video inputs, and the existing centered-anchor regression path.
- PR #76 Text Overlay Export remains parked; multi-track compositing and audio mixing remain separate deferred work.

## 2026-09-23 — M3.67 Animated Transform Export — merged

- PR #81 was user-validated and squash-merged into `main` at `783885376209ec56013612147b217a13c8bf1ef7`.
- GitHub CI run #181 passed the frontend lint/tests, TypeScript/production build, and Rust tests on the final head.
- Added animated X/Y, Scale, Rotation, and Opacity export using deterministic FFmpeg expressions and the existing keyframe easing model.
- Animated clips now route through the graph renderer, with project-FPS normalization and transparent composition.
- Crop and visual effects remain before animated transforms; centered transform anchors remain the supported anchor boundary.
- No project schema change.
## 2026-09-23 — M3.67 Animated Transform Export — implementation
## 2026-09-23 — M3.67 validation correction
## 2026-09-23 — M3.67 final test fixture correction

- Latest user validation reached 373/374 frontend tests; the remaining failure was a stale assertion expecting the `2*(` term even though the test fixture only exercised ease-in and ease-out interpolation. fileciteturn836file0L139-L154 fileciteturn836file0L277-L299
- Updated the final animated-transform keyframe fixture to use ease-in-out, so the existing `2*(` assertion now verifies actual easing output instead of testing an absent condition.
- The same validation run passed production build, 39/39 Rust tests, and Tauri dev startup. fileciteturn836file0L302-L312 fileciteturn836file0L313-L370 fileciteturn836file0L372-L387
- PR #81 remains Draft until the user reruns the frontend test suite and reports PASS.


Branch: `feat/m3-67-animated-transform-export`
PR #81 — Draft

User-supplied validation exposed five stale/implementation-level failures before local acceptance:
- ESLint rejected the FFmpeg expression helper because the source used unnecessary JavaScript escapes; the helper was corrected to emit the intended literal `\\,` sequence.
- The render pipeline could still route an animated single video through the legacy single-source or segment renderer, bypassing the compiled animation graph; animated segments are now forced through the graph path.
- The old graph test still expected animated transforms to be rejected even though M3.67 implements them.
- The animated crop fixture expected `0.85` width while its left/right crop values produce `0.8` visible width.
- The old pipeline rejection test was updated to cover the still-supported failure boundary: non-centered animated transform anchors.

Validation status:
- The supplied run showed the frontend build and Rust tests passing, but the frontend lint/test suite was not green, so M3.67 remains unvalidated and PR #81 remains Draft.


Branch: `feat/m3-67-animated-transform-export`
PR #81 — Draft

Implemented:
- Added FFmpeg graph compilation for animated X/Y, Scale, Rotation, and Opacity keyframes.
- Reused the existing normalized keyframe model and easing semantics from Preview.
- Added project-frame-rate normalization before animated transform evaluation.
- Used time-based expressions for scale, rotation, and position plus a frame-index-based alpha expression for opacity.
- Preserved crop and visual-effects ordering before animated transforms.
- Kept centered transform-anchor export as the supported boundary; non-centered anchors remain explicitly deferred.
- Routed animated transform clips through the native graph renderer.
- Added render-graph and pipeline regression coverage.
- No project schema change.

Validation:
- User local validation of the M3.67 implementation is pending.
- CI validation is pending.
- PR #81 remains Draft.

## 2026-09-23 — M3.66 Transition Export — merged

- PR #80 was user-validated and squash-merged into `main` at `a3bf59055b76de1c485c8d410e2adb13862925d6`.
- CI run #171 passed on the final implementation head.
- Added dissolve and fade-through-black export while preserving timeline duration semantics and the existing single-video graph.
- M3.62 remains parked in PR #76.

## 2026-09-23 — M3.67 Animated Transform Export — started

- The next concrete export gap is transform keyframes, which already exist in the project model, timeline controls, interpolation helpers, and Preview.
- M3.67 will compile supported keyframed transform motion into the existing FFmpeg video graph without introducing a schema change.
- Non-centered transform anchors, multi-track compositing, audio mixing, and parked Text Overlay Export remain deferred.
- PR status will remain Draft until local validation is confirmed.

## 2026-09-23 — M3.66 transition guard correction

- CI frontend tests initially failed because the pre-M3.66 transition guard still rejected every transitionOut before the new graph compiler could run.
- Removed that stale guard in commit ea660dd9bc608e0a1de0858cd611e63cb0c94ea7.
- The failed run showed 368 existing tests passing plus the 4 new transition tests failing only at that stale guard; TypeScript and Rust compilation were not reached in that run.
- A fresh CI run is pending after the correction.

## 2026-09-23 — M3.66 Transition Export — implementation

Branch: `feat/m3-66-transition-export`
PR #80 — Draft

Implemented:
- Added FFmpeg graph compilation for the existing `dissolve` transition.
- Added FFmpeg graph compilation for the existing `fade-through-black` transition.
- Preserved timeline-duration semantics by assigning the transition window to the outgoing clip's final duration and starting the incoming clip from source time zero at its original boundary.
- Used a looped first incoming frame during the transition so Preview and export share the same first-frame transition semantics.
- Routed any transitioned video sequence through the native graph instead of the legacy sequential segment renderer.
- Kept video/image inputs, static crop, static transforms, and visual effects on the same graph path.
- Added graph and pipeline regression coverage.
- No project schema change.

Validation:
- CI/local validation is not yet complete; PR #80 remains Draft until the user reports PASS.

## 2026-09-23 — M3.65 Static Image Clip Export — merged

- PR #79 was validated locally by the user and squash-merged into `main` at `0136c1e6d13fd8cdb838dc2bbee8e5792fa86d31`.
- Image clips can now be exported through the single-video FFmpeg graph as looped visual inputs.
- Mixed video/image sequences route through the graph while preserving the existing static crop and static transform pipeline.
- Native graph requests carry optional per-input media-type metadata; the project schema remains unchanged.
- M3.62 remains intentionally parked in PR #76.

## 2026-09-23 — M3.66 Transition Export — started

- The next focused export gap is transition rendering between directly adjacent visual clips.
- The existing project model and Preview already define dissolve and fade-through-black transition behavior.
- M3.66 will implement transition graph compilation while preserving the existing timeline-duration semantics and one-video-track boundary.
- PR status remains Draft until local validation is confirmed by the user.

## 2026-09-23 — M3.65 validation assertion correction

- User-supplied validation showed 366/368 frontend tests passing, with two failures in `render-graph.test.ts`.
- The failures were stale duration expectations: the video fixture has a 5-second duration but the test expected 3 seconds, while the image fixture uses the default 3-second duration but the test expected 5 seconds. fileciteturn621file0L234-L261
- Production build passed, Rust unit tests passed 39/39, and Tauri dev started successfully in the same run. fileciteturn621file0L273-L285 fileciteturn621file0L288-L329 fileciteturn621file0L344-L360
- Corrected both assertions in commit `f85e56a19e622005ab501707cf12ce90369384e0`.
- Fresh frontend test execution and final CI remain required before M3.65 can be marked PASS/ready.

## 2026-09-23 — M3.65 test/native-file restoration

User-supplied validation showed:
- Frontend tests: 367/368 passed; only the image graph test expected a 5-second trim while the project fixture produced a 3-second image clip. fileciteturn601file0L243-L261
- Rust compilation failed because `src-tauri/src/lib.rs` on the branch had been corrupted to a test-fragment beginning with an unexpected closing brace. fileciteturn601file0L277-L307

Corrections applied:
- Restored `src-tauri/src/lib.rs` from `main` and reapplied M3.65 native image graph support, including optional per-input media types and looped image inputs.
- Updated native Rust graph request fixtures for the new media-type field.
- Corrected the image RenderGraph regression expectation to the actual 3-second default image duration.

CI note:
- Run #155 failed on an older head before the restoration.
- Run #156 was still running an intermediate head before the final test correction.
- Do not treat either result as the final M3.65 validation.

PR #79 remains Draft until a fresh full local validation and green CI are available.

## 2026-09-23 — M3.65 native graph test fixture hardening

- Updated the existing Rust `NativeVideoGraphRenderRequest` test fixtures to include the new optional per-input `input_media_types` field.
- This is test-only compatibility for the M3.65 graph request contract; no production behavior changed.

## 2026-09-23 — M3.64 Static Crop Export — merged

- PR #78 was validated by the user and squash-merged at `fd9d889c3975fdd076a87235913f3b37d1cbc50a`.
- Static crop and crop-position export is now part of `main`.

## 2026-09-23 — M3.65 Static Image Clip Export — in progress

Branch: feat/m3-65-static-image-export
PR: #79 — Draft

Scope:
- Export image assets as timeline video frames.
- Support image-only clips and image/video sequences through the existing video render graph.
- Preserve static crop and static transforms for image clips.

Implementation:
- Native graph requests carry optional per-input media types.
- Image inputs use a looped FFmpeg image demuxer at the project frame rate.
- Image duration remains controlled by RenderPlan segment trimming.
- Pipeline bypasses direct video-source renderers when an image is present and uses the graph renderer instead.

Deferred:
- Image-specific audio extraction.
- Transition export.
- Transform keyframes.
- Non-centered anchors.
- Multi-track compositing.
- Audio mixing.

Validation:
- Local lint/test/build/Cargo/Tauri validation pending user report.
- PR #79 remains Draft until user PASS.
- PR #76 remains Draft/parked.

## 2026-09-23 — M3.63 Static Visual Transform Export — merged

- PR #77 was validated by the user and squash-merged at `67f5e9900fea9424e6e11fd247b4c26143927f27`.
- Static X/Y, Scale, Rotation, and Opacity export is now part of `main`.
- Transform keyframes and non-centered anchors remain explicitly deferred.

## 2026-09-23 — M3.64 Static Crop Export — in progress

Branch: feat/m3-64-static-crop-export
PR: #78 — Draft

Scope:
- Export static `ClipCrop` and `CropPosition` using the existing normalized project model.
- Preserve Preview crop-before-transform semantics.
- Support crop alone and crop combined with static X/Y/Scale/Rotation/Opacity.
- Preserve the minimal default graph when no crop/transform is active.

Implementation:
- RenderPlan normalizes non-empty crop metadata and crop position.
- The FFmpeg graph fits source content, applies visual effects, crops the requested visible region, restores that region to the original contained-content bounds, then applies static transforms and output composition.
- Non-centered transform anchors, transform keyframes, transitions, images, multi-track compositing, and audio mixing remain deferred.

Validation:
- Local lint/test/build/Cargo/Tauri validation pending user report.
- PR #78 remains Draft until user PASS.
- PR #76 remains Draft/parked.

## 2026-09-23 — M3.63 stale regression assertion correction

Branch: feat/m3-63-static-transform-export
PR: #77

Validation evidence supplied by the user:
- `npm ci`: completed with 0 vulnerabilities.
- `npm run lint`: completed without a reported lint failure.
- Frontend test run: 32 test files executed; 31 files passed and 1 file failed only because `render-pipeline.test.ts` still expected static transforms to be rejected. Totals were 362 passed / 363 tests. fileciteturn451file0L269-L270
- `npm run build`: passed. fileciteturn451file0L275-L285
- `cargo test`: 38 passed, 0 failed. fileciteturn451file0L286-L329
- `npm run tauri dev`: Vite started and the Tauri app launched successfully. fileciteturn451file0L344-L359

Correction:
- Static X/Y/Scale/Rotation/Opacity export is now supported, so the old pipeline test expectation was stale.
- The test now supplies transform keyframes and expects the intentional `animated transform export is deferred` guard.
- No production transform-export behavior was rolled back.

Validation:
- Fresh full local validation is still required after this test-only correction.
- PR #77 remains Draft.

## 2026-09-23 — M3.63 Static Visual Transform Export — in progress

Branch: feat/m3-63-static-transform-export
PR: #77 — Draft

Scope:
- Compile static visual X/Y, Scale, Rotation, and Opacity into the existing single-video FFmpeg render graph.
- Preserve the existing minimal direct graph for default transforms.
- Propagate transform anchors into RenderPlan and reject non-centered anchors explicitly.
- Keep transform keyframes, crop/crop position, transitions, image export, multi-track compositing, and audio mixing deferred.

Implementation:
- Static non-default transforms now render the source content to project-sized transparent RGBA, apply visual effects, scale, rotation, and opacity, then overlay it at canvas-relative X/Y translation.
- Transformed segments normalize to project-sized `yuv420p` output for deterministic concat/export behavior.
- Existing default-transform graph output remains unchanged.

Validation:
- Local lint/test/build/Cargo/Tauri validation pending user report.
- PR #77 remains Draft until user PASS.
- M3.62 PR #76 stays Draft and parked; its WebKitGTK delayed repaint issue is intentionally deferred.

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