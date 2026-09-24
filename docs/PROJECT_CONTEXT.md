## M3.85 — Embedded Video Source-Audio Waveform Parity — completed — 2026-09-25

Branch:
`feat/m3-85-video-source-audio-waveform`

PR:
#100

Merge SHA:
`c631fce74963d3c89fff8bf6246ccf95685ecd8e`

Implementation reconciled:
- Native waveform source validation now accepts Audio and Video media types.
- Video waveform generation still probes the first audio stream, so Video without audio produces no waveform rather than a fake signal.
- Timeline reuses the existing `AudioWaveformPreview` for Video-track Video clips.
- Existing waveform seeking, selection, request de-duplication, and persistent caching paths are reused unchanged.
- Image clips remain audio-free.
- Added Rust validator coverage plus Timeline Video/Image waveform regressions.
- User reported PASS for M3.85.
- No project schema or export DSP change.

Known limitation:
- Waveform selection is currently local Timeline UI state; no independent edit command is attached to a selected waveform region.

Next step:
- Audit the merged audio/timeline surfaces for the next smallest functional gap; start from updated `main`.

