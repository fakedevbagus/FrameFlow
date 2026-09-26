## M3.135 — Strict Waveform Output Peak-Count Contract — active — 2026-09-26

Branch:
`fix/m3-135-waveform-source-range-contract`

Scope:
- Bound the waveform source-range helper's derived output peak count before it reaches `Array.from()`.

Audit finding:
- `getWaveformPeaksForSourceRange()` accepted any finite positive `outputPeakCount`.
- It rounded that value and immediately used it as an array length, so a very large finite request could cause an extreme allocation or runtime failure.
- The native waveform generator already caps source waveform density at 2048 peaks.

Implementation:
- Added a 2048 maximum for waveform source-range output peak counts.
- Unsafe, non-positive, or over-limit rounded counts now return an empty result before allocation.
- Preserved existing fractional rounding behavior within the supported range.
- Added regression coverage for unsafe/over-limit counts and the maximum valid count.
- No project schema version change.

Invariant / contract:
- `getWaveformPeaksForSourceRange()` may allocate at most 2048 output peaks.
- The rounded output count must be a positive JavaScript safe integer within the supported waveform bound.
- Existing valid source-range interpolation behavior remains unchanged.

Validation:
- Implementation complete; user local validation is pending. Do not assume lint/test/build/cargo/manual validation has passed.

Remaining risks:
- Waveform source-duration/source-end numeric validation remains subject to separate focused auditing.
- Floating-point waveform interpolation remains out of scope.

Next step:
- Complete user local validation of M3.135; after PASS, follow the standard verify head → merge → documentation reconciliation workflow.

## M3.134 — Strict Audio Waveform Response Contract — completed — 2026-09-26

Branch:
`fix/m3-134-strict-waveform-response-contract`

PR:
#149

Merge SHA:
`077d8d7b78ca92d466a960110d9fca8ad5e58be6`

User validation:
- User reported PASS for M3.134.
- PR #149 was refreshed at head `1b35e57f3673541e1bf8db1e8024083d7944c6e6`, verified ahead of `main`, marked Ready for Review, and squash-merged.
- `main` was verified after merge at `077d8d7b78ca92d466a960110d9fca8ad5e58be6`.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.

Audit finding:
- Native waveform `durationMs` and `sampleRate` were previously accepted as finite positive numbers and silently rounded.

Implementation:
- Tightened response and persistent-cache validation to require positive JavaScript safe integers.
- Removed redundant response metadata rounding.
- Added focused regression coverage for unsafe and fractional native metadata.
- No project schema version change.

Invariant / contract:
- Native waveform timing metadata must be safe integers before cache/render use.

Remaining risks:
- Source-range output peak-count allocation remained subject to a separate focused audit, addressed by M3.135.
- Floating-point waveform interpolation remains out of scope.

Next step:
- Fresh audit from verified `main` for the next concrete runtime/media boundary.

## M3.133 — Strict Audio Waveform Peak-Count Contract — completed — 2026-09-26

Branch:
`fix/m3-133-waveform-peak-count-contract`

PR:
#148

Merge SHA:
`ce35441e801d7f2a240a2a2535cc39b9d1bc6139`

User validation:
- User reported PASS for M3.133.
- PR #148 was refreshed at head `5f3cdf6dd4274e9438bce7ef4cd77bbd2f2feae9`, verified ahead of `main`, marked Ready for Review, and squash-merged.
- `main` was verified after merge at `ce35441e801d7f2a240a2a2535cc39b9d1bc6139`.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.

Audit finding:
- `getAudioWaveform()` could propagate a non-finite peak-count input, including `NaN`, into the native waveform command.

Implementation:
- Added a dedicated peak-count normalizer with non-finite fallback to the default 128.
- Preserved the existing finite 32..2048 clamp and rounding behavior.
- Added focused regression coverage proving invalid input is normalized before native invocation.
- No project schema version change.

Invariant / contract:
- Native waveform generation receives a finite integer peak count between 32 and 2048.

Remaining risks:
- Native waveform response duration/sample-rate validation required the follow-up hardening implemented in M3.134.
- Waveform interpolation uses floating-point sampling calculations and remains out of scope.

Next step:
- Fresh audit from verified `main` for the next concrete runtime/media boundary.


## M3.132 — Strict Source Split Endpoint Safety — completed — 2026-09-26

Branch:
`fix/m3-132-safe-source-split-endpoint`

PR:
#147

Merge SHA:
`9b2a8edc278ed7894779b0314aa571247a433e5c`

User validation:
- User reported PASS for M3.132.
- PR #147 was refreshed at head `0fbb5481dbd6691b9b97534a46235a8b32df1fb4`, verified ahead of `main`, marked Ready for Review, and squash-merged.
- `main` was verified after merge at `9b2a8edc278ed7894779b0314aa571247a433e5c`.
- No additional lint/test/build/cargo/manual validation claims are inferred beyond the user's PASS.

Audit finding:
- `splitClipAtTime()` derived `sourceSplitMs` with direct source-start plus timeline-offset arithmetic without a safe-integer result check.

Implementation:
- Reused the existing checked millisecond addition helper for source split derivation.
- Added focused regression coverage for an unsafe derived source split endpoint.