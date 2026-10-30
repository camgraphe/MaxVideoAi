# Refinement 5 — stable conversation and visible references

2026-10-28. Continued in draft PR #555 after review in the actual app.

The earlier transcript used only a maximum height, so its first messages and the first suggestion pushed Message Milo down. The conversation and suggestion now share a reserved 240–280 px stage. The transcript scrolls independently; expanding the suggestion uses that same space. Message Milo stays below the stage, and Use prompt stays outside both scroll regions. The selected-model identity, **Milo for Seedance 2.5** for example, stays above the transcript. Audio instrumental identity uses the selected Lyria Clip/Pro model.

The user-approved tabs now read **Prompt / AI assistant**, explaining the option before introducing Milo by name inside the conversation. The grey Message Milo placeholder reads “Describe your idea. Milo will help write your prompt.” There is no duplicate introduction in the empty conversation. French and Spanish labels follow the same distinction.

Manual writing and optional references now share one surface. A thin plus with the visible **References** label opens the existing inventory, in both writing modes. The Milo references and send button share a footer row. Required Modify/Extend sources retain their direct entry point before writing. Filenames remain absent from the compact strip; thumbnails and reference actions retain their existing behavior.

At Adrien's request, simulation badges and explanatory fixture replies have been removed from the visual-review UI. This changes presentation only: the local response remains a fixed fixture or a copy of the current draft. It makes no LLM or credit request, and the production-off gate is unchanged. The live service is still a separate increment.

## Reference pattern

The separation of a scrollable message list and a composer follows the [assistant-ui Chat panel anatomy](https://www.assistant-ui.com/elements/chat-panel), checked on 2026-10-28. Its [Thread composition](https://www.assistant-ui.com/elements/thread) also separates message presentation, attachment entry and sending. We adapted that layout pattern to the existing components; no source code or dependency was imported.

## Verification

- Reproduced the initial reply-field displacement with a failing browser assertion before the fix.
- The same test now passes at 320, 390, 768, 1024 and 1440 px: document position stays within 2 px of its empty-state position after the first response, proposal expansion and ten exchanges. The 1024 px case uses a 600 px viewport height.
- 15 focused tests pass: context invalidation, full proposal/undo, audio isolation, keyboard/IME, reference insertion, required source ordering and production-off behavior. TypeScript, frontend lint and exposure checks pass; lint has seven pre-existing warnings outside the changed files.
- The live local Seedance 2.5 UI was inspected in both tabs. No Generate action was used. New synthetic screenshots: [390 px](evidence/refinement-5/composer-390.png), [desktop](evidence/refinement-5/composer-1440.png).

The whole app column still scrolls. This change stabilizes the reply field within its composer; it does not pin the entire composer to the browser viewport. Physical mobile keyboards and true browser zoom remain unqualified. The previous full build belongs to revision 4; this focused UI pass leaves the active local review server running and uses the PR CI for the new production build.
