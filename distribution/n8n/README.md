# MaxVideoAI n8n workflow candidates

These disabled JSON exports are reviewed workflow candidates. The
[brief-to-approved-generation workflow](https://n8n.io/workflows/19591-turn-creative-briefs-into-approved-maxvideoai-generations-with-human-review/)
was publicly listed as n8n template `19591` on 2026-09-25. On 2026-10-05,
the October 4 recovery revision was submitted to that same template and the
Creator Portal now shows **Under review**. The public API still serves the earlier
20-node payload and its direct page remains readable; the 21-node update is not publicly approved.
The other two candidates remain unsubmitted while the review disables the
portal's next-template action. See the
[submission checkpoint](../../docs/marketing/mcp-directory-submissions.md#n8n-update-submission--2026-10-05).
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

## October 4 recovery revision and engine qualification

The brief workflow now honors `retry.afterSeconds` instead of always waiting
15 seconds. It forwards the returned status arguments for the accepted job and
stops after 20 status calls, or when retry instructions are null, missing,
invalid, use a different tool, or reference a different job. Recovery cannot
return to `confirm_generation`. This revision applies only to the brief
workflow; the campaign queue has a separate per-item recovery contract.

n8n 2.38.7 rejects the property name `arguments` in its expression sandbox,
even when it is ordinary response JSON. The native **Rename Keys** node therefore
converts `structuredContent.retry.arguments` to
`structuredContent.retry.parameters` before the recovery expressions run.
No Code node or sandbox setting change is needed. The real engine caught this
failure in an earlier draft; evaluating expressions with Node.js alone had not.

The corrected workflow passed 19 deterministic cases using the actual n8n
2.38.7 engine, n8n-core 2.38.2, n8n-workflow 2.38.1 and Node.js 24.19.0.
The harness executes the native If, Wait, Set, Rename Keys and NoOp nodes,
retains item lineage and run indices, pauses at human approval, and resumes
the same execution with a fixture approval payload. Only the input trigger
and MCP calls are replaced with deterministic fixtures. Cases cover approval
rejection and mismatched quotes, null and malformed retries, terminal states,
same-job recovery, exactly 20 status calls with one confirmation, and real
wall-clock waits of 5, 15, 30 and 45 seconds. A disabled CLI import/export
preserved all authored fields with zero credential references; its synthetic
local workflow ID was excluded from the source export.

This checks engine behavior, not current live OAuth, paid generation, n8n
Cloud, or AI Agent invocation. The earlier live checkpoint above keeps its
original date and scope. The existing Creator Portal session was resumed and
the update submitted on October 5. n8n approval and a matching public readback
of the updated workflow `19591` remain publication gates.

To reproduce from the repository root, use Node.js 24 on `PATH`. Install the
pinned runtime outside the repository, then run the committed harness:

```bash
n8n_qa_runtime="$(mktemp -d)"
npm install --prefix "$n8n_qa_runtime" --no-audit --no-fund n8n@2.38.7
node scripts/qa/check-n8n-recovery.cjs "$n8n_qa_runtime" \
  distribution/n8n/brief-to-approved-generation.json \
  "$n8n_qa_runtime/recovery-report.json"
```

The harness requires exactly n8n 2.38.7 and Node.js 24, creates and removes its
own temporary n8n state, and never executes the live MCP Client implementation.
It reports the input SHA-256 and runtime versions. The optional report path
must not already exist. Keep the report as release evidence and remove the
disposable runtime when finished; no repository dependency is added. CLI
import/export checks must likewise use a separate `N8N_USER_FOLDER`; the CLI
requires a local workflow `id`, which must be added to a temporary copy only.

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

Before publishing another candidate, repeat the relevant checks on the target deployment,
configure a Chat Model for the bounded AI Agent path if that path will be
claimed, and review the sanitized export. The product owner has authorized the
exact three-file external action recorded in
`docs/marketing/mcp-directory-submissions.md`; each template-library write
still requires that authorized owner to complete the Creator Portal identity
step, submit one reviewed workflow at a time, and record the observed result.

The first candidate, `brief-to-approved-generation.json`, updates existing
[workflow 19591](https://n8n.io/workflows/19591-turn-creative-briefs-into-approved-maxvideoai-generations-with-human-review/)
and is pending n8n review. Its setup still requires a manually attached
MaxVideoAI OAuth2 credential.
The other two reviewed candidates have no verified public listing. None of the
three JSON workflows calls `list_media` or
`create_reference_upload_link`; private-reference automation remains
unverified and outside their claimed scope.
