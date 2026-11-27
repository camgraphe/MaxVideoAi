# Video purchase routing

The Wan 3 Prime pilot supports text, a start frame, paired first/last frames and one to ten reference images. Kling 3 Pro (text or start image) and Kling O3 Pro (image references) also record purchase decisions in shadow mode on the direct submission path. Open **Generations → Video routing** at `/admin/routing` to compare eligible suppliers and trace a job. Its simulator animates the same price decision and definitive-refusal policy in the browser. Replay a request or step through each submission. Scenario settings include individual provider responses and the purchase ceiling. Reduced-motion users start with the resolved trace. The provider map can be filtered from either end. Installed integrations show representative engine/mode associations. Configured paths come from the local paid-route resolver, including enabled fallbacks. Neither view makes provider requests.

## Routing network in the admin

Open **Generations → Video routing** and select an engine on the map. In **Simulation**, the moving path follows a decision from request to supplier. Select **Two refusals** to follow two handoffs, or step through the trace. The receipt gives the selected offer, purchase ceiling and price difference from the first choice. Each engine card shows the number of scenarios and each supplier card exposes its state. The console beneath the network shows the latest steps and compares offers against the same ceiling. In Observed mode it shows recent recorded states and provider counts. Click a provider to inspect its eligibility and published rate where available. **Inspect scenario** opens the same request in the scenario lab, where **Compare installed suppliers only** rehearses the paths available without adding an integration.

**Observed** reads the recorded attempts for video jobs created in the last hour. The admin client refreshes every 30 seconds while this view is selected and the browser tab is visible. The query samples the newest 512 jobs across surfaces, keeps up to eight attempts per video job and returns the 48 latest status records plus route counts. The map signals when the job or attempt sample was truncated. A legacy job with a recorded remote task can show its owner. A handoff arc requires a linked predecessor. The monitor plays new recorded events in chronological order within the current filter. Hold an event to inspect it, then choose **Follow latest** to resume. The initial sample and unchanged samples stay still. The volume ranking counts each sampled video job once per engine, including jobs without a confirmed provider. Its fallback count includes only jobs with an observed handoff. Prompts, media URLs, remote task identifiers and customer identifiers are excluded from the feed.

The lab covers Wan Standard, Wan Prime, MiniMax H3, MiniMax H3 Max, Seedance 2.5, Kling 3 Pro and Kling O3 Pro. The new WaveSpeedAI quotes on Wan and APIMart quotes on H3 are available for simulation only. Rate sources and supported input combinations are listed in the [comparison catalogue](video-routing-comparison-offers.md).

## Pricing and eligibility

The router filters by exact engine, mode, media, resolution and aspect ratio. It ranks eligible offers by the cost of the whole request in USD microdollars. At equal cost the existing direct route takes priority. It uses local rate cards at submission time. The accepted customer quote, job identifier and wallet reservation are reused for every attempt.

| Scenario | APIMart Gold | Alibaba Singapore | Fal |
| --- | ---: | ---: | ---: |
| 15 s, 480p, text, 16:9, audio | $0.77145 | $1.02 | $1.02 |
| 4 s, 720p, one reference image, 16:9, audio | $0.41144 | $0.56 | $0.56 |

These figures use the published rates checked on 2026-11-27. APIMart Gold costs $0.05143, $0.10286 and $0.20571 per output second at 480p, 720p and 1080p respectively. The pilot excludes input video, audio references, documents, webpages, mixed frame/reference roles and unmapped extra options from APIMart. Frame and reference arrays retain their distinct generation types and ordering. The canary ceiling is the lower of the existing direct provider’s estimate and the trusted USD customer quote. A server-configured ceiling can reduce it further. The simulator uses the direct estimate as its starting ceiling. [APIMart Wan Prime](https://apimart.ai/model/wan-3-0-prime) · [Alibaba model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing) · [Fal Wan Prime](https://fal.ai/models/alibaba/wan-3.0-prime/reference-to-video)

## Model policies and secondary routes

The engine ID selects an exact purchase policy. Each policy declares its offers, baseline supplier and ordering. Capability checks, the customer-approved USD ceiling and supplier availability apply before ordering. The default maximum is the baseline estimate. The Fal queue owns settlement after submission, so a plan cannot continue beyond Fal. A newly offline provider is removed before submission and the remaining raw offers are ranked again in the simulator.

- **Lowest cost**, the Wan Prime default, sends to the cheapest eligible supplier. An equal-price tie follows the declared offer order.
- **Keep a fallback**, the Kling default for the shadow comparison, orders suppliers capable of handing off before terminal queues, then selects by cost within each group. A cheaper terminal supplier can still be the only route under a tight ceiling.

Kling Direct starts on standby for new purchases. The operator has declared the Kling 3 API pack out of funds. Compatible Kling 3, 3 Turbo and O3 requests go straight to the existing Fal queue, which prioritizes the direct Fal account credential. Controls exclusive to Kling Direct are rejected before provider submission. The admin map shows the declared status. The simulator can rehearse a funded pack locally.

Once the pack for the account behind the V3 API credentials has been verified and funded, set server-side `KLING_DIRECT_V3_FUNDED=true` in the intended environment to make the integration eligible under its existing enable, audience and fallback settings. Recheck supplier pricing before enabling it. The declaration is manual. Clear it to stop new direct purchases. Keep the existing polling credentials and polling switch for tasks already accepted by Kling. Kling 4 and 4 Flash use separate Fal routes.

With a funded pack, for Kling O3 Pro with two image references, ten seconds at 1080p and audio on, the existing Kling unit estimate is $1.68. The Fal reference endpoint lists $1.40. Preserving a fallback projects Kling Direct followed by Fal. Minimizing purchase cost projects Fal only. At a ceiling of $1.40 both policies admit Fal only. A price estimate does not establish the account's net invoiced rate. [Fal O3 Pro references](https://fal.ai/models/fal-ai/kling-video/o3/pro/reference-to-video)

For Kling 3 Pro five seconds of text with audio on costs an estimated $0.84 on both paths. A start image with audio off is $0.56 on both paths. Camera control is direct-only. Requests with voice, source video or unreviewed complex inputs have no comparable offer here. [Fal V3 text](https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video) · [Fal V3 image](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video)

The Kling comparison is attached to the existing first direct attempt. It models verified credit refusal and respects the configured credit-fallback flag. The established Kling handler controls dispatch, retries and customer billing. It can still retry certain ambiguous failures. The new simulator stops on those events. Compare the recorded plan with the actual attempt chain before enabling any new Kling execution policy. Version 2 snapshots record the policy. Older snapshots and jobs without a purchase decision stay readable. Use `/admin/routing?engine=kling-o3-pro` for the worked example. The browser receives scenario prices and capabilities only. The recorded job history belongs to the authenticated admin view.

## Historical replay and additional engines

The admin viewer includes a saved purchase audit and an on-demand replay for the previous 30 complete Europe/Madrid calendar days in the current environment. The query aggregates request settings for paid, completed, non-admin Wan Prime jobs. It reads no prompts or media URLs into the report. The replay uses first-attempt media roles and mode, the recorded USD customer ceiling, and the same purchase planner as the canary. A missing first-attempt record, ambiguous media counts or unsupported currency cannot contribute savings. At replay time all three suppliers are assumed available, the APIMart Gold rate is assumed accessible and the historical spend uses Alibaba Singapore LIST as its comparison. Manual session caps and invoice discounts are outside this estimate.

The November 27 audit covers 234 purchases created October 28 through November 26 inclusive. The earlier text/single-reference scope covers 163. Adding start frames, paired frames and multiple references covers 210, including 97 text, 12 frame and 101 image-reference jobs. All three offers fit each of the 210 recorded customer ceilings. The comparable Alibaba estimate is $350.53200. The APIMart estimate is $260.23503, giving a projected difference of $90.29697. The 24 outside the pilot include 21 with video inputs and 3 with audio references. The earlier supplier study compared rates on 211 purchases. Its broader media filter included the three audio-reference jobs, while its saved-mode filter missed two jobs whose first Alibaba attempt explicitly recorded reference mode. The simulator and replay do not generate provider tasks. [APIMart Prime media roles and rate card](https://apimart.ai/model/wan-3-0-prime)

Wan Standard compares the list prices of Alibaba and Fal with the public APIMart Gold rate. On 30 seconds at 480p this gives $1.50, $1.50 and $0.98640 respectively. If the 30% Alibaba account discount applies, the comparator becomes $1.05 and the projected difference is $0.06360. Its route comparison is recorded in shadow mode by default. An independent admin preview switch can exercise the purchase router through Alibaba and its eligible Fal fallback. [APIMart Standard rates](https://apimart.ai/model/wan-3-0) · [Alibaba pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)

MiniMax H3 uses the existing Fal cost calculator for reviewed text and image-reference profiles. For example, three reference images, ten seconds and 480p give $0.50. Seedance 2.5 stays with BytePlus. Its admin examples use observed token counts and the existing ModelArk list rate. The 22-second reference example used 476,100 tokens at 720p, giving $5.09427. Future jobs can consume a different number of tokens. Single-supplier scenarios show a stop after an explicit refusal. [Fal H3](https://fal.ai/models/minimax/h3/reference-to-video) · [BytePlus ModelArk pricing](https://docs.byteplus.com/en/docs/modelark/model-pricing)

## Preproduction operation

The default mode saves a simulated purchase decision to the existing Wan Standard or Prime Alibaba attempt. The experimental APIMart submission path is restricted to Wan Prime. The viewer marks this **Price simulation** and shows actual attempts separately. There is no extra database round trip to record a decision. Historical jobs without a decision retain their actual job/attempt information.

Both Wan editions can exercise the purchase router with the two installed suppliers. To rehearse for free, open the scenario lab, select **Wan 3 Prime**, and turn on **Compare installed suppliers only**. An explicit Alibaba refusal should reach Fal. A lost Alibaba response should end at reconciliation. Try the 15-second text and 4-second image-reference profiles. Their installed-provider ceilings at list price are $1.02 and $0.56 respectively. Reducing either ceiling below both offers should produce zero attempts.

For an actual administrator submission on an isolated preview, the existing Alibaba direct gates must allow the request. Set the server-side pilot for the intended edition:

- `WAN_STANDARD_EXISTING_PROVIDERS_ADMIN_CANARY=1` uses the existing Alibaba and configured Fal transports for the reviewed Wan Standard profiles. Standard cannot select APIMart or WaveSpeed. Set `WAN_STANDARD_PURCHASE_CEILING_USD` to tighten its ceiling independently.
- `WAN_PRIME_EXISTING_PROVIDERS_ADMIN_CANARY=1` uses Alibaba and the configured Fal fallback for the reviewed Wan Prime profiles. APIMart is excluded before ranking, even if its own switch and key are present. This mode takes precedence when both switches are set.
- `APIMART_WAN_PRIME_ADMIN_CANARY=1` with a valid `APIMART_API_KEY` adds APIMart after its price and commercial terms have been verified. Leave the installed-provider pilot switch off for this mode.

Actual Fal fallback requires `ALIBABA_MODEL_STUDIO_FALLBACK_TO_FAL_ENABLED`. The optional `WAN_PRIME_PURCHASE_CEILING_USD` can reduce an eligible Wan Prime canary clip’s purchase ceiling, including on fallback. Public users, production deployments and requests outside the pilot retain the established policy. The viewer's response and balance controls only affect its animation. Each paid pilot submission goes through the actual generation flow. Disable the corresponding pilot switch after testing.

APIMart accepts `POST /v1/videos/generations` and returns a task ID. The same authenticated cron as Alibaba and the authorized per-job refresher poll `GET /v1/tasks/{id}`, copy the completed video to owned storage, and use the existing delivery and terminal-failure paths. Disable the canary switch to stop new submissions. Keep the credential until accepted tasks have drained. The purchase estimate at completion is marked as a list estimate.

A known balance or throttling refusal can start the next eligible attempt under the ceiling. Invalid inputs or moderation stop the chain. A timeout or unreadable acknowledgement after sending moves the job to reconciliation. Keep the reservation until the first submission can be accounted for. An accepted task is polled only at its owning provider. The ledger claims each canary attempt once using the existing unique job/attempt index. It links each definitive rejection to the next attempt.

## Extending the route

1. Define a provider offer beside its rate source under `frontend/src/server/video-providers/purchase/`. Match exact engine and input roles, deny unreviewed combinations and return integer USD microdollars. One provider appears once for a given engine. Distinct endpoints for different modes belong to the capability/quote function. Mark transports that own final settlement as terminal.
2. Register the engine's baseline, offers and default strategy in `purchase-router.ts`. The decision engine resolves prices locally. Normalize the provider's validated submission inputs before comparing offers, and use the existing attempt write to record the decision. A missing policy returns no comparison and keeps the existing owner in control.
3. Add representative requests to the admin routing scenarios. The viewer derives its providers, policies, costs and branches from the same quote and ranking functions. Stage observable decisions before enabling a transport.
4. A live adapter additionally needs server-only activation, a durable attempt claim, definitive/uncertain error classification, provider-specific polling, settlement and media delivery. Wan direct submit factories are registered in `wan-transports.ts`. Verify retries, concurrency, budget boundaries, duplicate offers, direct-only options and single charging.

Run the focused tests from the repository root.

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/wan-purchase-routing.test.ts tests/kling-purchase-routing.test.ts tests/wan-routing-replay.test.ts \
  tests/alibaba-*.test.ts tests/provider-attempt*.test.ts tests/fal-provider-fallback-enqueue-postgres.test.ts \
  tests/kling-provider-routing.test.ts tests/fal-fallback-attempt-recovery.test.ts tests/generate-route-context.test.ts \
  tests/fal-credential-alias.test.ts tests/video-provider-mode-matrix.test.ts tests/byteplus-provider-architecture.test.ts \
  tests/routing-comparison-offers.test.ts tests/admin-traffic-map.test.ts tests/admin-routing-traffic-postgres.test.ts
```

### Pilot checkpoint · November 27, 2026

The expanded suite passed 256 checks locally with simulated supplier responses and disposable PostgreSQL. The two browser workflows in `tests/e2e/admin-routing-traffic.spec.ts` also passed on the isolated local admin. The Wan Standard, Wan Prime and APIMart pilot switches were left off. No paid render was submitted. Kling Direct remains on standby.

To resume, open branch `codex/video-provider-router` and the **Preproduction operation** section above. APIMart pricing and rights discussions are tracked in OUTREACH as `INB-012`. A proposed first paid comparison is the same four-second, 720p Wan Prime request with one reference image and audio on Alibaba and Fal. Its two list-price estimates total $1.12. Record the delivered media, serving model when exposed, latency and actual supplier charge for each completed render.
