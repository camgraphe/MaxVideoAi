# Studio conversation reply envelope

Studio conversation replies share a 50,000-character envelope through the director
decoder, public draft contract, JSONB journal and task `partial_reply` storage.
`STUDIO_CONVERSATION_REPLY_MAX_CHARS` in `lib/studio/conversation-reply.ts` owns the
application bound. Recent assistant replies are passed intact to both director
adapters; the existing history-turn and counted input-token limits still apply.
`projectStudioReply` retains its separate protocol-marker protection.

This changes conversational text capacity, not generation prompt limits. Selected
model/operation prompt validation, quotes, client confirmation, output tokens,
reasoning, call caps, input-token bounds, deadlines, credit ceilings, rates and
settlement policy are unchanged. An allowed text envelope does not promise that a
model can produce its maximum length within a frozen token budget. The incoming
Studio message limit remains a separate 4,000-character contract.

A completed response with no function calls and exactly one nonempty string
`reply` above 50,000 characters is a saved output-limit outcome. Studio retains
the exact supplier evidence and ordinary metered usage, then saves a short notice
that the original reply could not be delivered. Its turn is `ready` with
`retryable:false` and an `output_limit` continuation; its task is `paused/output`.
This is an unfinished request, not a completed answer or a refund. Reads, duplicate
submits and explicit saved recovery do not buy a replacement response. Continue
still needs the existing explicit approval for a new execution segment.

Only length rejection receives this outcome. Malformed JSON, extra fields, invalid
tool/action output and unknown supplier usage retain their existing bounded
recovery and financial policies; this change does not eliminate those retries.

## Migration and rollout

`94_studio_conversation_reply_envelope.sql` replaces migration 65's
`studio_tasks_partial_reply_check` (`length(partial_reply)<=2400`) with the validated
`studio_tasks_reply_envelope_v1` (`length(partial_reply)<=50000`). It changes no rows,
task approvals or financial evidence. It is repeatable and uses a 5-second lock
timeout and 30-second statement timeout. A lock failure rolls back; do not bypass it
or apply request-time DDL.

Apply migration 94 explicitly on the approved direct database connection before
deploying this runtime, after the existing Studio task migrations. Old deployments
accept the widened constraint. New task admission and worker selection require the
validated new constraint and absence of the old restrictive constraint before
counting, reserving or dispatching. Base task-schema recognition remains separate,
so missing migration 94 does not erase ownership or route an existing task through
legacy spending. Existing history/status reads remain available.

Migration index 94 was absent from fetched `origin/main` at `390ac3e86`; PR 607 owns
93. Recheck the merged migration index before publishing this follow-up. Do not
renumber or modify a migration already applied elsewhere. No production migration
was performed during implementation.

For rollback, restore the previous application while retaining the widened
constraint. Reintroducing 2,400 would reject already stored long replies and is not
a safe automatic rollback. Historical raw checkpoints are never rewritten or
automatically reopened by deployment; saved recovery stays an explicit operation.

## Verification

The original actual worker/PostgreSQL diagnostic accepted 2,400 characters but
settled and rejected 2,401. Automatic recovery bought three synthetic replies and
consumed 70 included credits before pausing, compared with 30 for the single
delivered control. This was an offline reproduction, not an observed live failure.

`tests/studio-long-reply-postgres.test.ts` covers exact 2,401, 6,081 and 50,000-character
delivery once, complete stored history, crash recovery without another purchase,
50,001-character stable limit handling, explicit continuation and missing-migration
pre-spend refusal. Unit checks retain malformed/tool replay boundaries and both
history adapters. The connected Studio browser fixture verifies all 50,000
characters remain readable after reload without a second call or horizontal
overflow. Providers and counters are synthetic; these tests establish plumbing,
not real-model output quality or generation performance.

Local implementation checks passed: 10 focused unit/PostgreSQL tests, 91 related
task/recovery/runtime/credit tests, TypeScript, ESLint (seven existing unrelated
warnings), exposure and whitespace checks. The first browser run used the local
new worker with the fixture's archived earlier Git HEAD server, so it is partial
render/reload evidence only. Final browser qualification must run again from the
combined committed candidate before delivery.
