# Create film integration — local review, 2026-11-16

The approved Create C image composition is retained: the same diagonal drummer mask, character mask, editorial grid, two compact motion frames, and captions underneath. Only media surfaces and unobtrusive controls change. The drummer has a pale overlay play/pause control and an audio toggle after playback. Motion has one central play/pause control for both originals, always muted, and no per-video audio controls.

## Selected media

`frontend/config/model-cinematic-create-media.json` records local exact-original hashes, dimensions and separate immutable display posters. The set is the Camgraph drummer render, the approved ballet source, the successful ballet transfer using the new Seedream 5.5 character, and that actual character image. No rejected Sunburst-character transfer or superseded walking/dance source is used. The original videos are not retimed or re-encoded. Browser timestamp correction aligns decoder drift; it does not alter playback rate.

Create and motion dialogs expose their actual generation prompts; the localized handoffs preserve Use this prompt, Copy prompt and Refine with Milo. References are not silently attached to a visitor's account. The dialog explains that visitors supply their own image/video references. Modify and Extend remain explicitly labelled concepts.

## Verification

- Compared with `create-alternatives-20261115/c-editorial.jpg` and the approved `create-c-integration/desktop-create.jpg` / `motion-control-desktop.jpg` captures.
- Browser review at 1065 × 998 and 390 × 844. The mobile document is 390px wide, without horizontal overflow.
- Main film play/pause works inside its unchanged mask, with no native control bar.
- One motion button starts, pauses and replays both videos. Observed decoder timestamps differed by 23ms during playback and 6ms on pause; both were muted and playbackRate remained 1.
- Fresh reload: all three video elements paused, preload none, readyState 0. Responsive posters remain visible. No claim of a measured Core Web Vitals improvement.
- Prompt dialog and actual workspace/Milo destinations checked in the browser.
- Focused cinematic/preset tests: 16 passed. Exact original/poster hashes verified by tests.
- TypeScript check passed. Frontend lint: zero errors; seven existing warnings outside the changed cinematic readers. Exposure check and git diff check passed.
- EN, FR and ES routes return HTTP 200, expected localized canonicals, hreflang and existing JSON-LD output; actual Create video source appears in each server response.
- Local console retains existing navigation popover property warnings and unavailable database/cookie-policy warnings. A transient Fast Refresh dependency-size warning during edits did not recur after a full reload.

Local preview only. No generation, remote gallery publication, deployment or account mutation in this integration pass. Production media publication and final public-gallery validation remain separate.
