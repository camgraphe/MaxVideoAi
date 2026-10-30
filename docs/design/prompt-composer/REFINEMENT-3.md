# Refinement 3 — compact prompt preview with an independent action

Date: 2026-10-28. Local interaction prototype only; no production integration or live AI calls.

## Decision

Keep the proposed prompt collapsible. Show its first two lines by default, with an ellipsis for longer text. The title and chevron expand/collapse the editable text. **Use prompt**, or **Use script** for audio, is a separate button in the header; it remains available in either state. Applying uses the complete text, including edits, never the truncated preview.

The proposal is now a sibling of the scrollable conversation. A long prompt cannot displace the messages inside that viewport or bury its own action at the bottom of the transcript. The expanded editor has a bounded height and its own text scrolling. Stale-draft warnings also sit outside the collapsed content. The separate **Message Milo** field remains the place to continue the exchange.

Reference thumbnails are 32 × 32 px, down from 44 × 44 px. Insert targets remain 44 px high and removal controls remain 27 × 44 px. Generation settings use primary text, medium weight and a subtle fill. Their mobile padding is smaller so the four sample video settings fit on one row at 320 px. Heading sizes are unchanged.

## Verification

- Reproduced the old expanded proposal clipping its text and Apply action inside the conversation's scroll viewport.
- Browser test with a 3,846-character edited prompt: expanded editor height 172 px, content height 1,179 px; action outside the editor and transcript. Collapsed preview height 43 px (two lines). Applied from collapsed state and verified all 3,846 characters reached the manual draft. Undo restored the original draft.
- Browser test with five message/reply pairs: transcript viewport stayed 360 px while content grew to 626 px. Scrolling back changed the transcript position independently of the proposal. Sending a follow-up returned focus to Message Milo.
- Changing aspect ratio disabled Use prompt and exposed the stale-draft warning even while collapsed.
- At 320 px, the collapsed state kept its two-line excerpt, visible Use prompt action, compact reference row and four video settings on one line. In the expanded state, editing the long prompt to its end left the action visible above the editor.
- Audio loaded **Suggested script / Use script**, collapsed by default.
- `node --check prototype.js` and `git diff --check` passed.

Screenshots: [desktop](evidence/refinement-3/milo-desktop.png), [320 px collapsed](evidence/refinement-3/mobile-320-collapsed.png), [320 px expanded long prompt](evidence/refinement-3/mobile-320-expanded-long.png).

## Integration limits

The action is independent of the collapsible text and transcript scrolling; it is not fixed to the browser viewport. Page scrolling can still move the whole section off screen. Confirm the actual generator column width/height, surrounding app panels, mobile virtual keyboard, and scroll ownership during product integration. These checks used a desktop browser and the review frame's 320 px width, not a physical phone.

No production components, provider bindings, billing behavior or persistence were changed. The simulation still returns fixed sample responses. Revision 2's research and references remain applicable; this iteration adds no third-party code or dependency.
