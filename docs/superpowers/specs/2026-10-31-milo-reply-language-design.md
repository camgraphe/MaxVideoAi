# Milo conversational reply language

Date: 2026-10-31. Scope: the authorized clarification of composer Milo's conversational reply language.

## Intent and approach

The existing instruction to reply in the user's language does not establish precedence when the current instruction, earlier conversation and requested creative text use different languages. Clarify that precedence in the shared provider instructions and align the app guide and workflow documentation.

An instruction-only clarification fits the existing ownership. Language detection or translation after the response would introduce another language owner and could change creative text; persistent preferences would require separate memory and lifecycle design. Neither is part of this change.

## Required behavior

- For conversational `reply`, honor the most recent applicable explicit reply-language instruction, including an ongoing preference still available in the conversation context.
- Otherwise use the language of the user's current own instruction. Quoted or supplied material, the editor and requested scripts/lyrics do not determine the reply language.
- If that language is unclear, retain the established conversation language; use UI locale only as a last fallback.
- Choose proposed-text language separately: visual direction defaults to English; exact literals and names retain requested wording; spoken scripts and lyrics retain the requested language; reviewed English-only guidance remains authoritative.
- The provider receives at most eight prior completed exchanges. This clarification adds no memory of a preference outside that context and does not translate stored replies.

## Boundaries and validation

Only provider instructions, app guidance and documentation change. Public schemas, destination decoding, recovery, application proof, storage, billing, model selection and UI retain their current owners. No keyword detector or additional provider translation call is introduced.

Use existing offline context, conversation, destination and provider-budget checks, plus TypeScript, lint and exposure checks. Do not add a test that merely copies the new instruction. These checks establish transport and contract integrity, not real-model semantic compliance. No live provider call or browser QA is authorized for this task.

Review synthetic language boundaries: a current Spanish instruction after French conversation; an English instruction requesting a French script; a French instruction quoting Spanish dialogue; an applicable explicit reply preference; an ambiguous acknowledgement. The expected reply language follows the precedence above without changing the creative text's language.
