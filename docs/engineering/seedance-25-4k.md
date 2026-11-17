# Seedance 2.5 4K — 17 November 2026 candidate

Seedance 2.5 keeps its existing identity and ModelArk model
`dreamina-seedance-2-5-260628`. Direct `resolution: "4k"` and native Draft 480p
followed by a separately paid 1080p or 4K final use the same provider adapter.
Omitting final resolution retains 1080p; explicit 480p/720p finals are rejected.
The five ModelArk modes are t2v, i2v, ref2v, v2v and extend. Environments retaining
LAS Edit keep its separate 480p/720p limits. Flash remains 480p/720p without Draft.

## Primary evidence

The live [tutorial](https://docs.byteplus.com/en/docs/ModelArk/seedance-2-5),
[task API](https://docs.byteplus.com/en/docs/ModelArk/create-video-generation-task-api)
and [pricing page](https://docs.byteplus.com/en/docs/ModelArk/model-pricing) were
checked on 17 November; their published updates are dated 16 November 2026.
Both 1080p and 4K use 10-bit HEVC. This is not a claim of HDR or 4:4:4 chroma.
Duration remains 4–30 seconds, with the existing Auto and source-timing policies.
4K is a resolution tier: landscape is 3840×2160, square is 2880×2880, and the other
published rasters live in `frontend/lib/seedance-output-dimensions.ts`.

The supplier's linked [minimum-token table](https://bytedance.larkoffice.com/wiki/H0fUwHPxtiHayOk6CVpcZzKqnHJ?table=tblTUnmKaxBSqpU7&view=vew3SrxKLX)
was read through its public UI: 447 rows, including 108 4K rows. The dated fixture
`tests/fixtures/seedance-25-4k-minimums-2026-11-17.json` retains all 108 published
values (four aspect groups × 27 durations); the test also checks both orientations.
All match the existing minimum estimator. Provider-reported usage remains authoritative.

## Price ownership and activation

4K LIST is $4.7/M tokens without video input and $2.9/M with video input.
Adrien approved LIST ×2 on 17 November. `seedance25-commercial-tariffs.ts` authors
literal customer cells, with upward cent rounding once and the verified continuous
video-input minimum/slope. Normal and final selectors remain separate. A 5s 16:9
no-video task costs an estimated $4.5684 LIST and has a $9.14 customer quote.
Its existing Draft is charged separately. No new account discount is assumed.

There are 1,944 new 4K classes: 972 normal and 972 final. Prepare only their nine
bounded, create-missing admin imports without reading or writing production:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/prepare-seedance25-4k-tariffs.ts /tmp/seedance-25-4k-tariffs
```

Use Admin Pricing → Tariff batches → Exact batch JSON. Preview and confirm each
import against the current revision; preserve its receipt and finish page refresh.
Existing 4K cells conflict rather than being overwritten. The older full commercial
proposal still separates legacy replacement batches from these new imports.
Direct and final 4K refuse quotation when their active tariff is missing; the
display basis cannot enable legacy percentage billing. Historical prices and
paid receipts are not rewritten.

## Web, Studio/Milo and MCP

Shared engine and mode capabilities project 4K to the workspace, Studio/Milo and
MCP. Studio's existing certified creation, Modify and Extend paths retain the
selected resolution through `video_prepare`, canonical quotes and paid requests.
This adds no new timeline/export quality setting or automatic generation.

The shared library/Studio Draft action offers 1080p and 4K and displays the
actual stored final resolution. Changing the choice invalidates its quote;
in-flight and ambiguous submissions keep the choice locked. Parent ownership,
references, creative settings, expiry, atomic reservation and refund recovery
continue through the existing workflow owners.

MCP accepts `settings.resolution` through its existing input contract. Discovery
adds `final.resolutions` while retaining `final.resolution: "1080p"` as the default.
`seedanceWorkflowPrices` keeps its existing default 1080p estimate fields and adds
`finalResolution` and `finalOptions` so 4K estimates cannot be confused with 1080p.
A final preparation returns the chosen tier's exact quote. Each step still needs
explicit confirmation, and a different resolution needs a new quote.

The plugin archive, version, manifests, OAuth, tool names, input/output schemas,
tool descriptors and OpenAI review submission are unchanged. These additive live
facts use the existing passthrough result contracts. Deterministic MCP checks do
not establish host refresh, OpenAI approval or real-host behavior.

## Release boundary

This candidate does not establish production activation or account-specific 4K
access. Complete required Quality CI, tariff activation and an authorized bounded
provider canary before claiming the feature is live. Check direct and Draft final
outputs, actual dimensions/10-bit HEVC, original delivery, provider usage and
receipts. BytePlus documents 4K RPM 15 and one concurrent task; no higher throughput
is promised. The model-page work remains coordinated in PR #657 and must follow
the actual activation signal.
