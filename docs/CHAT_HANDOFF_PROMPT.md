## M3.86 — active — 2026-09-25

- Branch: not created yet; start from updated `main` after M3.85.
- M3.85 completed and squash-merged as PR #100 at `c631fce74963d3c89fff8bf6246ccf95685ecd8e`.
- Audio waveform now appears for Video clips that contain embedded source audio and continues to use the existing Audio waveform implementation.
- Native waveform generation accepts Audio/Video sources and probes the first audio stream before decoding; Video without audio does not render a fake waveform.
- Image clips remain excluded; project schema and export DSP are unchanged.
- The next milestone must be selected only after auditing current `main`.
- PR #76 remains parked; PR #22 remains unrelated and untouched.

