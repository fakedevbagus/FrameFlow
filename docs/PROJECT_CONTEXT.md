## M3.65 — Static Image Clip Export — in progress — 2026-09-23

- M3.64 Static Crop Export is complete and merged into `main` at `fd9d889c3975fdd076a87235913f3b37d1cbc50a`.
- M3.62 Text Overlay Export Rendering remains parked in PR #76 Draft because the user's Linux/Tauri/WebKitGTK Preview timing issue is unresolved.
- Image assets are already accepted on video tracks and rendered in Preview, but the native export graph previously rejected non-video visual assets and the single-source pipeline bypassed the graph for any clip at timeline zero.
- M3.65 adds media-type metadata to native graph requests so FFmpeg can distinguish image inputs from video inputs.
- Image inputs are opened with a looped image demuxer at the project frame rate; duration is controlled by the existing RenderGraph trim/timeline segment duration.
- The TypeScript export pipeline routes image-containing video plans through the graph renderer instead of the direct single-source/segment video renderer.
- The RenderGraph accepts both video and image visual assets while preserving the existing one-video-track architecture.
- No project schema change is introduced.
- Animated transforms, non-centered transform anchors, transitions, multi-track compositing, and audio mixing remain deferred.
- Added regression coverage for image RenderGraph compilation, pipeline routing, and native media-type request metadata.
- Local validation is pending. Keep PR #79 Draft until the user reports PASS.

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



