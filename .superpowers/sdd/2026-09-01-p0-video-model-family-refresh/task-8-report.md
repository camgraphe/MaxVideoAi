# Task 8 report — localized P0 model pages and lifecycle transitions

Date: 2026-09-01

## Revision

- Base: `ecbe8524aee7df49c54ecca5788fd9ddf13a8456`
- Initial implementation: `4713ad64f27f2148cee1bd163cafef5f5a935619`
- Review-fix round 1: `fa14c1e76795601ecd960fb5ea1b6b1dda8836fb`
- Review-fix round 2: reported in the Task 8 handoff because a commit cannot contain its own hash.

## Outcome

Seven complete normal model-page templates and 21 exact EN/FR/ES content documents now exist for Wan 3, Wan 3 Prime, LTX 2.5 Fast, LTX 2.5 Pro, Grok Imagine Video 1.5, FLUX.3 and FLUX.3 Draft. The real registry publication flags remain false, so the routes, app engines, examples, pricing rows, comparison discovery and sitemap entries remain hidden until Task 14.

The model-page template inventory is now 49. Every locale has 49 strict decision, prompting and Examples documents. Examples visibility is 35 visible and 14 hidden per locale, or 105 visible and 42 hidden across the three locales. Every new hidden gallery keeps `showWhenEmpty: false`, `fallbackItems: null`, template examples enabled and no placeholder media.

All seven launch pages distinguish the model owner from distribution: Alibaba/Tongyi, Lightricks, xAI and Black Forest Labs own their respective model families, while Fal distributes these seven launch endpoints. No new direct-provider route, agreement claim, fallback, adapter or provider pricing owner was introduced. Existing direct routes remain unchanged.

## Canonical pricing scenarios

The page-template manifest is frozen and rendered through the existing Task 5 quote path:

- every model: 6 seconds, 720p, T2V;
- Wan 3, Wan 3 Prime, Grok and FLUX.3: 6 seconds, 1080p, T2V;
- LTX 2.5 Fast: 6 seconds, 4K T2V plus 6 source-audio seconds at 1080p A2V;
- LTX 2.5 Pro: 6 seconds, 1080p T2V plus 6 source-audio seconds at 1080p A2V;
- Grok: 8 seconds, 480p ref2v with two reference images;
- FLUX.3 and FLUX.3 Draft: 6 seconds, 720p extend.

The pricing-page scenario adapter now forwards A2V `durationSec` as the trusted `inputAudioDurationSec` expected by the canonical pricing definition. The pages contain no finished total, provider rate or commercial formula; the rendered cards consume exact live canonical quote results.

## Content and link audit

- All 21 new documents parse through the strict decision, prompting and Examples contracts and have identical structural and semantic IDs across EN/FR/ES.
- Useful localized copy ranges from 1,057 to 1,240 words per page, above the required 400-word threshold.
- Each page retains at least 80% page-specific normalized sentences, and every locale has seven unique title/description pairs.
- Every page contains localized best-fit, non-fit, workflow, constraints, prompting, family-position, attribution and safety copy.
- Every page has seven or eight unique authored links including the locale-correct family examples, pricing anchor, app CTA, sibling/successor where applicable and two to four contextual editorial destinations.
- Future comparison destinations exist only in the seven hidden P0 documents. Currently published legacy documents contain no Task 13 upgrade-pair URL, and the rendered decision-data projection filters every comparison link through the canonical published-pair catalog. The seven template quick-link arrays still contain no future comparison route, so publication-backed discovery remains gated for Task 13.
- Official prompt guidance uses only the reviewed owner URLs for Alibaba Model Studio, LTX, xAI and Black Forest Labs.
- Content contracts reject authored prices, margins, blanket-superiority copy, fake media and direct-provider claims.

## Lifecycle and SEO audit

All 18 required EN/FR/ES lifecycle documents were updated:

- legacy: LTX 2.3 Pro → LTX 2.5 Pro, LTX 2.3 Fast → LTX 2.5 Fast, Wan 2.6 → Wan 3;
- deep legacy: LTX 2 → LTX 2.5 Pro, LTX 2 Fast → LTX 2.5 Fast, Wan 2.5 → Wan 3.

Legacy pages keep the old executable engine CTA, their version-specific title and self-canonical indexable identity, while linking the exact current successor and already-published contextual comparisons. Their Task 13 upgrade scoreboards remain absent until canonical pair publication. Deep-legacy pages keep historical facts, examples, pricing presets and self-canonical identity, remove current/recommended generation language and obsolete model links, and route every generation CTA to the exact successor. No registry replacement, public redirect or tombstone was added; the 28-day Search Console redirect decision remains deferred.

## Audit compatibility

The repository model audit previously used one published-slug set for both required and allowed content. That treated valid registered-but-unpublished page documents as unregistered extras. It also required obsolete root `hero`, `bestUseCases`, `technicalOverview` and `faqs` blocks even when the strict rendered `decision` schema owns those sections.

The audit now:

- still requires every published model document in every locale;
- allows content only for canonical registry slugs, including hidden registered identities;
- recognizes decision content as the current rendered marketing owner only after the shared strict parser validates every required nested block, without adding dead fields to the new JSON.

`pnpm models:audit` passes with 49 documents per locale, zero critical findings and nine expected warnings for family-resolution-disabled hidden identities. Its mutation contract still produces exactly the 19 intentional critical Examples findings.

## RED evidence

Before production edits:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/p0-model-page-seo-content.test.ts \
  tests/model-page-template-registry.test.ts \
  tests/model-decision-content-contract.test.ts \
  tests/model-prompting-content-contract.test.ts \
  tests/model-examples-content-contract.test.ts
```

Result: 51 tests, 37 passed and 14 failed. The failures covered the absent seven templates and 21 localized documents, old 42-template/35-visible-and-7-hidden invariants, missing canonical pricing presets, and lifecycle copy/CTA expectations.

After the new content exposed the historical audit assumptions, `tests/models-audit-examples-contract.test.ts` was the second RED: the temporary audit reported 29 instead of the 19 intentional mutation findings because it added three unpublished-content parity findings and seven dead-schema completeness findings.

## GREEN evidence

Focused page/content/template/pricing/lifecycle/audit suites:

```text
103 tests, 103 passed, 0 failed
```

Publication, hidden-execution, registry, pricing, SEO and sitemap suites:

```text
97 tests, 97 passed, 0 failed
```

Model registry and content audit:

```text
pnpm model:registry:check  valid (50 models, 2 tombstones; 50 catalog entries; 42 roster entries)
pnpm models:audit          pass (49 EN / 49 FR / 49 ES; 0 critical; 9 hidden-family warnings)
```

Final deterministic gates:

```text
pnpm --prefix frontend run i18n:check                  pass (FR 4,207; ES 4,201)
pnpm --prefix frontend run seo:check                   pass
pnpm --prefix frontend exec tsc --noEmit --pretty false pass
npm --prefix frontend run lint                         pass, 0 warnings
npm run lint:exposure                                  pass
git diff --check                                       pass
```

The repository-wide `pnpm test:validate` completed with 3,848/3,852 passing. Its four failures are upstream contracts outside the Task 8 diff and were already documented by earlier task reports:

1. Black Forest Labs theme tokens are absent from both light and dark CSS themes.
2. The generate-route attachment-delegation contract still expects the older owner split.
3. The synthetic retired-model redirect contract still expects replacement redirects not emitted by the current registry helper.
4. The workspace composer split contract still expects `UNIFIED_VEO_FIRST_LAST_ENGINE_IDS` in the engine/mode hook.

## Deviations and residual risks

- `scripts/models-audit.mjs` was not in the initial file list, but the new valid hidden documents made its published-only assumption fail the full suite. The narrow correction preserves unknown-slug rejection and published-content requirements while avoiding dead content fields.
- The seven P0 identities are deliberately absent from public model, app, Fal proxy, roster, family, pricing, comparison and SEO discovery. Task 14 must keep the registry flip atomic; deploying only the authored configuration is not a launch.
- Future comparison destinations are authored but unresolved until Task 13 creates the reviewed scoreboard-only comparison records. They must not be promoted through template or hub discovery before then.
- Galleries remain empty until Task 12 supplies two accepted durable videos per model. No fallback media was invented.
- Local verification ran under Node 23.9.0 while the repository requests Node 22.x. All requested gates passed, but Task 15 still owns the release-runtime verification.

## Review fix round 1

The first independent review requested four corrections. Each received a failing contract before production edits:

1. Published LTX 2.3 Pro, LTX 2.3 Fast and Wan 2.6 documents still authored Task 13 upgrade-pair URLs, and projected published content exposed another unpublished Kling pair. The new projection guard extracts comparison slugs from all EN/FR/ES route families and consults `isPublishedComparisonSlug`; optional quick links/cards are withheld and required CTA fields fall back to their safe template destinations. All published model decision projections are now checked recursively, while hidden P0 editorial comparison references remain authored but non-rendered.
2. `models-audit` previously treated any object-shaped `decision` as complete. It now calls the same `parseModelDecisionContent` contract as the rendered page. A temporary-content mutation test proves `{}` and the absence of hero, media, features, decision cards, workflows, pricing copy or metadata each produce a critical `invalid_localized_decision_content` finding and cannot satisfy legacy marketing coverage.
3. Every EN/FR/ES deep-legacy document now points all generation hrefs to its exact current successor, removes direct navigation to LTX 2, LTX 2 Fast and the 2.3 predecessor pages, and describes the old route as historical/deep-legacy rather than retired or currently recommended. Recursive href and visible-copy assertions cover the complete documents rather than spot fields.
4. Grok EN/FR/ES workflow owners now explicitly cover canonical t2v, single-opening-image i2v through 1080p with source-fixed framing/no separate aspect-ratio control, and ref2v with one to seven references addressed from `<IMAGE_0>` at 480p/720p. The contract also locks the canonical runtime mode, resolution and reference-count facts without introducing a blend workflow or dead schema.

Round-1 RED:

```text
14 tests: 8 passed, 6 failed across all four review findings
```

Round-1 focused GREEN:

```text
page/content/template/pricing/lifecycle/audit: 134/134 passed
final changed-owner rerun:                   49/49 passed
models:audit:                                49 documents per locale, 0 critical, 9 expected warnings
```

Round-1 gates:

```text
model:registry:check                          pass (50 models, 2 tombstones; 50 catalog, 42 roster)
i18n:check                                    pass (FR 4,207; ES 4,201)
seo:check                                     pass
tsc --noEmit                                  pass
frontend lint                                 pass, 0 warnings
lint:exposure                                 pass
git diff --check                              pass
```

The round-1 repository-wide `pnpm test:validate` exposed an additional deterministic-isolation defect in `analytics-consent.test.ts`: its unauthorized-link fixture was created and deleted inside the real `frontend/` source tree while architecture scanners could be walking that tree. Review fix round 2 below removes that race and supersedes the round-1 full-suite baseline.

## Review fix round 2

The internal-link guard now exposes a synchronous testable runner with a validated scan-root option. Calling it without an override always resolves and scans the canonical repository `frontend/` root, independent of the caller's current directory. The production `seo:check` command continues to invoke the guard with no override. An override must be explicit, absolute, resolvable and a directory; fixed navigation, dictionary and Company ownership contracts still read the canonical repository even when only the broad semantic walk is isolated.

`analytics-consent.test.ts` now creates its unauthorized `/company` fixture with `mkdtempSync(tmpdir())`, builds only the minimal `frontend/lib/analytics` fixture tree outside the repository, invokes the guard with the explicit fixture root and recursively cleans the temporary directory. It asserts before and after the mutation that the former repository fixture path does not exist. No test writes into a repository scan root.

Round-2 RED before production edits:

```text
20 concurrent analytics-consent + architecture-audit runs: 1 passed, 19 failed
normal two-file run after adding contracts:               25 passed, 3 failed
```

The failures reproduced both race forms: architecture audit received `ENOENT` after discovering a fixture another process deleted, and a default guard observed an unauthorized fixture owned by another test process. The three new contract failures covered the absent testable runner, absent override validation and ignored CLI scan-root argument.

Round-2 GREEN:

```text
20 concurrent analytics-consent + architecture-audit runs: 20/20 passed
analytics, architecture, Company and return-policy tests:   36/36 passed
Task 8 focused page/content/pricing/publication tests:       134/134 passed
no repository fixture or temporary fixture directory leaked
```

Round-2 gates:

```text
model:registry:check                          pass (50 models, 2 tombstones; 50 catalog, 42 roster)
models:audit                                  pass (49 documents per locale, 0 critical, 9 expected warnings)
i18n:check                                    pass (FR 4,207; ES 4,201)
seo:check                                     pass, including the default canonical internal-link scan
tsc --noEmit                                  pass
frontend lint                                 pass, 0 warnings
lint:exposure                                 pass
git diff --check                              pass
```

The latest repository-wide `pnpm test:validate` completed with 3,855/3,859 passing and no analytics or architecture-audit failure. Its four failures are the stable upstream debts outside the Task 8 diff: missing Black Forest Labs theme tokens, the generate attachment-delegation owner split, the synthetic replacement-redirect fixture, and the workspace `UNIFIED_VEO_FIRST_LAST_ENGINE_IDS` contract.
