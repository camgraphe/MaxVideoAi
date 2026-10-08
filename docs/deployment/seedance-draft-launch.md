# Seedance 2.5 Draft launch

The creator workflow keeps Seedance 2.5 as one model. Its existing checkbox
selects a separately priced 480p text-to-video Draft, with one output. An owned
ready Draft can receive a separately quoted and confirmed 1080p final. Prompt,
duration, framing and audio are inherited; the paid Draft remains available.
An ordinary 480p generation is a different offer and cannot be finalized through
this workflow. MCP remains deliberately outside this initial release.

## Server availability

`SEEDANCE_2_5_DRAFT_ENABLED=1` is an explicit server-only release switch shared by
the workspace page, authenticated workflow reads, preflight and submission.
Absent, `0` and other values keep execution unavailable. The flag does not change
model identity, the pricing registry, historical receipts or provider routing.

- Production builds may execute only with the explicit flag and without
  `PRICING_SANDBOX=1`. Vercel production and preview environment scopes must be
  selected deliberately; the flag has no default-on value.
- Development still requires the flag, the pricing sandbox and a loopback URL.
- The `draftPreview=1` simulation remains restricted to local development and
  never opens production execution.
- Authentication, owned-parent validation, active independent workflow tariffs,
  single-winner final reservation and uncertain-submission protection remain
  required after enabling the flag.

Media and Studio use the same authenticated finalization action in production.
The server read determines whether the job belongs to an eligible workflow;
ordinary media does not acquire an empty action sidebar. Composer controls and
instructions appear only for compatible Draft scenarios, and an unchecked
Draft option keeps the normal localized generation label.
The comparison panel retains the same Draft resolution and single-output
constraints, locks submitted settings, and displays the active workflow quote.

The Draft checkbox can return the composer to standard generation after an
accepted, completed, failed or uncertain Draft. Leaving the mode preserves the
account-scoped active job and same-attempt recovery facts; it neither cancels
the task nor submits a replacement. The separate account-scoped selection flag
preserves an unchecked choice across reloads. Re-entering Draft resumes its
existing job, while only the explicit new-Draft action clears terminal setup.
The checkbox is temporarily disabled while the submission request is pending.

## Acceptance before activation

1. Verify current active Draft/final cells through the canonical quote owner.
   The pricing cutover installed independent workflow cells; do not replay the
   local seeding command or reuse ordinary cells as a fallback. Verify supplier
   LIST separately: signed normal-task discounts do not apply to workflow steps.
2. Run the focused availability, preflight, submission, poll, refund, ownership
   and creator tests, TypeScript, lint and the repository validation gate.
3. Obtain a bounded budget and external-storage authorization for the actual
   application canary. The completed provider-only pair is historical evidence;
   it does not authorize another task or certify app-owned storage.
4. Exercise one four-second silent 16:9 Draft and one final through the real
   application orchestration against disposable local PostgreSQL and signed
   local Auth. Keep provider/storage credentials out of Git and the running
   ordinary pricing sandbox. Restrict renders and saved media to a unique test
   namespace, using the existing `VIDEO_RENDER_STORAGE_PREFIX` and
   `MCP_STAGING_REFERENCE_STORAGE_PREFIX` owners. Do not write production jobs,
   receipts, tariffs or Studio projects.
5. Check the durable owned Draft output before confirming the final; verify the
   final's separate current quote, one charge per accepted job, both original
   outputs, retained framing, library save and Studio import/playback. Persist
   accepted task IDs before polling. An uncertain acknowledgement stops further
   paid submission; polling an accepted ID never creates a replacement task.
6. Record the actual provider usage, storage objects, local receipt amounts and
   browser result. Failure/refund and cancellation fault injection uses fixtures;
   deliberately submitting another paid task to make it fail requires its own
   budget. Do not claim fixture coverage as a live failure canary.

## Git delivery and rollback

Coordinate with any release already merging to main, incorporate its confirmed
main revision and follow [GitHub/Vercel delivery](github-vercel.md). Require green
Quality CI and a successful preview build, run `pnpm deployment:check` immediately
before merge, then verify both live domains against the merged Git SHA.

Only activate the production environment switch after acceptance and the launch
decision. Changing Vercel environment configuration requires a new Git-backed
deployment to take effect; a saved environment value is not a live confirmation.
Smoke-test the signed-in checkbox and both quote steps without submitting a paid
production task, and inspect runtime errors.

Removing the switch closes new workflow requests and finalization actions. It
does not cancel accepted provider tasks, refund paid jobs or discard media.
Existing recorded-provider polling continues. Ready Drafts may temporarily lose
finalization access, so preserve their expiry and lineage when investigating.
Re-enabling the same validated release restores eligible finalization; never
replay accepted submissions or rewrite receipts to recover the workflow.
