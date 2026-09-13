# MaxVideoAI n8n workflow candidates

These disabled JSON exports are review candidates, not launched templates. A
clean import on an exact n8n version is not yet recorded.

Use the **MCP Client** node for deterministic workflow steps with explicit tool
inputs and ordering. Use the **MCP Client Tool** only when a bounded AI Agent
needs selected discovery or planning tools. Paid confirmation remains a
separate deterministic node after a human approval event.

## Credential boundary

Create an n8n OAuth2 credential for `https://api.maxvideoai.com/mcp` after
import. The JSON files intentionally contain no credential reference or token.
Record whether the credential is user, project, or instance scoped for the
supported deployment. Validate n8n Cloud and self-hosted separately, including
callback handling, refresh, revocation, observed access loss, and reconnect.

## Candidate files

- `brief-to-approved-generation.json` develops one brief through discovery,
  budgeting, exact preparation, human approval, one confirmation, and recovery.
- `campaign-queue.json` processes a bounded queue sequentially with one stable
  idempotency key and one approval per item.
- `completion-notification.json` starts only from an accepted job and emits an
  outcome for completion, failure/refund, or required user action.

The wait/status path must recover the accepted job rather than create or
confirm another request. A creative retry always starts a fresh quote and
approval cycle.

Before any catalogue release, perform a clean import, bind a disposable OAuth
credential, inspect every expression and connection, run success and negative
cases, remove the credential, and export again to confirm no secret is present.
A template-library write requires a fresh policy review and explicit owner authorization
for the exact files.
