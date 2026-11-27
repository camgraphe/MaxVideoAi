# Video purchase routing

The first economic route covers Wan 3 Prime text and single-image reference jobs. Existing engines continue through their configured providers. Open **Generations → Video routing** at `/admin/routing` to compare eligible suppliers and trace a job. Its simulator animates the same price decision and definitive-refusal policy in the browser. Replay a request or step through each submission. Scenario settings include individual provider responses and the purchase ceiling. Reduced-motion users start with the resolved trace. The provider map can be filtered from either end. Installed integrations show representative engine/mode associations. Configured paths come from the local paid-route resolver, including enabled fallbacks. Neither view makes provider requests.

## Pricing and eligibility

The router filters by exact engine, mode, media, resolution and aspect ratio. It ranks eligible offers by the cost of the whole request in USD microdollars. At equal cost the existing direct route takes priority. It uses local rate cards at submission time. The accepted customer quote, job identifier and wallet reservation are reused for every attempt.

| Scenario | APIMart Gold | Alibaba Singapore | Fal |
| --- | ---: | ---: | ---: |
| 15 s, 480p, text, 16:9, audio | $0.77145 | $1.02 | $1.02 |
| 4 s, 720p, one reference image, 16:9, audio | $0.41144 | $0.56 | $0.56 |

These figures use the published rates checked on 2026-11-27. APIMart Gold costs $0.05143, $0.10286 and $0.20571 per output second at 480p, 720p and 1080p respectively. The first version excludes input video, input audio, documents, last frames and other modes from APIMart. The canary ceiling is the lower of the existing direct provider’s estimate and the trusted USD customer quote. A server-configured ceiling can reduce it further. The simulator uses the direct estimate as its starting ceiling. [APIMart Wan Prime](https://apimart.ai/model/wan-3-0-prime) · [Alibaba model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing) · [Fal Wan Prime](https://fal.ai/models/alibaba/wan-3.0-prime/reference-to-video)

## Preproduction operation

The default mode saves a simulated purchase decision to the existing Wan Prime Alibaba attempt. The viewer marks this **Price simulation** and shows actual attempts separately. There is no extra database round trip to record a decision. Historical jobs without a decision retain their actual job/attempt information.

For a paid administrator canary on an isolated preview with qualified Gold pricing and SaaS/media rights, use the existing Alibaba direct gates plus server-only `APIMART_API_KEY` and `APIMART_WAN_PRIME_ADMIN_CANARY=1`. Actual Fal fallback also needs the existing `ALIBABA_MODEL_STUDIO_FALLBACK_TO_FAL_ENABLED` switch. An optional `WAN_PRIME_PURCHASE_CEILING_USD` applies to each eligible canary clip, including subsequent attempts. Missing credentials, public users and production deployments keep the existing submission policy. The viewer's response and balance controls are local simulations. Real canaries advance on explicit provider refusals.

APIMart accepts `POST /v1/videos/generations` and returns a task ID. The same authenticated cron as Alibaba and the authorized per-job refresher poll `GET /v1/tasks/{id}`, copy the completed video to owned storage, and use the existing delivery and terminal-failure paths. Disable the canary switch to stop new submissions. Keep the credential until accepted tasks have drained. The purchase estimate at completion is marked as a list estimate.

A known balance or throttling refusal can start the next eligible attempt under the ceiling. Invalid inputs or moderation stop the chain. A timeout or unreadable acknowledgement after sending moves the job to reconciliation. Keep the reservation until the first submission can be accounted for. An accepted task is polled only at its owning provider. The ledger claims each canary attempt once using the existing unique job/attempt index. It links each definitive rejection to the next attempt.

## Extending the route

1. Add the new provider's offer to `frontend/src/server/video-providers/purchase-router.ts`, including its capability predicate, exact pricing unit and tariff source. Price and compare new offers in the simulator first.
2. For a live adapter, register the submit factory in `wan-transports.ts`, normalize accepted/rejected/uncertain results, and wire its task polling, accounting, server-only activation gate and owned-media transport. The existing Fal queue adapter continues to handle Fal outcomes.
3. Cover exact option parity, duplicate claims, loss of acknowledgement and durable delivery. The decision journal and price ranking use the common candidate format. The admin's existing-path view calls the normal paid-route resolver on seven representative installed paths.

Run the focused tests from the repository root.

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/wan-purchase-routing.test.ts tests/alibaba-*.test.ts tests/provider-attempt*.test.ts
```
