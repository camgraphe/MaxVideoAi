# Flash page: Modify, Extend, dialogue and orbital proof

Local review on 2026-11-16; not a production deployment or a public-gallery publication.

## Delivered

- Two genuine Flash originals in Modify: ivory-coat source and targeted blue-coat edit. The original image composition remains, with a diagonal mask, a 50% initial reveal, keyboard/pointer slider and one shared silent playback action.
- Extend uses the existing still board and an illustrative 6s + 4s editing timeline. It has no video player, fabricated playback or promise that the provider returns a stitched original plus continuation.
- The prompt guide shows an 18-second text-to-video conversation: question, a brief hand insert, admission, silent reaction, invitation to stay. Six requested shots have unequal lengths (2/4/1/5/2/4 seconds), based on those story beats.
- The specifications figure now shows an eight-second male-surveyor orbital scene. Both new films retain the existing rectangular figure, measured poster geometry and discreet controls.
- Original submitted prompts, copy/reuse/Milo links and factual provenance are available in EN/FR/ES. The guide links the official series prompting documentation, which explicitly includes Flash.

## Generation and ownership

The user approved four unique attempts with a $7.20 supplier-cost reserve; no retry. The edit was conditional on a reviewed source and its own $1.40 reserve. The plugin still reported ENGINE_UNAVAILABLE, so this uses the previously approved direct BytePlus route followed by private imports into the verified Camgraph account. These imports are assets, not newly fabricated native application jobs.

Supplier LIST cost computed from returned completion tokens: source $0.919254; edit $1.0943199; dialogue $2.7279; orbital $1.2159. Total $5.9573739, not a reconciled invoice or customer retail price. All four private imports returned one asset and no failures. No provider identifiers, account IDs or supplier prices are needed in browser-facing media config.

Exact prompts, requests, one-attempt receipts, upload results and originals are retained in the local `model-page-integration/final-media-20261116` artifact folder. Original bytes are not retimed or re-encoded; local preview copies have content-hash filenames. Separate WebP posters use source samples at 1.5s for the comparison, 1.4s for dialogue and 5.5s for the orbital shot.

## Meaning and limits of the proof

- Source and edit are 834×1112 at 24 fps. Video tracks are 6.041667s and 5.708333s; the provider removed eight frames. Playback follows the same native timestamps and stops both at the shorter end. The prompt panel explains this difference.
- One-second samples show the ivory-to-blue change and broadly consistent walking, face and colonnade. Buttons and clothing details differ. This is not a frame-perfect preservation claim.
- Dialogue samples show the intended framing sequence. An audio stream and audible-mode playback were verified; the exact spoken wording, naturalness and lip sync still warrant human listening before editorial sign-off.
- Orbital samples show a male subject, coherent station architecture and planet reveal. The initial foreground column briefly occludes the character; the poster is selected after that reveal.
- Extend remains an illustration; the hero and gallery teaser remain attributed stills. No local media is presented as an existing public gallery job.

## Validation

- 16 cinematic/preset tests pass, including original/poster hashes, correct model attribution, shared controls and prompt handoffs.
- TypeScript passes; lint has no errors and seven existing warnings outside these readers. Exposure check and diff whitespace check pass.
- Headless Chromium: desktop 1113×998 and mobile 390×844. No horizontal overflow. Seven videos start paused with `preload=none`, readyState 0 and zero initial MP4 requests. This is request evidence, not a production Core Web Vitals claim.
- Modify: pointer/keyboard reveal, play, pause, end and replay pass. Both muted at rate 1; observed timestamp drift ~12ms during sampled playback. Source and result are not speed-normalized to hide duration differences.
- Guide: playback with sound enabled, prompt dialog, exact prompt content and Create/Milo URLs pass. Existing copy functionality remains unchanged.
- EN/FR/ES routes return HTTP 200 with expected canonicals, four hreflang entries and five JSON-LD scripts each. Public paths, redirects and sitemap ownership were not changed.
- No uncaught page errors in the smoke test. The local dev overlay/cookie panel may be visible in diagnostic screenshots; they are unrelated to the new readers.

## Prompting references

- https://ai.byteplus.com/ark/region:ap-southeast-1/docs/seedance-2-5-prompt-guide (updated November 15; explicitly covers Flash): assign references, use an overall scene brief, timed or numbered shots, explicit actions/camera/audio, consistent continuity and clear speaker roles. Allocate time to the described content; do not overload short ranges.
- https://dreamina.capcut.com/seedance/seedance-2-5-prompt: director-style briefs, concrete action, camera behavior and purposeful continuity constraints. Broader Seedance 2.5 capability claims were not transferred to Flash.
- https://ai.byteplus.com/ark/region:ap-southeast-1/docs/create-video-generation-task-api: real Modify request uses reference_video with edit/adaptive/-1.

The story, dialogue and production prompts are original editorial choices. Provider guidance informs the structure; it does not guarantee the rendered result.
