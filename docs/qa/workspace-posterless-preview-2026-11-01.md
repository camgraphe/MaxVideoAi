# Selected video preview without a poster — 1 November 2026

## Observed problem and cause

The private M12 journey completed one video generation. Its newest rail card
displayed the short preview, but the central preview remained white until the
user selected the card. The original then played to the end in the modal. The
journey's `result-top.png`, `media-ready.json`, `figure-rendered.html` and
`result.json` establish these distinct observations; no new generation or live
database read was needed for this correction.

The central tile only mounted its video when Play was active. At rest it displayed
the stored thumbnail, which in this case was still the local
`/assets/frames/thumb-16x9.svg`: a white rectangle. An available original does not
guarantee an available poster. The rail's separate short-preview video masked this
distinction. Selection, accepted job identity and completed media URLs survived;
the failure was the tile's idle display policy.

## Deterministic reproduction

`tests/workspace-generation-preview-dom.test.ts` mounts the real render-state and
preview hooks with the real `CompositePreviewDock`. It applies the production
local-render and accepted-response projections, changes local identity to a server
job/group, delivers a controlled completed status response, and refreshes history
to remove the local row. Only network/media browser boundaries are doubled.

Before the fix, both absent-poster and placeholder-poster cases retained the
correct selected job and original, but the DOM contained no video. The first run
failed four of six cases: both posterless results, failed-poster fallback, and
native-reader error handling. The manual-selection and curated-idle cases already
passed. This is a behavioral reproduction, not a source-text assertion.

## Corrected behavior

Only the selected central personal result loads its full playback rendition, or
the exact original when no full rendition exists, in pause if no usable poster is
available. The white placeholder cannot cover that reader. No Play call or audio
starts automatically. A real poster retains the existing idle loading behavior;
poster failure enables the same paused reader. A native video error displays the
existing localized “Preview unavailable” label without marking the paid generation
failed. Selecting another result replaces that error state.

The short rail preview remains separate. Download and modal actions retain the
original. Completion does not replace a different result selected by the user.
Curated demonstrations, gallery cards, provider/backend behavior and job polling
ownership are unchanged.

## Verification and limits

The focused run covers seven new DOM cases and the existing render polling,
accepted-result, history, single-flight account scope, gallery order, URL-role and
preview contracts: 68 tests passed. Existing fixture warnings remain for
`onLoadingComplete`, styled-JSX attributes in JSDOM and a marketing image quality
configuration; they are outside this display correction.

The DOM tests control media events. They prove mounting, source selection, pause,
manual Play, visible error fallback, selection preservation and stopping status
requests; they do not prove actual decoding or first-frame paint in a browser.
Play then Pause also retains the same video node and its current playback time.
Frontend TypeScript, lint and public-exposure checks passed. Lint reported seven
existing warnings in unrelated Image, Studio conversation and Billing files, with
no errors or warnings in the edited components. `git diff --check` passed.
No connected browser, paid generation or live storage request was used.

### Additional native first-frame qualification

`workspace-generation-preview-browser` uses the existing local fixture server,
real dock/CSS, bounded Range-response helper and committed
`tests/fixtures/studio-media/pattern-a.mp4` (H264/yuv420p, AAC, 320×180, 6 seconds,
115,331 bytes). Playwright 1.59.1 runs isolated headless Chromium and WebKit at
1280×900. The Browser plugin is absent; the requested path uses the repository's
Playwright infrastructure, without a user browser or account.

Both browsers passed: the initial video had `readyState=4`, 320×180 decoded
dimensions, `paused=true`, `muted=true`, `autoplay=false` and `currentTime=0`.
The screenshot's RGB pixels matched the current decoded frame, with mean absolute
errors of 3.29 (Chromium) and 7.26 (WebKit), against a tolerance of 18. A separate
nonwhite check rejects the original blank cover. Play then Pause retained the
same video node and stable playback position, with visible-frame errors of 3.55
and 7.67. Only the exact local original was requested; there were no remote
requests or page errors. WebKit used two requests against that same local source.

The same Chromium test against the pre-fix tile from `69d71ce21` failed because
there were zero video elements rather than one. Restoring the corrected tile
returned both browsers to green. Optional screenshot and JSON evidence is written
outside the repository through `WORKSPACE_PREVIEW_EVIDENCE_DIR`; this run used
`/tmp/maxvideoai-preview-native-followup/`.

Production storage delivery, actual customer media, downloads and physical
Safari/iOS remain rollout checks. This local qualification proves the native
paused-frame boundary for the selected H264 fixture; it does not establish
all-codec, all-device or performance coverage.
