# Milo workflow chats implementation

Spec: `docs/superpowers/specs/2026-10-30-milo-mode-chats-language-design.md` (approved by Adrien).

Goal: restore one active same-tab composer chat per visible workflow, add New chat, and write visual instructions in English while preserving literal content and conversational language.

Constraints: authenticated account ownership, same credits and request recovery, no automatic model retry, no editor/settings/reference reset, no new migration or history picker. Legacy requests remain supported, but new clients use versioned workflow storage. Work happens in this isolated branch.

## Task 1: Server session contract and restore
- Add tests for workflow validation, account/scope isolation, bounded minimal transcript, latest suggestion through clarification, pending requests, expiration and rolling completion-only expiry.
- Add shared workflow and canonical draft fingerprint helpers; keep legacy scope mapping when workflow absent.
- Add authenticated no-store session read and extend expiry on first successful completion only.
- Verify: focused session and existing live PostgreSQL tests; expected green without additional provider calls or credit writes on reads.
- Interfaces: validated draft.workflow, session snapshot DTO, canonical draft serialization consumed by Task 2.

## Task 2: Browser lifecycle and persistence
- Add browser regressions for Create→Modify→Create, reload, latest active suggestion, pending recovery without duplicate reply, New chat, local draft edits, stale context and account changes.
- Persist versioned account/workflow session pointers plus unsent text and local proposal edits. Hydrate server transcript before permitting send; keep original pending identity for recovery.
- Retire late async callbacks, retain assistant tab across workflow changes, reset reference analysis only for New chat, handle expired/full sessions explicitly.
- Verify: session browser test plus existing live browser/state tests; expected green.
- Interfaces: Task 1 snapshot and fingerprint, controller.loading/newChat/chatKey consumed by Task 3.

## Task 3: Surface wiring and language
- Wire explicit visible workflows for video, image and audio; add compact localized New chat and loading/retry feedback.
- Update shared Milo instructions and app guidance; preserve exact dialogue, signage and spoken scripts.
- Verify: workflow mapping, route context contracts and provider input tests; real language sample checks when configured access is available. No claim of live output validation from instruction assertions alone.

## Task 4: Review and PR
- Run focused browser/PostgreSQL tests, typecheck, lint, exposure, diff check and required validation suite.
- Request one fresh whole-branch review, fix actionable findings with reproductions.
- Record evidence and remaining limits, commit and open an isolated draft PR based on delivered suggestion continuity fix.

Review focus: account/workflow hydration races; old completed reply versus pending recovery; local edits overwritten during restore; late replies after New chat; expired/full pending sessions; perception recovery identity; no duplicate debit; English instructions with untranslated literal speech.
