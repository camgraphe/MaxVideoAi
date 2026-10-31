# Composer Milo server boundary

- `provider.ts` owns instructions and request parameters; `reply-format.ts` owns
  the private provider response protocol and its conversion to public `{reply,text}`.
  Conversation advice is not editor replacement text. Valid prompts and spoken
  scripts remain replacements according to their destination, without keyword filters.
- Freeze the response format before count, use the same parameters for create,
  and persist its version in the existing calling transaction before dispatch.
  Keep this operational marker outside expiring `reviewInput`. Recovery selects
  the decoder only from the durable version: absent means legacy; present invalid
  means failure, never guessed migration or fallback from a malformed new output.
- Preserve public reply schemas, selected-target limits, proofs, request ownership,
  exact history and shared ledger/recovery behavior. Offline provider fixtures
  establish plumbing and structural refusal, not real-model semantic quality.
