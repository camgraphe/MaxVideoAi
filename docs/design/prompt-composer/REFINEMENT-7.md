# Refinement 7 — sidebar creation types and a shared composer header

2026-10-28. Adrien asked to remove the remaining media/operation bar, return Create / Modify / Extend beside Prompt / AI assistant, and explore Video / Image / Audio in the sidebar. He specifically asked to avoid overlap with **Expand** and keep the previous variant available for comparison.

## Layout

The separate media/operation row is removed. The existing writing tabs occupy the left of the composer header, with the existing supported operation buttons on the right. Both groups remain visible and wrap on narrow screens. Model support still determines available operations.

Video / Image / Audio appear beneath Create in the existing 86 px sidebar. Each remains a normal link with a visible active destination. On mobile, the creation item in the bottom navigation shows the selected type and opens the native selection picker; it navigates to the same three existing routes. Audio uses these entry points too, without changing its editor.

Expand / Collapse moves into the existing Milo heading, separated from operation buttons. At widths up to 400 px it shows its icon with an accessible name and a 44 px target. It continues to resize only the bounded conversation. The full suggestion review, reply field, source spacing, model picker, price controls, player and gallery behavior are unchanged.

Alternatives considered: retain the previous common bar for maximum separation (saved below); move operations into a menu (rejected because the user requires immediate visibility); use the sidebar and the shared composer header (current reversible experiment).

## Restore point

Previous version: commit `275fbba98`, branch `codex/prompt-director-common-bar-backup`. It includes the required source spacing adjustment. The experiment remains on `codex/prompt-director-composer`, draft PR #555. Do not reset the active checkout to compare; use the saved branch in a separate worktree or revert this isolated refinement.

## Validation

- 21 prompt-assistance/navigation tests pass, including the updated command-bar browser cases after correcting their fixture route handling. The fixture checks 320/390/768/1440 px, visible operations, shared desktop row, a separate Expand heading, mode changes, model access in both writing tabs, navigation to all three creation types, and production-off behavior.
- 30 relevant composer, image-workspace, source-surface and gallery contracts pass. TypeScript, public exposure and diff whitespace checks pass. Full frontend lint has no errors and the same seven existing warnings.
- The authenticated app shows the sidebar choices and common writing/operation header. Expand and Collapse were exercised in the existing user tab without editing its draft or generating media. Private screenshot: `sidebar-composer-app.png` in the task visualization folder.
- The full production build was not rerun while the shared local preview server is active. Physical mobile picker/keyboard and true browser zoom still need separate qualification; browser fixtures cover responsive layout and selection behavior.

No media generation or live LLM call is part of this refinement. Production retains the original layout because the existing development-only preview flag guards the new navigation and composer presentation.

## Follow-up — compact empty conversation

Before the first message, show only the Milo heading and the message composer; hide the empty history and Expand. Typing alone does not open the history. Sending the first message opens the bounded conversation immediately, so the pending response and later replies do not resize it. A pending request or existing proposal also keeps the conversation visible. The seven targeted layout/navigation browser tests pass, including empty state, first send, ten follow-ups and Review at 320–1440 px; focused lint and diff checks pass. Authenticated visual verification captured `compact-empty-milo.png` privately.
