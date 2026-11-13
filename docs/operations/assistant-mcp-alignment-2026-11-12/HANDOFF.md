# Common runtime handoff

## Commit order and ownership

The receiving branch is owned by **OpenAI Audit Marketplace**. It already has an
equivalent of Pika commit `560aeeae6` (`6a7da9849` there) and main `371ee9eaf`
(PR #649, delivered by **MaxVideoAI — fiche Business Hub ChatGPT**).

The receiver already integrated the common runtime and Product contracts:

- `a2d769069f16f9b2934f69df83a6311142cbb407` as `2479c6610`: shared runtime, native Milo, subtitle policy, MCP/plugin, migration order and contracts.
- `c9c0249a48fe3826c07336b34113466dc2d8ac15` as `d37ca4bb9`: Product expectations for archived Pika, keeping the frozen historical matrix intact.

Remaining common commits, in order:

1. `f346f175ea14b85d5fdd23cc83b951755b401e5e`: explicit offline historical audit scope, immutable Pika/Luma representatives and public archive sunset checks. Frozen financial JSON and live price math stay unchanged.
2. `60a1f3a8115cbd1c81fde7886fdbd5a2c88ebf52`: current published test fixtures, historical Pika recall and real route/archive SSR contracts.
3. The separate audit-evidence commit containing this folder and the implementation plan; identify it from the final handoff message or branch history.

Do not cherry-pick feature merge `566d430c8`; its main parent is already included
by the receiver. Main integration, marketplace adult eligibility, privacy/ads,
OAuth, protected resources, dedicated configuration, private delivery and output
schemas remain owned by their existing branches. No source presentation files or
private media were copied or changed here.

## Explicit operational prerequisites

- `neon/migrations/100_audio_generation_dispatch.sql` owns the private immutable Audio dispatch journal.
- `neon/migrations/101_character_builder_quotes.sql` owns Builder recipe bindings.
- Apply them only to the intended approved database, after the existing quote/scope migrations and independent 99 files. The official runner now sorts numeric prefixes and complete filenames; a shared number is not a collision. No runner was applied remotely by this task.
- Extended MCP Audio requires both `MCP_AUDIO_EXTENDED_ENABLED=true` and `AUDIO_GENERATION_WORKER_ENABLED=true`, plus existing paid/Audio publication gates. Either missing switch retains the bounded Eleven projection. Individual provider/model availability remains authoritative.
- Character purchases require `MCP_CHARACTER_STUDIO_ENABLED=1`, `MCP_CHARACTER_BUILDER_ENABLED=1` and existing paid/reference gates. Known quote/status reads stay available when new Builder purchases close. Apply the migration before exposing the new reader to existing quote IDs.
- Creator/subtitle/profile, timeline/edit/export and private-media gates were not enabled remotely.

Run external Audio execution with `pnpm audio-generation:worker`; use
`pnpm audio-generation:worker:once` for one bounded dispatch. Build a new immutable
Node 22/FFmpeg source image from the existing worker Dockerfile and override its
command. No Audio image was built/pushed here. Never reuse normal-production
DB/storage/provider identities for the dedicated Review environment.

Processing/ambiguous dispatches are not reclaimed. Ten queued minutes, forty-five
processing minutes, corruption or ambiguity can produce `needsAttention` and
`retry:null`. A total DB outage may prevent storing newly produced provider/storage
evidence; operators must reconcile it without purchasing another attempt.

## Transport adaptations to retain

New common MCP names:

- `prepare_character_builder`
- `confirm_character_builder`
- `get_character_builder_quote`
- `get_character_builder_status`

The immutable recipe, original identity/style references, exact charge and actor
scope stay in shared owners. Generic image confirmation cannot discard that
binding. Public recipe projections contain owned asset identities, not private
original URLs.

Milo exposes native `character_prepare`, `character_save`, `character_select`,
creator preparation/recovery and subtitle read/edit/export preparation. The model
cannot confirm a paid operation. Existing application cards carry exact prices
and the saved operation/quote; lost acknowledgements and reloads only read the
same attempt. A selected look feeds Builder/Recast; generic image/video reuse
still requires the existing library attachment or ready project output.

Retain directory `distributionProfile` propagation, explicit success/error
`outputSchema` projections, standard MCP Apps metadata and compatible legacy
widgets/importer resources. Add `needsAttention`/stopped polling and
`webTools`/`webHandoff` to the appropriate strict projections. Review and normal
resources, users, audiences, storage and provider identities remain separate.

Package `generate/references/extended-workflows.md` in the OpenAI builder and
include its actual content in the policy fingerprint. Common fingerprint:
`2759ef51f1ce67b6050a4a0bf27d5c17ecd595bfba4ea22eee28fd7f87370397`.
The 70 curated decisions and fixture contract remain unchanged. All 1024 capability
combinations fit the 2000-byte window (maximum 1998). Recompute from the receiving
branch's actual reviewed content; do not copy a fingerprint across changed
marketplace metadata or instructions.

## Subtitle commercial decision

Adrien explicitly chose a single paid subtitle bundle with corrections, SRT/VTT,
mix preparation and MP4 included, then requested 200% markup. The subtitle-only
policy is `creator-subtitles:provider-plus-200:v1`: exact supplier transcription
cost × 3 before canonical rounding. Four other creator products keep 120% markup.
Accepted history retains exact charges/refunds; stale unaccepted quotes must be
prepared again even if the rounded visible amount is unchanged.

The later render button is “Export MP4 — included”; no new export charge is added.
See `subtitle-economics.md`, `subtitle-prices.json` and the public AWS rate record.
These distinguish supplier list references from actual invoices and global net
margin. No pricing change was deployed by this task.

## Remaining qualifications and boundaries

Angle, Storyboard, Upscale and Background Removal retain canonical web handoffs;
their web-session/raw-source runners do not become generic paid MCP executors.
Builder full-body/lighting refinements also retain their web workflow. No feature
was removed from those interfaces and no direct execution claim is made.

Live dedicated Review still needs separately authorized runtime/provider and host
qualification. A source catalogue or tool descriptor does not prove hosted
execution. No new paid render, secret/resource activation, production migration,
push, production merge, deployment, marketplace publication or review capture was
performed. Proposal/validation of review scenes remains separate from filming.

Final verification results are in README; initial failures and their corrections
are retained there rather than represented as a first-pass green run.

## Final local qualification limits

The complete browser lane was 328/329 on the runtime candidate. Its only remaining
failure is the unchanged Header `useId` hydration warning after session restore,
reproduced with the same test/phase/IDs on untouched main `371ee9e`. See
`header-hydration-baseline.md`; no warning suppression, dependency update or forced
click was included. The exact cause remains unresolved. The full editor and local
build pass; exhaustive tariff history passes. The final fast manifest passes 11226 tests with zero failures and one pre-existing
skip; fresh TypeScript, lint, exposure and diff checks pass. Full results and
source/log identities are recorded in README and `verification.json`.
