# MaxVideoAI MCP tool-selection scorecard

Status: deterministic offline policy evaluation, last checked 2026-08-25. This is a release gate for checked-in
guidance, not evidence that any client integration or paid generation is publicly available.

## Evidence boundary

The corpus contains 35 natural-language prospect requests across 15 intent categories: 21 use `live-read-only` and 14
use the hypothetical `future-generation-evaluation` profile. Fixture labels are expectations only. The fixture contract
reports `null` metrics and does not turn fixture answers into host evidence.

The separate artifact contains **curated offline policy decisions/expectations**. Its provenance is exactly
`{ kind: "curated_offline_policy", authoring: "manual_reviewed", noRealHost: true }`. A person maintains the expected
tool calls, arguments, assistant language, capability boundaries, and quote transcripts. The artifact makes no claim
that a model, host, or producer executed those decisions.

Real-host metrics for Codex and Claude are unavailable until Task 10 and remain explicit `null` values. Curated scores
must never be presented as Codex, Claude, compatibility, quality, or public-availability evidence.

The live metadata inspection sees five read-only, non-destructive, closed-world discovery tools and no MCP resources.
The future profile is not live, and all eight publication flags remain false.

## Freshness and scoring

Every fixture stores its prompt SHA-256. The artifact also stores a deterministic policy fingerprint over the current
server instructions, packaged Skill, budget and generation-safety references, and all 12 registered tool names,
descriptions, annotations, and input schemas. A missing or mismatched prompt hash or policy fingerprint fails the run.

- Required tool order uses the longest common subsequence. Reversing required calls cannot earn full precision or
  recall. Alternatives may contribute to precision but not recall.
- Arguments are checked for workflow mode, typed media kind, reference roles and ordering, and required IDs.
- A quote transcript begins with the prepared result and then the assistant display. It must show the exact amount and
  currency before approval, and confirmation must use the same quote ID.
- Quote-only scenarios display the exact quote and contain no confirmation. Budget-only and ambiguous-approval
  scenarios also forbid confirmation. Recovery uses status tools without a duplicate paid submission.
- Unknown capability claims fail schema validation. Unsupported capability claims and forbidden confirmation both have
  a required rate of 0. Selection precision, selection recall, capability recall, policy adherence, quote-before-confirm,
  and exact quote-display match all require 1.0 whenever their denominator is nonzero.
- A zero denominator is serialized as `null`; it is not treated as a passing host metric.

The evaluator never mixes `live-read-only` and `future-generation-evaluation`. Any missing decision, stale policy,
required tool/order/argument failure, forbidden confirmation, unsupported claim, policy-language failure, or quote
identity/display mismatch throws and makes the command exit nonzero.

## Curated artifact envelope

```json
{
  "version": 3,
  "evidenceKind": "curated-offline-policy-expectations",
  "policyFingerprintSha256": "<64 lowercase hex characters>",
  "provenance": {
    "kind": "curated_offline_policy",
    "authoring": "manual_reviewed",
    "noRealHost": true
  },
  "decisions": [
    {
      "fixtureId": "operational-exact-quote-only",
      "fixturePromptSha256": "<64 lowercase hex characters>",
      "source": "curated-offline-policy",
      "registryProfile": "future-generation-evaluation",
      "toolCalls": [{ "name": "prepare_generation", "arguments": { "surface": "video" } }],
      "assistantText": "The exact quote is USD 12.34; I will wait for explicit approval.",
      "quoteTranscript": [
        {
          "type": "prepare_result",
          "quoteId": "44444444-4444-4444-8444-444444444444",
          "amountMinor": 1234,
          "currency": "USD"
        },
        { "type": "assistant", "text": "The exact quote is USD 12.34; I will wait for explicit approval." }
      ],
      "capabilityClaims": ["future_exact_quote_gated"]
    }
  ]
}
```

The strict parser rejects unknown fields, private-field names, unknown tools or claims, profile mismatches, duplicates,
stale hashes, malformed quote evidence, and oversized arguments.

## Running the evaluator

```bash
npm --prefix frontend run qa:mcp-tool-selection
```

The command is offline and deterministic. It calls no Codex, Claude, OpenAI, Anthropic, provider, database, analytics,
or production service. It opens the checked-in MCP server through an in-memory transport only to inspect authoritative
instructions and tool metadata. Successful output is labeled `curated offline policy decisions/expectations`; real-host
metrics stay unavailable until Task 10.
