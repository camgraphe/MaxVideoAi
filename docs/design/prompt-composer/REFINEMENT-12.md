# Keep AI assistant selected when changing models

2026-10-29 · draft PR #555.

Model identity was part of the assistance conversation scope. Selecting another
model or variant therefore reset the preview reducer, switched back to Prompt,
and discarded the transcript and unsent message.

Conversation scope now follows the account and workspace (or audio intent).
Models, variants and video input modes remain part of the suggestion context:
changing them preserves the selected writing tab, transcript and unsent message,
while invalidating suggestions and undo actions tied to the previous setup.
The assistant header immediately reflects the selected model. Explicitly applying
a suggestion still returns to Prompt; account and audio-intent changes still
clear the conversation.

This applies to the development-only assistance preview in the video, image and
audio composers. Generation, pricing and production activation are unchanged.

## Verification

- Reproduced the original tab reset with a failing variant-switch browser check.
- All 13 focused model, context, layout and preview-state tests pass. Chromium
  and WebKit cover compact variant/model switching at 320, 390 and 1440 px,
  conversation and unsent-message retention, and invalidation of old suggestions.
- Real video-adapter coverage includes a model change from t2v to i2v, then an
  account change that still clears the conversation. Audio coverage preserves
  the message when changing voice models and still resets on voice-to-song changes.
- All 13 required image-workspace/session-cleanup contract tests pass.
- TypeScript, scoped ESLint and whitespace checks pass.
- Manual visual check with the real composer in an isolated fixture confirms
  that AI assistant remains selected after Mini → Fast → Wan 3 Prime. No paid
  generation or LLM request was made, and the live user's draft was not modified.
