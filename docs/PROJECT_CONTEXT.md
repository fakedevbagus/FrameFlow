## M3.225 — Persisted Project Serialization Size Cap — completed — 2026-10-01

Branch:
`fix/m3-225-persisted-project-serialization-size-cap`

PR:
- #243; squash-merged at `c12fde998a6c27421174493550020a825d80a6d6`.

- Added `MAX_PROJECT_SERIALIZED_BYTES = 16 * 1024 * 1024` at the domain parse/serialize boundary.
- Rejected serialized input above 16 MiB before JSON parsing.
- Rejected serialized output above 16 MiB before workspace storage or native save.
- Added exact-boundary and over-limit regression coverage.
- User reported PASS.
- No project schema version change.

## M3.226 — Persisted Project Display Name Byte Caps — planned — 2026-10-01

Fresh audit finding:
- `Project.name`, `MediaAsset.name`, and `Track.name` are required to be non-empty strings, but they have no field-level UTF-8 byte limit.
- The 16 MiB serialized project cap bounds total payload size but does not prevent one display-name field from consuming a disproportionate amount of the allowed payload.
- Existing identifier, source-path, collection-count, and serialized-project caps remain intact.

Planned scope:
- Add one shared persisted display-name UTF-8 byte cap for project, asset, and track names.
- Preserve existing trimming/non-empty semantics.
- Add exact-limit, over-limit, and multibyte UTF-8 regression coverage.
- No project schema version change.

Next step:
- Create a focused M3.226 branch from verified `main` and add the smallest safe field-level name cap.
- Do not start UI/UX redesign.
## M3.224 — Persisted Project Identifier Byte Caps — completed — 2026-10-01

Branch:
`fix/m3-224-persisted-project-identifier-byte-caps`

PR:
- #242; squash-merged at `42f0655b6ed56abfb0b22dbb9d9b75138bbdbef4`.

- Added `MAX_PERSISTED_IDENTIFIER_BYTES = 256`.
- Validated project, asset, track, clip, and clip `assetId` identifiers by UTF-8 byte length.
- Added exact-limit, over-limit, and multibyte UTF-8 regression coverage.
- User reported PASS.
- No project schema version change.

## M3.223 — Persisted Project Asset Source Path Byte Cap — completed — 2026-10-01

Branch:
`fix/m3-223-persisted-asset-source-path-cap`

PR:
- #241; squash-merged at `21610705086360cf7d8022bb5bd111d3b0feb7f3`.

- Added `MAX_PERSISTED_ASSET_SOURCE_PATH_BYTES = 4096`.
- Persisted asset source paths use UTF-8 byte-length validation.
- Added exact-limit, over-limit, and multibyte UTF-8 regression coverage.
- User reported PASS.
- No project schema version change.

## M3.221 — Persisted Project Total Clip Count Cap — completed — 2026-10-01


Branch:
`fix/m3-221-project-total-clip-count-cap`

Fresh audit finding:
- Per-track clip count is capped at 4,096, but aggregate project clip count remained unbounded.
- Existing 256-track cap still permits up to 1,048,576 persisted clips.
- `validateTracks()` also maintains a project-wide `clipIds` set while validating tracks, so aggregate clip count is a direct project-load/resource boundary.

Scope:
- Add `MAX_PROJECT_TOTAL_CLIPS = 65_536`.
- Reject projects whose aggregate persisted clip count exceeds 65,536 before validating the excess clip collection.
- Preserve the existing 4,096 per-track cap and all clip/topology semantics.
- Add exact-limit and over-limit regression coverage.
- No project schema version change.

Implementation:
- Added `MAX_PROJECT_TOTAL_CLIPS = 65_536`.
- Added aggregate persisted clip counting across all tracks before per-clip validation for an over-limit project.
- Added exact-limit acceptance and 65,537-entry rejection tests.
- Documentation is reconciled for M3.221.
- Local validation is pending user run.

Next step:
- Run the complete Pull/Fetch + Validation workflow for M3.221.
- After user PASS, refresh PR/head/base state, mark Ready for Review, squash-merge using the freshly verified head SHA, verify main, reconcile all three docs, perform a fresh audit, and create the next focused milestone.


