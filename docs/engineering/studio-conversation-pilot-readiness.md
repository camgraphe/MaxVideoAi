# Conversational Studio pilot readiness — 2 October 2026

The director is **GPT-6.1 Sol**, medium reasoning, OpenAI Responses, `store: false`, no SDK retry. It writes creative prompts and chooses from executable certified capabilities. Native Studio and MCP share generation, wallet, media, canonical sequence and export business owners; their session/OAuth adapters keep distinct authority.

## Delivered locally

| Area | Current proof | Qualification still needed |
| --- | --- | --- |
| Persistent director | Actual Sol browser exchanges, durable brief, action journal/checkpoints, usage observation | Long natural film journey and commercial token policy |
| Image | Native Google session: one real Flare original, private browser access and same-job recovery, one charge in the isolated test ledger; PostgreSQL confirmation/reference parity | Production wallet qualification remains separate |
| Video, voice, music | Shared canonical quotes/jobs; native owned-image Wan 3 quote and saved-draft recovery, no paid video attempt; voice configured | One ready output per capability; renewed music credentials and durable remote audio execution |
| Editing | Shared manual/Sol commands, owned canonical Sequence, revisions/receipts, measured source facts, trim/order/gain/remove | Real generated outputs inserted in the same client journey |
| Native UI | Chromium/Firefox/WebKit byte-backed playback, trim/move/gain/reload, bounded decoder recovery, responsive layout and persistent app-wide charcoal/olive | Physical Safari/iOS/Android smoke test with provider outputs |
| Export | Existing exact estimator/reservation/worker adapter, owned recovery reader and local 3 s MP4 proof | Remote worker dispatch, original upload, completed artifact recovery in native chat |

The local preview uses an isolated socket-only database. Its wallet/library are QA data, even when Google signs in with a real account. It does not establish the production balance. Provider, storage and remote renderer credentials are deliberately absent there. Browser qualification does not establish paid generation availability; verify runtime availability before activating the pilot catalog. Existing conversations/projects are preserved; a fresh film creates a canonical empty Project/Sequence without converting old canvases.

The subsequent authorized cloud preparation and active native preview are recorded in [Isolated native Studio pilot](studio-conversation-pilot-environment.md). The socket-only preview described above is preserved on port 3002; the active localhost pilot uses isolated Neon and real server credentials. Its wallet remains a separate test ledger.

## Browser qualification

The opt-in native browser journey passes on these locally installed Playwright engines:

| Engine | Version | Result |
| --- | --- | --- |
| Chromium | 147.0.7727.15 | PASS |
| Firefox | 148.0.2 | PASS |
| WebKit | 26.4 | PASS |

Each run owns a committed Next snapshot, a fresh socket-only PostgreSQL database, synthetic Auth sessions and exact private-storage interception serving two real MP4 fixtures. Viewports cover desktop 1440×900, phone 390×844 and layout checks at 320/768 px. Mobile dimensions are simulated; this is not certification of physical phones or the installed Safari browser.

The English journey checks source-frame seeking after a start trim, actual playback, stable decoder sources across signed-URL polling, monitor collapse, keyboard gain persistence, pointer movement and reload, unavailable asset removal, and chat access without document overflow. Olive now uses the app's existing theme preference, changes the header/sidebar too, survives reload and sets the native controls' color scheme. The library checks modal sizing, empty/outage states, Import availability, Escape and focus restoration. Its library responses are UI-only doubles; canonical edits, media ownership and private video decoding use the owned DB/byte fixtures.

A rapid access renewal can return the same signed URL. The failed decoder now remounts once after renewal, without disturbing normal polling. Fresh contexts avoid Firefox's already-decoded cache; an actual owned projection is replayed to reproduce same-URL recovery. WebKit's internal Range retries remain distinct from the single app renewal. A permanent refusal collapses the monitor with a stable error. No hydration/page errors were observed in the qualified journeys.

Run `tests/connected-studio-conversation-browser-integration.test.ts` with `STUDIO_BROWSER_ENGINE=chromium|firefox|webkit`; the default remains Chromium. Install the existing dependency's browser binaries with `playwright install chromium firefox webkit`. Use project Node 22, PostgreSQL 17, `NODE_PATH=frontend/node_modules` and `TSX_TSCONFIG_PATH=frontend/tsconfig.json`; run through `node --import tsx --test`. The frontend snapshot comes from committed HEAD. `STUDIO_PROOF_DIRECTORY` optionally writes screenshots outside Git.

## Remote worker audit

Read-only AWS/Vercel inspection on 2 October 2026 established:

- ECS cluster `maxvideoai-timeline-exports` exists in `us-east-1`, ACTIVE, with no running/pending task at inspection. The active worker definition is revision 2, registered 9 June, 2 vCPU / 4 GB.
- Its actual container name is `worker`, not the launcher's default `timeline-export-worker`. A launcher for this definition needs the explicit container override.
- It refers to `maxvideoai-timeline-export-worker:latest`. That ECR repository currently contains no images; the referenced image cannot be pulled.
- SSM secret references exist. A private in-memory comparison confirmed the worker's database host/name match the primary production configuration. No credential values were printed or persisted. This definition must not serve the isolated QA database.
- Vercel project `maxvideoai-mcp-staging` exists, with provider/storage/reference namespaces and a database configured. Its listed environment lacks the director key, Studio gates and ECS launcher settings. Its DB isolation has not been verified. Main app production/preview also lack ECS launcher settings. Presence of other preview provider keys does not establish native pilot readiness.

Therefore the existing infrastructure is a useful base, not a qualified Studio test renderer. Prepare a separate pilot DB and worker definition/SSM namespace, an immutable image containing the current renderer, and isolated storage (a separate bucket avoids assuming that `VIDEO_RENDER_STORAGE_PREFIX` also scopes `timeline-exports/`). Use a protected branch preview with the coordinated session-aware readers and explicit migrations. Keep the existing production definition and MCP staging publication intact. Verify all pilot targets before any quote confirmation or worker dispatch.

This audit made no cloud configuration change, image push, deployment, production migration or paid media/render request. The next milestone remains the bounded native pilot below.

## One next milestone

The whole-branch review is complete and its recovery findings have a focused correction pass. Export submission identity and original manifest/preset are saved before POST; a lost acknowledgement retries that identity or reconciles it from owned Project history. Quote renewals carry their immutable retry provenance across tabs. Private decoder URLs survive routine polling; each failing clip has one automatic renewal per monitor opening, then a stable error. Missing originals remain removable in the canonical timeline. Keyboard volume changes are persisted. Local tests reproduce the original failures before verifying the corrections.

Run one bounded native pilot, then qualify the **single cheap 25 s film** from ordinary English messages. Do not start another general agent salve beforehand.

1. Prepare one owned preproduction environment with actual provider, storage and canonical worker configuration. Check runtime availability before showing creation/export controls. Keep the director key server-side.
2. Inspect the actual target schema. Apply explicit prerequisites and migrations in order: connected Studio migration 42, then session scope/turn/usage/run/media migrations 49–53. Migration 52 requires 42 and 49–51. Never bootstrap schema from a conversation read or fabricate legacy revision zero.
3. Deploy the origin-aware common generation/Audio readers and writers together before allowing Studio-session quotes with null OAuth identities. Verify existing public MCP clients still require their original OAuth identity; keep their publication flags unchanged.
4. Enable image, action, media, editing and export gates only under the current authenticated admin/pilot access. Keep the old Studio entry and Projects intact. Verify the correct account's actual wallet/library; the local QA wallet is unrelated.
5. Start with one native image quote. The client approves its exact current price once; reload must recover that same accepted job without another charge. Then qualify video, voice and music with separate explicit quotes, one attempt each. Prior MCP approvals do not authorize replacement native jobs.
6. Use a few vague client phrases to make the film. Sol supplies direction, prompts, model/settings and useful questions. Attach a reference through +, animate a ready image, add an English voice and instrumental music, manually trim a clip, ask the bot for one adjustment, reopen, confirm the canonical export estimate and recover the completed original in the chat.

## Evidence required before opening to clients

- Same account and Project throughout; original media, measured duration and final playable file.
- One accepted job/charge per quote; exact debits/refunds and successful reload/crash recovery.
- A manual/AI revision conflict preserves the user's edit.
- English primary journey, useful French regressions, desktop/mobile playback and trimming.
- Raw usage for **every** director Response, including tools and incomplete responses; known/unknown costs kept separate. Media, rendering and director costs are separate ledger entries.
- A defined customer policy for conversation tokens and usage caps. QA token estimates are not customer wallet billing. A working API key does not verify that a billing card is registered; funding/card state remains unverified.
- Worker configuration/dispatch/upload recovery and the whole-branch review findings resolved or explicitly accepted.

## Rollback and delivery boundary

All conversational gates default off. Disabling them stops new conversation actions without deleting Projects, accepted jobs or canonical timelines. Reconcile accepted jobs/charges before removing a worker or incompatible reader. Keep origin-aware shared readers deployed while Studio-session rows exist; do not destructively reverse data migrations.

No production migration, publication, main-branch replacement or provider spend is implied by the local implementation. The pilot bundle must be reviewed before that operational step. The 25 s film is the final acceptance test, not a replacement for missing native integration.
