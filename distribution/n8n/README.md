# MaxVideoAI n8n workflow candidates

These disabled JSON exports are reviewed workflow candidates. One candidate is
privately submitted for human review; none is a public n8n library template.
They use the **MCP Client** node for deterministic workflow steps with explicit
tool inputs and ordering. Use the **MCP Client Tool** only when a bounded AI
Agent needs selected discovery or planning tools. Paid confirmation remains a
separate deterministic node after a human approval event.

## Template-guideline recheck

On 2026-09-14, the current submission guideline linked from the authenticated
n8n Creator Portal was rechecked before upload. It requires a submitted
workflow to include at least one explanatory Sticky Note. Each candidate now
contains exactly one yellow-default, non-connected Sticky Note with its intended
user and outcome, graph walkthrough, self-hosted MCP OAuth setup, applicable
approval and recovery boundary, and the unclaimed n8n Cloud and MCP Client Tool
scope. The notes are documentation-only: no executable node, connection,
setting, credential boundary, activation state, or workflow behavior changed.

## Recorded self-hosted checkpoint

On 2026-09-14, the three candidates were imported into self-hosted n8n 2.38.7
on macOS 26.6.2 arm64. The official image was pinned as
`n8nio/n8n@sha256:a8c95f75c6fdf65f5f2b7a7b354744eaa1c62bb911b5c00af6499c3f38e4cd32`
and exposed only on `127.0.0.1:5680`. Each clean import contained zero
credential references. A dynamically registered, project-scoped MCP OAuth2
credential was attached only after import.

The deterministic MCP Client path discovered current tools and models,
calculated a current project budget, prepared an exact quote, and paused before
confirmation. After explicit approval of a 12-cent USD Seedance 1.5 Pro quote,
the workflow called `confirm_generation` exactly once. The accepted job
completed and was recovered independently through `get_generation_status`,
`list_recent_generations`, and `present_generation`. The completion workflow
routed that job only to `Notify Completion`. A separate rejection-path run
reached `Approval Rejected` and executed no confirmation.

Fresh bound exports preserved import/export parity for workflow name, active
state, graph, node IDs, parameters, connections, settings, and tags after
removing the expected local credential reference and generated webhook IDs.
No access token, refresh token, client secret, or bearer value appeared in the
exports. The MaxVideoAI grant was then revoked, the same credential failed with
`Authentication required`, and the local credential, disposable container, and
volume were removed.

The MCP Client Tool 1.4 also imported with exactly five selected read-only or
planning tools: `get_account_status`, `list_models`, `get_model_details`,
`recommend_models`, and `calculate_project_budget`. `prepare_generation` and
`confirm_generation` were excluded. A Chat Model credential was not configured
in the disposable instance, so agent-mediated tool invocation remains
unverified. n8n Cloud, token refresh, and a post-revocation reconnect also
remain unverified. The tested self-hosted deterministic MCP Client scope is
live and indexable on MaxVideoAI; those separate MCP Client Tool and n8n Cloud
limitations remain outside the public claim.

## Credential boundary

Create an n8n MCP OAuth2 credential for `https://api.maxvideoai.com/mcp` after
import. The JSON files intentionally contain no credential reference or token.
n8n Cloud and self-hosted deployments need separate credential, callback,
refresh, revocation, access-loss, and reconnect evidence.

## Input contract and candidate files

`brief-to-approved-generation.json` expects one input item containing the
strict-schema objects `recommendationRequest`, `projectBudgetRequest`, and
`generationRequest`. It performs discovery, budgeting, exact preparation,
approval validation, one confirmation, and bounded status recovery.

`campaign-queue.json` expects up to 20 items containing `briefId`,
`projectBudgetRequest`, and `generationRequest`. It uses the actual n8n Limit
node, the Loop Over Items `loop` output, and one exact approval per item.

`completion-notification.json` accepts a POST body containing
`acceptedJobId`. It reads the job without preparing or confirming anything and
routes completed, failed-and-refunded, and failed-needing-new-approval states.

The approval webhook must receive `{ "approved": true, "quoteId": "..." }`
for the exact quote produced by the preparation node. MaxVideoAI accepts no
client `idempotencyKey` in this tool contract: confirmation replay safety is
server-side and idempotent for the same `quoteId`. Polling and lost-response
recovery always use the accepted `jobId`; they never route back to confirmation.
A creative retry starts a fresh quote and approval cycle.

Before catalogue release, repeat the relevant checks on the target deployment,
configure a Chat Model for the bounded AI Agent path if that path will be
claimed, and review the sanitized export. The product owner has authorized the
exact three-file external action recorded in
`docs/marketing/mcp-directory-submissions.md`; each template-library write
still requires that authorized owner to complete the Creator Portal identity
step, submit one reviewed workflow at a time, and record the observed result.

The first exact candidate, `brief-to-approved-generation.json`, passed Creator
Portal AI review and is privately `Pending` / `Under review` as workflow
`19591`. The other two candidates have not been submitted because the portal
disables `Share new template` while that review is pending. No public workflow
library URL exists. None of the three JSON workflows calls `list_media` or
`create_reference_upload_link`; private-reference automation remains
unverified and outside their claimed scope.
