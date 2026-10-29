# Milo in the creation composers

The video and image composers and audio creation editor share **Prompt / AI assistant**. The isolated PR includes an opt-in real text-assistance service as well as the development-only visual sample. Default behavior remains off. This service cannot generate media or change generator settings.

## Activation and rollback

Before enabling real assistance in a controlled environment:

1. Apply `neon/migrations/85_prompt_assistance.sql` explicitly, after existing Studio assistance ledger/credit migrations. Request handlers never create schema. Do not apply this migration to a shared database merely to review the UI.
2. Configure the existing OpenAI credential and Milo policy: `STUDIO_ASSISTANCE_ENABLED=true`; production also requires `STUDIO_ASSISTANCE_APPROVED_POLICY=studio-credits-2026-10-05-v2`. The global OpenAI endpoint is required by the existing tariff policy.
3. Enable server flag `PROMPT_ASSISTANCE_ENABLED=true` and build the frontend with `NEXT_PUBLIC_PROMPT_ASSISTANCE_LIVE=1`.
4. Verify authenticated status, owned references and recovery, then run a separately approved, bounded paid quality evaluation before general release.

The public flag alone does not enable the API. A live UI never falls back to sample replies. With live disabled, a development visual sample is available using:

```sh
NEXT_PUBLIC_PROMPT_ASSISTANCE_PREVIEW=1 pnpm --dir frontend dev --port 3018
```

The sample requires `NODE_ENV=development`; it never calls an LLM or spends credits. At the user's request it has no sample badge. Removing the public flag and rebuilding restores the previous presentation. To stop new paid requests, disable `STUDIO_ASSISTANCE_ENABLED` using the existing policy controls; keep the composer endpoint available for recovery/status until outstanding calls are resolved. Disabling the composer endpoint entirely also hides its recovery route. Do not drop the migration or erase usage evidence during rollback.

No shared migration, live activation, deployment or paid LLM call was performed for the first connection. Keep per-worktree environment files private.

## Ownership and draft safety

- `Composer.tsx` and the route adapters supply the selected model, operation, current text, scalar settings and exact owned reference identities. The manual draft, quotes and Generate remain with their existing owners.
- `PromptAssistanceComposer.client.tsx` handles writing tabs, Milo level and existing credits dialog. `PromptAssistancePanel.client.tsx` only presents the conversation, suggestion and reply field.
- `usePromptAssistancePreview.ts` delegates to the live transport when enabled. Its existing reducer captures a monotonic revision from the complete draft/settings/reference fingerprint. Changing model or mode keeps the conversation and invalidates old suggestions. Account changes clear local conversation state. Apply/Undo cannot overwrite a later revision.
- `usePromptAssistanceTransport.ts` sends one authenticated request identity and stores only its session/request IDs in account/workspace-scoped sessionStorage. A reload can recover the outstanding response, which is always stale for application. The visible chat is otherwise local to the mounted workspace; after reload the next message starts a new session, so hidden old history is never silently supplied.
- Completed requests remain saved on the server. Within a session, the last eight completed exchanges accompany the current draft. New messages are limited to 100 per session, with a 24-hour session expiry. Usage evidence and replay identities are not deleted at expiry. A retention/deletion policy is still required before a broader history product.

The approved compact reference/footer, visible generator settings, player and galleries retain their existing owners. Review opens the complete suggestion inside the bounded conversation area; Use prompt/Use script stays outside its scroll region. Send never invokes Generate. Multi-prompt scene editing remains manual. Audio voice updates only `script`; music/song style, ambience and effects update only `prompt`. Lyrics and Soundtrack a video are outside this increment.

## Selected-model fiches

`server/prompt-assistance/context.ts` resolves model, public operation and audio variant from the same canonical capability owners used by the application/MCP. It rejects unknown combinations and target limits before reserving credits.

`profiles.ts` selects authored family and operation advice, then attaches the existing per-model `agent-model-guidance.json` and official-source entries from `agent-model-prompting-sources.json`. A request records that guide's version, source list and canonical capabilities. Thus the assistant loads the relevant fiche, not the entire catalogue. Unsupported families get an explicitly generic capability-based guide. The family examples are editorial synthesis, not copied provider claims or measured quality results. Source links are provenance, not fetched live or injected as untrusted instructions.

Update curated guidance beside its authoritative source, add a model/operation fixture, and version the guide when it changes. Capabilities override examples. Terra and a future Lite tier remain a separate evaluation; this increment uses the existing Standard/Luna and Max/Sol policy and tariff.

## References

Each reference is resolved through the exact owned asset/job-output resolver. The server validates applicable fields, media kind, slot uniqueness and maximum count, and derives display labels and supported mention syntax from the canonical model fields. Null/foreign/deleted/unavailable assets cannot be sent as real references. Missing required generation assets do not prevent discussing a draft.

Only role/label, supported token and width/height/duration metadata reach the LLM. No private URL, filename, pixels, video or audio is supplied. Milo must not claim it has viewed or heard a reference. Dedicated Kling subject panels and keyframe editors remain outside this metadata adapter; their edits still invalidate suggestions, and the user must describe their intended content. Full visual/audio analysis and stable aliases across reference reordering remain later work. Existing changed-reference guards still protect generation.

## Calls and existing credits

`/api/prompt-assistance` uses the existing cookie authentication, a same-origin POST check, strict schemas and a 64 KiB request limit. It authorizes an owned composer session, not a fabricated Studio project. Its persisted `composer:<session UUID>` scope is used only by the shared assistance ledger and recovery adapter.

The server counts input tokens, reserves through the existing ledger, issues one Responses call with SDK retries disabled, saves provider evidence, settles usage, then returns a validated suggestion. The limits are 32,000 counted input tokens and 2,200 output tokens (including reasoning). The current draft is never silently truncated. Output that is incomplete, refused, malformed or above the model limit is not applicable; known provider usage is still settled and charged. These bounded calls do not guarantee enough output for every very long prompt; paid evaluation must include long-draft cases.

Standard/Max selection and credit purchases use the existing account preference, included credits, purchased lots, tariff and purchase confirmation. The credits dialog explains that the choice and balance are shared with Studio. Selecting a mode does not buy credits. Generator media quotes remain separate.

## Interruption and support

- The persisted identity/body hash makes concurrent or repeated submissions return the original request, without another provider call.
- **Stop waiting** aborts only the browser wait. It does not cancel a dispatched provider request or promise a refund.
- **Check reply** is an explicit recovery POST. It can settle saved evidence but cannot call the model. If recovery arrives before the original POST was claimed, an immutable abandoned identity prevents that delayed POST from dispatching later.
- Expired pre-dispatch requests can close without a charge. Unknown dispatched outcomes retain their reservation and block another composer request for that account.
- Existing assistance support inspection/resolution recognizes composer scopes, checks their lease and evidence, and can settle recorded usage or waive an unknown call using the existing audited workflow. An active lease cannot be waived. Late evidence after a support closure remains available for review; it does not automatically reopen the chat or start another call.

No periodic automatic billable retry or new recovery worker is introduced. Failed pending checks may require support, including when supplier evidence was never received. Keep endpoint and support availability in the rollout checklist.

## Verification

`prompt-assistance-context`, `live-client`, `live-postgres`, `route` and `live-browser` tests cover model/target rejection, metadata-only owned references, audio variants, exact payloads, clarification without a proposal, shared balances, concurrent sends, recovery, late replies and account changes. Provider/HTTP behavior is injected or intercepted; financial assertions use disposable PostgreSQL 17 with the actual ledger and migrations. Existing composer layout/keyboard/IME/mobile tests and Studio accounting/recovery suites remain part of validation. No claim of live provider quality follows from those fixtures.

The [LLM practices review](prompt-assistance-practices.md) records the official OpenAI/SDK sources, implemented safeguards and quality/cost evaluation still required before activation.
