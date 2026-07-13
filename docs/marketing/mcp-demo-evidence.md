# MCP demonstration evidence

Test date: 2026-07-14

Publication status: gated

Permitted public proof: none

## Evidence decision

A controlled, approved MCP generation session was not available for this task. No brief, reference, quote, or result capture satisfies the publication bar, so all proof media remains absent and `getMcpProof(locale)` returns `null`.

The previously selected result candidate was rejected after stream-level comparison showed that it contains the same encoded video and audio streams as a public provider example. A MaxVideoAI registry entry or CDN URL does not establish generation ownership and cannot replace job-backed and audit-backed provenance.

No result badge, engine, mode, price, or media instance is publishable. In particular, a current pricing scenario must not be attached to an unverified historical result.

## Required-flow audit

| Stage | Recorded evidence | Publication decision |
| --- | --- | --- |
| Host and version | Not run or recorded | Withheld |
| MCP server version | Not exercised in a controlled generation | Withheld |
| Creative brief | Not available | `mcp-brief.webp` absent |
| Host-authored prompt approved for publication | Not available | Withheld |
| Generated reference and stable asset reference | Not available | `mcp-reference.webp` absent |
| Model recommendation | Not available from a controlled flow | Withheld |
| Exact pre-confirmation quote | Not recorded | `mcp-quote.webp` absent |
| Explicit confirmation | Not available | Withheld |
| Completed job with audit-backed provenance | Not available | Result media absent; proof is `null` |

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
