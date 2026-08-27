# MCP demonstration evidence

Last evidence update: 2026-08-28

Publication status: gated

Permitted public proof: historical Claude Desktop host-UI capture plus the current MaxVideoAI production workspace and Library captures listed below

## Evidence decision

A controlled Claude Desktop session now records that the read-only `present_generation` app displayed a completed MaxVideoAI video inline, preserved the MaxVideoAI library handoff, and exposed the first-party CTA. A separate manual interaction in the same test recorded native playback; the published still image itself proves the rendered player and controls, not the Play action. This host-UI capture is publishable as Claude-specific rendering evidence. It is not a job-backed result proof, does not establish ChatGPT rendering, and does not change `getMcpProof(locale)`, which remains `null`.

The `$0.95` visible in the capture is the historical amount recorded in that test. It is never presented as a current price or quote.

At the 2026-08-26 checkpoint, a controlled, approved newly generated MCP
result was not available. The production checkpoint below now verifies a new
job and two MaxVideoAI product surfaces, but it still does not satisfy the full
host-plus-audit publication bar; the owned result video therefore remains
absent from the public proof bundle.

That earlier decision now has one narrower production update. On 2026-08-28
CEST, the installed MaxVideoAI production connection in Codex prepared an exact
Luma Ray 2 Flash quote for one silent 5-second, 540p, 16:9 text-to-video result.
After the owner explicitly approved that exact USD 0.25 quote, the initial
confirmation response was lost at the transport boundary. Recovery found the
single authorized job already accepted and paid; no confirmation was repeated.
The same job then reached `completed`, and MaxVideoAI reported it saved to the
connected Library. The downloaded result independently decoded as H.264,
960×544, 24 fps, 5.208333 seconds, with container SHA-256
`83fa287300d6a66b57caf8d2347527a9905c8b28e7c9cd8fb78f51044c31fa34`.

Two publication-safe MaxVideoAI product captures verify the finished frame in
the production workspace and the matching newest Library asset. Their crops
exclude the account email, balance, internal identifiers, private URLs,
unrelated media, and a separate stale progress banner. The source prompt was
intentionally public-safe and contained no people, brands, logos, or private
reference media.

This does **not** publish an exact-host Codex proof bundle. The macOS Screen
Recording preflight was unavailable, so no readable, privacy-reviewed Codex UI
capture of installation, planning, quote, approval, and inline delivery could
be accepted. Claude required a browser login, and the inspected ChatGPT catalog
exposed only a personal staging plugin rather than a supported MaxVideoAI
Production install. Those hosts remain withheld. The generated result also has
no separately publishable audit record, so `getMcpProof(locale)`,
`mcpGenerationVerified`, and `resultProof` remain gated rather than silently
promoting product UI evidence into complete host-and-audit proof.

The previously selected result candidate was rejected after stream-level comparison showed that it contains the same encoded video and audio streams as a public provider example. A MaxVideoAI registry entry or CDN URL does not establish generation ownership and cannot replace job-backed and audit-backed provenance.

No result badge, engine, mode, price, or media instance is publishable as a
complete exact-host MCP result claim. The two current MaxVideoAI product
captures may show their verified model and finished frame, but they must not be
relabeled as Codex, Claude, or ChatGPT host proof. A current pricing scenario
must never be attached to the older unverified historical result.

## Required-flow audit

| Stage | Recorded evidence | Publication decision |
| --- | --- | --- |
| Host and version | Codex production connection exercised; a privacy-reviewed native host/version capture was unavailable | Exact-host publication proof withheld |
| MCP server version | Installed MaxVideoAI 0.2.0 production connection exercised against the deployment below | Service checkpoint recorded; no standalone host-version capture |
| Creative brief | Public-safe single-shot prompt recorded; no publishable host-authored brief capture | `mcp-brief.webp` absent |
| Host-authored prompt approved for publication | Public-safe abstract glass-ribbon prompt approved with the exact quote; no native host capture | Service record only; no prompt screenshot published |
| Generated reference and stable asset reference | Not available | `mcp-reference.webp` absent |
| Model recommendation | Live Codex production flow returned a current shortlist and three comparable one-shot budgets; Luma Ray 2 Flash was selected as the USD 0.25 route | Service record only; no recommendation screenshot published |
| Exact pre-confirmation quote | USD 0.25 for Luma Ray 2 Flash, 5 seconds, 540p, 16:9, silent | Exact value recorded; `mcp-quote.webp` absent because no safe Codex capture exists |
| Explicit confirmation | Owner approved that exact quote; one confirmation attempt was made and recovery prevented duplication | Verified in the service checkpoint; host UI capture withheld |
| Completed job with audit-backed provenance | Job completed and saved to Library; container independently decoded and hashed, but no separately publishable audit record exists | Product captures publishable; complete result proof remains `null` |
| Claude inline host rendering | Claude Desktop 1.37937.1, controlled staging deployment, native controls and first-party CTA; manual playback recorded separately | Publishable only as Claude host-UI evidence |
| Codex production execution | One owner-approved USD 0.25 Luma Ray 2 Flash job recovered after a lost confirmation response, completed once, and saved to Library | Verified service and MaxVideoAI product flow; exact-host Codex UI proof withheld because no safe native capture was available |
| MaxVideoAI workspace | Finished public-safe frame, Luma Ray 2 Flash selector, and native playback controls in Production | Publishable product proof: `plugins/maxvideoai/assets/screenshots/maxvideoai-workspace-production.jpg` |
| MaxVideoAI Library continuity | Matching newest video asset, 960×544, 752.6 KB, dated 2026-08-28 00:05:54 CEST | Publishable product proof: `plugins/maxvideoai/assets/screenshots/maxvideoai-library-continuity-production.jpg` |
| ChatGPT Production host | Catalog search returned only a personal `MaxVideoAI Staging` plugin | `not_verified`; no Production install or flow captured |
| Claude Production host | Agent-created Chrome tab reached Claude sign-in | `not_verified`; no credentials entered and no host flow captured |

## Rejected candidate verification

- Candidate registry URL: `https://media.maxvideoai.com/renders/marketing/f9711b1e-53d5-4a1d-9adf-8186784538e3.mp4`
- Candidate container SHA-256: `5db66cfa848a021afaabe3a0a47a2a44643980966ef5aa8a055fe438cf678771`
- Provider example URL: `https://storage.googleapis.com/falserverless/example_outputs/veo3-i2v-output.mp4`
- Provider example container SHA-256: `6430e711dca4f2e1d8b7c6e8cf333d444bebabf48ef4662e196554270bc29b19`
- Matching video stream SHA-256: `a70320cdd31f395c3081cb1557cf5ef2958332330234d2d8bb6e650305a56449`
- Matching audio stream SHA-256: `f2cc3c3cdaf1de1d028fe5aaf09c434a5c2b64d55413a343852e9ea04ce6e135`
- Rejection reason: provider example is not backed by a MaxVideoAI job and audit evidence chain

Future proof requires all of the following together: a publishable result, a job evidence reference, an audit evidence reference, the exact public source URL, and the exact source checksum. Media properties alone are insufficient.

<!-- mcp-demo-evidence:v1 -->
```json
{
  "version": 1,
  "publicationStatus": "gated",
  "proofLabel": null,
  "mcpGenerationVerified": false,
  "captureAssets": {
    "brief": "withheld-unverified",
    "reference": "withheld-unverified",
    "quote": "withheld-unverified"
  },
  "resultProof": {
    "status": "withheld-unverified",
    "jobEvidenceReference": null,
    "auditEvidenceReference": null,
    "sourceUrl": null,
    "sourceSha256": null
  },
  "hostUiProof": {
    "status": "verified-host-ui",
    "host": "claudeDesktop",
    "assetPath": "frontend/public/media/mcp/claude-inline-video-proof.jpg",
    "mimeType": "image/jpeg",
    "width": 1152,
    "height": 768,
    "sha256": "2f54400a0287e7930295718beabb7c51b93cc927eb4abdd2dd9108d268a0780e",
    "capturedAt": "2026-08-26T16:31:42+02:00",
    "hostVersion": "Claude Desktop 1.37937.1",
    "hostLocale": "fr-FR",
    "operatingSystem": "macOS 26.5.1 (25F80)",
    "environment": "controlled-staging",
    "serverOrigin": "https://maxvideoai-mcp-staging.vercel.app",
    "deploymentId": "dpl_3i6XgnZ6KVCZmQPhhKBrHDVrm1TD",
    "sourceRevision": "621881dae621e9aec1d68a2a86f5065c6325cdb8",
    "resourceUri": "ui://maxvideoai/generation-result-v1.html",
    "manualPlaybackExerciseRecorded": true,
    "firstPartyCtaVerified": true,
    "marketingPermission": true,
    "privacyReview": "passed-no-visible-account-identifier",
    "evidenceReference": "host-ui-claude-2026-08-26-v1"
  },
  "productionCheckpoint": {
    "status": "verified-product-flow",
    "evidenceReference": "production-generation-codex-2026-08-27-v1",
    "host": "codex",
    "hostPublicationProof": "not_verified",
    "hostPublicationBlocker": "macos-screen-recording-preflight-unavailable",
    "environment": "production",
    "deploymentId": "dpl_YZvhN3B6nxrBoPvAZjC1hwtr4YJF",
    "sourceRevision": "1ef5f74760995822a570cab4716b0cdbc96ea059",
    "captureReviewRevision": "cfe82b11079fb80383e6557e72cfbd6a6c8603b2",
    "pluginVersion": "0.2.0",
    "browser": "Chrome extension-controlled session",
    "accountLabel": "admin proof account",
    "request": {
      "model": "Luma Ray 2 Flash",
      "mode": "t2v",
      "durationSec": 5,
      "resolution": "540p",
      "aspectRatio": "16:9",
      "audio": false,
      "referenceCount": 0,
      "outputCount": 1
    },
    "quote": {
      "amountCents": 25,
      "currency": "USD",
      "confirmationRequired": true,
      "ownerApprovalRecorded": true,
      "confirmationAttempts": 1
    },
    "result": {
      "status": "completed",
      "paymentStatus": "paid_wallet",
      "savedToLibrary": true,
      "containerSha256": "83fa287300d6a66b57caf8d2347527a9905c8b28e7c9cd8fb78f51044c31fa34",
      "mimeType": "video/mp4",
      "videoCodec": "h264",
      "width": 960,
      "height": 544,
      "fps": 24,
      "durationSec": 5.208333
    },
    "captureAssets": [
      {
        "path": "plugins/maxvideoai/assets/screenshots/maxvideoai-workspace-production.jpg",
        "width": 1450,
        "height": 525,
        "sha256": "fceb27abb935eada8b040232d8f0006bf3a3f4c19acccd11fb4ae6e3eaf697d6",
        "capturedAt": "2026-08-27T22:09:53Z"
      },
      {
        "path": "plugins/maxvideoai/assets/screenshots/maxvideoai-library-continuity-production.jpg",
        "width": 1010,
        "height": 650,
        "sha256": "6680f4b889464662f0be34d1628a21b4c9b0d900ce950b806f38df1315efe8e1",
        "capturedAt": "2026-08-27T22:09:32Z"
      }
    ],
    "privacyReview": "passed-cropped-no-email-balance-internal-identifiers-private-urls-or-unrelated-media"
  },
  "rejectedCandidate": {
    "reasonCode": "provider-example-not-job-backed",
    "candidateSourceUrl": "https://media.maxvideoai.com/renders/marketing/f9711b1e-53d5-4a1d-9adf-8186784538e3.mp4",
    "candidateSha256": "5db66cfa848a021afaabe3a0a47a2a44643980966ef5aa8a055fe438cf678771",
    "providerExampleUrl": "https://storage.googleapis.com/falserverless/example_outputs/veo3-i2v-output.mp4",
    "providerExampleSha256": "6430e711dca4f2e1d8b7c6e8cf333d444bebabf48ef4662e196554270bc29b19",
    "videoStreamSha256": "a70320cdd31f395c3081cb1557cf5ef2958332330234d2d8bb6e650305a56449",
    "audioStreamSha256": "f2cc3c3cdaf1de1d028fe5aaf09c434a5c2b64d55413a343852e9ea04ce6e135"
  }
}
```
