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

## Follow-up: stable references and mobile prompt focus

- Create, Modify and Extend keep references in the writing footer in both Prompt and AI assistant. A missing required source keeps its direct upload/library action; only the duplicate required-source summary is removed. Other required assets and provider restrictions remain visible.
- Source buttons stay horizontal on small screens. Controls can wrap within the footer without moving above the writing field.
- The manual prompt no longer inherits the old inset focus ring. A single subtle border follows the outer composer radius; keyboard focus for individual controls remains visible.
- Mobile and coarse-pointer writing fields use at least 16 px, including manual, scene and assistant inputs. Viewport user zoom remains unrestricted. This addresses the small-font iOS focus trigger; physical iPhone keyboard behavior still needs device confirmation.
- Clear keeps its position beside Multi-prompt and is disabled when the manual prompt is empty. Undo and its synchronous textarea focus remain unchanged; there is no global clear across multiple scenes.

Validation: Chromium and WebKit at 320/390/1440 px cover preview input focus, a long prompt/counter, Clear and Undo, plus the existing 36 clear-action scenarios across three locales and two densities. Modify/Extend direct-source popup access is checked in both writing tabs.

The model selector is now the first control in the writing footer, followed by references, in both Prompt and AI assistant. A 1 px theme-aware border and a slightly stronger hover border distinguish the selector without increasing its height.

The shared FLUX 3 / Luma Ray 3.2 keyframe editor now occupies the existing extra-fields area below the prompt and the settings / Generate row. Source and operation selection stay in their existing locations; keyframe data and handlers are unchanged.
