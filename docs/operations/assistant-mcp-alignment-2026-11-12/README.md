# Assistant, MCP and OpenAI alignment — 12 November 2026

## Sources and branch ownership

Fresh `origin/main`: `17bd771e64c2fa1186acdcb69245bb0c45b82ce3` (PR #648). Shared Desktop checkout: `codex/minimax-h3-reference-metadata`, with unrelated untracked work preserved. This work uses `codex/assistant-mcp-alignment-20261112` in its own managed worktree.

Marketplace initially: `5b75bf990`, 24 commits unique to the branch, missing the two #648 commits. OpenAI Audit Marketplace owns its integration and confirmed local synchronization to `a5123a42e051e545c775214cc2cb6171f2762483`. Its uncommitted `paquet-final-et-scenarios.md` and private presentation/media remain owned by that chat.

The adjacent `live-inventory.json` records actual connected tool inventories and live image/video catalogues. Tool presence is host discovery evidence, not proof that a tool executes successfully. No paid confirmation was called.

## Initial factual matrix

| Capability | Current web / Milo source | Direct MCP observed | OpenAI plugin observed | Dedicated Review / marketplace source | Classification and action |
| --- | --- | --- | --- | --- | --- |
| Image/video model catalogue | 44 registry current/app-published identities; configured catalogue intersects overrides and execution readiness | 43 current models including Kling 4/Flash, H3 Max, Wan 3/Prime, LTX 2.5, GPT Image 2.6 and FLUX 3 | Same 43 IDs and modes | Shared canonical catalogue; live lookup returns INTERNAL_ERROR | Pika is the only current-registry versus live-list difference. No evidence of missing new-model implementations. |
| Pika 2.2 | Registry current/published; production SELECT finds `engine_overrides.active=false` | Exact list empty; details ENGINE_UNAVAILABLE | Exact list empty | Positive package scenario still names Pika; isolated database need not contain production override | Confirmed portable policy drift. Encode closure in registry; historical retrieval remains intact. |
| Video modes | Canonical engine schemas; Milo intersects conversation certification | All canonical modes supported when executable; Omni retake intentionally requires private interaction state | Current catalogue matches direct MCP | Same owners and public-mode contract | Keep intentional private-state exclusion. Run the mode parity guard, do not infer availability from family names. |
| Audio / voice | Seven web packs; Milo certifies all seven tuples | Only Eleven v4 voice_only, 18 voices | Audio tools absent from this host inventory | Audio tools present; shared `listMcpAudioCapabilities` still Eleven-only | Documented first-release filter, plus stale/partial plugin discovery. Implement worker-backed broader projection locally; do not turn on remote gates. |
| Music, SFX, ambience, song, soundtrack packs | Existing validation, price, wallet, provider and refund owners | Excluded by public MCP projection | Not advertised by discovered tools | Same projection; synchronous multi-stage providers may exceed HTTP lifetime | Real adaptation needed: transactional dispatch plus external execution and recovery. |
| Character identities, looks, Recast | Shared Character Studio integration; Milo has list/get and Recast preparation | list/get/save/select and Recast prepare/confirm/status present | Character tools absent from host inventory | Same eight Character Studio tools present | Already implemented. Preserve OAuth/project ownership, exact original selection and independent passages. |
| Character Builder authoring | Web has typed identity/look recipes; saved output must originate in Builder | Existing descriptors send authoring to Builder web UI | Missing with Character tools | Same web handoff, not direct authoring | Concrete direct-authoring gap; investigate shared Builder quote/reservation owner, never save a generic image as a Builder recipe. |
| Creator profiles | Public tool identities; execution requires CREATOR_TOOLS_ENABLED; specialists have extra gates | list_creator_tools shows all non-subtitle profiles deploymentGateOpen=false; prepare/confirm absent | Creator tools absent | Prepare/confirm and subtitle tools present; runtime currently fails | Closed flags are distinct from missing implementation. Preserve real profile qualification and exact source checks. |
| Subtitles/corrections/SRT/VTT/burn-in | Shared versioned documents and operations | Read/edit/export-text/recovery discovered; new paid preparation absent | Absent from discovered inventory | Full tool family discovered | Existing implementation; refresh/reconnect and runtime gate qualification required. |
| Studio montage/timeline/export | Saved projects, exact sequence revisions and export quotes | Tools absent with production publication gates | Absent from discovered inventory | Full tool family discovered | Implemented behind independent gates; marketplace must preserve them. |
| Private imports and completed result recovery | Shared owned media and jobs | Tools present | Tools present | Tools present; marketplace improves signed private media delivery | Preserve marketplace delivery fixes, result envelope, legacy widget and new importer URI. |

Production configuration read was restricted to the Pika rows in `engine_overrides` / `engine_settings`, on project `shy-flower-71253790`, main branch `br-late-term-aeo22xpz`. `active=false` explains normal MCP behavior through `read-only-engine-catalog.ts`; no production failure or cache fault is inferred. Dedicated Review failure is recorded, without changing its resources or asserting a database cause.

## Local implementation after the inventory

| Area | Candidate behavior | Evidence and release boundary |
| --- | --- | --- |
| Pika | Registry `deep_legacy`, new app/pricing/examples selection closed; historical model, comparison URLs and owned results retained. | Commit `560aeeae6`; registry and retirement/quote tests plus three localized HTTP archive checks. Marketplace owner already cherry-picked it as `6a7da9849`. |
| Published model modes in Milo | Added the missing GPT Image 2.5 Sunburst image qualification. The real Studio service projection now includes all 43 live identities and 145 observed mode pairs. | `model-mode-parity.json`; native Sunburst text/edit preparation, concurrent confirmation and recovery on PG17. This is source/fixture evidence, not a paid canary for every model. Private-state Omni retake stays intentionally excluded. |
| Extended MCP Audio | Same seven web packs, same native pricing/providers/refunds, with a transactional immutable dispatch and an external one-attempt worker. Accepted work stays recoverable after new purchases close. | Migration 100 and both `MCP_AUDIO_EXTENDED_ENABLED=true` and `AUDIO_GENERATION_WORKER_ENABLED=true` are explicit local release prerequisites. Default public Eleven-only projection is unchanged. No remote switch or worker was activated. |
| Character Builder | Four direct MCP tools and native Milo prepare/save/select actions prepare/confirm/recover a native generated identity or look from owned references and a quote-bound recipe. Generic image quotes cannot masquerade as saveable Builder output. | Migration 101 plus `MCP_CHARACTER_STUDIO_ENABLED=1`, `MCP_CHARACTER_BUILDER_ENABLED=1`, paid generation and reference gates. Read/recovery tools remain when new Builder purchases close. Native web refinement actions remain available through their existing UI. In Milo, a saved selection can feed Builder or Recast; generic image/video reuse still uses the existing library attachment or ready project output boundary. |
| Creator tools and subtitles in Milo | Native typed discovery, preparation and saved exact-price card; explicit application confirmation; owned operation and document recovery, subtitle edits, revision-bound SRT/VTT and included captioned export. The canonical operation and Studio action receipt/checkpoint share a transaction. | Existing creator/profile/subtitle gates are reused. Paid and included operations both require approval. A lost acknowledgement or reload only reads the same saved operation; the model receives no confirmation authority. Private originals use signed access and manual media readers. |
| Other existing web creator tools | Truthful discovery and canonical handoffs retain Angle, Storyboard, Upscale and Background Removal and the already gated finishing profiles. | These web tools still have `mcpExecution=false`; their web-session/raw-source runners do not become generic paid MCP executors. Nothing was removed or silently enabled. No claim of direct authoring parity is made for these adapters. |
| Plugin guidance | Plan/generate now route Audio, characters/looks/Recast, creators/subtitles and Studio editing/export using live capability facts, exact approval and safe recovery. | New packaged `extended-workflows.md` reference and independent bundle inventory assertion. Installed host inventories still require an actual host refresh/requalification; editing source does not update a connected cache. |

Audio worker entry points are `pnpm audio-generation:worker` and the bounded `pnpm audio-generation:worker:once`. Build a new immutable image from the accepted source commit using the existing Node 22/FFmpeg worker Dockerfile and override its command; no image was built or published here. Apply only the approved database-specific migrations through the release owner. Processing/ambiguous attempts are never automatically reclaimed. If a total database outage prevents journaling newly produced artifact/provider evidence, operator reconciliation remains necessary; it is not permission to regenerate.

## Concurrent Business Hub work

Adrien explicitly requested coordination with **MaxVideoAI — fiche Business Hub ChatGPT**. Its PR [#649](https://github.com/camgraphe/MaxVideoAi/pull/649), branch `codex/chatgpt-ads-conversions`, had pushed candidate `a828ae91aeb5bd83acb91ef891744ae1a47ea16e` on base `17bd771e` when it replied. That owner reserves migration 99 (`openai_conversion_outbox`), conversion analytics, wallet/webhook/checkout hooks, `frontend/vercel.json`, cookies and privacy copy. This candidate does not touch those shared paths and reserves migrations 100/101 instead. That owner confirmed its authorized normal release complete: merged main `371ee9eaf6178b1b9c2579148bb59d7125699534`, Quality CI green, both domains aligned and first scheduled conversion run observed. This branch fetched and integrated that main locally as `566d430c8`; no production action belongs to this task. OpenAI Audit Marketplace has been informed and retains its own publication/adaptation ownership.

## Marketplace adaptations to preserve

- Dedicated direct/directory host routing, resource/audience isolation, OAuth scopes/challenges and reviewer binding.
- Adult consent/reconsent and their migration; no changes to normal auth ownership as a side effect of synchronization.
- Directory output schemas and structured error envelopes; account/billing and existing-entitlement projection.
- Standard MCP Apps UI resource/visibility metadata, compatible OpenAI aliases, immutable legacy widget and versioned importer.
- Private original-media access, short-lived signed delivery, inline result/download recovery and host tracking parameter compatibility.
- Dedicated environment guards, domain proof, build provenance and worker templates; no resource activation here.
- Immutable plugin package/version manifest, current qualification dossier and reviewer-only evidence.

## Current official OpenAI contracts checked

Fetched on 12 November 2026, using OpenAI Docs first and official-domain browsing after the documentation index did not return the Plugins pages:

- [Plugins reference](https://developers.openai.com/plugins/reference): declare outputSchema for structuredContent; prefer `_meta.ui.resourceUri` and `_meta.ui.visibility`; retain risk annotations that describe real effects and file parameter descriptors.
- [Authentication](https://developers.openai.com/plugins/build/auth): per-tool securitySchemes and protected-resource metadata plus runtime `mcp/www_authenticate` are complementary. Connection refresh cannot authorize a paid attempt.
- [Plugin UI changelog](https://developers.openai.com/plugins/changelog): current MCP Apps standard visibility/resource metadata and OAuth issuer/callback guidance. Compatibility aliases need not be deleted merely because standard metadata is preferred.

These are contract checks, not new host certification, publication or deployment evidence.

## Synchronization sequence

1. Marketplace owner integrates current main (done locally by that owner), retaining its own commits and dirty review document.
2. This branch delivers independently verified common commits. The marketplace owner cherry-picks/merges those commits and resolves only real overlaps.
3. Run registry/client checks, added business/PG17 checks and the dedicated directory output-schema, transport, OAuth, import, media-delivery and package checks.
4. Refresh each host catalogue independently. Reconnect only for an observed auth failure; preserve jobs/references and never turn a reconnect into a paid retry.
5. Dedicated live review and any paid recapture remain pending distinct authorization and operational availability. No production merge, deployment, migration or OpenAI submission is authorized by this audit.

## Execution ledger

- Baseline: `pnpm mcp:client:check` passed, 205 tests passed, one pre-existing skip; 70 offline selection scenarios passed. No host-selection metric inferred.
- Ruling: Pika closes through `deep_legacy` plus explicit publication fields rather than an environment-specific denylist. Its historical model/example identities remain readable, but current comparison/pricing/execution must omit it. Historical comparison URLs remain published, with their existing archive-side no-price/no-generation behavior.
- Ruling: keep current public Eleven behavior; broader Audio publication requires the new durable worker path, not a larger synchronous HTTP timeout.

- Concurrent release: Business Hub confirmed PR #649 merged as `371ee9eaf6178b1b9c2579148bb59d7125699534`; fetched here. Marketplace separately owns its four real overlap resolutions (privacy EN/FR/ES and Vercel config). Same-number migration prefixes alone are not a conflict: full filenames/tables are distinct. The official runner's 100/101 lexical-order defect was reproduced with fake psql and corrected to numeric-prefix/full-name ordering; no migration runner contacted a real database.
- Subtitle decision: Adrien explicitly chose one paid bundle with corrections/SRT/VTT/MP4 included, then requested 200% markup because supplier cost is low. The local subtitle-only policy uses exact provider cost × 3 before canonical rounding; all other creator products retain × 2.20. Exact costs/examples and remaining worker-cost uncertainty belong in `subtitle-economics.md`. No production price changed.


## Stable verification already completed

- Shared main integrated locally: `371ee9eaf` through feature merge `566d430c8`. No conflict with Business Hub ownership.
- Registry projections: `pnpm model:registry:check` passes. Localized Pika model routes return 200 with canonical/hreflang and archive WebPage JSON-LD; no active Product offer.
- MCP client: 227 tests pass, one pre-existing skip, and 70 curated offline selection scenarios pass. These are not real-host tool-selection metrics. All 1024 capability combinations fit the 2000-byte instruction limit (maximum 1998).
- The packaged `extended-workflows.md` content is bound into the policy fingerprint, now `2759ef51f1ce67b6050a4a0bf27d5c17ecd595bfba4ea22eee28fd7f87370397`. The 70 decisions and fixture contract `05f0fd68e1f8b0a403760bd68368a1cfeb73d85308750ffbc6808dc7e08cdb04` are unchanged.
- Root Audio/Builder combined runtime, PostgreSQL and CLI batch: 46/46. Full subtitle/creator pricing and lifecycle batch: 40/40. Native Milo Builder follow-up: 6/6 plus 37 existing regressions; independent review cleared both URL defects, strict selection, ownership and payment paths.
- Fresh frontend TypeScript exits 0; ESLint has 0 errors and 7 pre-existing warnings. Exposure and diff checks pass.
- Full Studio run initially reached 1599 passes, one skip and two failures. One Character search test incorrectly consumed a background image-library request; it now observes the exact Character endpoint. The other was a cold local HTTP compile timeout under excessive concurrent validation. The corrected/isolated admin, picker and mobile batch passes 21/21; no timeout threshold was increased.
- Both exhaustive financial cutover/activation tests pass, preserving all 26982 historical checkpoints plus 89 new-offer proposals per reviewed fixture. The completed browser outcome and broad fast follow-up are recorded below. Initial interrupted/overloaded attempts are not counted as passing evidence.


### Serial verification after reducing contention

On committed candidate `c9c0249a48fe3826c07336b34113466dc2d8ac15` (runtime commit
`a2d769069f16f9b2934f69df83a6311142cbb407` plus the two Product archive test updates):

- `pnpm qa:editor`: exit 0; 1601 tests pass, one pre-existing skip; TypeScript, lint and diff checks pass. Lint retains seven existing warnings.
- `pnpm --prefix frontend run build`: exit 0, including registry, SEO/Product, public rendition/poster, compilation and sitemap gates. This is a local build, not a deployed artifact or production domain verification.
- The canonical browser lane completed separately. The 1697-file fast manifest uses two workers without changing selected files, assertions or timeout thresholds.


The final offline projection also retains the ten explicitly published legacy
choices: 53 source catalogue models and 177 model/mode pairs in total. The live
current catalogue remains 43 models/145 pairs, all present in Milo's source.
Availability I/O is substituted in this projection; it is not provider qualification.

The receiving marketplace owner reported local cherry-picks as `2479c6610` and
`d37ca4bb9`, retaining four branch-specific conflict resolutions. Its combined
policy fingerprint differs legitimately from common because directory metadata
and instructions differ. The owner continues directory success/error DTO,
funding-profile, ZIP reference and private delivery/openUrl/saveSource adapters;
57 projection/recovery tests and five private-delivery tests were reported green.
This is counterpart evidence, not a new hosted Review execution claim.


### Remaining browser diagnostic

The serial canonical browser command completed 328/329 tests, with the four earlier
failures resolved. Its single remaining failure is a console hydration mismatch
in `connected-studio-conversation-browser-integration.test.ts`, after restoring
session selection: global Header/AppSiteMenu and MCP shortcut `useId` attributes
differ between server and browser. The exact same file/phase/IDs reproduce on the
exported untouched main 371ee9e baseline. No runtime suppression or forced click
was applied. Bounded triage reproduced the same baseline problem and retained no runtime workaround. See `header-hydration-baseline.md`. It does not establish the exact upstream cause.

The first complete fast manifest finished 11049 passed, 74 failed and one skipped across 11124 tests. Failures exposed stale current-Pika fixtures and a real offline audit representative-selection defect. Focused corrections retain historical identity, original amounts and current refusal contracts. The audit now explicitly selects frozen Pika/Luma representatives in historical scope; default live/admin scope stays unchanged. Actual audit, shadow-addition and public-baseline commands pass (270 scenarios/0 mismatches, 92 additions, 629 current public rows), without a helper or database connection. All frozen fixture JSON remains byte-identical. The completed final full manifest verification is recorded below.


### Final source and coordination state

`git fetch origin main` on 12 November 2026 at approximately 16:06 UTC still
resolved to `371ee9eaf6178b1b9c2579148bb59d7125699534`, already included locally.
The directory owner reported local package 0.3.21 and final branch-specific commit
`ab22291113f1495f02499f168efffde5b871b1e2`. Its private original-media adapter depends
on directory-only infrastructure, so no partial private-media cherry-pick was
made into common. The owner retains that full adaptation and hosted qualification.
No push, production action or new paid attempt was performed here.


## Completed final validation

Final source candidate: `60a1f3a8115cbd1c81fde7886fdbd5a2c88ebf52`.
The full fast manifest retained all 1697 selected files and ran alone with two
workers: **11226 passed, zero failed, one pre-existing skip** (11227 total),
858.493 seconds. Previously failing parent tests can now run their full nested
cases, so the final count exceeds the failed first pass.

The same serial runner then completed fresh TypeScript (exit 0), frontend ESLint
(exit 0, zero errors and seven existing warnings), exposure lint (exit 0), and
`git diff --check` (exit 0). Actual offline pricing commands and focused archive,
recall and architecture batches also pass. The historical JSON files are
byte-identical to main. Exact log hashes and durations are in `verification.json`.

The full editor (1601 passed, one skip), local production build and exhaustive
financial matrices (2/2) already passed on the unchanged runtime source. The
later runtime delta is restricted to three offline pricing-audit owners; public
admission, provider pricing and wallet/refund math are unchanged. No repeat of the
24-minute financial seed was needed for test fixtures and that audit-only scope.
The complete browser result remains **328/329**, with its single Header hydration
warning reproduced independently on untouched main. This is a recorded validation
limit, not a passing browser suite or a proven upstream diagnosis.

Common runtime, the two follow-up commits, this evidence and the implementation
plan are committed locally for the receiving marketplace owner. The source
checkout has no implementation changes pending. Deployment, migration execution,
worker activation, hosted qualification and marketplace publication are outside
this task's authorization.
