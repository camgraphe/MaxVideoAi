# Milo quality-review retention

## Approved intent

The user selected **90 days of detailed context for internal Milo review**, explicitly
separate from creations, Studio history and billing evidence. Continue in PR #555.
Production merge, configuration and cleanup are not part of this implementation.

This completes the retention decision identified by the release review. It does not
create a customer-visible chat-history product or erase original operational records.
The 90-day duration is the user's product decision, not a statutory duration claim.

## Existing ownership

- Composer operational input, response, validated reply and credit identity belong
  to `prompt_assistance_requests`. The additional provider-facing review snapshot is
  specifically `context_json.reviewInput`.
- Studio's additional snapshot is `studio_conversation_responses.review_context_json`.
  Native Studio turns, responses and tools serve history and accepted-work recovery.
- Shared admin review reads native evidence rather than copying all conversations.
  Its optional free-text annotation notes are additional internal review content.
- Access audit metadata and verdict/issue classifications contain no raw transcript.
  MCP quote records remain owned by their operational/financial lifecycle.

## Approach and tradeoffs

Use targeted expiration in the current native storage and a matching read boundary.
This avoids another transcript copy and preserves the existing recovery owners.
An all-row deletion would discard operational evidence; a separate duplicated review
store would add another lifecycle without improving the selected 90-day policy.
The targeted approach is an implementation decision under the approved scope.

Do not describe this as deletion of every copy of a conversation after 90 days.
Original workspace/operational records and provider retention have separate policies.
Do not claim anonymization of remaining metadata or a complete GDPR certification.

## Behavior

1. A review source expires exactly 90 elapsed days after its immutable `created_at`.
   Reading/reviewing/retrying never extends that window. PostgreSQL's clock is the
   authority for reveal/annotation decisions; metadata listing remains available.
2. At expiry, shared Assistant review cannot reveal native detailed content or add
   notes for that source. Return a distinct `review_expired` result and plain English
   explanation, even if scheduled physical cleanup has not yet run. Missing source,
   unavailable schema and expired review remain distinguishable.
3. An authenticated hourly cleanup removes only composer `reviewInput`, Studio
   `review_context_json` and annotation `note` text older than 90 days. Each uses its
   own immutable creation timestamp. Keep all other columns byte-for-byte unchanged.
   Native input/reply/provider evidence, settings needed by recovery, rows/IDs,
   verdicts/issues, access audits, credits, prices and media are preserved.
4. Cleanup is bounded, transactional and restartable; concurrent runs use row locks
   with `SKIP LOCKED`. Report aggregate counts and whether eligible work remains,
   never user IDs, prompts, private URLs or notes. Dry-run is read-only.
5. Existing immutable-snapshot guards permit only the exact expired removal. Before
   90 days, replacement/removal stays forbidden; after removal, repopulating an aged
   snapshot is forbidden. No session flag or general immutability bypass is added.
   Annotation history remains append-only except removal of an expired note's text.
6. Expiring review snapshots must not change the original provider evidence or
   interfere with status, replay or settlement, including an unresolved old call.
   No provider call, refund, generation or credit mutation occurs during cleanup.

## Boundaries and communication

Use the existing authenticated cron mechanism, not a public cleanup endpoint. Add
the hourly schedule to the repository's Vercel configuration; deploy only after the
new ordered migration. No request-time schema bootstrap. Apply hosted migrations
only to the explicitly identified isolated Milo QA branch during qualification.

Update customer-facing privacy/provider descriptions and Milo's existing public
explanation in EN/FR/ES. Explain internal human review, the 90-day additional-context
window and scheduled cleanup separately from saved history and billing. Keep the
composer uncluttered by using its existing help/privacy entry points. Provider
identity belongs in the provider/privacy register, not tier names or marketing
claims. Update legal content/version ownership consistently with the current code.

Retain existing authenticated, audited reviewer access. The accepted policy does
not authorize bulk transcript export, model training or extra reviewers. Production
activation still needs exact-target schema/config/worker and account-flow checks.

## Verification

Prove boundaries at just under 90 days and at expiry; missing/invalid dates fail
closed. Verify same-account scoping, duplicate IDs, concurrent cleanup/reveal and
annotation, migration replay, attempted replacement/resurrection, a partial batch,
dry-run and missing schema. Compare preserved native/financial values before/after.
Demonstrate recovery of an old unresolved call after its review-only snapshot is
removed. Test cron auth/failure behavior and the expired UI response. Re-run affected
admin/Studio/composer contracts and required CI for the new candidate.

Context: [CNIL retention guidance](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees)
distinguishes purposes and lifecycle stages; it does not prescribe this 90-day value.
