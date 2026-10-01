## M3.226 — Persisted Project Display Name Byte Caps — active — 2026-10-01

Branch:
`fix/m3-226-persisted-display-name-byte-caps`

Fresh audit finding:
- `Project.name`, `MediaAsset.name`, and `Track.name` are required to be non-empty strings but had no field-level UTF-8 byte limit.
- The 16 MiB serialized-project cap bounds aggregate size, not any individual display-name field.

Scope:
- Add `MAX_PERSISTED_DISPLAY_NAME_BYTES = 256`.
- Enforce it on project, asset, and track display names while preserving existing trimming/non-empty semantics.
- Add exact-limit, over-limit, and multibyte UTF-8 regression coverage.
- No project schema version change.

Implementation:
- Added the shared 256-byte UTF-8 display-name cap to project, asset, and track validation.
- Added regression coverage for exact 256-byte multibyte acceptance and 257-byte rejection on all three name surfaces.
- Documentation is reconciled for M3.226.
- Local validation is pending.

Next step:
- Run the complete Pull/Fetch + Validation workflow for M3.226.

