# Conversational Studio pilot readiness — 2 October 2026

The director is **GPT-6.1 Sol**, medium reasoning, OpenAI Responses, `store: false`, no SDK retry. It writes creative prompts and chooses from executable certified capabilities. Native Studio and MCP share generation, wallet, media, canonical sequence and export business owners; their session/OAuth adapters keep distinct authority.

**Latest user direction:** stop the current 25 s film. It is a technical integration proof, not an accepted promotional film or an artistic acceptance gate. Prioritize executable tools and their capabilities rather than creative recipes. The later music/mixed-export qualification and current handoff are in [the resume brief](studio-conversation-resume-brief.md); the initial checkpoint below is historical. The [Higgsfield/Runway/Replicate benchmark](studio-mcp-tool-benchmark-2026-10-02.md) records verified patterns, local gaps and the next implementation batches for both adapters.

**3 October tool checkpoint:** Batch 1 now implements project-scoped exact model inspection, configurable canonical preparations and full draft/retry persistence. Studio reuses the MCP visual facts and shared Audio variant facts; its one-output/eight-image-reference limits and missing video/audio reference resolvers remain explicit. Shared guidance carries attributed public Higgsfield/Runway descriptions/recommendations, not measured quality scores or imported prices. GPT-6.1 Sol chooses the creative approach; MCP adapters remain client-model independent. These are local contract/fixture changes, with no new real media generation or export. Batch 2 editing/export adapters, bounded multi-action completion and Audio/montage publication qualification remain next.

Fresh verification: `qa:editor` **723 passed, 1 skipped**, typecheck and lint succeeded (seven pre-existing image warnings); **122 focused MCP tests passed**, including canonical capabilities, prepare/confirm, source attribution and Audio reservation. Disposable PostgreSQL 17 verifies complete selected media drafts, transaction interruption/reload and duplicate prevention. Independent review has no remaining important finding; exposure/whitespace checks passed. This source checkpoint has not replaced the running localhost snapshot or qualified additional provider/model combinations live.

## Delivered locally

| Area | Current proof | Qualification still needed |
| --- | --- | --- |
| Persistent director | Actual Sol browser exchanges, durable brief, action journal/checkpoints, usage observation | Long natural film journey and commercial token policy |
| Image | Native Google session: one real Flare original, private browser access and same-job recovery, one charge in the isolated test ledger; PostgreSQL confirmation/reference parity | Production wallet qualification remains separate |
| Video | Fresh explicitly approved native Wan 3 attempt completed once after private-reference transport correction; real 5 s, 854 × 480 silent MP4 decoded, inserted, trimmed and recovered with measured source facts; one 30-cent charge | Physical device and further provider variants remain separate qualifications |
| Voice | One explicitly approved native Seed MP3, Sol-authored English script, one 5-cent charge; private chat decoding to end, saved library output and natural insertion with measured source facts | Durable remote audio execution and further provider variants |
| Music | One approved real Lyria 3 Clip, 30 s; complete native playback, one 5-cent charge, mix at 20% with voice at 100% | Other provider variants; production credential rotation remains separate |
| Editing | Shared manual/Sol commands, trim/move/gain/reload and revision safety; revision 10 saves separate voice/music tracks; concurrent decoding and collapsible monitor | Complete multi-action turns without falsely claiming a supported control is unavailable |
| Native UI | Chromium/Firefox/WebKit byte-backed playback, trim/move/gain/reload, bounded decoder recovery, responsive layout and persistent app-wide charcoal/olive | Physical Safari/iOS/Android smoke test with provider outputs |
| Export | Two free native exports completed once each on isolated ECS revisions 3 and 4; the second includes voice and music, plays to the end after reload, and projects canonical media identity and stored billing | Conversational export preparation is absent; physical devices and production rollout remain separate |

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

## Initial remote worker audit (historical)

Read-only AWS/Vercel inspection on 2 October 2026 established:

- ECS cluster `maxvideoai-timeline-exports` exists in `us-east-1`, ACTIVE, with no running/pending task at inspection. The active worker definition is revision 2, registered 9 June, 2 vCPU / 4 GB.
- Its actual container name is `worker`, not the launcher's default `timeline-export-worker`. A launcher for this definition needs the explicit container override.
- It refers to `maxvideoai-timeline-export-worker:latest`. That ECR repository currently contains no images; the referenced image cannot be pulled.
- SSM secret references exist. A private in-memory comparison confirmed the worker's database host/name match the primary production configuration. No credential values were printed or persisted. This definition must not serve the isolated QA database.
- Vercel project `maxvideoai-mcp-staging` exists, with provider/storage/reference namespaces and a database configured. Its listed environment lacks the director key, Studio gates and ECS launcher settings. Its DB isolation has not been verified. Main app production/preview also lack ECS launcher settings. Presence of other preview provider keys does not establish native pilot readiness.

Therefore the existing infrastructure is a useful base, not a qualified Studio test renderer. Prepare a separate pilot DB and worker definition/SSM namespace, an immutable image containing the current renderer, and isolated storage (a separate bucket avoids assuming that `VIDEO_RENDER_STORAGE_PREFIX` also scopes `timeline-exports/`). Use a protected branch preview with the coordinated session-aware readers and explicit migrations. Keep the existing production definition and MCP staging publication intact. Verify all pilot targets before any quote confirmation or worker dispatch.

That initial audit made no cloud configuration change, image push, deployment, production migration or paid media/render request. The subsequently authorized isolated pilot completed a real remote export; see the current checkpoint below. The production worker remains unchanged.

## Initial native export checkpoint (historical)

The user approved the displayed free export once. Job `tlx_0d7a699d2f6ad5738618965b1254dc99ef93d0997931537904877ab177327cbe` completed on 2 October at 16:58:13 UTC. The isolated worker exited 0. The original contains 750 video frames at 30 fps, 1280×720 H.264 and stereo 48 kHz AAC; the container is 25.002667 s. The real voice is present and the still holds through the silent ending. Reload while rendering and reopening after completion recovered the same job and a playable original, with no duplicate export.

Wallet export cost is **$0**, consuming one free export. Existing net media charges stay **$0.40**; 40 Responses / 110,685 tokens stay **$0.1619952 estimated Sol API cost**. The measured Fargate task interval estimates about **$0.00568 CPU/RAM**, excluding storage, logs, network, database, build work and taxes; this is not an invoice. API funding/card state remains unverified.

This checkpoint qualifies the first rough-cut export. The worker was subsequently rebuilt from `98345933c` and pinned as isolated revision 4, including the export-asset provenance correction. Offline entry-point/runtime checks passed. The one existing pilot asset was repaired explicitly and its original remeasured without rerendering. Music, actual layering and a second mixed export on revision 4 were later qualified; [the resume brief](studio-conversation-resume-brief.md) records that evidence and the current costs. The current film is no longer an acceptance gate. Keep physical-device qualification, commercial conversation pricing/caps and rollout review open.

## Native pilot protocol

The whole-branch review is complete and its recovery findings have a focused correction pass. Export submission identity and original manifest/preset are saved before POST; a lost acknowledgement retries that identity or reconciles it from owned Project history. Quote renewals carry their immutable retry provenance across tabs. Private decoder URLs survive routine polling; each failing clip has one automatic renewal per monitor opening, then a stable error. Missing originals remain removable in the canonical timeline. Keyboard volume changes are persisted. Local tests reproduce the original failures before verifying the corrections.

The bounded native media pilot is complete for its exercised capabilities. Do not continue the current film or launch another general agent salve. Qualify the next executable tool with a focused English scenario and exact spending approval only if a real paid provider call is necessary. The following steps document the original pilot protocol.

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

No production migration, publication, main-branch replacement or provider spend is implied by the local implementation. The pilot bundle must be reviewed before that operational step. Client readiness requires functional tools, correct account/billing policy, recovery and rollout qualification; improving the current film is no longer an acceptance requirement.
