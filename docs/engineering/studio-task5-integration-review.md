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

## Remaining responsive corners after dda228de1

The landscape column correction makes 844×390 pass the node geometry and scale
checks, but real screenshot inspection finds the floating Canvas navigator covering
the Video creation button. A root hit-test now checks the center of each enabled
screen-sized command with `elementFromPoint`, plus a 44px target (1px tolerance).
It reproduces Video blocked by Canvas; the Canvas launcher itself is only40px high.

The subsequent 24-case run returns **17 passes / 7 failures**: six320px cases are
clamped again because Fit runs while the expanded map reserves204px; one390px ES
dark case times out before its theme finishes hydrating. The latter must be rerun
on the final stable snapshot, not silently counted as a geometry pass.

Independent review also identifies inconsistent short-layout breakpoints between
621 and700px. The matrix therefore adds the common667×375 landscape viewport
(**30 combinations** total). Its causal first run cannot click Fit because the
Save canvas button intercepts it. These are still the same responsive/action
clarity scope, and neither fit thresholds nor hit-testing are waived.

Screenshots are now retained as `fitted.png` even for passing cases, so geometry
assertions are accompanied by actual visual inspection. Output directory names
do not establish qualification; the counts and findings in this report do.

## Integration review and fixture independence

The intermediate `studio-import/integration-order.json` is independently Approved:
all113 entries match Git first-parent order through `d754057a9`, including full
hashes and subjects; stable patch-id SKIPs and the two mixed/shared bundle counts
were rechecked. The final manifest will supersede this snapshot after Task5.

The common local UI fixture now mocks the out-of-scope consent service explicitly
alongside account services, rather than ignoring console errors from its absent
database. The engine-picker keyboard/search/disabled-model test then passes1/1
in3.0s; the density test also passes. Two historical connector assertions still
need adaptation from always-visible optional rows to the Connections/inspector
presentation while retaining their exact model capacities. A cold development
run also timed out on initial canvas hydration; final stable-snapshot qualification
remains required.

## Connected montage presentation qualified at b321928d3

The complete real connected browser suite passes **7/7, zero skips,64.81s** on
the immutable product `b321928d3158a2c73d6f34ecdfc8141a13a0dd14`. The new first-frame
contain assertion is now green with intrinsic/frame aspect guards. All previous
native video/audio, exact ordered creation, SQL acknowledgement, stale conflict,
offline local recovery, account-change purge, retained-reference renewal, mobile
retry and lost-response idempotency scenarios remain green. This uses only the
owned verified disposable PostgreSQL17/Auth/private-bytes fixtures, not production.

## Frozen UI qualification remains in progress

An exported `681b75f38` snapshot ran separately on3040/3041 with the existing safe
anonymous launcher; no DB/provider/storage/payment environment was inherited.
Its first six desktop/portrait cases pass, including320px. However, moving Canvas
to the right now covers the expanded map's Fit control in both landscape sizes.
After three identical30-second actionability failures, the remaining matrix was
stopped explicitly; it is not a complete pass. The owned3040/3041 processes were
then stopped, and the snapshot remains at `/private/tmp/studio-ui-qa.inkcrz`.
The normal3032 preview and baseline3034/3035 were not touched.

The later435c3cc00 layout passes the earlier command hit-tests in both landscape
sizes, but complete-card inspection still finds Canvas overlapping its output
area (13.95×44px), and the320px creation toolbar covers the bottom24px of the card.
The root matrix now includes the **whole selected card** in its collision check,
as required by the original brief's hidden-output finding. Both counterexamples
are reproduced in `output/playwright/studio-clarity-whole-card-red/`.

The sole product writer has the targeted UI runtime slot to iterate using this
root-owned test read-only and inspect the saved screenshots. Root runs no heavy
suite during that slot, then independently reruns the full frozen matrix. This
does not transfer ownership of assertions or waive the remaining findings.

## Independent snapshot 0ba7bfba9: remaining menu geometry

The writer's EN/light five-viewport run passed; the root then exported immutable
`0ba7bfba9` to `/private/tmp/studio-ui-qa.MotLZz` on owned3040/3041. The full
three-language/two-theme matrix returns **28/30 in1.2min**. Both667×375 French
cases still fail: the wider collapsed map overlaps the selected card/title by
about10px. English and Spanish pass at the same size. This is a translated-control
geometry defect, not a reason to shorten the qualification matrix.

A new root-owned open-menu check clicks Canvas, inspects the actual panel bounds,
opens Templates, scrolls to the last action, checks actionability without executing
it, and closes with Escape/focus restoration. It returns **1/5** on this snapshot:
portrait390/320 panels end at882px in844px viewports;667 landscape ends at413px
in375px. Desktop initially opens correctly, but the Templates panel extends to
top−26px and is visibly clipped behind the header. Only844 landscape passes.
Screenshots and traces are retained in `output/playwright/studio-task5-menu-media`.
The writer receives these exact findings and the targeted UI runtime slot again;
no broad build or PostgreSQL suite runs concurrently.

The same independent run keeps all six non-menu scenarios green: media3/3,
optional-connector2/2, and native decoded-frame/audio-RMS/seek1/1. The audio-bin
scenario now checks the real Undo lifecycle: disabled after hydration, enabled
after import, disabled after reload, enabled after removal, and disabled after
restoring that sole post-reload removal. Canonical references, original media,
timeline duration, save/reload and unrelated-media preservation remain asserted.

Independent review of `f8e113534` (injective Copy selection scope) and `399b4cc09`
(scoped actual media history availability) is **Approved**, with8/8 targeted tests.

## Product review and frozen geometry gate at 26cbbed36

The subsequent `a3f42bf48` and `26cbbed36` correct the menu offsets and bound the
collapsed map width while preserving its full accessible name. Independent review
also identified the first pixel of the short-landscape layout at621px: the final
312px/152px horizontal insets leave157px for the620px starter graph, giving its
260px card about65.8px rather than dropping below64px. The root matrix now includes
621×375 in all three languages and both themes, for36 canvas cases.

The final immutable product `26cbbed36a04c9f3dbf5c8260e2a6cf36e2818c0`, exported to
`/private/tmp/studio-ui-qa.sYDyCR` on owned3040/3041, passes **41/41 in1.5min**:
36 full-card/readability/command-hit-test cases and five real open-menu cases.
Every saved `fitted.png` remains available under
`output/playwright/studio-clarity-final-26cb/`. No assertions were relaxed.

Independent product review through26cb, including smoke adaptation2266ab39c,
is **Approved** with22/22 lightweight checks. Copy, media Undo, measured contain,
Projects, native model capacities and the three retained Settings access paths
are covered. The root's broader regressions, maximum-list connected browser and
final build remain pending at this entry; this is not a full release approval.

Source protection was rechecked again: all34 historic dirty-source hashes and
the original editor HEAD match the import manifest exactly.

One architecture correction is still required: Task5's e82 added44 connector
styling lines to the previously503-line node module, exceeding its520-line
contract at547. This is a Task5 regression, not an inherited failure. The writer
is isolating the new connector styling responsibility without changing its CSS
values, raising the limit or compressing source formatting to evade the guard.

## Connected browser and regression rerun

The full private connected browser suite on26cb passes **7/7, zero skips,65.67s**.
The mobile builder now also exercises all12 ordered occurrences: add controls
disable at the limit, the final trim and submit remain actionable, the ordered
list has visible overflow without an inner scroll range, and the dialog owns
scrolling. The ten extra occurrences are then removed before the existing real
two-clip B/A creation, lost-response replay and SQL receipt assertions. No extra
twelve-clip server command is submitted. All native frame/audio, media renewal,
ownership, revision conflict, local draft recovery and save-and-exit tests pass.

The independent39-case UI regression run returns38 passes and one fixture error.
The Projects legacy Rename/Duplicate/Delete assertions all pass, but its final
console guard correctly catches two500s. The saved trace identifies only
`/api/legal/cookies/version` and `/api/legal/cookies`: unlike workspace tests, this
case did not call the common local-dependency fixture helper. The correction must
mock these absent consent services explicitly, not ignore errors. All other
model/capacity, clipboard, keyboard, responsive inspector, audio and local-recovery
cases pass. The corrected Projects case still needs a fresh run.

## Final technical gates at 4a119520a

`df2d32c9e` extracts the unchanged connection styles into a43-line local module:
the node owner is503/520 lines again, with explicit import/ownership contracts.
`490977173` replaces the three starter inventories with actual outcome sentences
in EN/FR/ES and fallback copy; the generation disclaimer is unchanged.
`4a119520a` isolates the two consent fixtures in the Projects smoke only.
All three commits and the root12-clip/frontier QA are independently **Approved**.

On final product `4a119520ac3b2ad5529890bae932599ad9651737`:

- Studio/exports unit, contract, DOM and disposable-PostgreSQL suites:
  **496/496**, zero skips,24.65s; log `/private/tmp/studio-editor-final.GePDea`.
- Modified MCP gates/contracts plus original montage planning contracts:
  **87/87**, zero skips,12.36s; log `/private/tmp/studio-mcp-final.50AkWe`.
- Clean-environment production build in `/private/tmp/studio-build.HTFEnx`:
  prebuild registry/catalog/media gates, optimized build, lint/types,
  **867/867 pages**, traces and sitemap postbuild all succeed.
- Exposure and `git diff --check` succeed. Two inherited exhaustive-deps warnings
  remain in WorkspaceAssetLibraryBrowser and WorkspaceRuntimeModals; the installed
  Supabase SDK also emits its inherited Edge `process.version` warning.

No DB/provider/payment/storage environment is inherited by the build. The normal
3032 preview and new immutable4a preview3040/3041 remain anonymous local drafts.

## Comparable interaction measurements, not a CWV claim

Three fresh Chromium contexts per version,1280×720, identical byte-for-byte
`editor-performance.spec.ts`,80 nodes/150 timeline items, same local media and
mocked account/persistence/consent. Baseline332bf4abf remains on3034; final4a runs
on3040. Each run succeeds. Both development servers are warmed before gestures;
no parallel heavy work runs during measurement.

| Measure | Baseline median (range) | Final median (range) |
| --- | ---: | ---: |
| Media requests before first Play | 150 (150–150) | 150 (150–150) |
| Play to playhead progression | 270ms (270–271) | 275ms (259–282) |
| Scrub to expected position | 41ms (40–41) | 43ms (40–44) |
| Automated clip drag | 224ms (224–228) | 268ms (250–272) |
| Two timeline zoom increments | 70ms (69–72) | 86ms (86–87) |
| Automated canvas pan | 420ms (417–433) | 176ms (160–193) |

The final drag/zoom measurements are modestly slower (+44ms/+16ms median), while
pan is faster. Do not describe this as a universal speedup, production benchmark
or CWV improvement. The150 preloaded readers remain an explicit unchanged debt.
The stress test observes editor-clock progression/gestures; native media decoding
and sound are established by the separate frame/RMS and private-browser tests.

The first attempted baseline rerun incorrectly used the new header-readiness
helper against the old header and failed before measurement3/3. The corrected
run uses the baseline's existing helper and the verified identical stress test;
no baseline product or files were modified. Raw reports:
`.superpowers/studio-visuals/final-baseline-performance-corrected.json` and
`final-studio-performance.json` (three passes each).
