# Refinement 2 — compact references and a clear reply field

28 October 2026. User-directed iteration of the design preview, not production implementation.

## What changed

The whole preview, including sample prompts, messages, accessibility labels, controls and review frame, is now in English. The interface has a separate conversation area and a clearly outlined input labelled **Message Milo**. The proposed prompt is a disclosure labelled **Suggested prompt**, with editing and application inside it. The input remains outside the scrollable conversation and is focused again after Send.

Reference chips no longer show filenames or “example” as a second line. The image thumbnail is 44 px square and touches the chip's leading edge, without a surrounding card. Labels are **Start image**, **End image**, **Image 1**, **Audio 1**, etc. A single horizontal strip keeps the height stable as references are added. The plus has no visible box.

References can be clicked to insert an alias at the current text selection. Counters are independent by media type and do not renumber surviving references after deletion. Frame roles are separate from numbered reference images. Audio references go into Milo's message, never the spoken script. Missing/replaced aliases are signalled, and the corresponding action cannot proceed until they are reviewed.

Removed visual causes of the reported heaviness: 3 px inset focus bars, focus-driven margin changes, boxed segmented tabs, repeated nested reference cards, automatic focus transfer into a menu after mouse clicks and large menu shadows. Pointer focus changes only the input border. Keyboard navigation retains a distinct focus indicator.

## Public patterns inspected

- [assistant-ui thread anatomy](https://www.assistant-ui.com/docs/primitives/thread): separate messages, scrollable viewport and composer footer. We retain that separation without installing the library or copying its implementation. Its scroll management would still need integration with the actual workspace.
- [assistant-ui composer source](https://github.com/assistant-ui/assistant-ui/blob/b6b10672ef896e2deaf1603e7414ef0142943e9e/packages/ui/src/components/react/assistant-ui/elements/composer.tsx): restrained hover fills, small action controls, distinct attachment and toolbar responsibilities. MIT at this commit. Inspected source; no substantial code copied.
- [Runway reference guide](https://help.runwayml.com/hc/en-us/articles/52963720640275-Using-reference-media-to-guide-your-generations): automatic Image/Video/Audio labels and referencing an attachment from the prompt. This supports the interaction pattern, not compatibility of Runway's exact syntax with every MaxVideoAI provider.
- [Krea video documentation](https://www.krea.ai/docs/user-guide/features/video): start/end image roles and settings below the prompt. This is a documented pattern, not a live authenticated product audit. Linked screenshot assets returned HTTP 403 through the browsing tool and were not used as visual evidence.

Sources inspected on 28 October 2026. No competitor assets, screenshots or proprietary source code were embedded in the preview.

## Integration implications

Production already has `buildReferenceMentions`, `selectedReferenceLabel`, `insertReferenceMention` and `changedReferenceMentions` in `frontend/components/composer/workspace-reference-mentions.ts`. Reuse their supported-provider logic. Do not pass every demo alias directly to a provider. Stable visible IDs must map to owned asset IDs, roles and the provider's actual compact index/token. A deleted or replaced asset cannot quietly take over an existing mention.

The revised files are separated into HTML, CSS and plain JavaScript for review. CSP allows those local files and blocks network connections. They still simulate all AI replies, uploads and quotes. “Source video” is a role label, not an assertion that it can be referenced with a literal token by every model.

## Verification of this revision

Observed in the local Codex browser:

- Second message sent from the labelled input; field remains identifiable and focused afterwards.
- Pointer click and reference insertion show a single thin input boundary, with no left focus bar or layout shift.
- Image 1 insertion into the Milo message works.
- A selected phrase in the manual prompt is replaced by the clicked reference mention; Apply and Undo preserve their previous behavior.
- Adding Image 2, deleting Image 1, then adding another image yields Image 3 while preserving Image 2.
- Four references occupy one fixed-height strip at 390 and 320 px; later references are reachable by horizontal scrolling or keyboard focus.
- Audio 1 clicked from the manual audio surface opens the Milo message and leaves the spoken script intact.
- Removing a reference used by the pending message displays a missing-reference notice and disables Send.
- Dark appearance checked with the separate transcript/input structure.
- Both HTML files checked for duplicate IDs and missing local assets; their inline scripts and `prototype.js` pass `node --check`. `git diff --check` passes.

This is interaction verification of the prototype. It does not establish provider correctness, production accessibility, ledger behavior or creative quality. Original captures in `evidence/` belong to revision 1; new captures are under `evidence/refinement-2/`.
