# Private Character Builder authoring

Reviewed 2026-11-12. This adapter prepares new identities and looks of saved
characters. Recast and saving completed originals retain their existing owners.
The private Character Studio MCP capability controls discovery; paid generation
and private reference capabilities additionally control preparation/confirmation.
Closing execution retains quote and job recovery. No migration or activation is
performed by a request.

`src/server/tools/character-builder/preparation.ts` owns the shared pure recipe
preparation used by both the web runner and private transports: sanitation, prompt,
ordered original references, model, format, geometry and Builder snapshot. The web
runner still resolves the selected saved character and executes its existing image
pipeline. One invocation produces one Nano Banana 2.1 image using the native image
customer tariff; Draft/Final are creative/output choices, not separate billing
products for new work.

`src/lib/character-builder-authoring.ts` bounds the transport recipe;
`server/character-studio/authoring-request.ts` preserves the server import facade. It
accepts owned image asset IDs and optional saved characterId, never source URLs,
client-selected prices, job IDs or job metadata. Saved looks reuse
`bindStudioLookRequest`: identity traits and the owned identity original remain
authoritative, while styling and scene fields can change. Reference roles and
traits survive in the full private Builder recipe. The canonical reference list
uses precisely the web Builder's deduplicated original URL order; one original
used in two recipe roles is submitted and priced once.

`server/character-studio/authoring.ts` delegates to
`createCreatorGenerationService`. Canonical preparation and transaction-locked
repricing, reference ownership, account restrictions, spending limits, wallet
reservation, provider continuation, refunds and existing-job recovery are shared.
No provider endpoint or alternate billing algorithm is introduced.

Migration 101 adds the immutable `character_builder_quotes` binding. The canonical
quote still owns account, OAuth client or Studio project scope, expiry and the
single job claim. The binding pins the canonical request hash, full sanitized
Builder recipe, its hash and the exact original-reference fingerprint. It is
inserted in the quote transaction. Confirmation locks the binding, checks exact
USD amount/currency, revalidates the recipe projection and owned references, and
passes the trusted recipe and `surface=character` into the shared paid image
reservation and continuation. An owned completed job therefore retains the actual
Builder recipe and can be saved as an identity or look by the unchanged store.

Both dedicated pricing calls add `meta.characterBuilderRecipeHash` to the
otherwise unchanged canonical snapshot. This is a workflow binding, not a price
adjustment. Ordinary `confirm_generation` recomputes the unmarked snapshot and
rejects the mismatch before wallet reservation. Conversely, a generic image quote
has no immutable Builder binding and cannot be bought or saved as a Builder
recipe. The marker does not bypass canonical tariff revision or full snapshot
comparison.

`authoring-output.ts` projects a human-reviewable recipe. It exposes reference
asset IDs and creative roles; private original URLs remain inside the binding and
job only. The agent wrapper publishes four tools:
`prepare_character_builder`, `confirm_character_builder`,
`get_character_builder_quote`, and `get_character_builder_status`. Exact quote
approval authorizes one attempt. Timeout, ambiguous outcome, reconnect, failure or
refund never authorizes replacement generation. Recovery always uses the original
quoteId and remains scoped to its original actor.

The adapter currently authors `action=generate` identities and looks. The web
Builder retains its existing full-body-fix and lighting refinements; those actions
are not advertised by this adapter. Local tests replace supplier transport only;
they establish neither a paid canary nor a particular MCP host's discovery.

Verification includes `character-builder-authoring-preparation.test.ts`,
`character-builder-authoring-postgres.test.ts`,
`mcp-character-builder-authoring.test.ts`, the existing Builder architecture
contract, native image-price parity and Character Studio integration tests.
All SQL tests use the disposable PostgreSQL 17 helper.

New MCP purchases additionally require `MCP_CHARACTER_BUILDER_ENABLED=1` after migration 101 is applied and the isolated checks pass. This is independent of existing saved-character and Recast availability. The Character Studio flag remains necessary. Closing Builder purchases keeps quote/status recovery exposed while Character Studio remains discoverable. No production or review flag was changed by the 12 November task.

## Native Milo authoring and library actions

Milo's `character_prepare` derives strict native properties from the same authored
Builder schema. Nullable optional native fields are omitted before canonical
validation; required nullable trait values remain intact. The model cannot supply
an actor, raw URL, job metadata, price or confirmation action.

`src/server/studio/conversation-character-authoring.ts` validates attached owned
images or an exact completed `character.select` receipt in the same project. The
latter re-reads the current saved identity/look using the shared selector, checks
its asset/job identity against the receipt, and verifies current owned image
access. A deleted or changed saved selection requires a fresh selection. This
admission is limited to Builder; generic image/video preparation keeps its
existing attachment or ready-project-output requirement. Recast already accepts
exact saved identity/look IDs through its independent owner.

The pending Builder intent is saved before preparation. The canonical quote,
immutable Builder binding, attached conversation quote ID and successful action
receipt commit together through `onQuotePrepared`. Existing model checkpoints and
turn recovery retain that quote after a lost acknowledgement. The ordinary
`ImageQuoteCard` displays the actual Builder direction and price; only the client
button sends the exact amount/currency to the dedicated confirmation owner.
Closed purchase gates block new work and preserve accepted quote/job recovery.
`MCP_CHARACTER_BUILDER_ENABLED=1` is shared with MCP's migration-qualified purchase
gate, in addition to the existing Studio Character/media/action admission.
Server request origins use `trustedAccountUrlFromOrigin` before canonical quoting,
which retains the exact `/account/connections` and trusted-origin checks.

On an explicit request, `character_save` takes only a project-owned Builder
quote ID and name. It resolves the completed original server-side and delegates
to the unchanged Character Studio store. The frozen recipe determines whether
this saves an identity or a look on its original parent. Generic image jobs and
foreign project quotes cannot become Builder recipes. `character_select` reuses
the shared exact saved-record selector. Normal Studio action receipts recover
both nonspending actions; the store also deduplicates exact originals. Saving or
selecting never submits another provider job or charges the wallet. Saving is
reported separately from generating an image. Existing web refinement actions
remain accessible in Character Builder.

`studio-character-authoring-contract.test.ts`,
`studio-character-authoring-card.test.ts` and
`studio-character-authoring-postgres.test.ts` cover the native director, quote
card, actual preparation/approval, lost acknowledgement, saving, repeated saving,
look selection and reuse, project isolation and deleted-selection refusal.
