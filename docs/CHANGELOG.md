### M3.135 — Strict Waveform Output Peak-Count Contract — active — 2026-09-26

- Branch: `fix/m3-135-waveform-source-range-contract`.
- Fresh audit found `getWaveformPeaksForSourceRange()` could accept an extreme finite output peak count and use it directly as an array length.
- Added a strict 2048 maximum plus safe-integer validation before allocation.
- Added focused regression coverage for unsafe/over-limit counts and the maximum valid count.
- No project schema change.
- Implementation is complete; user local validation is pending.
- Next step: complete local validation before the standard PASS merge/reconciliation workflow.

### M3.134 — Strict Audio Waveform Response Contract — completed — 2026-09-26

- Branch: `fix/m3-134-strict-waveform-response-contract`.
- PR #149; squash-merged at `077d8d7b78ca92d466a960110d9fca8ad5e58be6`.
- User reported PASS.
- Tightened native waveform duration/sample-rate metadata validation to positive safe integers and removed silent rounding.
- Added focused regression coverage.
- No project schema change.
- PR head `1b35e57f3673541e1bf8db1e8024083d7944c6e6` was verified before merge.
- `main` was verified after merge at `077d8d7b78ca92d466a960110d9fca8ad5e58be6`.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh audit from verified `main`.

### M3.133 — Strict Audio Waveform Peak-Count Contract — completed — 2026-09-26

- Branch: `fix/m3-133-waveform-peak-count-contract`.
- PR #148; squash-merged at `ce35441e801d7f2a240a2a2535cc39b9d1bc6139`.
- User reported PASS.
- Hardened waveform request normalization so non-finite peak counts fall back to 128 while finite values retain the existing 32..2048 range.
- Added focused regression coverage.
- No project schema change.
- PR head `5f3cdf6dd4274e9438bce7ef4cd77bbd2f2feae9` was verified before merge.
- `main` was verified after merge at `ce35441e801d7f2a240a2a2535cc39b9d1bc6139`.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh audit from verified `main`.

### M3.132 — Strict Source Split Endpoint Safety — completed — 2026-09-26

- Branch: `fix/m3-132-safe-source-split-endpoint`.
- PR #147; squash-merged at `9b2a8edc278ed7894779b0314aa571247a433e5c`.
- User reported PASS.
- Hardened `splitClipAtTime()` source split arithmetic with the existing checked millisecond addition helper.
- Added focused regression coverage for unsafe derived source split endpoints.
- No project schema change.
- PR head `0fbb5481dbd6691b9b97534a46235a8b32df1fb4` was verified before merge.
- `main` was verified after merge at `9b2a8edc278ed7894779b0314aa571247a433e5c`.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh audit from verified `main`.

### M3.131 — Strict Transform Keyframe Time Normalizer — completed — 2026-09-26

- Branch: `fix/m3-131-transform-keyframe-time-normalizer`.
- PR #146; squash-merged at `5a8f98309dfd4a190828d85efdc38432b1b7b909`.
- User reported PASS.
- Hardened the exported Transform Keyframe timestamp normalizer to reject non-finite input and unsafe rounded results, while collection normalization filters invalid values.
- Added focused regression coverage.
- No project schema change.
- PR head `45f0405f5a217f0811244bf61efa24fd1fff2335` was verified before merge.
- `main` was verified after merge at `5a8f98309dfd4a190828d85efdc38432b1b7b909`.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh audit from verified `main`.

### M3.130 — Strict Transform Keyframe Safe-Time Contract — completed — 2026-09-26

- Branch: `fix/m3-130-transform-keyframe-safe-times`.
- PR #145; squash-merged at `d4e1693480e15f0cc59acc4c18be76c820b00ec1`.
- User reported PASS.
- Added safe-integer normalization and upsert validation for runtime Transform Keyframe timestamps.
- Added focused regression coverage.
- No project schema change.
- PR head `693a874e3f3aec76f81857531ee2639ded893667` was verified before merge.
- `main` was verified after merge at `d4e1693480e15f0cc59acc4c18be76c820b00ec1`.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh audit from verified `main`.

### M3.129 — Strict Audio Keyframe Safe-Time Contract — completed — 2026-09-26

- Branch: `fix/m3-129-audio-keyframe-safe-times`.
- PR #144; squash-merged at `e5b9d9aa4728ab112493e3e6fce70729673cda27`.
- User reported PASS.
- Fresh audit found runtime audio volume keyframe normalization could preserve unsafe rounded timestamps and `upsertAudioVolumeKeyframe()` could accept unsafe rounded timestamps.
- Added safe-integer normalization and safe-integer upsert validation with focused regression coverage.
- No project schema change.
- PR head `da89d08fedeed31c7a8bc463560a35defba46a9f` was verified before merge.
- `main` was verified after merge at `e5b9d9aa4728ab112493e3e6fce70729673cda27`.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.
- Next step: fresh audit from verified `main`.