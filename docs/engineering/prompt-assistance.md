# Prompt assistance (local app preview)

The video and image workspace composers and the audio creation editor now share an optional **Prompt / AI assistant** presentation. This increment is a development-only interaction sample, not a live assistant. It performs no LLM, credit, provider or generation request. Studio is unchanged.

## Activate and roll back

Start this worktree independently:

```sh
NEXT_PUBLIC_PROMPT_ASSISTANCE_PREVIEW=1 pnpm --dir frontend dev --port 3018
```

Both `NODE_ENV=development` and the flag above are required. A production build cannot expose the simulation even with the flag set. Remove the flag and restart to restore the ordinary UI. Keep each worktree's `.env.local`, `.next` and test state separate; copying an old local environment does not synchronize Vercel Preview settings. Never commit credentials.

## Ownership

- `Composer.tsx` keeps manual editing, reference review, advanced options, quotes and Generate. Video/image route adapters provide account/model/mode scope and the current settings, Kling subjects and separately owned generation controls; existing hooks remain the draft owners.
- `PromptAssistanceComposer.client.tsx` selects the view and presents Undo. `PromptAssistancePanel.client.tsx` owns transcript/editor layout only; it has no Generate callback.
- `usePromptAssistancePreview.ts` supplies a 350 ms local sample. At the user’s request, the visual-review UI uses natural fixture copy with no simulation badge; the development-only gate and no-network implementation are unchanged. `preview-state.ts` captures monotonic revisions from the draft/settings/reference fingerprint and rejects stale application/undo. Account, model and operation changes retire the conversation and pending response.
- Suggestions preserve their complete text. A fixed-height conversation stage (240–280 px depending on viewport height) contains the independently scrolling transcript and compact proposal action row. Review replaces the transcript with the complete editable suggestion in that same space. The reply field stays below it from the empty state through subsequent exchanges and review. Expand explicitly enlarges the conversation only. **Use prompt / Use script** lives outside both scroll regions. This is not a sticky action relative to the whole page.
- `ComposerWorkspaceControls.client.tsx` supplies presentation slots from the video shell and image surface, without owning model or quote state. `ComposerCommandBar` places visible compact operation buttons beside the writing tabs; Expand sits in the Milo heading. `WorkspaceComposerModel.client.tsx` uses EngineSelect's custom trigger and existing picker. The old model/history strip and page activity row are omitted only behind the development gate. `AppCreationNavigation.client.tsx` provides Video/Image/Audio links beneath Create in the sidebar and a native route picker in the mobile navigation, including on audio. The existing settings/Generate toolbar, player and gallery are unchanged.
- `WorkspaceReferenceSection.client.tsx` reuses the existing upload/library/excerpt owners. Compact references use short labels and 32 px thumbnails; the labelled “+ References” action lives inside the writing surface and opens the existing inventory, including character-library field actions. Required Modify/Extend sources keep a direct action in that same writing footer, with one Required label on the source button rather than a second summary. Provider-specific mention tokens and changed-reference guards remain authoritative. Stable display aliases with translation to provider tokens are still service work; deleting a reference may currently renumber the existing provider mentions.
- Audio voice assistance edits `script`; music/song style, ambience and SFX edit `prompt`. Lyrics remain separate. Clicking **Audio 1** writes a mention into Message Milo, never speech. The existing `onChange` callback is the only draft mutation path. Soundtrack-a-video uses the existing separate AudioWorkspace and is not included.

Multi-prompt scene editing remains manual with an explanation. Existing engine text limits still apply; no unrestricted text is silently submitted to a model with a smaller limit. Preview conversations are ephemeral and reset when leaving the page.

## Remaining live-service increment

Build a dedicated authenticated context/proposal contract, with model/mode-specific guides, reference identity binding, revision checks, idempotent requests and the existing Milo Sol/Luna credit accounting. Do not fabricate Studio project/actor identifiers to reuse its endpoints. Evaluate Terra separately. Complete localized copy (including audio's preview labels), real errors/cancellation, account transitions and mobile keyboard QA before enabling a live path. No new dependency or external source code was copied for this increment.

## Verification

Reducer, real React DOM and browser tests cover stale replies, scope changes, complete application, Undo, keyboard/IME, reference invalidation, audio field isolation, production-off behavior and no accidental generation. `tests/prompt-assistance-layout-browser.test.ts` uses the real Composer, audio editor and product CSS with synthetic data, across 320/390/768/1024/1440 px, including short desktop and reduced motion. The command-bar browser test covers compact navigation, model placement in both tabs, operation visibility and explicit expansion. See [latest app review](../design/prompt-composer/REFINEMENT-6.md) for actual browser checks and remaining limits.
