# Milo in the creation composers

The video and image composers and audio creation editor share **Prompt / AI assistant**. The isolated PR includes an opt-in real text-assistance service as well as the development-only visual sample. Default behavior remains off. This service cannot generate media or change generator settings.

## Generate after a Milo conversation

The Prompt tab remains an explicit manual generation path. In AI assistant, a reply, a review, or a ready proposal does not authorize generating the previous hidden draft. Generate keeps its current quote visible but its guarded action requires an explicit Use prompt / Use script application from the current conversation. Applying returns to the existing Prompt tab; returning to the chat can retain that permission while the applied text and compatible context still match.

`usePromptAssistancePreview` keeps this application proof in memory, bound to the chat, editor/proposal text and hard context. A sent request, New chat, undo, text/proposal divergence or incompatible account/model/workflow/reference change revokes it. Qualified scalar controls reuse the existing settings-review compatibility boundary, so a compatible ratio change and live quote updates do not revoke application. Restored suggestions, cached text and history never restore generation permission by themselves.

`PromptAssistanceComposer` publishes the mode-specific gate; shared `Composer` enforces it before its generation callback and publishes effective eligibility to enclosing owners. The image owner also guards native form submission. Video and image runners recheck a supplied permission predicate after asynchronous auth/wallet admission, so opening an unauthorized assistant before dispatch cannot continue with the hidden draft. Image dispatch passes its admitted session token to avoid a second unguarded lookup. Audio creation guards its own generation handler and passes a live continuation predicate through `runAudioGenerate` to `authFetch`, which checks it after session recovery immediately before the actual fetch. Revoked audio attempts finish quietly without a misleading generation failure. Existing pricing, media, source, model and account checks still apply, and quote requests are not gated by Milo permission. Studio and surfaces without the shared Milo composer retain their existing flow.

`GenerationActionHelp` exposes localized guidance through hover, focus and touch. Its aria-disabled action remains focusable so users can discover the explanation, while the real handlers enforce blocking. The amount is not dimmed by the Milo gate. The compact proposal/review surface remains unchanged.

## Activation and rollback

Before enabling real assistance in a controlled environment:

For customer use, approve the customer information, context retention/deletion
and reviewer access policy before activation. Live composer requests retain
their provider-facing textual input/history. The expanded Studio capture flag
`ASSISTANT_REVIEW_CONTEXT_ENABLED` does not gate this composer storage.

1. Apply `neon/migrations/85_prompt_assistance.sql` explicitly, after existing Studio assistance ledger/credit migrations. Then apply the pending shared-level migrations 86–88 in the order documented in [Milo levels](milo-levels.md). Request handlers never create schema. Do not apply this migration to a shared database merely to review the UI.
2. Configure the existing OpenAI credential and Milo policy: `STUDIO_ASSISTANCE_ENABLED=true`; production also requires `STUDIO_ASSISTANCE_APPROVED_POLICY=studio-credits-2026-10-05-v2`. The global OpenAI endpoint is required by the existing tariff policy.
3. Enable server flag `PROMPT_ASSISTANCE_ENABLED=true` and build the frontend with `NEXT_PUBLIC_PROMPT_ASSISTANCE_LIVE=1`.
4. Verify authenticated status, owned references and recovery, then run a separately approved, bounded paid quality evaluation before general release.

The public flag alone does not enable the API. A live UI never falls back to sample replies. With live disabled, a development visual sample is available using:

```sh
NEXT_PUBLIC_PROMPT_ASSISTANCE_PREVIEW=1 pnpm --dir frontend dev --port 3018
```

The sample replies require `NODE_ENV=development`; they never call an LLM or consume credits. The shared Milo panel still reads the real Studio account; explicit account choices or confirmed pack purchases there are real. At the user's request it has no sample badge. Removing the public flag and rebuilding restores the previous presentation. To stop new paid requests, disable `STUDIO_ASSISTANCE_ENABLED` using the existing policy controls; keep the composer endpoint available for recovery/status until outstanding calls are resolved. Disabling the composer endpoint entirely also hides its recovery route. Do not drop the migration or erase usage evidence during rollback.

The first connection was verified offline. The subsequent [2026-10-29 live check](milo-live-check-2026-10-29.md) applied migrations to an isolated Neon branch, activated the local app and exercised real LLM calls and credit accounting. The parent database and production remain unchanged. Keep per-worktree environment files private.

## Ownership and draft safety

- `Composer.tsx` and the route adapters supply the selected model, operation, current text, scalar settings and exact owned reference identities. The manual draft, quotes and Generate remain with their existing owners.
- The video Composer projects its negative-prompt companion only when the prepared current engine/mode offers that field. The same projection feeds Milo context and suggestion identity; an inactive preserved value neither enters that context nor invalidates a suggestion by itself. The authored value remains in the draft for compatible engines/modes, while changes to applicable companions, engines and modes retain their existing guards.
- `PromptAssistanceComposer.client.tsx` handles writing tabs, Milo level and existing credits dialog. `PromptAssistancePanel.client.tsx` only presents the conversation, suggestion and reply field.
- `usePromptAssistancePreview.ts` delegates to the live transport when enabled. Its reducer captures a monotonic revision from the complete draft/settings/reference fingerprint. Context changes invalidate ordinary application of old suggestions; visible workflows have distinct chats. Account changes clear local conversation state. Apply/Undo cannot overwrite a later revision. A separate explicit settings-review transition is described below; opening it never makes a stale proposal ordinarily applicable.
- `usePromptAssistanceTransport.ts` owns authenticated request identities and same-tab chat restoration. It stores the active IDs, unsent message, locally edited proposal and bounded settings-review proof in account/workflow-scoped sessionStorage; the authenticated session snapshot restores completed conversation and its draft fingerprint. A matching complete draft can retain ordinary application; a recovered identity without sufficient context remains stale. Existing pending identities are checked rather than resubmitted. See [Milo workflow chats](milo-workflow-chats.md) for pending recovery, stale-application guards and New chat behavior.
- Completed requests remain saved on the server. Within a session, the last eight completed exchanges accompany the current draft. New messages are limited to 100 per session, with a 24-hour window renewed by completion. Session expiry does not delete usage evidence or replay identities; internal review retention is separate from the active chat.

The latest message and relevant conversation establish whether a request starts an
independent creative brief or revises the same idea. Existing editor text and an
unapplied proposal are optional creative context, not permission to inherit their
subject into a new brief. This applies even when `activeSuggestion` is present.
For a clear follow-up, that suggestion remains the usual working text; an explicit
editor revision uses `currentDraft.text`, and natural same-chat continuation does
not require a special revision phrase. For an ambiguous initial creative request
with existing editor text, Milo asks one concise reuse-or-new question in the
user's language and returns `text: null` until the choice is clarified. The
question may briefly identify the old prompt's topic. Clear editor revisions and
independent new briefs proceed directly; the user's answer remains established
through conversation without repeating the question. New chat still keeps the
manual editor, references and settings physically intact.

`prompt-assistance-conversation-contract` checks that this intent policy reaches
every assistance level and preserves separated message/editor/proposal/history
inputs and authoritative settings, including clarification followed by new-idea
and reuse answers in different languages. Its contrasting synthetic cases are reusable
for separately authorized output evaluation; offline policy and payload checks do
not establish model-output quality. No provider calls are part of these tests.

The approved compact reference/footer, visible generator settings, player and galleries retain their existing owners. Review opens the complete suggestion inside the bounded conversation area; Use prompt/Use script stays outside its scroll region. Send never invokes Generate. Multi-prompt scene editing remains manual. Audio voice updates only `script`; music/song style, ambience and effects update only `prompt`. Lyrics and Soundtrack a video are outside this increment.

## Local review after generation settings change

The video adapter supplies a conservative compatibility projection. If only its known scalar generation controls changed, a stale proposal offers **Review & use** in the existing 53 px bar. The existing expanded prompt view shows customer-readable settings before → current, the editable proposal and **Use with current settings**. Numeric duration aliases appear once; automatic duration choices remain explicit. Nothing is applied or generated when review opens. Confirmation writes only the inspected text; Apply and Undo keep the current generator settings. Another context change while reviewing disables that confirmation until the current changes are explicitly reviewed again.

`application-review.ts` partitions the adapter's known duration, frame count, framing, resolution, frame rate, output count, seed, loop, audio, camera, safety, guidance and shot controls. Account, surface/workflow/target, engine/mode/operation, source/reference identities **and local metadata**, subject/source controls, manual editor, companion fields and perception remain hard compatibility inputs. Unknown controls, including provider-specific source/excerpt fields, fail closed. Image/audio adapters do not opt into this review path. Any hard-context change invalidates compatibility monotonically, including a change followed by a reversion. Request/recovery/loading and existing access/reference-review gates continue to block confirmation.

A completed modern local proposal may retain review eligibility across reload through an additive version-1 proof in its existing local cache: request UUID, SHA-256 digest of **all** hard inputs, original normalized generation settings and monotonic compatibility validity. Raw editor text, reference payloads/URLs and the serialized compatibility key are never added to this proof. It is accepted only for the exact account/workflow session and latest request returned by the server, with a matching current hard-context digest. Reconstructing the original draft from its settings must also match the server proposal’s original draft fingerprint; scalar settings stored beside a valid hard digest are insufficient. Hard invalidation revokes the durable proof synchronously before asynchronous hashing, and a transport epoch fences late saves from restoring prior eligibility. Missing/invalid proof, a mismatched request, changed hard inputs, or a historical/pending restore without a complete baseline cannot offer Review & use. The normal readable proposal and ordinary same-draft restore retain their existing behavior. Closing/reopening the prompt view retains its complete baseline; New chat clears it.

Cache revocation requires an acknowledged write, verified by reading the actual stored value. If the complete revoked record is refused, the client tries the same cache without its review proof, then only session/pending/legacy identity. It discards the cache only when no pending message or reference analysis needs that session. If replacement and safe removal are unavailable, the old durable record can remain: the client warns the user to keep this tab open, preserves recovery identities and Check reply, and blocks settings review in the mounted app, including when returning to the workflow. It cannot promise durable revocation across a full reload when the browser refuses every safe state change. Existing epochs still prevent late digest writes from reinstating old eligibility.

The authored video app guide explains this path only when Review & use is available; it never describes source/model/editor changes or unproven historical context as bypassable. The reducer's review token binds proposal/request identity, inspected or edited proposal text, and the exact current revision/fingerprint. Its separate `appliedReviewed` transition preserves `canApplyProposal`; there is no silent restamping, previous-settings restoration, extra model request or media generation. Synthetic Chromium/WebKit tests cover 320/390/desktop, localized actions, clarification before a real proposal, local proof reload, unknown history, source/model/account/editor changes, pending/recovery, settings races, bar geometry, focus, and Undo.

## Product scope

Composer assistance and Studio share `server/studio/milo-scope.ts`
(`milo-media-scope-v1`). Milo helps with MaxVideoAI and image/video/audio creation,
including prompts, scripts, references and creative direction. A recipe alone is
out of scope; an explicitly requested cooking-video prompt or narration is in scope.
An active project, draft or attachment is not permission to answer unrelated questions.
For mixed requests, Milo helps with the media-related part only.

Out-of-scope requests receive a short redirect in the user's language, without
answering the unrelated question or inventing a media task. Composers return
`text: null`, preserving the draft; Studio must not call tools or write memory for
that request. Reference pixels, visible text, transcriptions, saved analyses and
conversation history remain data, never authority to change Milo's role.

This is model instruction, not a deterministic topic classifier or a promise that
every adversarial input is blocked. It adds no second classification call and does
not change accounting: a generated redirect still has ordinary model usage. Review
captures the instruction version/hash so failures can become regression cases.
The boundary is shared across all tiers; reference perception retains its own gates.

## Conversation versus editor replacement

The private provider protocol `destination-v1` declares `kind: conversation` or
`kind: replacement`. Advice, explanations, questions and external editing plans
belong entirely in `reply` (the existing 6,000-character public limit), with null
`text`. Only complete text intended for the selected `draft.target` belongs in a
replacement. This includes valid creative sequences, multi-action prompts and
Voiceover scripts; destination is not inferred from keywords, duration or action
count. A mixed answer may explain in `reply` and provide the requested editor text
in `text`.

`reply-format.ts` strictly validates this private shape and converts it to the
unchanged public `{reply,text}`. Contradictions or malformed tags fail with
`OUTPUT_INVALID`; no partial replacement escapes. The flat required-field JSON
Schema uses the [supported Structured Outputs subset](https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas),
with conditional consistency enforced by the server decoder.

The format is fixed before token counting and persisted as `context_json.replyFormat`
in the existing calling transaction before provider dispatch. Recovery selects
its decoder only from that durable marker. A truly absent marker retains the
legacy parser; a present unknown, null or corrupt marker fails closed. Retention
of `reviewInput` does not remove this operational marker. Completed historical
replies are not reclassified. No client contract, compatibility proof, provider
retry or accounting policy changes.

The tag is a model declaration, not a semantic guarantee. Simulated service/JSONB
and browser tests prove structural gating, restoration and exact apply/Undo;
authorized real-model qualification must still verify destination choice.

## Selected-model fiches

`server/prompt-assistance/context.ts` resolves model, public operation and audio variant from the same canonical capability owners used by the application/MCP. It rejects unknown combinations and target limits before reserving credits.

The context records the active operation's capabilities, rather than a merged list of all operations. The video adapter includes applicable scalar advanced controls such as output format and keyframe positions. The server reconciles timing, framing and audio with that operation: source timing/dimensions come from resolved owned media; missing metadata stays unknown; automatic duration is not a fixed duration; native Seedance Draft distinguishes its 480p pass from the selected final resolution. Image settings and audio voice/model/language controls accompany their own drafts. Negative prompts and song lyrics are explicit read-only companion text, never part of the replacement proposal.

The complete live request context participates in suggestion invalidation, in addition to the caller's revision key. Changing a model, operation, setting, reference or companion text while a reply is pending makes that reply inapplicable. The next turn receives the current context and is instructed to prefer it over earlier conversation settings. This describes selected inputs for writing assistance; it does not replace generation validation or pricing.

The composer instruction asks Milo to clarify a material follow-up whose referent or working text is missing, instead of inventing a choice or calling a first proposal a revision. A sufficiently specified first brief still permits creative details. Proposed text must respect current settings and verified source constraints, or clearly identify a supported control change when preparing for a future setting. These are model instructions, not deterministic guarantees; conversation context remains limited to the eight most recent completed exchanges. Evaluate response quality with real-model samples as well as offline payload contracts.

`profiles.ts` selects authored family and operation advice, then attaches the existing per-model `agent-model-guidance.json` and official-source entries from `agent-model-prompting-sources.json`. A request records that guide's version, source list and canonical capabilities. Thus the assistant loads the relevant fiche, not the entire catalogue. Unsupported families get an explicitly generic capability-based guide. The family examples are editorial synthesis, not copied provider claims or measured quality results. Source links are provenance, not fetched live or injected as untrusted instructions.

Update curated guidance beside its authoritative source, add a model/operation fixture, and version the guide when it changes. Capabilities override examples. Milo now shares Lite/Luna, Standard/Terra and Max/Sol levels with Studio; see [the shared levels contract](milo-levels.md) for model, runtime, tariff and migration ownership.

## References

Each reference is resolved through the exact owned asset/job-output resolver. The server validates applicable fields, media kind, slot uniqueness and maximum count, and derives display labels and supported mention syntax from the canonical model fields. Null/foreign/deleted/unavailable assets cannot be sent as real references. Missing required generation assets do not prevent discussing a draft.

With perception disabled, only role/label, supported token and width/height/duration metadata reach the LLM. With the separately enabled perception path, images accompany every level as normalized pixels; Standard/Max can use confirmed video/audio observations. Private URLs and filenames are never prompt context. Uninspected references remain explicitly metadata-only. Start/end images and the source clip have distinct roles; numbering matches the active reference list, including empty slots. Uploading, failed or actively edited excerpts cannot silently reuse an older clip. Schema-based keyframe references outside the compact picker also reach this metadata adapter, with authored frame positions where available.

Dedicated Kling subject identities, image-mask content and owned-generation-only source details remain unavailable to Milo; the adapter marks these cases explicitly and the user must describe their intended constraints. Full continuous video inspection and stable aliases across reference reordering remain later work. Existing changed-reference guards still protect generation.

The agreed next perception scope is **images on Lite; images, video and audio on Standard and Max**. This is implemented behind separate flags, enabled only in the isolated local test environment. See the [reference-perception integration scope](prompt-assistance-reference-perception.md) for migration 89, activation, existing Studio owners, modality limits and validation evidence.

## Calls and existing credits

`/api/prompt-assistance` uses the existing cookie authentication, a same-origin POST check, strict schemas and a 64 KiB request limit. It authorizes an owned composer session, not a fabricated Studio project. Its persisted `composer:<session UUID>` scope is used only by the shared assistance ledger and recovery adapter.

The server counts input tokens, reserves through the existing ledger, issues one Responses call with SDK retries disabled, saves provider evidence, settles usage, then returns a validated suggestion. The limits are 32,000 counted input tokens and 6,000 output tokens (including reasoning) for newly frozen runtimes; historical requests retain their 2,200-token limit. The current draft is never silently truncated. Output that is incomplete, refused, malformed or above the model limit is not applicable; known provider usage is still settled and charged. These bounded calls do not guarantee enough output for every very long prompt; paid evaluation must include long-draft cases.

Lite/Standard/Max selection and credit purchases use the existing account preference, included credits, purchased lots, tariff and purchase confirmation. The credits dialog explains that the choice and balance are shared with Studio. Selecting a mode does not buy credits. Generator media quotes remain separate.

## Interruption and support

- The persisted identity/body hash makes concurrent or repeated submissions return the original request, without another provider call.
- **Stop waiting** aborts only the browser wait. It does not cancel a dispatched provider request or promise a refund.
- **Check reply** is an explicit recovery POST. It can settle saved evidence but cannot call the model. If recovery arrives before the original POST was claimed, an immutable abandoned identity prevents that delayed POST from dispatching later.
- Expired pre-dispatch requests close without a charge. An ended provider request with no saved response, or an expired unanswered call, closes through the existing audited customer-waiver transaction. The request lease is revoked and its customer hold released; supplier usage remains unknown with its original exposure. Recovery and a fresh message in another chat can trigger this closeout. Active leases and any saved response/response ID prevent automatic waiver.
- Three still-unreconciled automatic closeouts per account stop new composer dispatches before creating a request or hold. This bounds purchased-credit exposure, which may have no sponsored campaign allocation. The message asks the user to contact support. Manual support waivers do not consume the cap; valid late settlement removes that call from it. Replaying a closed request never dispatches again.
- Existing assistance support inspection/resolution recognizes composer scopes, checks their lease and evidence, and can settle recorded usage or waive an unknown call using the existing audited workflow. An active lease cannot be waived. Late evidence after closure settles through the normal ledger when the original invocation or recovery sees it, without recharging a waived customer, reopening the chat or returning a late suggestion. Invalid or missing usage remains unresolved for support.

The provider budget is 90 seconds from the start of the message service, including context/reference preparation and token counting. Counting receives at most 15 seconds; generation receives only the remainder. An abort signal covers both headers and response-body parsing. A final deadline check inside the reservation transaction rolls back a reservation that took too long. The browser still waits at most 100 seconds and the route at most 120 seconds, leaving closeout time. SDK retries remain disabled. This bounded synchronous path does not guarantee every Max/xhigh reply finishes; it guarantees a closed outcome can be recovered without repeating a paid call.

Sanitized diagnostics retain failure kind, elapsed milliseconds, HTTP status and a validated provider request ID when available, together with internal request/call/model identifiers. Error messages, provider bodies, prompts, references and secrets are not logged.

No periodic automatic billable retry or new recovery worker is introduced. Explicit video/audio analysis reuses the existing Studio analysis worker and its durable recovery; it has a separate confirmation and credit ceiling. Failed pending checks may require support, including when supplier evidence was never received. Keep endpoint and support availability in the rollout checklist.

## Verification

`prompt-assistance-context`, `live-client`, `live-postgres`, `route` and `live-browser` tests cover model/target rejection, metadata-only owned references, audio variants, exact payloads, clarification without a proposal, shared balances, concurrent sends, recovery, late replies and account changes. Provider/HTTP behavior is injected or intercepted; financial assertions use disposable PostgreSQL 17 with the actual ledger and migrations. Existing composer layout/keyboard/IME/mobile tests and Studio accounting/recovery suites remain part of validation. No claim of live provider quality follows from those fixtures. `prompt-assistance-timeout-postgres` covers timeout closeout, account isolation, active/expired leases, late settlement, cross-chat recovery, purchased-credit exposure bounds and deadline rollback. `prompt-assistance-provider-budget` uses only a loopback server to verify that a stalled body aborts without retry.

`prompt-assistance-context-audit` adds operation-specific settings, source timing, Draft/automatic duration, keyframes, reference roles and read-only text. Its catalogue matrix resolves 123 model/mode/operation contexts with provider availability stubbed; it is not a live-provider compatibility claim. The browser audit changes eleven context dimensions during pending replies. The additional real API/context checks are recorded in the [live-check report](milo-live-check-2026-10-29.md).

The [LLM practices review](prompt-assistance-practices.md) records the official OpenAI/SDK sources, implemented safeguards and quality/cost evaluation still required before activation.
