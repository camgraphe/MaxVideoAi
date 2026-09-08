# Studio Task 5 — clarity qualification

Task 4 is qualified at product `18bf21cad`; its persistence, recovery, ownership,
idempotency and real browser evidence remain in `studio-task4-integration-review.md`.
Task 5 is the already-planned final interface pass, explicitly reaffirmed by the
coordinator. This document records intermediate checks, not a release approval.

## First canvas sublot: e82cc214f — not yet approved

Required, connected and incomplete connector rows remain visible. Empty optional
ports keep their IDs and nonzero anchors behind a persistent Connections command.
The menu exposes remaining/maximum capacity and restores focus after removal.

The first 24-case browser matrix returned **18 passes / 6 failures** in approximately
one minute. All failures were the 844×390 landscape cases in EN/FR/ES, light/dark:
node headings and inspector buttons overlapped the selection toolbar.

Real desktop inspection also found a defect that containment alone did not catch:
at 1440×900, Fit reduced the selected 260px-wide card to **46.8px** and Generate to
**7.92px** high (`scale(0.18)`). The installed XYFlow package interprets numeric
padding as proportional padding, not pixels. The product writer and independent
reviewer were notified. The matrix now additionally rejects postage-stamp starter
cards: at least 160px wide on desktop, 64px in compact overview layouts. These are
regression floors, not a claim that scaled canvas controls are touch targets;
screen-sized selection/inspector commands remain necessary on mobile.

Artifacts: `output/playwright/studio-clarity-matrix-task5/` (owned local fixtures).
No screenshot or functional test establishes a performance improvement.

## QA correction: f1e25d1b2

The new-montage contain-fit browser assertion now verifies intrinsic source and
frame aspect ratios, in addition to visible fill, centering and `object-fit`.
The controlled delayed-listing fixture releases and settles its pending routes
on exit. Its targeted rerun passed **1/1 in 5.6s**. A preceding cold development
run failed at its five-second navigation assertion: the trace showed a pending
workspace RSC request following successful controlled GET 200 / POST 503, not an
API recovery failure. Cold development compilation is not production performance
evidence. Final qualification must rerun the complete relevant suite.

## Canvas correction follow-up

`5dec7888d` changes padding to pixel strings; `c81c56d50` also reserves the map
at the 601–700px boundary. The four EN/light viewport checks then returned **3/4**:
desktop and both portrait sizes pass, but 844×390 still clamps to 46.8px-wide
cards. Its real canvas is approximately y102–280 (178px), so reserving 162px for
vertical controls leaves almost no usable area. The landscape layout remains a
blocking product finding, not an assertion to relax.

The new optional-connector E2E passes **2/2 in 5.9s**, desktop and 390px:
an empty optional video port stays mounted with nonzero noninteractive geometry;
keyboard insertion reveals it, its transformed SVG endpoint reaches the real
left target boundary, removing its last link hides the row without removing the
source, Escape restores focus to the same card's persistent Connections button,
and keyboard Undo restores the edge. The initial endpoint probe incorrectly
expected the handle center; inspection of installed XYFlow `getHandlePosition`
confirmed that a left target ends at its left boundary, and the assertion was
corrected to that contract rather than widening its tolerance.
