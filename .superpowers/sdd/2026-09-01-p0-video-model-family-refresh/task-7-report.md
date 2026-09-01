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

- There is no currently authored retired runtime engine, so retired behavior is implemented generically through the runtime replacement/public target path but cannot have a real production-fixture execution test until such an identity exists.
- Hidden confirmation reloads seven configured engines sequentially inside the transaction. This avoids concurrent queries on one executor and preserves the locked override snapshot, at the cost of a small staging-canary-only query overhead.
- P0 guidance evidence URLs are authored now but stripped from prelaunch output. Task 14 publication will expose them automatically when app publication becomes true.
- Public HTTPS duration fail-closed behavior is deliberately scoped to the reviewed MiniMax H3 contract. Other canonical workflows that permit public references without trusted duration metadata retain their Task 4 behavior; resolved owned assets still enforce every authored duration constraint.
