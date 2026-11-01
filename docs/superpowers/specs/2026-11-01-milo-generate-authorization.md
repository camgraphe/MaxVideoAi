# Milo generation authorization

Approved user choice: after reviewing the compact mockup, Adrien authorized implementation with “ok go”. This specification records that choice; no further design or implementation approval is required. Scope includes video, image and audio workspaces that expose Milo plus Generate; excludes Studio and surfaces without Milo.

## Behavior

- In AI assistant, Generate keeps its current location and current quote. The action is grey and cannot submit until a prompt from the current conversation was explicitly applied.
- Pending requests, failed replies, clarification with null replacement text, and an unapplied proposal grant no permission. View prompt keeps its existing review UI and never authorizes generation.
- Use prompt applies text, switches to the existing Prompt tab and enables generation subject to all existing quote/source/engine/input guards.
- Returning to the chat after applying may retain permission when the applied text and compatible context still match. Sending a new request, resetting/new chat, account/workflow/engine/reference or other incompatible changes, undo, or divergence of the editor text revokes permission. Revocation must not revive by returning to an old value. Compatible scalar setting changes, especially aspect ratio, preserve permission and continue updating the quote.
- Prompt is an explicit manual path: its visible text can generate under existing guards without requiring Milo.
- The 53px proposal bar, ellipsis excerpt, View prompt eye and current review surface retain their layout and behavior. The quoted amount remains fully readable while the Milo action is blocked.
- Help works with hover, keyboard focus and touch. English before a proposal: “Continue with Milo to prepare a prompt, or open the Prompt tab.” English with a ready proposal: “Use Milo’s prompt, or open the Prompt tab to review the text to generate.” Supply corresponding French/Spanish copy where the surface supports those locales.
- The guard must be effective in click/keyboard handlers and enclosing submission owners, including the image form; aria-disabled alone is insufficient.

## Boundaries and evidence

No timeout, billing, tariff, provider, Studio, production account or database changes. Tests use synthetic prompts/references and intercept LLM/media APIs. Existing read-only reproduction confirms the bug, including failed/null/failed with no applicable proposal. No client data belongs in Git.

## Acceptance

Behavior tests must fail against the starting commit, then pass after implementation: old synthetic Tokyo cannot be generated from AI assistant in pending/error/null/unapplied states; review grants nothing; application/manual path can generate; returning tabs preserves valid application; new messages/chat and incompatible context revoke it; ratio/quote changes preserve valid application; image form submission and audio entry handler enforce the rule; keyboard and mobile help remain usable; price stays visible and updated.
