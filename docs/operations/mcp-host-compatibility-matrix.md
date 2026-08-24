# MaxVideoAI MCP host compatibility matrix

Last local checkpoint: 2026-08-24

This matrix separates local contract evidence from host evidence. It records the
current branch only. It is not a statement that a remote endpoint, OAuth flow,
or host integration is available.

## Local foundation

- Resource design: `https://api.maxvideoai.com/mcp` (not publicly reachable from this branch)
- Transport design: MCP Streamable HTTP with stateless JSON responses
- Authentication design: OAuth 2.1 authorization code with PKCE through Supabase Auth
- Local SDK contract: `@modelcontextprotocol/sdk` `1.29.0`
- Local authenticated discovery tools: `get_account_status`, `list_models`,
  `get_model_details`, `recommend_models`, `calculate_project_budget`
- Mutations: none in this discovery profile. Generation, media upload, exact
  quotes, wallet debit, trial credit, and recovery calls are not published.

`calculate_project_budget` is a read-only project estimate for one to four
named video proposals. It uses the canonical pricing boundary and separates
base production passes from declared creative attempts. It is not an exact
quote, a reservation, a wallet debit, or a provider submission. A real
generation remains subject to `prepare_generation` followed by explicit
`confirm_generation` when those gated tools are later released.

The thin Codex and Claude plugin adapters are a local, unpublished package.
They share the same skill and proposed MCP endpoint. No directory submission,
public install path, host tool rendering, or host-selected-tool behavior is
claimed here.

## Compatibility matrix

| Host or surface | Local evidence | Hosted OAuth evidence | Status |
| --- | --- | --- | --- |
| MCP TypeScript SDK 1.29.0 | In-memory contract tests cover initialization, `tools/list`, all five discovery tools, annotations, closed schemas, and sanitized errors. | Not applicable. | Local contract only. |
| Codex CLI | The plugin manifest and shared skill have structural tests only. | OAuth, refresh, installation, tool rendering, and tool selection are unverified. | Unverified. |
| Codex app or library | The package has no embedded interface and no library submission. | OAuth, installation, rendering, refresh, and library availability are unverified. | Unverified. |
| Claude Code | The Claude adapter and shared skill have structural tests only. | OAuth, installation, tool rendering, refresh, and tool selection are unverified. | Unverified. |
| Claude Desktop | The Claude adapter and shared skill have structural tests only. | OAuth, custom connector loading, tool rendering, refresh, and revocation are unverified. | Unverified. |
| Other MCP hosts | The wire contract is intentionally host-neutral. | Each host needs its own recorded installation, OAuth, rendering, and recovery evidence. | Unverified. |

## Local release checkpoint

| Verification | State | Boundary |
| --- | --- | --- |
| Five-tool discovery contract | Pass | Local automated tests only; it does not make the endpoint public. |
| Conversational recommendations and named project estimates | Pass | Local automated tests only; host creativity remains outside the server contract. |
| Canonical pricing and H3 reference pricing | Pass | Local pricing tests only; a project estimate never creates an exact quote. |
| Codex/Claude thin package | Pass | Local structural tests only; neither host has loaded it. |
| Hosted OAuth and refresh | Not run | Requires a separate controlled deployment and exact host/version evidence. |
| Host rendering and tool selection | Not run | Requires real Codex and Claude sessions with the five-tool profile. |
| Provider generation, media transfer, recovery, wallet actions | Not run | Remain gated and are outside this read-only local profile. |
| Public flags, deployment, marketplace submission, marketing/SEO/GEO rollout | Blocked | All eight checked-in publication flags remain `false`. |

## Evidence required before any public claim

1. Deploy the exact reviewed branch behind separately approved publication flags.
2. Record the precise host and version, install method, consent denial and
   approval, OAuth refresh, revocation, reconnect, and removal.
3. Capture the five tool names, annotations, structured results, tool selection,
   and error rendering without copying private data into documentation.
4. Verify `calculate_project_budget` is presented as an estimate and that
   `prepare_generation` plus explicit `confirm_generation` remain necessary for
   a fresh exact quote and any spend.
5. Verify references, recovery, provider results, monitoring, and support only
   when their gated capabilities are approved for release.
6. Recheck every publication flag, legal statement, host policy, and directory
   requirement before an authorized owner submits anything.

Until those steps are complete, do not claim MaxVideoAI works with Claude or
Codex, is live, is listed, is approved, or is publicly installable.
