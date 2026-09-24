### M3.85 — Embedded Video Source-Audio Waveform Parity — completed — 2026-09-25

Branch: `feat/m3-85-video-source-audio-waveform`
PR #100
Merge SHA: `c631fce74963d3c89fff8bf6246ccf95685ecd8e`

Implementation:
- Timeline now renders the existing audio waveform for Video clips with embedded source audio.
- Native waveform validation accepts Video sources and still probes for an actual audio stream.
- Video without an audio stream produces no waveform; Image clips remain excluded.
- Existing waveform seek/selection/cache behavior is reused.
- Added Rust and Timeline regression coverage.
- User reported PASS.
- No project schema or export DSP change.

Known limitation:
- Waveform region selection is visual/local state only and is not yet connected to a separate editing command.

