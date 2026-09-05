# MCP watch project example — design QA

Date: 2026-09-06.

## Evidence and final state

- Source: `/Users/adrienmillot/.codex/generated_images/01a06e9d-7306-7390-9fad-4181b5569c79/exec-7ddd3d8e-4bb9-4eef-82f7-cdd8e6685560.png` (1672 × 941).
- Implementation: `http://localhost:3006/fr/mcp#project-demo`.
- Latest desktop screenshot: `/tmp/maxvideoai-project-demo-qa/fr-play-option-desktop.png`, 1672 × 941 viewport. Source and scroll implementation viewed together; existing navigation explains the vertical offset.
- Mobile checked at 390 × 844; ordered stages stack without horizontal overflow. Capture: `/tmp/maxvideoai-project-demo-qa/es-scroll-mobile.png`.
- User accepted the Wan 3 Prime clip with “ok pour moi”, then requested video progress controlled by scroll. That interaction is implemented in EN/FR/ES.

## Iterations and resolved findings

- [P2, fixed] Increased conversation typography and widened the title area to preserve one-line desktop heading.
- [P2, fixed] Product framing moved to 35% object position so the left-side HTML remains readable.
- [P1, fixed] User rejected the first FLUX 3 clip's rotation. Wan 3 Prime uses restrained movement, fixed orientation and the same first/last reference image. The user accepted this replacement.
- [P2, fixed] Native playback replaced by scroll-controlled seeking at the user's request. The layout, photo, translations and product direction remain intact.

## Final interaction verification

- Desktop scroll advanced the paused video from 2.123810 to 4.668998 seconds. A later read without scrolling stayed at 4.668998.
- Mobile reached 5.966666 seconds on downward scroll, then returned to 5.003811 on upward scroll. Video remained paused with native controls hidden.
- No scroll interception: ordinary document scrolling controls the product's progress through the viewport.
- Loading begins within 200px of the viewport; seek requests coalesce through animation frames and wait for the current seek to finish.
- EN/FR/ES hints verified: “Scroll to bring it to life”, “Faites défiler pour animer”, “Desplázate para animarlo”.
- Native playback, pause and loop were verified before adding scroll control. Native controls remain the server-rendered and reduced-motion fallback. Changing the OS reduced-motion preference was not exercised in this browser session.
- CTA navigates to the localized `#first-video` section. First-request copy behavior was checked in the earlier integration pass.
- Follow-up: discreet 40px play button in the bottom-right corner. It restarts standard playback and enables native controls. A top-right button returns to scroll control. Both actions verified in EN/FR/ES; keyboard activation verified in French and mobile appearance checked in Spanish (`/tmp/maxvideoai-project-demo-qa/es-play-option-mobile.png`).
- Manual playback advanced normally (3.223384 seconds on desktop, 5.610039 on mobile). Returning to scroll paused the video at 2.304613 seconds, matching the current scroll target. TypeScript, lint, exposure and diff checks pass after this addition.
- Follow-up copy: the central chat request now explicitly asks for scroll-controlled video, explaining forward/down and backward/up in EN/FR/ES. The MCP hub's copyable prompt starts with this same text and adds the discreet play button, model comparison and exact-price approval. Browser clipboard matched the rendered Spanish prompt exactly. Localized content and overflow checked; TypeScript, lint, exposure and diff checks pass. Desktop comparison: `/tmp/maxvideoai-project-demo-qa/fr-chat-prompt-desktop.png` against the preceding play-button version; the longer bubble remains legible without clipping.
- Final scope clarification: chat title and speaker now name Codex or Claude; the subtitle uses “your assistant” and the icon is a neutral conversation symbol. EN/FR/ES verified in the production preview, including mobile overflow. Captures: `/tmp/maxvideoai-project-demo-qa/fr-codex-claude-desktop.png` and `/tmp/maxvideoai-project-demo-qa/es-codex-claude-mobile.png`. Compared with the preceding chat version; the desktop title fits on one line.

## Media and fidelity

- Final asset: `watch-wan-3-prime-scroll.mp4`, 1920 × 1080, 30 fps, 6 seconds, silent H.264, 4,221,289 bytes.
- Thirty keyframes, spaced 0.2 seconds apart, verified with ffprobe for responsive forward/backward seeking. Faststart metadata, yuv420p; source padded from 1918 to 1920 pixels wide.
- Poster comes from the same Wan clip at 2.5 seconds. Photo and all copy remain separate from video.
- Graphite product frames, cobalt/lime accents, serif title, existing light/dark surface tokens. The latest screenshot preserves the approved layout with the user's subsequent motion and interaction changes.
- Rejected FLUX and conventional Wan encodes are archived in ignored `.reports/mcp-watch-demo/`; no longer shipped as public video assets.

## Checks and limits

Production build passes: 860 pages generated, including lint/type validation and model-registry projection checks. All 77 focused home/MCP tests pass. SEO/media origin checks, exposure and translation parity pass. Production preview verifies localized canonical URLs, hreflang and JSON-LD, the homepage link to MCP, playback and the Codex/Claude text. No deployment performed. Browser verification used the in-app browser at desktop/mobile viewport sizes, not physical iOS/Android hardware. Build log: `/tmp/maxvideoai-mcp-final-build.log`.

final result: passed
