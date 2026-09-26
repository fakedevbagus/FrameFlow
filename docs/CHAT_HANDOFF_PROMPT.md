## M3.119 — completed — 2026-09-26

- Branch: `fix/m3-119-strict-unified-av-audio-segments`.
- Scope: align native unified AV source-audio segment processing metadata with the project-domain numeric/range/ordering contract.
- Audit finding: native validation previously checked only duration, input index, and video-input type; FFmpeg helpers could silently clamp or normalize invalid audio metadata.
- Added strict validation for track volume/pan, fades, audio volume keyframes, EQ gains, and compressor parameters.
- Added focused native regression coverage.
- No project schema version change.
- PR #134; squash-merged at `91179b94d6b986e9c687ef768a23277088abfc28`.
- User reported PASS.
- `main` was verified after merge.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh repository audit from verified `main` for the next concrete engineering gap.

## M3.118 — completed — 2026-09-26

- Branch: `fix/m3-118-strict-video-graph-media-types`.
- Scope: align the native video-graph request boundary with the declared and detected visual input media types.
- Audit finding: `render_video_graph_to_mp4` only count-checked `input_media_types`, while FFmpeg argument construction uses those values to decide image looping.
- Added allowed-value validation for supplied media types and actual-file type matching before graph rendering.
- Preserved the current empty-list compatibility behavior.
- Added focused native regression coverage.
- No project schema version change.
- PR #133; squash-merged at `6ef44fd0af0c000cd3a122bbcf99b32627514ba7`.
- User reported PASS.
- `main` was verified after merge.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh repository audit from verified `main` for the next concrete engineering gap.

## M3.117 — completed — 2026-09-26

- Branch: `fix/m3-117-export-settings-native-contract`.
- Scope: align `normalizeExportSettings()` with native export requirements for positive even dimensions and frame rates up to 240 FPS.
- Audit finding: export normalization could preserve odd positive dimensions and frame rates above the native limit.
- Added even-dimension/minimum normalization and a shared 240 FPS ceiling.
- Added focused export-setting regression coverage.
- No project schema version change.
- PR #132; squash-merged at `51cc63f8a922cb0189c90d87027f845f3a722d35`.
- User reported PASS.
- `main` was verified after merge.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh repository audit from verified `main` for the next concrete engineering gap.

## M3.116 — completed — 2026-09-26

## M3.116 — completed — 2026-09-26

- Branch: `fix/m3-116-project-canvas-dimensions`.
- Scope: align persisted/runtime project canvas width/height with the native export requirement that dimensions be positive even numbers.
- Audit finding: project validation and `updateCanvasDimensions()` previously accepted odd positive integers, but native export rejects them.
- Added strict positive-even integer validation for persisted canvas dimensions and command-level updates.
- Added parser and command regression coverage for the boundary and odd dimensions.
- No project schema version change.
- PR #131; squash-merged at `95f5268708f0250e3305d318410ccdbe47d54309`.
- User reported PASS.
- `main` was verified after merge.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh repository audit from verified `main` for the next concrete engineering gap.

## M3.115 — completed — 2026-09-26

- Branch: `fix/m3-115-project-framerate-range`.
- Scope: align persisted `canvas.frameRate` with the native export upper bound of 240 FPS while preserving supported fractional rates.
- Audit finding: project validation previously accepted any positive finite frame rate, but native export rejects values above 240 FPS; the project frame rate is also the default export frame rate.
- Added `MAX_CANVAS_FRAME_RATE = 240` and strict persisted upper-bound validation.
- Added parser regression coverage for the 240 FPS boundary and over-limit values.
- No project schema version change.
- PR #130; squash-merged at `05a474a2525d51bf51099e4f335081728652b2e8`.
- User reported PASS.
- `main` was verified after merge.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh repository audit from verified `main` for the next concrete engineering gap.

## M3.114 — completed — 2026-09-26

- Branch: `fix/m3-114-canonical-clip-command-times`.
- Scope: canonicalize valid non-negative clip timeline/source timing inputs at reusable command boundaries.
- M3.101 already enforced integer clip timing at persistence; M3.114 closed the pre-persistence command gap for add/move/trim/split.
- Split timing is normalized before deriving resulting clip boundaries and related keyframe/audio automation timing.
- Added regression and serialization coverage.
- PR #129; squash-merged at `be77ca4e2966f1ac65268b3886f64a9ade40c2e7`.
- User reported PASS.
- `main` was verified after merge.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh audit from current `main` for the next concrete engineering gap.

## M3.113 — completed — 2026-09-25

- Branch: `fix/m3-113-canonical-transform-keyframe-times`.
- Scope: canonicalize Transform Keyframe timestamps to integer milliseconds while preserving fractional playback interpolation.
- PR #128; squash-merged at `7672e1d9d603ab573178f3c908bd0807d0bfa4f1`.
- Implemented canonical timestamp normalization/lookup, command-level time canonicalization, strict persisted integer validation, and focused regression coverage.
- User reported PASS.
- No project schema change.
- Local validation is considered passed only because the user reported PASS; do not infer additional checks beyond the user's report.
- Next step: fresh audit from updated `main` for the next focused persisted/runtime invariant.

## Workflow for this chat

- Inspect actual `main` SHA, branch state, and open PRs before acting.
- M3.119 is completed and merged; the next milestone must come from a fresh audit of verified `main`.
- On user `PASS` / `pass` / `lanjutkan` for a future active milestone: refresh the PR state, use the freshly verified head SHA, mark the Draft PR ready, squash-merge it, record the actual merge SHA, reconcile all three docs, verify `main`, audit again, and start the next focused milestone.
- Never claim lint/test/build/cargo/manual validation passed unless the user explicitly confirms it.
- Keep parked PR #76 and unrelated PR #22 untouched.

## M3.112 — completed — 2026-09-25

- Branch: `fix/m3-112-canonical-text-overlay-position-precision`.
- PR #127; squash-merged at `fc5ce918cf5f73dce0bb0d6e57f0ea43329cf98f`.
- Implemented two-decimal Text Overlay X/Y normalization and strict persisted-value validation.
- User reported PASS.
- No project schema change.

## M3.111 — completed — 2026-09-25

- Branch: `fix/m3-111-strict-transform-rotation-range`.
- PR #126; squash-merged at `eb7ab0fe11c0c279e7daf70c2e31317bf972394f`.
- Implemented strict persisted Rotation `-180..180` validation and focused parser regressions.
- User reported PASS.
- No project schema change.

## M3.110 — completed — 2026-09-25

- Branch: `fix/m3-110-canonical-transform-opacity-precision`.
- Scope: align Transform Opacity persistence and runtime normalization with the Inspector's integer-percent input contract.
- PR #125; squash-merged at `40c0fd1df662754e814e7e658f9a56e0ce615b78`.
- Transform Opacity is now normalized to two decimal places after range clamping.
- Persisted Transform Opacity values with more than two decimal places are rejected, including transform keyframe transforms.
- Added regression coverage for runtime normalization, command behavior, and persisted-value rejection.
- User reported PASS.
- No project schema change.
- Local validation is considered passed only because the user reported PASS; do not infer additional checks beyond the user's report.

## Workflow for this chat

- Inspect actual `main` SHA, branch state, and open PRs before acting.
- The latest completed milestone is M3.110; the next step is a fresh audit from updated `main`.
- On user `PASS` / `pass` / `lanjutkan`: mark the active Draft PR ready, squash-merge it using the freshly verified head SHA, record the actual merge SHA, reconcile all three docs, verify `main`, audit again, and start the next focused milestone.
- Never claim lint/test/build/cargo/manual validation passed unless the user explicitly confirms it.
- Keep parked PR #76 and unrelated PR #22 untouched.

## M3.109 — completed — 2026-09-25

- Branch: `fix/m3-109-canonical-transform-scale-precision`.
- PR #124; squash-merged at `d7c31e4dcd9c0da664fd76c3de673bbd6d2fedcc`.
- Transform Scale now uses two-decimal canonical normalization after range clamping.
- Persisted Transform Scale values with more than two decimal places are rejected, including transform keyframe transforms.
- Existing Scale range `0.05..10` remains unchanged.
- Added regression coverage for runtime normalization, command behavior, and persisted-value rejection.
- User reported PASS.
- No project schema change and no change to X/Y, Rotation, Opacity, Crop, Preview, or Export contracts.

Next milestone:
- M3.110 — audit remaining persisted visual-transform precision and control normalization.

## M3.108 — completed — 2026-09-25

- Branch: `fix/m3-108-canonical-track-audio-precision`.
- PR #123; squash-merged at `317f09aa66f6f7e1196fdd6d8ce86e07fdd07cd8`.
- Track Volume/Pan now use shared two-decimal canonical normalization in getters and update commands.
- Persisted Track Volume/Pan values with more than two decimal places are rejected.
- Added regression coverage for getter normalization, command normalization, and persisted-value rejection.
- User reported PASS.
- No project schema change and no change to preview/export/media behavior beyond canonicalizing existing track controls.

Next milestone:
- M3.109 — Canonical Transform Scale Precision.