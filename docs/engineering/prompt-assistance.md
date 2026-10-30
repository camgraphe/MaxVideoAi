# Milo in the creation composers

The video and image composers and audio creation editor share **Prompt / AI assistant**. The isolated PR includes an opt-in real text-assistance service as well as the development-only visual sample. Default behavior remains off. This service cannot generate media or change generator settings.

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
- `PromptAssistanceComposer.client.tsx` handles writing tabs, Milo level and existing credits dialog. `PromptAssistancePanel.client.tsx` only presents the conversation, suggestion and reply field.
- `usePromptAssistancePreview.ts` delegates to the live transport when enabled. Its existing reducer captures a monotonic revision from the complete draft/settings/reference fingerprint. Changing model or mode keeps the conversation and invalidates old suggestions. Account changes clear local conversation state. Apply/Undo cannot overwrite a later revision.
- `usePromptAssistanceTransport.ts` sends one authenticated request identity and stores only its session/request IDs in account/workspace-scoped sessionStorage. A reload can recover the outstanding response, which is always stale for application. The visible chat is otherwise local to the mounted workspace; after reload the next message starts a new session, so hidden old history is never silently supplied.
- Completed requests remain saved on the server. Within a session, the last eight completed exchanges accompany the current draft. New messages are limited to 100 per session, with a 24-hour session expiry. Usage evidence and replay identities are not deleted at expiry. A retention/deletion policy is still required before a broader history product.

The approved compact reference/footer, visible generator settings, player and galleries retain their existing owners. Review opens the complete suggestion inside the bounded conversation area; Use prompt/Use script stays outside its scroll region. Send never invokes Generate. Multi-prompt scene editing remains manual. Audio voice updates only `script`; music/song style, ambience and effects update only `prompt`. Lyrics and Soundtrack a video are outside this increment.

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
