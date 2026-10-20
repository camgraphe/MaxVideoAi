# External Fal result provenance

An external provider generation can be represented in `app_jobs` only as an
explicit external result. It is not an application generation attempt. The
marker is `settings_snapshot.origin = 'external_fal_import'`; the immutable
`externalImport` object carries its provider request, input and evidence. These
infrastructure guards do not import a result, add a model, grant admin access,
activate a tariff or publish media.

Migration 76 makes external request IDs unique, requires completed video results
with an owner, real request ID and explicit `external_not_billed` payment status,
and requires customer price, currency, pricing snapshot, cost breakdown and Stripe
references to remain null. It prevents changing the provenance, owner, engine or
provider request. It skips generation timing capture for these rows. Existing
application jobs retain their original timing behavior. Apply through the
repository migration process; qualification here uses disposable PostgreSQL.

Runtime readers exclude this origin from generation health, render counts,
commercial aggregates, measured latency and Activity. Exact owned output reads
and the native public-gallery eligibility rules remain available. Library readers
retain the original uploaded asset and do not also project an output card; saving
that output reuses its existing owned asset. Provider resync and webhook lifecycle
updates reject/ignore imports, while the admin audit identifies the origin and
shows “Not billed” for the null application price.

Deploy the runtime guards and migration before adopting external results. With
migration alone, no timing sample or application receipt is manufactured, but an
older runtime still counts imported successes in some internal views and can
show duplicate output cards. Admin exclusion from commercial metrics does not
cover every operational reader. Do not remove these guards or roll back to an
unaware runtime after external rows exist without a separate compatible reader
plan. The migration does not change existing data or create billing events.

Private asset byte verification and local manifest preparation may run before
this infrastructure release, using read-only database transactions and provider
GET requests. They do not require an external row or a published model. Media
publication then follows the existing authorized editorial and deployment flow;
these guards add no separate content approval requirement.

Independent regression coverage:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/external-fal-guardrails-postgres.test.ts tests/admin-job-audit-server-contract.test.ts
```

The disposable test uses an existing model identity, checks private external
rows, no receipt/queue/attempt/metric/timing writes, immutable provenance, unique
request identity, library deduplication, exclusions, exact reads and unchanged
native completion behavior. It does not need an import CLI or a model launch.
