# Studio generated-image retouch implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this bounded correction.

**Goal:** Milo can quote a retouch of an exact ready image generated in the current Studio project without asking the client to attach it again.

**Architecture:** Keep native job/output identities in the immutable conversational draft. Validate every selected source before any library write, reuse the existing idempotent library-save owner only during requested quote preparation, and bind the resulting canonical asset request to verified reference facts. Existing quote confirmation and recovery remain authoritative.

**Tech stack:** TypeScript, Zod, Responses tools, PostgreSQL 17, existing Studio generation services.

**Spec:** The user's explicit correction request in this chat and the constraints below.

## Global constraints

- Exact current account/project, accepted completed job, ready visible image output only.
- Attached images keep their review fingerprint; generated images keep exact original provenance.
- No generation, provider submission or wallet debit before explicit quote confirmation.
- Preserve selected models, settings, reference roles and saved draft identities.
- Pricing remains read-only; no schema migration or model publication change.

## Review focus

- Foreign projects/accounts, hidden or unready outputs must fail before promotion.
- A changed original or changed promoted copy must fail before a quote is persisted.
- Invalid model/settings or an invalid later reference must cause no library write.
- Retrying a saved native draft must not call Milo again, duplicate the asset or submit a generation.
- Mixed native and attached references must preserve roles and original review facts.

### Task 1: Native image references through quote and recovery

**Files:** image creation/action contracts; new conversation-image-request and conversation-image-preparation owners; image conversation service/run; existing source-asset helper; Studio integration guide; schema, source, and PostgreSQL conversation tests.

**Interfaces:** Preserve service re-exports of imageRequestFromDraft and imageReferenceFingerprintFromReview. Add validateStudioImageRequest returning a read-only validated selection with materialize() for the canonical request and its expected reference fingerprint. Both prepare and resume use this owner.

- [x] Add failing tool/draft contract tests for exact native image identities.
- [x] Add source tests for preflight, mixed references, original drift, promotion provenance and denial before writes.
- [x] Add a PostgreSQL regression for native image quote preparation and recovery without reattachment, provider execution or charge.
- [x] Run the new tests and confirm they fail for the missing support.
- [x] Extend the contract and implement the shared validation/materialization path.
- [x] Update Milo's image tool guidance and the engineering guide.
- [ ] Run focused tests, test:editor, qa:editor, lint:exposure, build and applicable CI validation.
- [ ] Review the complete diff independently and address actionable findings.
- [ ] Commit and create a reviewable pull request; report deployment status explicitly.
