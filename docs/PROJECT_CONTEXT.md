## M3.49 merge reconciliation and M3.50 kickoff — 2026-09-21

- M3.49 Audio Track Pan Control is complete and PR #63 was squash-merged.
- M3.49 merge SHA: 7fbb75a222bcccfc92cb2ee211e1df0db9748233.
- User approved M3.49 continuation with pass after local validation.
- Reported M3.49 validation before approval: lint passed; 28 Vitest files passed with 279/279 tests; production build passed after the final import/fixture corrections; Rust tests passed 28/28; Tauri dev launched successfully.
- M3.49 adds backward-compatible Audio-track pan state, Timeline pan control, preview StereoPannerNode routing, RenderPlan propagation, and FFmpeg stereo balance.
- M3.50 starts from the verified M3.49 merge and focuses on export progress streaming and cancellation.
- Native FFmpeg export processes now expose progress events keyed by export job ID.
- A Tauri cancellation command terminates the active FFmpeg process and also handles cancellation requested between sequential render stages.
- Export progress remains monotonic in the frontend; two-stage video-plus-audio exports map video to 80% and final audio mixing to the remaining 20%.
- ExportPanel now shows a progress bar and Cancel export control, with a cancelled terminal state.
- Deferred: full audio effects/EQ/compression stack, audio automation, waveform editing.
- M3.50 local validation is pending user verification.

