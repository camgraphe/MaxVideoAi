# Seedance 1.5 direct BytePlus bridge

The public `seedance-1-5-pro` identity and customer prices remain unchanged. New jobs use the direct ModelArk profile only. If direct execution is not enabled and configured, generation and preflight fail before billing; they never fall back to Fal. Historical Fal jobs still use their recorded provider for polling and media access. The direct profile remains behind an explicit canary gate; no production traffic should be switched merely because the code is present.

## Activation prerequisites

1. Verify that the deployment account can invoke the exact Seedance 1.5 ModelArk model ID. The local development account's authenticated `/models` response on 2026-09-29 listed `seedance-1-5-pro-251215` with status `Retiring`; this is model discovery, not a successful generation canary. Configure the account-proven ID through `BYTEPLUS_ARK_SEEDANCE_1_5_MODEL_ID`. There is deliberately no default.
2. Capture the contract state and effective rate separately from the [published list rate](https://docs.byteplus.com/docs/ModelArk/1099320). The accounting projection uses the published audio/silent list rate and never labels it an account rate or invoice cost.
3. With an approved canary budget, verify text-to-video and first/last-frame image-to-video at 480p, 720p and 1080p, audio on/off, task polling, failure refunds and original media storage. Verify the billed model ID and observed rate.
4. Only after those checks, set `BYTEPLUS_ARK_ENABLED=true`, `SEEDANCE_1_5_BYTEPLUS_ENABLED=true`, and `SEEDANCE_1_5_PROVIDER=byteplus_modelark`. `SEEDANCE_1_5_BYTEPLUS_ADMIN_ONLY` defaults to `true`; allowed modes default to `t2v,i2v` through `SEEDANCE_1_5_BYTEPLUS_MODES`. Keep admin-only until the live canary and rollback have passed.

## Current account check — 2026-09-29

The development account's authenticated model list includes `seedance-1-5-pro-251215` with status `Retiring`. A bounded 4-second, 480p, silent T2V create request returned HTTP 404 `InvalidEndpointOrModel.NotFound` with the provider message that the model does not exist or the account lacks access. No task was created and no generation cost was incurred. Model listing alone therefore does not verify generation access. Activate this model for the account or obtain an authorized endpoint, then repeat the canary before enabling the route in any environment. The admin pricing comparison labels the direct route as disabled until its configuration is complete.

After the user activated the model, the ModelArk console in `ap-southeast-1` showed Seedance 1.5 as **Activated** in the `default` project. The `maxvideoai-byteplus-modelark-server` key in that project was **Active** with **All** permissions; its last-usage timestamp advanced to 03:39 local time after the diagnostic requests. The same local API key returned HTTP 200 from `GET /models`, including `seedance-1-5-pro-251215`, but a new 4-second 480p silent T2V create still returned HTTP 404 `InvalidEndpointOrModel.NotFound` (request ID `021790645841743124404eabe9b927fceaa7c0eaca8bf7af63398`, 2026-09-29 01:37 UTC). A non-billable malformed-create control using the same key and URL returned HTTP 400 `InvalidParameter` for the activated Seedance 2.0 model, but HTTP 404 for Seedance 1.5 (request ID `021790645968250e0570d30189b68d5608c0b11774ff85b9f3bf4`). This isolates the failure to effective 1.5 invocation access or ModelArk's model routing, rather than the shared API URL or authentication. Keep direct execution disabled and provide these request IDs to BytePlus support if access does not propagate.

The direct profile sends camera lock and seed when selected. It removes the Fal-only safety-checker toggle from direct runtime options. The current 1.5 Draft path is not implemented and must not be advertised.
When provider usage is unavailable, the list-cost estimate uses the 1.5 output dimensions from the [official video generation tutorial](https://docs.byteplus.com/en/docs/modelark/video-generation-tutorial), which differ from 2.5 at several aspect ratios.

## Retirement check — engineering owner, 2026-10-28

Review the live routing, account notices and replacement presentation by 2026-10-28. BytePlus [announces](https://docs.byteplus.com/en/docs/ModelArk/1350667) Seedance 1.5 shutdown after 17:00 on 2026-11-11 (UTC+8), with Seedance 2.0 Mini suggested as a replacement. The direct submission gate closes at 2026-11-11 09:00 UTC even if flags remain enabled. Do not silently substitute Mini for a paid 1.5 request. Keep historical Fal and BytePlus jobs readable through their recorded provider.
