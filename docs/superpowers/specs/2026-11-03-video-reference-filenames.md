# Video reference filenames

The Video Media picker must retain the optional name already returned by the Media API, display and search it using the existing shared picker, and retain it when selecting the reference. A blank or absent name keeps the current fallback. Functional Image 1/2 labels, canonical media identity, exact original URL, ownership, eligibility, account isolation and generation guards stay unchanged.

Scope: the Video workspace library payload adapter and ordinary/Kling reference display-name projections, plus optional name typing through the modal. Kling names remain display metadata; subject identifiers and provider payloads are unchanged. No API changes, media lookup, old-reference recovery, production calls, phone tests or generation.

Regression: local synthetic Media responses flow through the real library hook and modal/picker. Verify both watch filenames, refresh, cursor pagination, exact-name search, confirmation and selected original identity; retain adjacent account and reference guards.
