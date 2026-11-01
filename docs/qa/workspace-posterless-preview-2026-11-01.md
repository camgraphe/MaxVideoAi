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
No connected browser, paid generation or live storage request was used. Production
first-frame, manual-play and download checks, including Safari/iOS qualification,
remain rollout verification.
