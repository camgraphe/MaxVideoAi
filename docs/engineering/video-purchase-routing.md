# Video purchase routing

The Wan 3 Prime pilot supports text and single-image reference jobs. Kling 3 Pro (text or start image) and Kling O3 Pro (image references) also record purchase decisions in shadow mode on the direct submission path. Open **Generations → Video routing** at `/admin/routing` to compare eligible suppliers and trace a job. Its simulator animates the same price decision and definitive-refusal policy in the browser. Replay a request or step through each submission. Scenario settings include individual provider responses and the purchase ceiling. Reduced-motion users start with the resolved trace. The provider map can be filtered from either end. Installed integrations show representative engine/mode associations. Configured paths come from the local paid-route resolver, including enabled fallbacks. Neither view makes provider requests.

## Pricing and eligibility

The router filters by exact engine, mode, media, resolution and aspect ratio. It ranks eligible offers by the cost of the whole request in USD microdollars. At equal cost the existing direct route takes priority. It uses local rate cards at submission time. The accepted customer quote, job identifier and wallet reservation are reused for every attempt.

| Scenario | APIMart Gold | Alibaba Singapore | Fal |
| --- | ---: | ---: | ---: |
| 15 s, 480p, text, 16:9, audio | $0.77145 | $1.02 | $1.02 |
| 4 s, 720p, one reference image, 16:9, audio | $0.41144 | $0.56 | $0.56 |

These figures use the published rates checked on 2026-11-27. APIMart Gold costs $0.05143, $0.10286 and $0.20571 per output second at 480p, 720p and 1080p respectively. The first version excludes input video, input audio, documents, last frames and other modes from APIMart. The canary ceiling is the lower of the existing direct provider’s estimate and the trusted USD customer quote. A server-configured ceiling can reduce it further. The simulator uses the direct estimate as its starting ceiling. [APIMart Wan Prime](https://apimart.ai/model/wan-3-0-prime) · [Alibaba model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing) · [Fal Wan Prime](https://fal.ai/models/alibaba/wan-3.0-prime/reference-to-video)

## Model policies and secondary routes

The engine ID selects an exact purchase policy. Each policy declares its offers, baseline supplier and ordering. Capability checks, the customer-approved USD ceiling and supplier availability apply before ordering. The default maximum is the baseline estimate. The Fal queue owns settlement after submission, so a plan cannot continue beyond Fal. A newly offline provider is removed before submission and the remaining raw offers are ranked again in the simulator.

- **Lowest cost**, the Wan Prime default, sends to the cheapest eligible supplier. An equal-price tie follows the declared offer order.
- **Keep a fallback**, the Kling default for the shadow comparison, orders suppliers capable of handing off before terminal queues, then selects by cost within each group. A cheaper terminal supplier can still be the only route under a tight ceiling.

For Kling O3 Pro with two image references, ten seconds at 1080p and audio on, the existing Kling unit estimate is $1.68. The Fal reference endpoint lists $1.40. Preserving a fallback projects Kling Direct followed by Fal. Minimizing purchase cost projects Fal only. At a ceiling of $1.40 both policies admit Fal only. A price estimate does not establish the account's net invoiced rate. [Fal O3 Pro references](https://fal.ai/models/fal-ai/kling-video/o3/pro/reference-to-video)

For Kling 3 Pro five seconds of text with audio on costs an estimated $0.84 on both paths. A start image with audio off is $0.56 on both paths. Camera control is direct-only. Requests with voice, source video or unreviewed complex inputs have no comparable offer here. [Fal V3 text](https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video) · [Fal V3 image](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video)

The Kling comparison is attached to the existing first direct attempt. It models verified credit refusal and respects the configured credit-fallback flag. The established Kling handler controls dispatch, retries and customer billing. It can still retry certain ambiguous failures. The new simulator stops on those events. Compare the recorded plan with the actual attempt chain before enabling any new Kling execution policy. Version 2 snapshots record the policy. Older snapshots and jobs without a purchase decision stay readable. Use `/admin/routing?engine=kling-o3-pro` for the worked example. The browser receives scenario prices and capabilities only. The recorded job history belongs to the authenticated admin view.

## Preproduction operation

The default mode saves a simulated purchase decision to the existing Wan Prime Alibaba attempt. The viewer marks this **Price simulation** and shows actual attempts separately. There is no extra database round trip to record a decision. Historical jobs without a decision retain their actual job/attempt information.

For a paid administrator canary on an isolated preview with qualified Gold pricing and SaaS/media rights, use the existing Alibaba direct gates plus server-only `APIMART_API_KEY` and `APIMART_WAN_PRIME_ADMIN_CANARY=1`. Actual Fal fallback also needs the existing `ALIBABA_MODEL_STUDIO_FALLBACK_TO_FAL_ENABLED` switch. An optional `WAN_PRIME_PURCHASE_CEILING_USD` applies to each eligible canary clip, including subsequent attempts. Missing credentials, public users and production deployments keep the existing submission policy. The viewer's response and balance controls are local simulations. Real canaries advance on explicit provider refusals.

APIMart accepts `POST /v1/videos/generations` and returns a task ID. The same authenticated cron as Alibaba and the authorized per-job refresher poll `GET /v1/tasks/{id}`, copy the completed video to owned storage, and use the existing delivery and terminal-failure paths. Disable the canary switch to stop new submissions. Keep the credential until accepted tasks have drained. The purchase estimate at completion is marked as a list estimate.

A known balance or throttling refusal can start the next eligible attempt under the ceiling. Invalid inputs or moderation stop the chain. A timeout or unreadable acknowledgement after sending moves the job to reconciliation. Keep the reservation until the first submission can be accounted for. An accepted task is polled only at its owning provider. The ledger claims each canary attempt once using the existing unique job/attempt index. It links each definitive rejection to the next attempt.

## Extending the route

1. Define a provider offer beside its rate source under `frontend/src/server/video-providers/purchase/`. Match exact engine and input roles, deny unreviewed combinations and return integer USD microdollars. One provider appears once for a given engine. Distinct endpoints for different modes belong to the capability/quote function. Mark transports that own final settlement as terminal.
2. Register the engine's baseline, offers and default strategy in `purchase-router.ts`. The decision engine resolves prices locally. Normalize the provider's validated submission inputs before comparing offers, and use the existing attempt write to record the decision. A missing policy returns no comparison and keeps the existing owner in control.
3. Add representative requests to the admin routing scenarios. The viewer derives its providers, policies, costs and branches from the same quote and ranking functions. Stage observable decisions before enabling a transport.
4. A live adapter additionally needs server-only activation, a durable attempt claim, definitive/uncertain error classification, provider-specific polling, settlement and media delivery. Wan direct submit factories are registered in `wan-transports.ts`. Verify retries, concurrency, budget boundaries, duplicate offers, direct-only options and single charging.

Run the focused tests from the repository root.

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/wan-purchase-routing.test.ts tests/kling-purchase-routing.test.ts tests/alibaba-*.test.ts tests/provider-attempt*.test.ts
```
