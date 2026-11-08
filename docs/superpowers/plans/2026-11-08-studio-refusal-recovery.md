# Studio refusal recovery implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, then request an independent review.

**Goal:** Explain a recorded content-filter refusal and offer the client a reference/prompt change or a compatible alternative engine.

**Architecture:** Extend the existing shared safe failure-message projection for the observed content-checker responses. Keep recovery advice in the conditional Studio generation instructions; current catalog tools own alternative engines and quotes.

**Tech Stack:** TypeScript, Node tests, disposable PostgreSQL 17.

**Spec:** User request of 8 November 2026: explain the failure and offer a different image engine or an adapted/replaced reference when appropriate.

## Global constraints

- Keep the exact rejected field only when the provider supplied it; unknown causes stay unknown.
- Never claim a refund without the existing receipt proof or promise another model will accept the content.
- Client chooses changes; a new attempt keeps the exact-quote and confirmation flow.

## Review focus

- Prompt versus image reference versus unspecified target: localized regression fixtures.
- Bare HTTP 422 and private provider text: retain safe unknown fallback.
- Rejected output versus rejected input: preserve existing output-specific guidance.
- Studio persistence: verify recorded messages reach project facts without another generation.
- Recovery suggestions: no model permissiveness ranking, automatic retry or purchase.

## Task 1: Preserve refusal evidence and explain recovery

- [x] Add observed content-checker fixtures to `tests/generation-output-failure-guidance.test.ts` and the existing PostgreSQL quote-facts test; run them and observe missing targeted guidance.
- [x] Extend `getKnownGenerationFailureMessage` in `frontend/lib/generation-failure-messages.ts` using the existing localized prompt/reference/generic messages.
- [x] Update `STUDIO_GENERATION_RECOVERY_INSTRUCTIONS` in `frontend/src/server/studio/conversation-director-instructions.ts` to explain the recorded reason and offer the client's requested choices, using live facts for alternatives.
- [x] Document the recovery behavior in `docs/engineering/studio-conversation-integration.md`.
- [ ] Run focused guidance/Studio tests, lint, exposure, TypeScript and build; review the final diff independently.
- [ ] Deliver through PR, required Quality CI, merge and verified Git production deployment.
