# Seedance 1.5 direct BytePlus bridge

The public `seedance-1-5-pro` identity and customer quotes remain unchanged. Fal remains the default execution provider. The direct ModelArk profile is available only for an explicit, account-verified canary; no production traffic should be switched merely because the code is present.

## Activation prerequisites

1. Verify that this account can invoke the exact Seedance 1.5 ModelArk model ID. The [official prompt guide](https://docs.byteplus.com/en/docs/modelark/seedance-1-5-pro) and [video task API](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api) have shown different prefixes, so configure the account-proven ID through `BYTEPLUS_ARK_SEEDANCE_1_5_MODEL_ID`. There is deliberately no default.
2. Capture the contract state and effective rate separately from the [published list rate](https://docs.byteplus.com/docs/ModelArk/1099320). The accounting projection uses the published audio/silent list rate and never labels it an account rate or invoice cost.
3. With an approved canary budget, verify text-to-video and first/last-frame image-to-video at 480p, 720p and 1080p, audio on/off, task polling, failure refunds and original media storage. Verify the billed model ID and observed rate.
4. Only after those checks, set `BYTEPLUS_ARK_ENABLED=true`, `SEEDANCE_1_5_BYTEPLUS_ENABLED=true`, and `SEEDANCE_1_5_PROVIDER=byteplus_modelark`. `SEEDANCE_1_5_BYTEPLUS_ADMIN_ONLY` defaults to `true`; allowed modes default to `t2v,i2v` through `SEEDANCE_1_5_BYTEPLUS_MODES`. Keep admin-only until the live canary and rollback have passed.

The direct profile sends camera lock and seed when selected. It removes the Fal-only safety-checker toggle from direct runtime options. The current 1.5 Draft path is not implemented and must not be advertised.

## Retirement check — engineering owner, 2026-10-28

Review the live routing, account notices and replacement presentation by 2026-10-28. BytePlus [announces](https://docs.byteplus.com/en/docs/ModelArk/1350667) Seedance 1.5 shutdown after 17:00 on 2026-11-11 (UTC+8), with Seedance 2.0 Mini suggested as a replacement. The direct submission gate closes at 2026-11-11 09:00 UTC even if flags remain enabled. Do not silently substitute Mini for a paid 1.5 request. Keep historical Fal and BytePlus jobs readable through their recorded provider.
