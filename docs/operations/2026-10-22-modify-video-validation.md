# Modify Video validation — 22 October 2026

Candidate: PR #500, not a production activation. The shared UI is checked against
all 13 configured `v2v` entries. Live MCP discovery exposes nine public Modify
entries; that differs from the admin Luma pilot and legacy catalog. Automated
coverage is not evidence of thirteen successful paid renders.

## Shared workflow and phone import

Composer presents the required source before optional references, accepts file
and library entry, waits for completed upload before pricing, and invalidates the
old quote when the source changes or disappears. Each model retains its reference
roles and advanced controls; unified Kling and Wan references remain available.

The original iPhone MOV imports through the production private helper, returning
the same canonical asset on re-import. The local demonstration verifies identical
bytes over multipart transport. This does not qualify arbitrary HEVC/HDR files or
implement trimming/compression. The candidate upload probe respects display
rotation: the original is 2160×3840, 5.558333s, without altering its bytes. Older
production metadata still needs a bounded repair after deployment.

## Mode-specific contracts

| Models | Verified code contract / live scope |
| --- | --- |
| Luma Ray 3.2 | Verified source timing up to 18s; no Modify duration override. Guides/keyframes, strength and preservation controls retained. Additional retail classes prepared, not activated. Five direct-provider qualifications completed. |
| Luma Ray 2 / Flash | Existing source-driven edits and unit tariff preserved; no new paid qualification or invented source ceiling. |
| Gemini Omni Flash 1.1 | Owned source, inherited timing/pricing and previous-interaction workflow preserved. Correct generated-output selection and explicit silent-delivery handling added; details below. |
| Kling Omni Standard / Pro | Modify Standard is 720p; Pro retains 1080p. Requested output duration 3–15s is preserved independently of source length. Images/subjects, keep-audio and aspect choices remain available. Both variants completed live through Fal. |
| Happy Horse 1.0 | Existing source timing and references retained. Configured-code coverage does not establish public MCP availability or live output. |
| Seedance 2.0 / Fast / Mini | Their requested output duration remains independent of source length. Resolution and image/video/audio references preserved; input/reference duration pricing remains separate. No paid qualification of these three variants in this batch. |
| Seedance 2.5 | ModelArk Edit inherits source timing/framing and keeps its own options/pricing. This person's video was refused and refunded. |
| Wan 3 / Prime | Independent output duration, input-video pricing, optional references and combined duration ceiling preserved. Both variants completed live. |

Kling's shared workspace previously replaced the requested output duration with
ceil(source duration). The mode now declares `durationPolicy: requested`; Seedance
2.0 variants receive the same correction. Luma and source-inheriting workflows do
not change. Payload tests verify requested 3/6/15s, source, reference images and
keep-audio on both Fal and direct Kling transports. **Fal already sent duration**;
the earlier report saying it omitted duration was incorrect.

The [Fal Standard Modify schema](https://fal.ai/models/fal-ai/kling-video/o3/standard/video-to-video/reference/api)
and [Pro schema](https://fal.ai/models/fal-ai/kling-video/o3/pro/video-to-video/reference/api)
have separate fixed-resolution endpoints, without a resolution parameter. Their
published sample files and the paid results measured 720p and 1080p respectively.
Do not extrapolate this to untested direct routing or other Kling modes. Generation
model defaults/public pricing stay at their existing resolution; only Modify's
mode capability becomes 720p. Public pricing, PAYG and JSON-LD baseline checks
protect that boundary. The existing source ceiling is not broadened from the Fal
schema alone while another transport remains unqualified.

## Modify pricing verification

The approved quotes used `v2v` and their model-specific source/output rules. This
is not a text-to-video price comparison. Provider estimates are not invoices.

Read-only production tariff inspection found 13 active Kling Standard Modify
cells for 3–15s under the old 1080p selector. The candidate
`server/pricing/kling-modify-resolution-tariffs.ts` prepares corresponding 720p
cells from those exact reviewed amounts, with the source revision and fingerprint.
It does not change historic cells, existing quotes or prices, and refuses missing,
inactive or already-authored targets. Canonical billing tests verify every copied
amount. At revision 1749, USD cents were:

| Output seconds | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cents | 50 | 66 | 82 | 99 | 115 | 132 | 148 | 164 | 181 | 197 | 214 | 229 | 246 |

These are a dated preparation snapshot, not newly activated prices. Re-read and
publish through reviewed tariff maintenance **before deploying** the corrected
catalog. Do not alias a new 720p quote to an old 1080p tariff. The additional Luma
classes have their separate review/activation requirement.

## Paid results

Five Luma direct renders completed for $4.32 total according to console usage.
The original 5.558333s produces 5.56s; an 8.4s fixture produces 8.4s; a 17.52s
fixture produces 17.32s. Frame-exact preservation is therefore not claimed.
The requested noir scene improved with a guide and explicit preservation controls.

Two MaxVideoAI batches were explicitly approved at $4.91 and $4.23. Every quote
was confirmed once. Both used the same original phone clip and fictional noir
scene, preserving the person and substituting an inert prop pistol.

| Model | Actual result and charge |
| --- | --- |
| Kling Standard | $0.99. Completed/library saved, 720×1280, 6.041667s despite the old 1080p quote. Close face/glasses/hair and changed night street/prop. |
| Seedance 2.5 | Recognizable-person reference refused (`seedance_reference_video_blocked`); $2.41 refunded to the wallet. No replacement attempt. |
| Wan 3 | $1.51. Completed/library saved, 720×1280, 6s. Noir alley/prop, more stylized face/beard than Kling on this example. |
| Kling Pro | $1.32. Completed/library saved, true 1080×1920, 6.041667s. Close appearance, noir street/prop. |
| Gemini Omni Flash | $0.80. Provider rendered 720×1280, 5.525333s. A response-selection bug saved the source to the library instead; the correct provider file was recovered without another generation. Changed alley/prop, recognizable appearance, partly colored rather than monochrome. |
| Wan 3 Prime | $2.11. Completed/library saved, 720×1280, 6s. Dark alley/prop, more stylized face/beard than Kling. |

Net MaxVideoAI comparison charge is $6.73 after the confirmed refund. Private
media, full provider responses, prompts and job identifiers remain outside Git.
The local results page presents all six outcomes, including the recovered Omni
file; it explicitly distinguishes recovery from a repaired production library.

### Omni output and audio corrections

The [Interactions response](https://ai.google.dev/gemini-api/docs/interactions-overview)
includes `user_input` before `model_output`. Selecting the first video across all
steps incorrectly persisted the phone original. The extractor now selects only
`model_output` steps, while retaining supported SDK output shapes. A regression
covers source/thought videos preceding the result and source-only responses.

The real result includes an audio track despite the requested audio-off setting.
The [documented video response format](https://ai.google.dev/api/interactions-api)
does not expose an audio-disable field on this route. Preserve the product choice
by removing audio from the downloaded generated output before storage, with video
packet copy rather than re-encoding. Requests with audio remain byte-identical.
Failure defers completion through the existing output-copy retry mechanism; never
publish the audible fallback as a successful silent job. This does not reduce the
provider charge or mutate the imported phone video.

The actual recovered file was also processed locally: video packet SHA-256 is
identical, resolution remains 720×1280, and no audio stream remains. Its video
stream is 5.5s; removing the trailing audio makes container duration 5.5s instead
of 5.525333s. No video frames are removed. Production library repair and post-deploy
end-to-end verification remain outstanding; no repeat paid generation is needed
to repair this one accepted result.

## Validation and release boundaries

The broad focused Modify/provider/pricing run passed 304 checks. Subsequent final
pricing/MCP/Omni/architecture checks passed 83; workspace/model-switch/provider
checks passed 52; audio delivery and actual-media regressions passed 16. These
runs overlap and should not be summed as distinct coverage.

The complete fast lane ran 8,470 checks: 8,450 passed, one skipped and 19 failed
(including nested cases). Eighteen failures were caused by a temporary model-wide
Kling resolution change leaking into public generation price presets; that change
was narrowed to Modify and all affected pricing/PAYG/baseline files passed in the
83-check rerun. One old candidate-switch expectation still derived Kling output
length from its source; updated for the explicit requested-duration contract and
passed in the 52-check rerun. The full fast lane is not claimed green on this final
patch until CI reruns it. The prior full 967-page build predates these final fixes.

- Activate reviewed Kling/Luma tariff additions before catalog rollout.
- Repair the single Omni output and older phone geometry through bounded writes,
  then verify the deployed import → quote → debit → provider → durable-output path.
- Seedance 2.0/Fast/Mini and legacy/admin variants have code coverage, not paid
  qualification in this batch. Seedance 2.5 cannot pass this tested person-reference
  scenario through its current provider restriction.
- All options are preserved; no blanket success claim for every codec, duration,
  identity or audio scenario. Required latest-candidate Quality CI remains mandatory.
- No deployment, production schema/tariff activation or marketing migration here.
  Public URLs, IDs, reuse recipes and SEO routing remain unchanged.
- Shared excerpt selection, codec/HDR preparation, customer quotas and physical
  storage cleanup remain separate unimplemented work.

LTX 2.5 Fast/Pro live discovery currently offers t2v/i2v/a2v, not Modify. Its
[open-source IC-LoRA workflows](https://github.com/Lightricks/ComfyUI-LTXVideo/blob/master/example_workflows/2.5/README.md)
include video editing but are not an enabled MaxVideoAI API mode.
