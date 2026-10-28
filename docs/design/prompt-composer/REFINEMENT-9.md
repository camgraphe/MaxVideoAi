# Reference summaries and editing — 2026-10-28

## Problem and chosen flow

The prompt footer mixed reference identity, durations, removal and Choose section controls. Range-editable video/audio references also bypassed the summary limit, so adding temporal references could keep expanding the footer. On mobile, the horizontal strip concealed references beyond the viewport.

The compact development preview now shows only a thumbnail and Image 1 / Video 1 / Audio 1 (or the existing frame/source role). A pencil appears over the thumbnail on hover or keyboard focus. Clicking/tapping the thumbnail opens References on the matching media type and scrolls to the corresponding slot. Where provider mentions already exist, clicking the adjacent reference name retains insertion into the prompt.

The first three references are shown; an actionable +N opens the remaining inventory at its first hidden reference. On mobile these controls wrap naturally without horizontal scrolling. References are never discarded by this presentation limit.

Choose section, duration, replacement and removal are inside the matching inventory slot. Slot labels use the same short names as the prompt instead of long filenames. Video and audio share the existing excerpt preparation flow; opening/cancelling does not prepare an asset or generate media. Keyboard events stay inside the excerpt dialog, Escape returns to References, and the initiating button explicitly receives focus for Safari/touch return-focus consistency.

The reference panel and excerpt dialog retain their existing media owners and callbacks. Production reference presentation, pricing, generation, the main player and the gallery layout are unchanged.

## Bounded product comparison

Reviewed official documentation, not logged-in competitor flows:

- [Runway Gen-4 Image References](https://help.runwayml.com/hc/en-us/articles/40042718905875-Creating-with-Gen-4-Image-References): reference tags/mentions and a hover action on the image that opens a dedicated sketch interface. Useful pattern: compact identity plus contextual editing. Runway's own three-reference input limit is not copied; our three items are only a display limit.
- [Adobe Firefly image-to-video](https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-using-images.html): hover actions on frame thumbnails include Crop, Edit and Remove; editing opens a separate interface. This supports the contextual-thumbnail approach, not an assertion about audio trimming.

Studio follow-up: the same separation between reference identity and the reference editor may help its composer, with reference mentions retained. No Studio implementation is included here.

## Verification

Authenticated app inspected through thumbnail → References → Choose section → cancel for both video and audio. The user's existing prompt and three attachments were retained. At 390 px, the three references occupy 92 px in both Prompt and AI assistant, wrap within the form, and do not overflow horizontally. The viewport was restored after inspection.

Regression coverage uses synthetic media in the real Composer at 320 / 390 / 1440 px in Chromium and WebKit. It covers short labels, hidden footer editing controls, keyboard pencil visibility, direct video/audio navigation, Escape and focus return, bounded multi-reference layout, the +N destination, applying an excerpt to the correct slot, and preserved prompt/no generation. Existing production excerpt and mention suites cover the unchanged behavior.

Private screenshots in the task visualization directory: references-before-compact-edit.png, reference-audio-edit-panel.png, references-mobile-wrapped.png. No production generation or LLM call was made.

The focused browser, excerpt, mention and composer layout checks pass (47 checks across the targeted suites). TypeScript, focused ESLint and `git diff --check` pass. The final mobile check includes the assistant at 390 px, touch access, and 17 references behind a bounded summary without horizontal clipping.
