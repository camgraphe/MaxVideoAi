# Isolated native Studio pilot — 2 October 2026

The user authorized preparing this pilot after the read-only worker audit. These changes affect separate pilot resources. Main app production, the existing production worker and public MCP staging remain unchanged.

## Resources and proof

| Resource | Prepared state | Qualification remaining |
| --- | --- | --- |
| Neon | Schema-only `qualification/studio-native-20261002`, branch `br-twilight-sea-ae32jnf3`; zero rows verified before bootstrap and all 59 ordered migrations. Independent branch credential, 0.25 CU, 300 s suspension, expiration 16 October at 22:00 UTC | Production wallet/library were not cloned; this is a test ledger |
| Storage | Private `maxvideoai-studio-pilot-469541406686-20261002`, public access blocked, encryption, 30-day lifecycle. Anonymous probe refused; signed GET returned exact owned bytes; probe removed | Generated-media upload, metadata and playback |
| Worker | Source `32f1f60e2`, Node 22, pricing package and Corepack cache; pinned digest `sha256:b31510eb2c9822942ccfba8d06132335c920b95f31a453d62ecdf538f87ce2c0`. Actual offline entry point reached the database-not-configured preflight | No database claim, render or Fargate dispatch occurred |
| ECS | Separate cluster, execution role, SSM namespace and `maxvideoai-studio-pilot-worker:2`; scoped storage/launcher identities. Independent pilot DB credential; both selected public subnets share the security group's VPC | Explicitly approved dispatch, output upload and recovery |
| Vercel | Dedicated protected `maxvideoai-studio-pilot` project with preview configuration. Callback origin `https://maxvideoai-studio-pilot-camgraphes-projects.vercel.app` | Remote Google redirect allowance is unqualified; native Google stays on localhost |

CodeBuild built the image because the local Docker API did not respond. An offline check exposed a missing package-manager cache; the corrected image passed the real entry-point check with no network or credentials. Versions: Node 22.23.3, FFmpeg 5.1.9 and Chromium 154.0.8037.92. Builds contained no provider/database credentials. Temporary setup/build identities were revoked. Engineering build/storage/compute costs are separate from media quotes; their invoice total is unverified.

Vercel auto-promoted its first project deployment despite the explicit preview option. It loaded no application environment keys and was canceled before readiness. The subsequent deployment was verified Preview (`target: null`) and READY before aliasing. Always check returned project, target and protection rather than relying on CLI arguments.

Actual transport probes passed: anonymous access redirects to Vercel SSO; deployment bypass alone receives native-session `401`; Fal bypass without its application token receives `401`; both callback credentials reach `400 EMPTY_BODY` without invoking the job writer. Never print token-bearing URLs or disable SSO for a provider.

## Local client checkpoint

The active localhost preview uses actual Google Auth, isolated Neon, OpenAI/Fal and private storage, with a separate HTTPS callback origin. The old socket-only QA and its 13 turns remain on port 3002. Image/action/edit gates are enabled; video/audio and export gates remain closed pending bounded native output tests. Only the owner's admin role, canonical empty Project/Sequence and already accepted legal versions were copied/created. Balance is zero; no synthetic top-up or production balance copy was made.

Three ordinary English messages produced Sol's concept, its own prompt and a native quote: one GPT Image 2.5 Flare 16:9 high PNG, no references, **5 cents USD**. The live journey exposed a four-Response limit that blocked preparation after project/catalog/memory tools. The fourth slot now permits only terminal prepare tools, retaining the four-call ceiling and no payment tool. Regression and the actual follow-up confirmed preparation; native generation/recovery after acceptance still require fresh approval.

All ten Responses, including the blocked exchange, were reported: **17,629 tokens**, with 33 reasoning tokens already included in output. Standard-tier estimated API cost: **$0.0269206**, using [public rates](https://developers.openai.com/api/docs/pricing) checked on 2 October. Local `studio-native-pilot/usage-and-quote.json` evidence retains every raw usage/cache-write record and response identity. This is not an OpenAI invoice, card verification or customer token billing. The checkpoint had zero media jobs, receipt charges/top-ups and exports.

## Callback configuration and lifecycle

`FAL_WEBHOOK_BASE_URL` is a server-only callback origin, independent of browser/Auth `NEXT_PUBLIC_APP_URL` and site origins. `FAL_WEBHOOK_VERCEL_BYPASS_SECRET` belongs only to this project's automation protection bypass. When set, the callback requires HTTPS and a separate `FAL_WEBHOOK_TOKEN`. The application token remains required after the deployment bypass. Neither secret belongs in public variables or source archives.

Keep persistent scoped storage/launcher identities until accepted jobs are reconciled, then explicitly remove pilot AWS/Vercel resources. Neon expiration does not remove them. The old inherited-password pilot SSM parameter was removed; the worker uses `DATABASE_URL_NATIVE`. Credentials remain in private runtime configuration, never Git. No production migration/publication or media spending is implied by this preparation. Continue with one freshly approved native image before the remaining video/voice/music/export acceptance steps in the [readiness guide](studio-conversation-pilot-readiness.md).
