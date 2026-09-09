# Finish Billing read latency

The integrated Wallet UI exposed two remaining server bottlenecks during actual root browser QA: `/api/me/currency` around 15–17 seconds and `/api/receipts?limit=25` around 13–18 seconds in the development preview. These are observations under development recompilation, not controlled performance claims. Both GET routes still call the global `ensureBillingSchema`; other qualified read routes no longer do. Follow `docs/engineering/read-route-schema-bootstrap.md` and preserve payment mutation owners.

## Constraints

- Keep wallet/receipt ownership, exact historical values, currencies, invoice/receipt resolution, pagination and existing auth behavior. No pricing or Stripe/payment configuration change.
- Reads operate against an explicitly initialized/migrated schema. Keep the currency POST initialization and mutation behavior unchanged. No bootstrap or migration may be run against an inherited remote target.
- Do not add a cross-account cache or hide an actual database outage as a successful empty real ledger. Preserve the existing intentional unconfigured local/mock response if it remains required by its contract; distinguish a configured database failure explicitly.
- No provider/Stripe payment, email or production mutation. Tests use injected auth and disposable local PostgreSQL. Root browser QA uses only the previously verified qualification copy and read UI.

### Task 1: Remove redundant global bootstrap from Billing GETs

Files: `frontend/app/api/me/currency/route.ts`, `frontend/app/api/receipts/route.ts`, focused route behavior/ownership tests and `docs/engineering/read-route-schema-bootstrap.md`. Shared currency/wallet/document helpers change only if they contain the same identified read bootstrap or need a narrow explicit test seam; preserve their public behavior.

- [ ] Capture a bounded comparable before/after measurement with the same input, initialized database, process freshness and compute warmth. Separate dev compilation observations from measured server data-path results; record individual runs and no browser CWV claim.
- [ ] Remove global billing schema work from both GET paths and ensure authenticated reads remain account-scoped. No per-request DDL or global default seeding replaces it. Keep POST mutation/initialization untouched.
- [ ] Preserve query results, cursor/limit behavior, exact cents/currencies, document resolution and no-database local contract. A real configured DB failure produces an actionable error response handled by the integrated Billing error UI instead of a fake empty ledger.
- [ ] Exercise actual GET handlers with unauthorized/authenticated/read-only database cases, receipt pagination and stored document fallback. Confirm zero schema/seed statements on reads and unchanged POST bootstrap via the narrow contract. Keep external Stripe requests mocked.
- [ ] Run focused tests/types/lint/diff, update ownership/performance evidence, commit exact files and receive independent review. No repeated full suite/build; root performs the combined final gates and actual UI loading verification.
