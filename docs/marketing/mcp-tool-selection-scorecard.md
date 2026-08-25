# MaxVideoAI MCP tool-selection scorecard

Status: deterministic offline policy evaluation, last checked 2026-08-25. This is a release gate, not evidence that a
client integration or paid generation is publicly available.

## Evidence boundary

The public corpus contains 35 natural-language prospect requests across 15 intent categories: 21 use the
`live-read-only` profile and 14 use the hypothetical `future-generation-evaluation` profile. Fixture labels are
expectations only. The fixture contract reports `null` metrics and never copies `expectedTools` or expected capability
claims into an observed decision.

A separate checked-in artifact contains **offline recorded policy decisions**. Each decision is keyed by fixture ID and
stores its prompt hash, ordered tool calls with arguments, a concise assistant response, and symbolic capability
claims. Prompt hashes make missing or stale decisions fail. These recordings exercise guidance deterministically; they
are not real Codex or Claude host evidence and must never be presented as such.
They are not recorded host evidence.

Real-host metrics for Codex and Claude are unavailable until Task 10. Both remain explicit `null` values regardless of
the offline policy score. There are no sanitized real-host decisions today.

The live metadata inspection observes only `get_account_status`, `list_models`, `get_model_details`,
`recommend_models`, and `calculate_project_budget`. They are read-only, non-destructive, and closed-world. The server
advertises no MCP resources. The future profile is not live, and all eight publication flags remain false.

## Scoring semantics

- `expectedTools` is an ordered required sequence. Required matches use the longest common subsequence, so reversing
  required calls cannot earn full precision or recall.
- Repeated typed media lookups are one tool choice for selection precision, while every recorded call and argument is
  retained for semantic checks.
- `allowedAlternatives` can contribute a correct selection but cannot increase recall.
- Forbidden confirmation rate counts any `confirm_generation` in a no-confirm fixture. Its required rate is 0.
- Quote-before-confirm requires one earlier unconsumed `prepare_generation` for every confirmation. When there is no
  confirmation scenario, the zero denominator is serialized as `null`.
- Unsupported capability claims are fixture-prohibited or otherwise unexpected allowlisted claims divided by emitted
  claims. Unknown claims fail schema validation. The required unsupported capability claims rate is 0.
- Capability-claim recall compares independently recorded claims with the fixture's expected factual boundaries.
- Operational policy checks inspect arguments and assistant language: media kinds, workflow mode, reference roles and
  order, the confirmed `quoteId`, explicit-approval wording, quote-only waiting, and recovery without resubmission.

Metrics remain separate per host and per registry profile. The evaluator will never mix `live-read-only` with
`future-generation-evaluation`; any aggregate is within one registry profile.

The proposed quality targets remain selection precision at least 0.90 and selection recall at least 0.85. Manual
approval of those targets is pending, and offline policy results cannot satisfy a real-host release gate.

## Offline recorded policy decisions

The artifact uses a strict versioned envelope:

```json
{
  "version": 2,
  "evidenceKind": "offline-recorded-policy-decisions",
  "policyVersion": "maxvideoai-skill-2026-08-25",
  "decisions": [
    {
      "fixtureId": "operational-seedance-start-end-images",
      "fixturePromptSha256": "<64 lowercase hex characters>",
      "source": "offline-policy",
      "registryProfile": "future-generation-evaluation",
      "toolCalls": [
        { "name": "list_media", "arguments": { "kind": "image" } }
      ],
      "assistantText": "The exact quote is ready; I have not started it and will wait for explicit approval.",
      "capabilityClaims": ["future_exact_quote_gated"]
    }
  ]
}
```

The parser rejects unknown fields, private-field names, unknown tools or claims, profile mismatches, duplicate fixture
decisions, stale prompt hashes, and oversized arguments. The default run requires exactly one offline policy decision
for every public fixture; missing decisions fail rather than silently reducing the denominator.

## Running the evaluator

```bash
npm --prefix frontend run qa:mcp-tool-selection
```

The runner is offline and deterministic. It calls no Codex, Claude, OpenAI, Anthropic, provider, database, analytics,
or production service. It opens the checked-in MCP server through an in-memory transport only to inspect runtime tool
metadata. A successful output labels the evidence `offline recorded policy decisions`, keeps the expectation-only
fixture metrics `null`, reports complete offline recordings, and reports real-host metrics unavailable until Task 10.

Before any compatibility or publication claim, Task 10 must record and sanitize real Codex and Claude runs, evaluate
each registry profile independently, obtain manual approval for the quality thresholds, and keep forbidden
confirmation and unsupported capability claims at zero.
