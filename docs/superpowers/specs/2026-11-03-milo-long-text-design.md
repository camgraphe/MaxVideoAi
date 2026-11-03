# Milo long conversation envelopes

The observed failure was application validation: two complete, valid
`destination-v1` conversation replies exceeded the old 6,000-character reply
limit. No provider replay is needed to establish that boundary.

Use a shared bounded 50,000-character envelope for human messages, conversational
replies, drafts, suggestions, session restoration and browser draft storage.
Keep replacement destination checks and each selected model's `maxChars` separate.
Keep `destination-v1`, strict fields, durable decoder selection, original history,
application proofs, 32,000 counted input tokens, frozen output tokens and financial
policy intact. Never shorten content silently to fit a character or token limit.

The authenticated message route streams at most 1 MiB. This accommodates full
message/draft/suggestion envelopes with UTF-8 and JSON escaping while retaining an
explicit aggregate transport bound. Other metadata also consumes this bound.
Oversized messages remain editable with a clear limit notice; they are not sent. The limit counts the full editable input, including outer whitespace. Invalid optional local data is excluded on reload without invalidating the valid chat or pending request identity; the notice explains that an overlimit unsent text cannot be restored.
The normal prompt bar and its fixed geometry remain unchanged.

Availability refreshes on returning to a visible/focused tab, using the existing
account owner and request epoch. A newer assistance revision invalidates a stale
funding rejection; it never resends a declined request. A confirmed app-output
refund receives truthful feedback distinct from unchanged incomplete, refused or
selected-target length failures.

## Execution and checks

- Add failing contract, parser, streamed-route and selected-model boundary tests.
- Add synthetic service round trips for 6,081, 6,452 and 50,000-character advice;
  retain rejection of replacements above the selected model's 20,000 limit.
- Add real Composer browser coverage for long input persistence/send and complete
  conversation rendering/restoration on Chromium/WebKit; assert no replacement,
  no automatic generation and unchanged prompt-bar geometry.
- Add a real funding-feedback regression: declined send, support revision/credit
  refresh, then one new explicit request with a new identity.
- Implement shared limits and boundary feedback, then run focused unit,
  PostgreSQL/browser, type, lint and whitespace checks. Customer content and
  identities never enter fixtures or git. No paid provider or production calls.

## Local verification evidence

The original boundaries failed first: reply >6,000, message >8,000, body >64 KiB,
long browser input restoration, oversized-message Send gating, and missing
focus/visibility credit refresh. After implementation:

- Unit/parser/streamed-route boundaries: 9 passed.
- Existing context/contract/client/state/storage checks: 55 passed.
- Actual Composer Chromium/WebKit long-text and PostgreSQL reply boundaries:
  22 passed, including complete 6,081, 6,452 and 50,000-character conversation
  replies, exact history/reload, and Wan's 20,001-character replacement refusal.
- Funding/session/command-bar/focus/formatting browser checks: 32 passed.
- Follow-up storage, full Composer long-text and funding checks: 24 passed;
  pending identity and existing server history survive an overlimit unsent input,
  and padded text above the raw cache envelope stays blocked with a warning.
- Frontend TypeScript passed; ESLint passed with seven pre-existing warnings in
  unrelated files; public exposure and whitespace checks passed.

Local replay of the two saved incident provider outputs accepted their exact
6,081 and 6,452-character replies with `text: null`. No provider call, prompt,
reply text or customer identity was copied into fixtures or this evidence. These
checks establish application boundaries, not model semantic quality or a promise
that 6,000 output tokens can produce every allowed 50,000-character envelope.
The root task owns the final whole-candidate build/CI and operational delivery.
