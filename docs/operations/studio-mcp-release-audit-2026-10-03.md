# Studio marketing and MCP release audit — 3 October 2026

Status: **local implementation and offline verification completed; no production
release, plugin publication or new host certification**. Branch:
`codex/studio-creative-workspace`, base commit
`8f46dc3bdfed2a020dafed18873e61433ea54afe`, plus the reviewed working-tree changes.
This audit covers discovery/instructions, model-policy coherence, plugin update
checks and public Studio copy. Studio economics, authenticated interaction and
production infrastructure have separate owners and release reviews.

## Findings and changes

| Finding | Change and boundary |
| --- | --- |
| General MCP instructions grew to 12,937 UTF-8 bytes with all branch capabilities enabled. Paid consent appeared late in the text. | Replaced the manual with a short discovery entrypoint. Exact quote, explicit approval, one attempt and recovery are in the first kilobyte. Detailed rules moved to their operation descriptors and runtime assertions. No tools, schemas, provider routes or spending gates were added. |
| The branch lacked the MCP client-experience guide and nested maintainer instructions present in the primary checkout. | Read those primary-checkout files as supplemental guidance, then added a branch-specific guide and server/plugin `AGENTS.md`. Selected descriptor guidance was reconciled with this branch's editorial policy and two additional Studio gates. This was not a wholesale merge of newer runtime changes. |
| The planning skill discouraged a host attachment even though generation supports authorized host-file import. | Clarified that an authorized attachment is an import source and its returned owned asset ID is the generation input. Added deferred-tool/authentication diagnosis and continuity to both skills. |
| A mode-coverage paragraph still described two public H3 Max mode exclusions as unpublished prelaunch pairs. | Corrected the paragraph to three app-published but execution-gated model-mode pairs. Kept the existing fail-closed execution behavior. |
| Privacy explanations did not explicitly distinguish external-host conversations from requests sent to MCP. | Added that boundary to the EN/FR/ES MCP documentation and packaged privacy guide. No collection or retention behavior changed. |
| No public Studio page existed in this branch. | Added `/studio`, `/fr/studio` and `/es/studio`, public discovery links, localized metadata, reciprocal alternates, visible FAQ/JSON-LD and sitemap discovery. Copy describes chat-led creation and available project tools while explicitly identifying a private preview. Main entry uses `/api/studio/marketing-entry`; account authorization remains with its existing owner. |
| The plugin release workflow had no consolidated client-experience gate. | Added `pnpm mcp:client:check` before local release builds and in the preparation job of the existing publication workflow. Source, deployment, package installation and per-host qualification remain separate steps. |

## Measured instruction contract

Measured against actual in-memory MCP `initialize` and `tools/list` output:

- **128 capability combinations**, covering generation, references, Audio,
  montage planning, Studio project creation, timeline editing and export.
- General instruction range: **834–1,762 bytes**; previous range **5,864–12,937**.
- Largest tool description: **1,767 bytes** (`get_model_details`). Every
  description stays within the 2,000-byte repository budget.
- All-capability inventory: **25 tools**, including the app-only download tool;
  combined tool-description text is **15,988 bytes**.

These are UTF-8 string measurements. They exclude input/output schemas, returned
content, skills and host additions. The smaller general block is not a claim of
an equivalent reduction in total model context or improved live tool selection.
The 2,000-byte limit is a conservative repository budget, not a universal protocol
limit. Tool gates and annotations are checked without invoking business services.

Preserved rules include named-model preference, null/omitted unstated inputs,
owned reference roles/order, import partial success, UTC quote expiry, exact
approval, one paid attempt, refund/reconnect non-authorization, top-up/requote,
job recovery, returned polling delay and completed-result delivery. Studio
retains revision/track-lock ownership, source-limited frame edits, exact export
approval and temporary-artifact delivery recovery without a replacement render.

## Catalog and recommendations

`model:registry:check` reports **55 authored/runtime models, 2 tombstones, 55
engine-catalog entries and 54 roster entries**, with current generated projections.
No model identity, publication, alias, successor or generated projection changed.
Focused catalog, details, executability, guidance, recommendation and special-mode
contracts pass. Default discovery remains current/app-published; exact legacy and
retired lookup semantics and model-specific executable gates remain unchanged.

The existing `2026-10-03.1` editorial policy has 15 exact video reference entries,
14 alternatives and one on-request entry. This audit does not change their ranks,
provenance, dates or weighting. MCP descriptors retain exact-version freshness,
review provenance and the distinction between editorial preference, measured
quality and execution certification. A compatible explicit user choice takes
precedence. No artistic comparison, real-model benchmark or paid generation was
performed; competitor positioning is not substituted for such evidence.

## Verification performed

| Check | Local result |
| --- | --- |
| `pnpm mcp:client:check` | 122 tests: 121 passed, 1 skipped; all 70 curated offline scenarios pass. The skipped combined authoring-validator test requires a locally absent plugin validator. Both skills were separately validated successfully with the installed skill validator and an existing cached PyYAML dependency. |
| Catalog/integration/public-copy/navigation suite | 150 passed, no skips. Includes immutable MCP public baseline, registry, localized copy, route architecture and SEO signals. |
| Runtime metadata, release-bundle/mirror and Studio marketing suite | 103 passed, no skips at that checkpoint; the subsequent English-wrapper regression is covered in the final Studio page suite. |
| `tests/studio-marketing-page.test.ts` | 6 passed; canonical/alternate/schema parity, locale paths, public navigation, access handoff and explicit English wrapper verified. |
| `pnpm model:registry:check` | Passed; no projection drift or authored model changes. |
| Focused ESLint and public exposure check | Passed for changed public Studio/MCP/route owners. |
| Plugin release builder | Local archive built and independently checked by release/mirror contracts; 60 archive files, excluding maintainer `AGENTS.md`. No upload or tag change. |
| Public HTTP/browser smoke | EN/FR/ES returned 200 with localized canonical, reciprocal alternates, JSON-LD and one `main`; Chromium at 320, 390, 768, 1024 and 1440 px had no horizontal overflow. FAQ opens and main CTA retains the access handler. No page exceptions recorded. |
| Sitemap | Local English sitemap contains `/studio` and its EN/FR/ES alternate destinations. |

The browser server used an environment allowlist without database, provider or
payment credentials. Outbound browser requests were blocked. The site's shared
cookie-version endpoint cannot read its database in that fixture; its missing
configuration is not a successful production cookie-service test. No generation
or payment endpoint was called. The first browser run caught the missing English
wrapper and an initial custom-server working-directory issue; both were corrected
before the final HTTP/viewport pass.

Local evidence is under `output/studio-creative-workspace/`: `mcp-size-audit.ts`,
`marketing-browser-results.json`, `marketing-responsive-results.json`,
`marketing-final-390.png`, `marketing-final-1440.png`, and `plugin-release-audit/`.
These are working QA artifacts, not production evidence. A screenshot of the
actual updated Studio is now represented by the integrated release capture described below; no invented product image is used.

## Remaining release gates and non-claims

- The final integrated TypeScript check remains pending. A whole-app snapshot
  during concurrent implementation reported JSX parse errors in the separately
  owned `frontend/app/(core)/admin/studio/_components/AdminStudioList.tsx`;
  this audit does not claim a passing whole-app type check.
- Studio's `adminOnly` gate remains enabled. The public explanatory page does not
  activate customer access or certify the assistant, persistence or economics.
- No new Codex, Claude, ChatGPT, OpenClaw or n8n host run was performed. Existing
  integration registry evidence, dates and store states remain unchanged. New
  metadata needs independent per-host refresh/reconnect and fresh-chat tests.
- Curated fixture decisions are unchanged. Only their policy fingerprint was
  refreshed after instruction review. Offline adherence is not real-host
  selection precision/recall or customer satisfaction.
- The archive retains the branch's source version **0.3.5** for inspection only.
  It must not replace an already published tag. Reconcile with current published
  versions and choose a new unused immutable version before an authorized release.
  No installed plugin cache was edited.
- No production rollout, OAuth lifecycle retest, paid model/provider canary,
  billing reconciliation or broad browser/device certification is claimed.
- This is a new page with responsive functional checks, not a measured Core Web
  Vitals improvement. Capture comparable production-loading evidence if hero media
  is added or changed; verify the exact reviewed image and its dimensions.
- Studio now has a restricted, audited review of retained visible turns and usage facts; see `docs/engineering/admin-studio-review.md`. Full context/version manifests, capture-health metrics and learning evaluation remain separate work. MCP does not expose full external-host conversations.

## Reproduce and ship

Follow [MCP client experience](../engineering/mcp-client-experience.md) for the
consolidated offline command, instruction ownership and per-host protocol. Use
[model registry](../engineering/model-registry.md) for model updates and
[integration registry](../engineering/mcp-integration-registry.md) for host/store
claims. Run the affected suites and public HTTP smoke again on the final immutable
release candidate; these local results do not replace that final check.

Public Studio content lives in
`frontend/app/(localized)/[locale]/(marketing)/studio/_lib/studio-marketing-copy.ts`;
its English wrapper is `frontend/app/studio/page.tsx`. Keep EN/FR/ES changes,
metadata, visible FAQ/schema and preview-access claims aligned. The authenticated
entry handler owns access and return destinations; do not bypass it from marketing.


## Supplemental assistance-client review — 4 October 2026

A focused read-only implementation review identified account-switch mutation
ownership, stale callbacks, returning from Luna to retained paid Sol, revoking
paid assistance during pending usage, and read-only recovery of an unresolved
conversation as issues. The implementation owner corrected those paths. Nine
new behavioral hook tests in `tests/studio-assistance-hook.test.ts` exercise stale
reads, immediate repeated clicks, unknown/malformed acknowledgements, revision
conflicts, account changes before effects and during writes, obsolete callbacks,
lost network acknowledgements and recovery reads. The focused hook, dialog,
client-contract and existing conversation-hook run passed **34 of 34** tests.
The three dialog/recovery changes were also inspected in source; their final
integrated browser qualification remains with the release owner. This review
performed no provider call, payment, migration or production activation.

The integrated release includes a real Studio capture (1354 × 832, 48,132-byte WebP), made from the rendered conversation surface with demonstration media. Its caption explicitly identifies the local preview. No generated mockup or fabricated model reply is used.
