# MaxVideoAI MCP host compatibility matrix

Last hosted checkpoint: 2026-08-26

This matrix separates verified staging behavior from production and directory
claims. The controlled environment is public on the internet but isolated from
production, noindexed, and restricted to its disposable staging account.

## Reviewed staging revision

- Stable origin: `https://maxvideoai-mcp-staging.vercel.app`
- Deployment: `dpl_45cqkwyW3U3LAL4pF1D6YUJLoVkH`
- Git revision: `33d9e3a498c1fe8947bbb6a4c957d19ca805be25`
- Transport: MCP Streamable HTTP with stateless JSON responses
- Authentication: OAuth 2.1 authorization code with PKCE through the isolated
  MaxVideoAI Staging Supabase Auth project
- Operational profile: 13 authenticated tools
- Provider boundary: Seedance 2.5 uses ModelArk for `t2v`, `i2v`, `ref2v`, and
  `extend`; LAS and direct `v2v` remain disabled

The 13-tool profile contains `get_account_status`, `list_models`,
`get_model_details`, `recommend_models`, `calculate_project_budget`,
`list_media`, `create_reference_upload_link`, `prepare_generation`,
`confirm_generation`, `get_generation_status`, `list_recent_generations`,
`present_generation`, and `create_topup_link`. It covers live model discovery, factual model details,
model recommendations, named project estimates, exact generation preparation,
confirmation, generation status and recovery, private media, private
reference-upload handoff, and a signed MaxVideoAI top-up handoff. Spending still
requires a separate explicit confirmation of a fresh quote.

The `present_generation` descriptor and its versioned MCP Apps resource are covered by local contracts. Inline rendering and playback are not yet part of the hosted Claude Desktop or ChatGPT evidence below; until those checks are recorded, resource links and the MaxVideoAI library remain the verified fallback.

## Compatibility matrix

| Host or surface | Hosted evidence | Status |
| --- | --- | --- |
| MCP TypeScript SDK 1.29.0 | Automated contracts cover initialization, tool discovery, schemas, annotations, authorization boundaries, and sanitized errors. | Contract pass. |
| Claude Desktop 1.37937.1 on macOS | Loaded the custom staging connector through OAuth; read account/catalog/model data; compared 60-second budgets; prepared an exact Seedance 2.5 quote without spending; listed private media; recovered a completed generation; created a private reference-upload handoff without uploading bytes; and created a signed top-up handoff with an exact ISO expiry. | Controlled staging pass. Refresh, revocation, reconnect, fresh uploaded bytes, and a new paid generation remain to be recorded. |
| Codex CLI 0.149.0-alpha.4.3 on macOS | Loaded the installed MaxVideoAI plugin with an ephemeral staging URL override; completed OAuth-backed account, catalog, model-detail, budgeting, exact-quote, and top-up-handoff calls. The final wallet remained unchanged. | Controlled staging pass. The normal plugin endpoint remains production and intentionally unavailable. A non-blocking MCP-client shutdown warning followed completed turns. |
| Codex desktop / ChatGPT app surface | The bundled Codex CLI path and plugin package were exercised, but no fresh graphical Codex task or ChatGPT app-directory installation was recorded. | Partial; do not claim ChatGPT app-directory availability. |
| ChatGPT Apps directory | No submission, review, install, or tool-rendering evidence. | Not run. |
| Claude Code | Shared Claude adapter and skill contracts exist, but this exact host was not exercised. | Not run. |
| Other MCP hosts | The wire contract is host-neutral, but each host still needs its own installation, OAuth, rendering, confirmation, and recovery evidence. | Unverified. |

## Verified customer-continuity behavior

- `get_account_status` returned the staging wallet balance without exposing the
  account email.
- Billing, connection, workspace, image-workspace, library, and support
  destinations stayed on the first-party staging origin.
- `list_recent_generations` recovered an existing completed video in the same
  MaxVideoAI account library.
- `list_media` exposed the account's private video inventory without
  exposing provider credentials or raw storage internals.
- The upload tool produced a private, temporary handoff; no file bytes were
  uploaded during this checkpoint.
- An insufficient-balance plan produced a signed MaxVideoAI billing handoff for
  exactly the missing amount. It did not collect payment in the host, reveal a
  payment secret, or change the wallet.
- Top-up handoffs now include both a Unix expiry and `expiresAtIso`, preventing
  host-side timezone or unit ambiguity.

## What this evidence supports

It is accurate to say that MaxVideoAI's controlled staging MCP worked with the
tested Claude Desktop and Codex CLI versions for conversational model choice,
live pricing, project budgeting, exact quote preparation, account/library
continuity, reference-upload preparation, and billing handoff. The host can
remain creative while the server supplies current capabilities, constraints,
prices, safe destinations, and confirmation boundaries.

This evidence does **not** establish that MaxVideoAI is listed or approved in a
ChatGPT, Codex, or Claude directory; that production is enabled; that every host
version is compatible; that OAuth refresh/revocation is proven; or that LAS
video-to-video works. It also does not replace the final controlled tests for a
fresh private upload, a newly paid render, provider failure/refund, and
disconnect/reconnect.

## Remaining release evidence

1. Record OAuth denial, refresh, revocation, authentication loss, and reconnect
   on the exact public-launch host versions.
2. Upload one tiny disposable private reference, use it in an allowed
   generation path, verify library ownership, then run and record cleanup.
3. With a separately approved minimal spend, confirm one fresh exact quote and
   reconcile quote, charge, job, output, library entry, and wallet cents.
4. Record known provider rejection/refund and ambiguous-timeout behavior without
   leaking prompt, media, payment, or credential data.
5. Test the final public install instructions on the precise ChatGPT/Codex and
   Claude surfaces that will be named in marketing.
6. Complete support, legal, observability, SEO/GEO, directory, and rollback
   review before changing any checked-in publication flag.

All eight flags in `frontend/config/mcp-publication.json` remain `false`.
Production, indexing, directory submission, paid public access, trial, and
public reference uploads therefore remain closed.
