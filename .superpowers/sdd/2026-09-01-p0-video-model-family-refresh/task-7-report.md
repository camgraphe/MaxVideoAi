# Task 7 report — lifecycle-aware MCP parity and hidden P0 canary

Date: 2026-09-01

## Revision

- Base: `565603a26f9823124276d6114e176e8ddea8e49e`
- Final implementation commit: reported in the Task 7 handoff because a commit cannot contain its own hash.

## Outcome

The MCP now projects model identity and policy from the runtime registry instead of treating every app engine as a default recommendation. Default listing and recommendation contain only current, app-published models. Exact legacy IDs retain their own schema and execution readiness, advertise the canonical successor ID/slug, use their canonical registry slug in links, and are not recommended by default. Exact deep-legacy and retired identities remain inspectable but non-executable; spending paths receive no such generation candidate and reject before pricing, reservation, or submission.

All duration options in model details are executable numeric seconds. Provider-only labels such as `auto` are filtered rather than advertised as MCP inputs.

The existing exact production-staging host/account/client authorization now grants a private access set derived from the seven canonical P0 pricing-scenario identities. It rechecks that every identity is still current and app-unpublished. Only details, project budget, prepare, and transactional confirm receive that internal set. Listing and recommendation never receive it, aliases/families/prefixes are not resolved, and prelaunch details set `prelaunch: true` while omitting owned unpublished model/example/evidence URLs. Guidance remains available with its unpublished evidence links stripped.

The project budget limit is exactly 14 lines: 14 is accepted and 15 is rejected. Confirmation continues to require one explicit confirmed quote per action.

## Canonical parity and marketing data

- All seven P0 models remain Fal-only. Existing Kling, BytePlus, Google, Luma, OpenAI, and other approved direct routes are unchanged.
- The 23 P0 mode details are projected from the canonical engine schemas. Existing Task 4 request-body and Task 5 pricing scenario owners remain the parity sources; no MCP price, endpoint, capability, or request table was added.
- P0 guidance now covers Wan references, LTX 2.5 A2V, Grok image references, and FLUX first/last-frame plus extend workflows without prices.
- Official prompting sources add only the frozen owner hosts: Alibaba Model Studio, xAI docs, Black Forest Labs, and the existing LTX owner docs. Fal is rejected as a prompting-source host. Canonical modes are checked against the actual models and public details filter each source to the selected model modes.
- `docs/engineering/mcp-mode-coverage.md` records lifecycle and prelaunch ownership.

## Existing contract gaps closed

1. MiniMax H3 public HTTPS video references with duration constraints now fail closed because no trusted owner verified their duration. Owned resolved assets retain the exact duration validation. Informational project budgeting has an explicit internal planning-only exemption; paid prepare/confirm do not.
2. The paid private-asset regression now exercises a schema-owned `image_url` field and proves that the verified private URL reaches the ephemeral provider body while asset ID and internal metadata do not.
3. Seedance 2.5 paid I2V projection now has a literal regression for the canonical `image_url` and `end_image_url` inputs used by the real site body builder. The full private-reference-to-BytePlus payload suite remains green.

## RED evidence

The three pre-existing gaps were reproduced first on the reviewed base: H3 accepted an unverified HTTPS clip, private materialization failed at exact-field selection, and Seedance I2V expected no canonical inputs.

A first production skeleton was accidentally started before the new Task 7 RED file existed. Work stopped immediately. The literal tests were then applied to a temporary detached worktree at the exact base commit, with production files restored to base, before implementation continued. Results were:

```text
tests/mcp-p0-video-parity.test.ts: 0 passed, 3 failed
- lifecycle/default filtering and successor tuple absent
- exact staging prelaunch resolver absent
- hidden 23-mode P0 details unavailable

existing focused REDs:
- H3 HTTPS: missing expected exception
- project budget: 14 lines rejected
- private asset: confirmed references did not match exact mode fields
- Seedance paid body: canonical image field projection mismatch
```

This sequencing deviation is recorded explicitly; all subsequent production slices were driven to green by those tests.

## GREEN evidence

Focused lifecycle, catalog/details/recommendation, guidance/source, execution, project budget, prepare/confirm, canary, special-mode, existing contract-gap, and P0 routing/pricing/body/validation suites:

```text
201 tests, 201 passed, 0 failed
```

Broader MCP plus P0 suite:

```text
935 tests, 935 passed, 0 failed
```

Deterministic gates:

```text
pnpm model:registry:check                    pass (50 models, 2 tombstones; 50 catalog entries; 42 roster entries)
pnpm --prefix frontend exec tsc --noEmit    pass
npm --prefix frontend run lint              pass, 0 warnings
npm run lint:exposure                       pass
git diff --check                            pass
```

The registry check emitted only the repository's existing Node-engine warning because the host uses Node 23.9.0 while the package requests Node 22.x.

## Security proof

- Access requires `NODE_ENV=production`, the exact `maxvideoai-mcp-staging.vercel.app` host, the operational staging flag, a non-null exact OAuth client ID, and exact allowlisted account and client IDs.
- Missing or wrong host/account/client returns no access. Publication drift or any missing P0 registry identity invalidates the entire private set.
- Hidden resolution uses exact engine IDs only. Public list/recommend remain non-enumerating and unchanged.
- Prepare and confirm use the normal canonical validation, pricing, quote, transaction, wallet reservation, paid body, and provider owners. Confirmation reloads hidden engines through the caller's locked transaction executor and recomputes the same catalog revision.
- Deep-legacy selection is absent from the executable catalog; a pricing spy proves budget rejection occurs before canonical pricing. Existing prepare/confirm suites prove catalog rejection occurs before wallet reservation and provider submission.
- No client metadata is trusted for duration. The H3 regression accepts only database-resolved duration facts.

## Deviations and residual risks

- There is no currently authored retired runtime engine. Fix round 2 therefore exercises a schema-valid synthetic registry through the real repository validator, runtime projection/resolver, and exact MCP details owner without adding a fake production row.
- Hidden confirmation reloads seven configured engines sequentially inside the transaction. This avoids concurrent queries on one executor and preserves the locked override snapshot, at the cost of a small staging-canary-only query overhead.
- P0 guidance evidence URLs are authored now but stripped from prelaunch output. Task 14 publication will expose them automatically when app publication becomes true.
- Public HTTPS duration fail-closed behavior is deliberately scoped to the reviewed MiniMax H3 contract. Other canonical workflows that permit public references without trusted duration metadata retain their Task 4 behavior; resolved owned assets still enforce every authored duration constraint.

---

## Fix round 1 — read-only catalog boundary and real retired identity

Base: `6542013edd4ce80f5eaae2978c4d3b2d37988129`.

### Findings closed

1. MCP exact hidden resolution no longer reaches the mixed site engine owner
   that may run `ensureBillingSchema` and `ensureEngineSettingsSeed`. The MCP
   catalog now imports a dedicated read-only owner. Its ordinary path reads
   settings and overrides without bootstrap; its confirmation path issues only
   the existing share lock and two `SELECT` statements through the caller's
   transaction executor. The normal website/admin configured-engine functions
   retain their existing bootstrap behavior.
2. Exact retired details now resolve from an injectable canonical runtime
   identity even when no raw engine or `EngineCaps` remains. The generic runtime
   schema can carry an authored optional `label`; the returned historical DTO
   preserves ID, label, slug, video/image surface, retired lifecycle, and the
   canonical replacement tuple while returning no modes, prompting sources,
   guidance, public URLs, or catalog timestamp. A fixture-only runtime identity
   exercises this behavior; no fake retired production row was added. If the
   authoritative identity is incomplete, lookup fails before consulting any
   executable catalog owner.
3. The Wan prompting source is the exact frozen Task 1 owner URL:
   `https://docs.modelstudio.console.alibabacloud.com/en/model-studio/wan3-video-generation-guide`.
4. The staging prelaunch resolver now has a narrow runtime lookup seam. A drift
   test proves the result is exactly all seven current app-unpublished P0 IDs or
   `null` when any one publication record changes.

Budget, prepare, and confirm continue to select only executable catalog
candidates. Explicit retired requests are rejected before canonical pricing,
quote persistence, wallet reservation, or provider submission.

### RED evidence

Before any fix-round production edit:

```text
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-read-only-engine-resolution.test.ts \
  tests/mcp-model-prompting-sources.test.ts \
  tests/mcp-p0-video-parity.test.ts

12 tests: 6 passed, 6 failed
- frozen WAN URL mismatch
- retired exact details returned ENGINE_UNAVAILABLE
- injected publication drift still returned all seven IDs
- read-only owner/behavioral imports were absent
```

A second RED added after the read-only owner existed but before wiring the MCP
catalog factory to its injectable read seam:

```text
tests/mcp-read-only-engine-resolution.test.ts
4 tests: 3 passed, 1 failed
get_model_details/project-budget read counters: expected 4, received 0
```

### GREEN evidence

Focused lifecycle, read boundary, details, sources, P0, budget, prepare,
confirmation, canary, request-body, and pricing suites:

```text
115 tests, 115 passed, 0 failed
```

Registry/runtime replacement and validation suites:

```text
36 tests, 36 passed, 0 failed
```

Broad MCP and P0 suite:

```text
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-*.test.ts tests/p0-*.test.ts
952 tests, 952 passed, 0 failed
```

Deterministic gates:

```text
pnpm model:registry:check                    pass (50 models, 2 tombstones; 50 catalog entries; 42 roster entries)
pnpm --prefix frontend exec tsc --noEmit    pass
npm --prefix frontend run lint              pass, 0 warnings
npm run lint:exposure                       pass
git diff --check                            pass
```

The only warning remains the local Node `v23.9.0` runtime versus the declared
Node `22.x` engine. The fix-round commit hash is reported in the handoff because
a commit cannot contain its own hash.

---

## Fix round 2 — authorable engine-less retired identities

Base: `0fdb543a6979434a9a40d32383175cc5783f1b52`.

### Finding closed

The authored registry can now retain a fully retired replacement after its raw
engine and generated engine-catalog entry are removed. This is a narrow
registry rule, not a second catalog:

- `current`, `legacy`, and `deep_legacy` identities still require an
  engine-catalog owner;
- an engine-less identity must be `retired`, point directly to a `current`
  replacement with a published model page, disable every publication,
  comparison, pricing, sitemap, rank, variant, and discovery field, and retain
  a non-empty authored marketing `label`;
- `presentationOnly` remains unchanged and cannot represent retirement;
- the label remains optional for a retired identity that still has an
  engine-catalog row.

The actual runtime projection carries the authored label and flattened public
target. `getAgentModelDetails` now resolves that target through the same
injected runtime loader used for the retired identity. A schema-valid synthetic
registry is validated against a synthetic repository, projected by
`buildModelRuntimeProjection`, loaded by `createRuntimeModelResolver`, and then
read through the real details path. It returns the original ID, label, slug,
surface and retired lifecycle with the canonical replacement tuple, but no
modes, guidance, prompting sources, public URLs, or executable state. Default
list and recommendation omit it. No cast-built runtime entry and no fake
production registry row remain.

The round-1 budget, prepare, and transactional-confirmation spies are preserved:
retired selection still fails before canonical pricing, quote persistence,
wallet reservation, or provider submission.

### RED evidence

Before round-2 production edits:

```text
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/retired-model-runtime-identity.test.ts

3 tests, 0 passed, 3 failed
- the repository validator rejected the valid retired row as missing from engine-catalog
- the missing-label negative reached the same generic missing-catalog guard
- the initial standalone runtime-only negative did not fail
```

The last assertion above was intentionally removed: a runtime document does
not know whether an identity is still catalog-backed, and a catalog-backed
retired row is allowed to omit the optional label. Before correcting the
over-strict implementation, that exact requirement was added as a second RED:

```text
tests/retired-model-runtime-identity.test.ts
3 tests, 2 passed, 1 failed
- catalog-backed retired identity without label was rejected by document validation
```

The final negative boundary now lives where ownership is known: repository
validation rejects a missing label only when the retired engine-catalog row is
absent.

### GREEN evidence

Focused registry/runtime plus MCP P0, budget, prepare, and confirm contracts:

```text
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/retired-model-runtime-identity.test.ts \
  tests/model-registry-validation.test.ts \
  tests/model-runtime-replacement-routing.test.ts \
  tests/model-registry-parity.test.ts \
  tests/mcp-p0-video-parity.test.ts \
  tests/mcp-prepare-generation.test.ts \
  tests/mcp-confirm-generation.test.ts

99 tests, 99 passed, 0 failed
```

Broad MCP/P0 plus the new end-to-end retired projection contract:

```text
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-*.test.ts tests/p0-*.test.ts \
  tests/retired-model-runtime-identity.test.ts

953 tests, 953 passed, 0 failed
```

Deterministic gates:

```text
pnpm model:registry:check                    pass (50 models, 2 tombstones; projections current)
pnpm --prefix frontend exec tsc --noEmit    pass
npm --prefix frontend run lint              pass, 0 warnings
npm run lint:exposure                       pass
git diff --check                            pass
```

The production registry and every generated projection remained byte-stable;
no schema-version change or production retired fixture was needed. The only
warning remains Node `v23.9.0` versus the declared Node `22.x` engine. The
round-2 commit hash is reported in the handoff because a commit cannot contain
its own hash.
