# Luma Modify: admin trial readiness

Status: direct API qualification completed for fractional 5.558333s, 8.4s and 17.52s inputs;
production activation and the end-to-end MaxVideoAI canary remain pending.
Scope: source acceptance, actual output timing, visual fidelity and measured account
usage. No generation is authorized by this document alone.

## Qualification findings — 2026-10-22

With explicit user approval, the original iPhone MOV (H.264/AAC, 26,852,432 bytes,
5.558333s) was submitted unchanged to Ray 3.2 `video_edit` at 720p.
`video.duration` was omitted. The output completed at 720×1280, 25fps, 5.56s,
with audio. The API console showed one Modify call and USD 1.08 usage.
A separate looped 360p technical fixture of 8.4s also completed at exactly 8.4s.
A second looped fixture measured 17.52s at input and 17.32s at output (360p,
25fps): accepted near the documented ceiling, but not frame-exact preservation.
The console total after five completed Modify calls was USD 4.32; the fifth call
added USD 0.54. These fixtures are not native longer phone takes and do not qualify
other phone codecs.

The first automatic-conditioning render replaced the background but substantially
changed the person. Explicit face/pose/trajectory controls improved the resemblance
but did not establish exact identity preservation. A guide-image qualification
then completed for the user-requested fictional film-noir scene: the original
5.558333s MOV, 720p, a generated first-frame guide and explicit face/pose/trajectory
controls produced a 5.56s portrait clip with audio. Beginning/middle/end frame
inspection shows materially improved identity fidelity and the requested prop.
One prompt was synchronously rejected with `content_moderated`; an explicit
fictional-film/inert-prop clarification was accepted. Quality must be reviewed
independently of HTTP acceptance, duration and billing.

The branch removes the artificial exact-5s/10s source restriction. Fractional
sources are verified in web quote/execution and canonical estimate/transaction
pricing. Modify sends the original source without `video.duration`. New retail
classes are prepared in code, not activated in production; see the pricing guide.
The live renders do not establish a general provider rounding or charging rule.

These engineering renders went directly to Luma with the approved key; they did not
exercise MaxVideoAI wallet debits, production import, its polling/copy lifecycle or
customer receipts. Private source files, provider responses and visual evidence stay
outside Git in the local qualification output directory.

## Source and billing contract

The [Agents editing guide](https://docs.agents.lumalabs.ai/guides/videos/editing/)
and [FAQ](https://docs.agents.lumalabs.ai/guides/faq/) specify an 18s source ceiling
for Modify and 10s for Reframe, with a 200MB file ceiling. Modify inherits source
timing. The application accepts verified positive source durations up to 18s.
No automatic trimming is performed. Its proposed customer tariff quantity is the
source duration rounded up to a second, with the existing 5s minimum. Existing
5s/10s reference amounts stay unchanged; other classes extend that commercial
reference proportionally and require reviewed active coverage before release.
Supplier costs for those other classes remain unknown. Guide images stay optional.

The web path accepts exactly one video in `video_url`. Extra, duplicate or
alternate-slot video inputs are rejected before quoting, and execution binds the
verified duration to the exact source URL sent to the provider.

Reframe now explicitly sends the selected 5s/10s output duration, as specified by
the [Reframe guide](https://docs.agents.lumalabs.ai/guides/videos/reframing/).
Its source can be shorter but must remain within 10s. Reframe is a separate trial.

## Release prerequisites

1. Merge the isolated PR only after current main, required Quality CI and
   `pnpm deployment:check`, following [GitHub/Vercel delivery](../deployment/github-vercel.md).
   Confirm both production domains serve the merged revision before changing flags.
2. Confirm `LUMA_AGENTS_API_KEY` exists in the target environment without displaying
   its value. Presence does not establish account credit, model access or key validity.
   Confirm those in the Luma account before the paid trial.
3. Confirm the configured cron invokes `/api/cron/luma-agents-poll`, authenticates
   with existing cron authentication, and can copy results to owned storage. Inspect
   status/logs; a successful application build does not certify this lifecycle.
4. Record the current values of the flags below for rollback. Stage changes only
   for the reviewed deployment/environment. Vercel environment edits require a new
   deployment to take effect; do not copy the Desktop checkout to production.

## Prepared admin-only configuration

```dotenv
LUMA_AGENTS_ENABLED=true
LUMA_AGENTS_VIDEO_DIRECT_ENABLED=true
LUMA_AGENTS_IMAGE_DIRECT_ENABLED=false
LUMA_AGENTS_ADMIN_ONLY=true
LUMA_AGENTS_PUBLIC_ROUTING_ENABLED=false
LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED=true
LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED=false
```

These values are a proposal, not applied by this change. The existing video flag
enables eligible Ray 3.2 direct modes for authenticated admins, not just Modify.
Public direct modes remain unavailable, images stay on their existing path, and
HDR/EXR remain disabled. Modify/Reframe never fall back to a second Fal render.
Use the **web workspace with an admin account** for this phase: MCP uses public
execution eligibility and must not be opened to public traffic to bypass this gate.

## Historical 5-second admin canary recipe — revise before release

Choose a simple owned clip with one visible person or object, limited occlusion
and a modest camera move. This historical recipe uses an already 5s source only;
it must not become a customer trimming requirement. The stored duration must be
verified; a browser-reported duration or a requested length cannot replace the source fact.
Unknown duration must be resolved by the existing verified import path before
quoting. Keep the source asset ID and original unchanged for comparison.

In the admin workspace choose **Luma Ray 3.2 → Modify**, select the source,
**5s**, **720p**, **Auto** conditioning, with HDR/EXR/loop off and no guide frames.
The target background for this trial is a bright greenhouse:

> Replace the background with a spacious sunlit greenhouse, glass walls, lush green plants and a pale stone floor. Keep the original subject's identity, clothing, shape, scale, position and movement. Preserve the original camera movement, framing and timing. Keep the foreground subject sharp and unchanged. Match the new environment's perspective, lighting and contact shadows naturally. Do not add people, text or logos.

Read a fresh exact MaxVideoAI quote for this source/settings combination and obtain
approval before submitting **one** generation. The published Luma supplier estimate
for 5s/720p SDR Modify is **USD 1.08**, not the customer price; current customer
tariffs remain authoritative. See [Luma pricing](https://docs.agents.lumalabs.ai/guides/pricing/).
The internal estimator now also carries HDR/EXR factors through submission and
completion; those options are outside this trial.

Record the public job ID immediately. If submission times out or the response is
ambiguous, recover that job/status before doing anything else. Do not submit a
second render or infer approval from a refund. After acceptance, all polling stays
on Luma.

## Acceptance evidence and rollback

- One accepted `luma_agents_direct` provider attempt, type `video_edit`, with the
  approved duration/resolution; no Fal attempt for that job.
- Completion copied to MaxVideoAI storage before job completion. The original
  download and full video play after provider URL expiry; thumbnail and library
  entry resolve normally. Check source/output duration and framing.
- Recorded estimate is USD 1.08 in the provider attempt and terminal job cost
  breakdown for this SDR trial. Check the actual account usage separately; an
  estimate is not an invoice. The customer receipt matches its approved quote.
- Compare beginning, middle and end: background changed, subject appearance and
  movement preserved acceptably, plausible perspective/shadows, limited flicker.
  Save observations with the job ID; model quality is not guaranteed by unit tests.

If submission, billing or copy fails, stop submitting new trials. The current
poller shares the global/video flags: **keep both enabled until every accepted
job is completed or explicitly settled**, so polling/copying can finish. Then
restore the previous flags through the normal Git-backed deployment process.
Disabling these flags early also stops polling; it does not cancel provider work. Retain
job/attempt/payment evidence and use the normal refund policy, without deleting
records or automatically resubmitting. Public activation needs a separate decision
after this trial succeeds.
