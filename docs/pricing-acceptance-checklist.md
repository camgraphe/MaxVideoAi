# Model Roster Acceptance Checklist (Phase 2.5)

- [ ] `docs/model-roster.json` and `docs/model-roster.csv` are generated from `fixtures/engines.json` via `npm run model:generate`.
- [ ] `frontend/src/lib/model-slugs.ts` maps every `engineId` to exactly one canonical slug.
- [ ] Home rail, Models index/detail, Examples gallery, Workflows roster, Pricing/Calculator estimator, and Generate view all consume the shared model roster + pricing kernel (no hard-coded names or prices).
- [ ] i18n dictionaries expose `models.meta` and `models.availabilityLabels`, and every surface relies on these keys.
- [ ] `npm run model:check` passes, producing `docs/model-roster-report.md` with no failed checks.
- [ ] Required 301 redirects added for any renamed slugs (n/a if no legacy slugs).
