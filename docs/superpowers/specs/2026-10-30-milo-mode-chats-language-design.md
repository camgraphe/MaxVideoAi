# Milo chats by workflow and prompt language

Date: 2026-10-30. Status: proposed for Adrien's review.

## Intent

Milo lives inside the Video, Image and Audio generators. People need to refine a suggestion without first applying it to the manual prompt. They also need to return to a Create, Modify or Extend conversation after switching modes or reloading the page. Milo can speak with them in their language while preparing generation instructions suited to the selected model.

This is a composer feature. Studio retains its separate project conversation. The existing assistance levels and credits remain shared between Studio and the composer.

## Current behavior and constraints

- The video composer currently uses one conversation scope per account across all operations. Its server session is scoped only to `video`. Image uses one image scope; Audio already keys its browser state by intent.
- The browser stores the session identifier only when a request is pending. A reload can recover that one request but cannot restore a completed chat. The server already stores each completed user message, reply and proposed text, and uses the latest eight completed turns as model history.
- A session expires 24 hours after creation and accepts at most 100 requests. Composer review evidence has its own approved 90-day cleanup; that policy is separate from the user's active chat.
- The latest unapplied suggestion now has explicit priority over an older manual editor prompt in follow-up requests. Restoring a chat must preserve this distinction.
- The prompt editor, selected model, settings, references, quotes and media generation are existing owners. A New chat action must not reset or change them.

## Approaches

1. **Browser-only chats by mode.** Small change, but a reload, tab closure or storage loss can silently remove a conversation and its latest suggestion. The browser history could diverge from the server history. Rejected.
2. **One active server-backed chat per workflow, with New chat.** Reuse the current request and session tables. Store only the active session ID per account, surface and visible workflow in browser storage; reload the transcript from an account-scoped read endpoint. This meets the requested behavior without adding a history library. **Chosen.**
3. **Full conversation library.** Supports browsing and reopening older chats across devices, but needs a durable chat index, titles, pagination, archival controls and more screen space. Deferred because Adrien asked to recover the current chat and start a new one, not browse old chats.

## User experience

- Create, Modify and Extend each have their own active chat. Returning to a mode shows its prior conversation. Other visible video workflows such as Reframe, Retake and Keyframes likewise have separate chats. The technical transport mode (for example text-to-video versus image-to-video within Create) does not split a Create chat.
- Video, Image and Audio do not share chats. Image's visible Create/Edit workflows and Audio's existing task intents keep distinct chats. Changing the selected generation model within one workflow keeps that workflow's chat; the new model/settings invalidate any old suggestion before it can be applied.
- Switching a workflow while AI assistant is open leaves AI assistant open and swaps the conversation inside the same panel. Changing to the manual Prompt tab does not close the chat.
- A small, clearly named **New chat** control appears in Milo's header once a chat has begun. It clears only that workflow's chat and unapplied suggestion, keeps AI assistant open, and leaves the manual editor, references and settings intact. It needs a visible label on desktop and an accessible label on narrow screens. There is no old-chat picker in this version.
- Reloading the page restores the active chat for the current workflow. If a request was interrupted, the existing Check reply flow resolves it before the chat becomes writable. New chat is unavailable while a request or reference analysis is pending or its usage is unresolved; the user cannot unknowingly abandon a potentially billed answer.
- A session that has expired or reached its request limit prompts a fresh chat. The UI explains the reset in a short, nonblocking message. The old session remains available to the internal review tools under their existing retention rules, not in the user's chat picker.

## Conversation identity and recovery

- Add an explicit, validated **workflow** field to the composer assistance request. It represents the visible operation, distinct from the model API mode. The client and server use the same pure workflow mapping. The server session scope becomes `video:create`, `video:modify`, `video:extend`, and equivalent surface/workflow scopes. Reject a session ID reused for a different scope or user.
- Preserve the current account-scoped 24-hour session window, measured from the last completed exchange rather than the first message. Keep the 100-request cap. Do not extend expiration for failed requests or page reads. A local active ID is only a pointer; it never grants access without the signed-in account.
- Add a bounded, no-store, authenticated `GET` for one session. It checks account ownership, exact workflow scope and expiry, then returns only displayable completed user messages, assistant replies, proposed text and a server-computed fingerprint of the last effective draft. It never returns raw provider responses, private reference URLs, credits, audit context or another account's messages. Return at most the session's 100 turns in chronological order.
- Store the active session ID under a versioned `sessionStorage` key for account + surface + workflow. Persist it immediately, not only for pending work. This guarantees same-tab reload and mode switching, not cross-device or new-tab synchronization. Loading a scope first hydrates its completed turns; the user cannot send until hydration or pending recovery resolves. Guard every response against a now-inactive account/workflow to prevent late writes into another chat.
- Reconcile any pending request ID with the restored transcript. A completed response appears exactly once; an unknown request remains in Check reply. Never send a second model request just to restore UI state.
- Rebuild the latest unapplied suggestion from the latest completed reply with proposed text, or from a later clarification turn's `activeSuggestion` when that reply has no proposed text. Compare its request fingerprint with the current editor and effective model/settings/references. If they differ, show the historical suggestion as stale and require a new Milo response before applying it. Preserve unsent message and locally edited suggestion in same-tab storage while the session remains active. This ensures follow-up edits after reload still use Milo's latest suggestion rather than an older manual prompt, while changed context cannot apply an obsolete suggestion.
- New chat rotates the active UUID and resets only the local conversation state for that scope, including the current reference-analysis pointer. It does not delete request, usage, review or billing records. Existing pre-release `video` sessions are not silently imported into a new operation scope, because they may contain mixed Create/Modify/Extend history.
- The server currently allows only one unresolved Milo request per account across all scopes. Keep that spending guard. If another workflow or tab is still finishing a reply, show a useful pending message and allow recovery of that request instead of silently starting a duplicate.

## Language policy

- Milo's conversational reply follows the user's language. The generation *instructions* in visual image/video prompts default to English for both first drafts and revisions, including when the user's request or old manual draft is in French. Do not claim that English is universally superior: some models accept other languages, while the selected provider may document an English-only requirement.
- Preserve exact user-requested dialogue, captions, signage, names, product copy and other literal content in its intended language inside that English visual direction. Never translate literal text without being asked. Model-specific formatting and reference syntax continue to come from the selected model's guidance.
- For Audio, spoken scripts and lyrics stay in the requested speech/song language. Descriptive music, effect and ambience directions default to English unless the user asks for another supported prompt language. Do not turn a spoken script into English merely because it is sent to a model.
- An explicit request for non-English generation instructions can be honored when the selected model supports it. If the selected model documents an English-only prompt language, keep the instructions in English and explain that choice in Milo's conversational reply. The prompt editor itself is never translated automatically; only Use prompt/Use script applies Milo's proposal.
- Keep the language rule in shared composer instructions with model-specific exceptions in reviewed model guidance. Do not hardcode a separate language behavior for Lite, Standard and Max; those are assistance quality and cost levels, not output-language choices.

## Boundaries and verification

- No new media or credit flow. Account authentication, model capabilities, reference perception, current settings, usage accounting, review access and 90-day review-context cleanup retain their existing owners.
- Verify scope mapping for every visible workflow and provider mode; Create → Modify → Create restoration; reload after complete and while pending; account switch; New chat; session expiry/full; model or reference changes making a suggestion stale; follow-up after reload preserving the unapplied suggestion; keyboard/mobile access to New chat.
- Exercise real Milo sample exchanges for French request → English visual direction, French spoken dialogue inside English direction, French voice-over script, and an explicitly requested prompt language on a model that supports it. Review outputs rather than asserting that instruction text alone guarantees behavior. Track model and guide version in the existing review context.
- Roll out after the current suggestion-continuity fix is merged. Keep the work in a new isolated PR based on that fix and rebase onto current `main` before delivery. The first rollout starts new per-workflow chats rather than mixing old `video` sessions; no database migration is required for the new scope strings or session reads.

## Sources informing the decision

- Runway Agent documents a recent session and a visible New chat action: https://help.runwayml.com/hc/en-us/articles/51601639579667-Creating-with-Runway-Agent
- Runway accepts other prompt languages but notes that results vary: https://help.runwayml.com/hc/en-us/articles/24342920074131-What-languages-can-I-prompt-in
- Google lists English as Veo 3.1's supported prompt language: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate?hl=en
- ElevenLabs says spoken language is driven by the script text: https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/what-languages-can-the-ai-speak
