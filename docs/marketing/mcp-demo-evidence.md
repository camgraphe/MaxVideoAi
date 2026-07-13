# MCP demonstration evidence

Test date: 2026-07-14

Publication status: gated for an end-to-end MCP case study; result-only fallback approved

Permitted public badge: `Real MaxVideoAI output`

## Evidence decision

A controlled, approved MCP generation session was not available for this task. The repository therefore does not publish a brief capture, reference capture, or quote capture. The only displayable proof is an existing MaxVideoAI-owned marketing render whose public registry entry and bytes were independently checked.

The result is not evidence of an MCP-originated generation. Any stronger MCP-origin claim remains gated until a complete consented run can be linked to the resulting job and independently audited.

## Required-flow audit

| Stage | Recorded evidence | Publication decision |
| --- | --- | --- |
| Host and version | Not run or recorded | Withheld |
| MCP server version | Not exercised in a controlled generation | Withheld |
| Creative brief | Not available | `mcp-brief.webp` absent |
| Host-authored prompt approved for publication | Not available | Withheld |
| Generated reference and stable asset ID | Not available | `mcp-reference.webp` absent |
| Model recommendation | Not available from a controlled flow | Withheld |
| Exact pre-confirmation quote | Historical amount and currency not recorded | `mcp-quote.webp` absent |
| Explicit confirmation | Not available | Withheld |
| Completed MCP-linked job | No verifiable link to the fallback render | Withheld |

## Verified fallback result

- MaxVideoAI public engine ID: `veo-3-1`
- Provider/model label: Google Veo 3.1
- Product registry: `frontend/server/engine-demos.ts`
- Public media source: `https://media.maxvideoai.com/renders/marketing/f9711b1e-53d5-4a1d-9adf-8186784538e3.mp4`
- Source input mode: not recorded
- Prompt and reference provenance: not recorded
- Original job ID and internal audit ID: not recovered
- Verified media settings: 8 seconds, 16:9, 1280×720; the published derivative is muted
- Historical price and currency: not recorded
- Visible price: computed at request time from `computeCanonicalPublicSnapshot` for the documented current 8-second, 720p member scenario; it is not presented as the historical charge
- Sanitization: local media contains no source audio, user-specific identifiers, or descriptive source metadata

The evidence document contains no controlled-flow screenshots because none met the verification bar. Future replacements must update this record, asset checksums, the verification date, and public copy together.

<!-- mcp-demo-evidence:v1 -->
```json
{
  "version": 1,
  "publicationStatus": "gated",
  "proofLabel": "Real MaxVideoAI output",
  "mcpGenerationVerified": false,
  "captureAssets": {
    "brief": "withheld-unverified",
    "reference": "withheld-unverified",
    "quote": "withheld-unverified"
  },
  "result": {
    "engineId": "veo-3-1",
    "durationSeconds": 8,
    "aspectRatio": "16:9",
    "resolution": "720p",
    "sourceMode": null,
    "historicalAmountCents": null,
    "historicalCurrency": null,
    "originalJobId": null,
    "internalAuditId": null
  }
}
```
