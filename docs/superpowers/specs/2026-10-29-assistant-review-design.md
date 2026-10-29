# Shared assistant review

## Intent and authorized scope
Extend the existing draft PR so the operator can learn from composer Milo, Studio
and server-observed MCP work, with the context necessary to explain successes and
failures. The user explicitly requests improving Studio too. Implementation stays
in this worktree; production migration/activation and external review are separate.

## Approach
Reuse native retained records behind one admin review entry point. Do not send
customer conversations to a third-party analytics service or duplicate every raw
payload in a second warehouse. Keep the existing Studio review as a compatible
detail route. A common review vocabulary lets cases inform shared model guidance
and regression tests; it does not automatically rewrite instructions or train models.

## Evidence
- Composer sessions: chronological messages, replies/proposals, selected media
  model/operation/settings, references and actual perception, model guide, actual
  assistance runtime, usage, funding/error states. Inspect the exact saved context,
  never rebuild historical facts from today's catalog.
- New provider calls: bounded redacted input manifest with instruction/tool/schema
  fingerprints, reasoning setting, output limit, textual context and media counts.
  Binary media, private links, credentials and hidden reasoning are excluded.
  Truncation and missing historical snapshots are explicit.
- Studio: native turns, actions and usage plus the new per-call manifest. Deleted
  projects remain unavailable. Existing reader compatibility is retained.
- MCP: retained OAuth generation preparations and their actual job status, canonical
  prompt/settings/reference identities/catalog revision. These are preparations,
  not a fabricated external transcript. No host LLM, host costs or unseen messages
  are inferred. Existing MCP operational metrics remain linked.

## Review experience
One source selector, account/conversation filters and bounded chronological paging.
Content requires a separately audited same-origin POST. Evidence stays escaped text.
Reviewers can record useful / needs work / unreviewed, common issue tags, and a short
note. Annotation history is append-only, tied to the exact source/account/scope/id;
it is not a customer rating, automated judge, revenue or generation-success metric.

## Constraints and rollout
English UI, existing admin authorization, no external export, no implicit paid call,
no request-time migrations. Native retention/deletion governs evidence visibility;
no extra content copies are made outside the native request rows. Review annotations
and access metadata have explicit operator retention obligations. New Studio input
capture is gated by ASSISTANT_REVIEW_CONTEXT_ENABLED=true after migration 90.
Composer manifests use its existing context_json and require no new content table.
Migration 90 adds Studio's nullable manifest and common access/annotation storage.
No live customer data is read for development; use synthetic disposable PostgreSQL.

## Known boundaries
Historical missing inputs cannot be recovered. MCP read-only tool conversations,
audio preparations in other stores, all external-host transcripts, downstream
composer Apply/Generate attribution and statistically valid aggregate quality
measurement are not inferred from this evidence. These gaps must be visible and
documented so this review foundation cannot be mistaken for complete telemetry.
