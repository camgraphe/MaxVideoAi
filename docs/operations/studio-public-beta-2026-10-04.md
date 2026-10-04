# Studio public beta — 4 October 2026

Release owner: application engineering. The owner approved the new Studio as the normal public-account entry and approved the related MCP distribution updates. Deployment evidence belongs to [PR 378](https://github.com/camgraphe/MaxVideoAi/pull/378); a prepared change or environment setting is not a completed deployment.

## Entry and access

`/app/studio` opens the most recent owned connected conversation, or the new-conversation welcome. An authenticated standard account is sufficient. Anonymous entry returns through sign-in to Studio. Project and media ownership checks remain mandatory on every API read/write.

Missing conversation configuration now leaves the chat shell in its truthful unavailable state. It never silently redirects to the classic Canvas. Explicit Canvas routes remain for saved projects, starters, media handoffs and advanced editing; the conversation uses their shared timeline/media engine. No saved project is migrated or deleted by this release.

The EN/FR/ES public pages describe account access, finite assistance, explicit paid choices and the current export limitation. Locally captured demonstration media remain labeled as such. MP4 export stays disabled until a production renderer has been qualified.

## Production configuration

Project `maxvideoai` (`prj_CA8KpDAwYzihVJZyDNnEUrDszaMu`) uses the existing OpenAI credential. No credential is recorded in this document. The complete CLI environment inventory confirms its presence; the connector environment response was capped at 100 rows and could not establish absence.

The following production values were configured for the next Git-backed deployment:

| Variable | Value |
| --- | --- |
| STUDIO_IMAGE_CONVERSATION_ENABLED | true |
| STUDIO_CONVERSATION_ACTIONS_ENABLED | true |
| STUDIO_CONVERSATION_MEDIA_ENABLED | true |
| STUDIO_CONVERSATION_EDITING_ENABLED | true |
| STUDIO_ASSISTANCE_ENABLED | true |
| STUDIO_ASSISTANCE_APPROVED_POLICY | studio-beta-2026-10-03-v1 |
| STUDIO_CONVERSATION_EXPORTS_ENABLED | false |

Account access is authored by `FEATURES.studio.adminOnly=false`. The runtime flags alone do not change an already built deployment. Follow the ordinary GitHub/Quality CI/main/Vercel path, then verify both production domains against the merged SHA and exercise the authenticated chat.

## Economics and support

The [assistance contract](../engineering/studio-assistance-economics.md) remains authoritative: one-time supplier-cost ceilings of $1 Sol and $0.25 Luna per account, with a $100 total sponsored campaign. They are not wallet credits. Paid Sol requires an explicit, revision-bound budget at the displayed tariff; no automatic recharge, switch to Luna or media confirmation occurs.

Migration `62_studio_assistance_resolutions.sql` adds immutable support decisions. After disposable PostgreSQL tests and independent review, its exact committed source (`afc63c28e`) was applied transactionally to production branch `br-late-term-aeo22xpz`, database `neondb`, on 4 October. Readback confirms the table and immutable trigger, with zero decisions and zero assistance calls; no customer balance changed. It does not debit wallets or reinterpret historical usage. Support resolution returns an unknown customer reservation without pretending the supplier call was free, and retains exact-once settlement/refund protection. The dedicated reconciliation runbook owns operator procedure; generic receipt refunds reject assistance reservations.

## Observed validation checkpoints

- Reproduced the original authenticated route failure: disabled flags returned a 307 to classic Canvas.
- New default access policy admits members while unauthenticated requests remain rejected.
- 27 focused access/marketing/entry checks passed.
- Real PostgreSQL 17, Next and Chromium tests passed after removing every test-account admin role: normal Studio entry reaches the conversation, timeline/media editing and mobile access remain functional, and disabled flags show the unavailable chat surface.
- The assistance/support/admin focused suite passed 81/81, including expired-lease fencing, concurrent waiver/settlement, immutable audit and no repeated customer charge. The independent support/CLI rerun passed 10/10. TypeScript and frontend lint passed (six pre-existing image warnings).
- The model registry and generated catalogue checks passed. The production Next build completed successfully, including static generation of all 930 pages.
- The focused distribution/access/marketing rerun passed 18/18.
- The real montage browser suite passed 7/7 after making retained Canvas test entries explicit; failed autosave, acknowledged exit and mobile creation assertions remain intact. A separate starter-reload regression reproduced loss of Canvas context; the consumed-starter URL now retains `view=canvas`.
- The first PR CI detected nullable search parameters in the access presentation; the component now handles the initial null state. Final CI must run on the complete candidate, including support reconciliation.

## Distribution state

The remote MCP service and plugin package are separately versioned delivery surfaces. The canonical plugin 0.3.7 bundle is prepared at source tag `maxvideoai-plugin-v0.3.7` / commit `a833d985a81f9d523e08917674a01f1e220337b1`, with SHA-256 `f43ae14a709c97ef2cb07f4955ae52dc6792ec10e4ab86eeddad1fc67f4a6ff4`.

Owner approval resumed [workflow 37171170497](https://github.com/camgraphe/MaxVideoAi/actions/runs/37171170497), but GitHub rejected its scoped publication token. No protection was bypassed. The public plugin and official Registry remain 0.3.6 until the scoped secret is renewed and publication succeeds. The cached Registry authentication has also expired; renew through its normal namespace authentication before publishing, never by changing namespace identity.

The ClawHub guidance update retains the live-catalogue contract, removes misleading client-idempotency guidance and specifies returned retry delays/null stops. Its actual OpenClaw 2026.9.5 package load and deterministic interrupted-confirmation fixture passed; no new live-model, private-attachment or channel-rendering claim follows. The baseline and candidate both passed the bounded agent simulations, so these simulations do not establish a measured quality gain.

The n8n update requires actual engine qualification: the first draft passed isolated JavaScript checks but n8n 2.38.7 rejected direct access to the `arguments` property. A native Rename Keys node now projects that field before the sandboxed expressions. The real engine passed 19 deterministic cases including returned delays, null/invalid stop, approval rejection and the 20-status limit; no paid supplier generation was made. Never weaken the expression sandbox. Existing listing 19591 must be updated rather than duplicated, after source adoption and owner-portal authentication.

The final n8n source SHA-256 is `56bd2f781c5935a47b5a936c04f5759256e7d62e5fcc6b38d673c0ba036cb0dc` (21 nodes, disabled, zero credential references). The committed `scripts/qa/check-n8n-recovery.cjs` reproduced 19/19 actual-engine cases against those exact bytes, and CLI import/export retained all six authored fields.
