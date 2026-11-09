# Connected integration verification — 9 November 2026

Status: local connected verification complete; scoped task and whole-wave review
are closed clean at87dd37bc4ed423b2421329fdb281c5d99234ec98. Final targeted native
rechecks on that source are complete, attributed to the parent IAB operator below. Actual optimized IAB observations and paired measurements
are recorded in [COMPARISON.md](COMPARISON.md). No remote CI or delivery approval is claimed.
No browser was launched by these fixture commands. The IAB operator supplies and
attributes browser observations separately.

The final connected product snapshot `9df0cb33f35f5bdb8f72e043c79455fc542f25e3`
passes its normal production build, with configuration unchanged and ordinary
prebuild, lint, type and postbuild gates. A fresh Integration lane passes
1,789 tests with 3 existing skips (1,792 total). The fresh Fast lane records
11,019 passes, one failure and one existing skip (11,021 total). Its sole failure
was the MiniMax H3 source contract's brace-delimited regex: an additive nested
read-descriptor call preceded the unchanged trusted duration field. The assertion
now uses the test's existing TypeScript AST approach and requires the response
asset's duration to remain exactly `stored.durationSec`; all 10 tests in that
file pass afterward. This focused rerun is separate from the full-lane result,
not a claim that a second complete Fast run occurred.

Postbuild HTTP checks pass bootstrap307, real browse/assets and ancillary GET200.
Actual browse/saved/recent SQL readers each return30 under a read-only connection
that rejects DDL. Actual jobs owners return12 jobs, one audio and two video jobs;
the intentionally absent Seedance workflow remains404. These checks establish
fixture readiness, not native browser parity or performance gains.

Final root IAB rechecks on that optimized snapshot confirm private Angle source
display and reload, direct Angle/Image upload reload with fresh authorized reads,
and native private Audio and Upscale-video playback. Inline Preview and Import
entry focus now reaches Back; returning restores the exact Preview or Import opener.
The Import panel becomes visible after an actual file choice. Native queue
pause-after-current survives close/reopen and resumes successfully; final import
identities and byte evidence are qualified in [IMPORTS.md](IMPORTS.md).

Upscale retains its existing ephemeral source behavior: reload selects a generated
default from actual jobs rather than restoring the consumed handoff. An initial
pending-image observation was rechecked and resolved to the decoded generated
default; no persistent private-read failure or source-draft restoration is claimed.
Creator and Studio native insertion remain limited by their genuine local release
gates; controlled DOM/SQL coverage does not establish native operation behind those
gates. Optimized paired measurements are now complete, with their limits in COMPARISON.md.

The initial integrated product snapshot was
`6719aec175803a6e9f98f77e8902f977b3493f31`. Broad validation exposed one actual
regression: a legacy single-reference wrapper could show a retirement message after
a route/account/context departure even though the batch owner correctly refused
insertion. `39234f1be` fences that wrapper with the existing lifetime and opaque
selection scope. Existing active-draft regressions reproduce the failure before the
change and pass afterward. The same commit updates stale test seams to exercise
current real owners, preserving exact originals, canonical refs and SQL transactions.

| Verification | Result |
| --- | --- |
| Loopback SDK protocol | 13 checks pass (including bounded upload refusal/retry): PUT/checksum, exact GET/HEAD, Range/416, unsigned/tampered/expired refusal, conditional PUT and DELETE. |
| Connected HTTP | One-use bootstrap307; real Library assets/browse200 and default30 rows, common total135; actual wallet/admin/legal/service GET200. |
| Actual readers on read-only PG17 connection | DDL rejected with25006; actual browse/saved/recent owners each return bounded30 rows. |
| Initial complete Fast lane | 10,953pass,24fail,1skip out of10,978. All failures were preserved and investigated. |
| Final complete Fast lane after corrections | 10,977pass,0fail,1skip out of10,978;347.99seconds. |
| Initial complete Integration lane | 1,783pass,5fail,3skip out of1,791. The five failures were stale fixtures, not suppressed. |
| Integration corrections, focused | 12/12pass,0skip against real disposable PG and route owners. Final complete lane: 1,788pass,0fail,3skip out of1,791;206.55seconds. |
| Workspace correction and model-review/recent identity fixtures | 63/63pass. |
| Thumbnail/progressive reader/facts/owned read fixture corrections | 32/32pass. |
| Upscale architecture contract correction | Pass; shared contextual host and domain confirmation remain explicit. |
| Full frontend TypeScript | Pass, no output. |
| Frontend ESLint | Pass,0errors and7 existing warnings. |
| Exposure guard and diff whitespace | Pass. |
| Fixture TypeScript | Pass using the fixture's own tsconfig; no production compiler setting changed. |

These groups overlap; do not add their counts. Initial failing logs and focused
corrections remain separate from final lane results. Fast's existing skip is the
absence of local Codex authoring validators. Integration's existing skips are two
`EDITORIAL_TEST_DATABASE_URL` opt-ins and the explicit Remotion Chromium render
opt-in, which is prohibited in this local IAB-only task.

The real whole-branch CI selector requests Fast, Integration and Browser, with
exhaustive tariff replay false. The three non-browser Studio integration files pass all four tests (77.93 seconds,
zero skips). Normal candidate and baseline builds now pass all gates; the required Browser CI lane remains outstanding. There is
no remote CI, push, PR, merge or deployment claim.

Reproduce commands with [the fixture guide](README.md). Each run writes source and
installed lock hashes, seed hash, harness hashes and PG/runtime qualification into
its redacted `runtime-manifest.json`. Public byte entries contain actual SHA256,
MIME, size, role and explicit public/private flags. Preserve those records, the
command logs and root's attributed IAB evidence in the chosen local investigation
directory before deleting scratch SDD reports. Never publish the private connection
file, session capabilities, auth cookies, control bearer or disposable DB URL.

A first schema bootstrap exposed a missing dependency in the preparation map:
authored migration34 must precede35. An initial bootstrap page path was intercepted
by ordinary i18n rewriting; the exported-only route now uses the API namespace.
Neither fix changes production auth, URL policy or SQL functions. Old private dev
logs had spent bootstrap query strings; redact them before retaining a shareable
artifact. Current runner logging removes query strings and the byte journal never
records signatures.

At this initial stage only functional fixture results had been recorded. Public IAB body fulfillment
and private S3 HTTP are distinct transports. Body bytes queued, actual useful image
quality, local latency and decoded media state must be reported separately. The
seed repeats20 measured physical originals under distinct logical URLs; one video
is a static portrait and others are excerpts. No field CWV, mobile-device, real CDN,
cloud expiry, native generic download or speedup conclusion follows from these tests.

Root IAB first functional observation (6719aec development, 1440×900, DPR1): 135 total,
30 loaded rows, no mounted video/audio readers, visible contain thumbnails decoded
through actual private grants. Screenshot `01-connected-dev-desktop.png` is retained
in the investigation directory. It exposed missing localized pagination and a 6px
horizontal grid overflow (clientWidth1096/scrollWidth1102). The pagination catalogues
now include English/French/Spanish labels; the 3px padding is outside the measured
virtualized scroller. Two focused regressions fail before the correction; all32
focused contract/compact DOM checks pass afterward. The later native IAB recheck passes (see final records below).

The first IAB image opens the measured 960×540 display at 746 CSS pixels; neighbor
images remain 320/180px thumbnails. One dialog and no video/audio nodes while reading;
Close removes the dialog and readers, restores the Preview button focus, and retains
the one-item selection. Root records these in `iab-functional-dev.json` and captures
01/02. Two further French labels exposed by this real run are corrected in
`7355a19bf`: singular selection and the YARL carousel/position accessibility labels.
Two targeted RED cases precede 38 passing compact/progressive/action-panel DOM checks.
The generic neighbor label “Output/Sortie” also appears between unrelated library
media; it is recorded as remaining copy polish because that owner also serves Gallery.

Additional Fast CI checks pass: engine catalogue (61 entries) and roster (60) drift,
model dataset audit (one existing family-resolver warning), and image alt quality
(340 files). Locale key parity passes. No schema, auth or browser policy was relaxed.


Both optimized exports build successfully through normal prebuild, Next compilation,
lint, types, static generation and postbuild, with configuration unchanged:
`b0fda4bbe1994deafa2020832d43f503dde38ded` and baseline
`5135e4e2b7ad04261d26b3f7669eb2ec8aded1db`. Each retains `build.log` and
`build-result.json`. Candidate production HTTP/bootstrap and real read-only SQL
reader checks also pass. The two apps are switched serially, with stable separate
PG/auth/storage controls. Builds and heavy checks are finished before timed work.

`paired-runtime-metadata.json` retains source, installed-lock, seed, fixture and
normalized byte-manifest hashes. Both have identical media keys/bytes/roles and seed,
376 registered objects, 96 public and 278 grant-required objects. Both use the same
installed dependency tree; their authored lock files differ because the candidate
adds React Aria, Uppy and YARL. This is a controlled dependency comparison, not a
reconstruction of historical installed dependencies. The build driver gained an
explicit connection path and `--no-start` after the candidate build; only that
orchestration helper hash differs. Runtime/seed/auth/S3/SQL helper hashes match.
At that stage alternating measurements and complete functional QA were pending; final evidence is recorded above.

Root optimized QA now verifies pagination/singular French copy, native grid width
1090=1090 without horizontal overflow, collection CRUD, two-item favorite/Trash/Restore
and reload persistence. A frozen135 selection excludes a later arrival; one truly
unavailable source produces134 confirmed/one failed, then explicit restoration and
failed-only Retry succeeds once. These are root IAB observations, not implementer
browser claims. Root confirms silent imported video playback (1280×720, readyState4,
playing, duration6s, no error). See [import evidence](IMPORTS.md) for independent
read-only proof of three imports, real chunk cleanup and no sibling reupload.
Full QA and alternating measurements were pending at that stage; final evidence is recorded above.

A prolonged-use IAB observation prompted a further real-hook regression: shared
mounted consumers exhausted automatic renewal permanently after the first successful
lease replacement. Controlled-clock RED reproduces the second genuine expiry being
blocked. The hook now arms a new single automatic attempt only at a successfully
issued replacement’s actual expiry, consumes it before requesting, and never rearms
from a failed renewal. Immediate grant200/media403 remains bounded; proactive checks
near a still-valid replacement expiry do not create false errors. All27 focused
renewal/private/progressive DOM tests pass. The open b0 runtime is intentionally
unchanged until root completes its current QA; this fix needs the next export.

Follow-up connected findings before the next optimized pin:

- The long-lived private reader now permits one automatic renewal after each actual
  replacement-lease expiry. Immediate grant200/media403 failures remain bounded;
  explicit Retry remains available. A controlled-clock real-hook test reproduced
  successive expiration with shared mounted readers, then passed with the fix.
- Native 390×844 IAB showed the zero-selection grid starting at632px. Mobile filters
  and collections now disclose their full controls, and selection commands open
  when selected. The page alone bounds height above the existing bottom navigation;
  shared modal hosts retain their sizing. Real DOM tests verify disclosures, original
  selection/reader behavior and focus recovery without stealing another control's
  focus. Native geometry still requires IAB recheck; no JSDOM geometry claim.
- A real-hook/queue/Retry DOM test confirmed the page import error persisted after
  the only failed file succeeded. The page clears that error after an all-success,
  stopped queue; successful siblings are not re-uploaded. Permanent invalid files
  remain failed and retain the error.
- The twelve synthetic jobs already existed. The actual `/api/jobs` failure was
  missing `generation_poll_state`, not missing job rows. Setup now installs the
  real47/53/59 schemas and fills settings via their real pure builders, without
  provider/Draft/financial writes. This additive complement is shared with baseline
  and recorded separately. Save097 created its exact output projection;098, which
  shares the original URL, remained unsaved (read-only SQL evidence).

A named import identity risk was also reproduced using the real Uppy SDK and default
import adapter: equal filename, MIME, size and lastModified with different bytes
collapsed two files into one queue result. Queue IDs now distinguish immutable File
objects; fresh selections pass through the existing server content identity. The
same File object can retry completion without transfer, and a fresh same-content
File restores its server-returned canonical asset. Tests inspect actual FormData
bytes at the external boundary, preserve non-duplicate SDK restrictions and verify
no client whole-file buffering. This is separate from the earlier transient-upload
Retry evidence and does not retroactively alter that run.

The IAB operator rechecked optimized source `1d94c6cf4` at390×844 after the mobile
correction: gridtop351px versus632px before,366px gridheight; gridwidth348 matched
scrollwidth348, documentwidth390 matched scrollwidth390, documentheight844. Gridend717
and Load more remained above bottomnavtop774. Filters/collections exposed all controls;
checkbox opened commands, Clear closed them and focused Select. Reader Escape returned
to the exact opener, with no mounted audio/video for an image. Desktop1440×900 retained
30 rows, gridwidth1090/scrollwidth1090 and526px gridheight. Screenshots08/09 and the
operator's attributed JSON remain in the external evidence directory. These are
native functional/geometry observations, not timing evidence.

Final runtime product source is `312eacdf526b82a3387abbb2ae00c5499693dc0f`. Its normal
optimized build passed with unchanged Next configuration. Actual jobs list12/audio1/
detail returned200 with settings; ordinary non-Draft workflow returned404. Candidate
and retained baseline have matching seed,376 object identities (bytes/MIME/role/key/
public-grant predicates) and the same12-job complement input/builders/migration hashes.
The separate verification helper and documentation added afterward do not change
that exported product. Build logs retain existing lint/Edge warnings and a handled
benchmark-lab latency fallback because the isolated schema omits
`generation_timing_samples`; this fixture does not qualify benchmark-lab behavior.
Tools/owners/native collision and comparative QA were pending at that stage; subsequent evidence is recorded above.

Subsequent native source312 Image reference-picker QA exposed focus falling to BODY
when its inline Preview hid the grid. The same host transition for Import reproduced
in a real AssetLibraryModal DOM test. The inline Back control now receives focus
once on mounting; queue progress and inline organization updates do not refocus it.
Import retains its exact initiating control for Back, and Preview's existing return
is preserved. No new host, portal or focus trap was introduced. Two RED tests became
GREEN;31 focused modal/grid/action/architecture tests pass, with types and scoped
lint clean. This correction is committed after312 and awaits grouped export/native
recheck. The312 runtime remains untouched during the operator's remaining tool QA.

Read-only availability diagnosis on312: `/api/engines?category=video` returned200
with `degraded:false`; Seedance2.5 explicitly projected `provider_disabled` for all
its modes under the fixture's provider-free environment. `engine_settings` exists;
this is the real runtime execution gate, not a missing media catalogue. The IAB
operator selected published Kling4.0 and observed reference/start/end controls
available; no generation was submitted. Do not add provider credentials or override
mode policy to change this result. Image Seedream's separate `pricing_error` comes
from absent `app_customer_tariff_state`, `app_customer_tariff_cells` and
`app_customer_tariff_cell_versions` in the disposable schema: the tariff owner fails
closed with `CustomerTariffUnavailableError`. Rates were not seeded or activated.
Native source insertion/basket/draft preservation can be assessed independently;
this fixture does not qualify paid generation or those image quotes.

Audio's generated-video picker additionally reads
`/api/jobs?surface=video&limit=60`. This exposed a fixture projection defect not caught
by the all-jobs/audio checks: the complement stored empty `render_ids` arrays on video
jobs, while the existing video-surface SQL intentionally excludes every non-NULL
`render_ids`. Zero results then reached a starter-playlist fallback whose schema is
outside this fixture. The exact HTTP request reproduced500 before correction.
The setup now writes SQL NULL for non-image primary surfaces and keeps image render
arrays and all36 output rows unchanged. The same guarded complement was applied to
both retained databases without app restart; inputSHA is
`8e07c99e1d65221367adef7f152273088da1d13a08b869b45b510288e99b0dc0`.
The real video query now returns200 with two jobs and original video URLs; all-jobs12,
audio1, detail and ordinary workflow checks still pass. `verify-jobs.ts` now includes
this exact consumer URL. No playlist, tariff, provider or fake-response setup was
added; empty-account starter-playlist behavior remains outside this fixture's coverage.

The operator subsequently confirmed private source-preview failures in native Angle
and Upscale on312 (screenshots11/12): the accepted source still pointed at its exact
canonical original, but the source panel requested that private canonical URL without
its lease. Real hook/panel tests reproduced identity loss during selection for both
Upscale images and videos and for Angle. The correction retains the full canonical
reference, facts, and read-access descriptors through selection. Angle prefers its
validated imageDisplay lease, then an original/thumbnail lease; Upscale's Original
and comparison views deliberately retain the original-quality lease. Neither reader
falls back to a private canonical URL. Shared read ownership handles expiry and
account retirement; media errors have one automatic attempt and explicit Retry.
Upscale unknown dimensions no longer probe a raw private original; video remains
manual with preload=none and pause/src cleanup on retirement or replacement.

Angle account drafts now serialize stable canonical identity/facts and read-access
descriptors through an allowlist, never transient grant URLs/expiry or local blob
URLs. Restoring a private descriptor requests a fresh lease. A pasted signed original
still reaches the live operation exactly as entered but is not persisted. Public
examples, paste URLs, and local upload previews retain their live display behavior.
No generation payload URL, provider/quote policy, or media identity is rewritten.
27 focused real DOM/read-owner/architecture/account-selection tests pass (one command;
this overlaps prior owner coverage), as do frontend types, scoped lint, i18n keys and
diff checks. Native rechecks on the grouped9df export are recorded above; gated hosts retain their stated limits.

Studio's native expanded action on312 was unavailable. Read-only authenticated HTTP
confirmed assets200 and a valid canonical ref resolving through
`POST /api/studio/media/resolve` with200; `GET /api/studio/conversation-projects`
returned404 `STUDIO_CONVERSATION_EDITING_DISABLED`. The real handler requires all
three Studio conversation/editing flags, absent from the fixture allowlist. No
release/auth bypass, project write, or Studio schema bootstrap was performed. The
Creator product-photo route likewise retains its real disabled local execution gate;
this fixture does not establish native Creator or Studio editing acceptance.

The same class was then reproduced without enabling Creator in nine real DOM
surfaces: Creator image/video/audio preview, source thumbnail, synchronized video
comparison, subtitle video/audio, Audio voice reference and Audio source-video
preview. Selected private descriptors now supply original-quality display leases
through the existing read-access owner; canonical URLs/refs remain in operation
inputs. Private posters cannot fall back to canonical URLs while grants are absent
or the owner retires. Media errors use the bounded owner renewal; playback remains
manual. Decoders pause and remove their sources when replaced/retired, including
Strict Mode effect replay. Result transport/retry ownership stays with its existing
operation owner. No Creator feature flag or tariff was changed.

Audio library selection now preserves read descriptors and measured facts, and its
account draft allowlist omits all transient grants/expiry. Restoration keeps the
canonical reference and requests a fresh lease. Real DOM tests cover missing/expired
grants, renewal, owner retirement, original identity, draft round-trip and exact
public/blob display. The focused existing Creator/Audio/Subtitle lane passed69 tests;
the subsequent final private-reader/comparison command passed26 (overlapping, not
additive). Types, scoped lint and i18n keys passed. Native Creator remains gated;
these tests do not claim native Creator editing acceptance. The initially identified direct-upload producer gap was subsequently included in
scope and corrected as described below.


Direct image/audio/video producers and both video completion paths now enrich
successful responses from the real exact-read owner after persistence. The stored
canonical or legacy row/fences define owner/ref/revision and the existing signer
provides temporary grants. A source replaced between acquisition and serialization
cannot supply a lease for a different original. Failed signing retains the genuine
descriptor with expired access; a failed lookup keeps only a private marker/ref and
never invents a revision. Both cases preserve upload success and suppress canonical
fallback. All successful upload responses use private/no-store caching.

The shared video client parser retains additive grants. Image and Video workspace
upload/selection adapters also had demonstrated descriptor loss; these now preserve
read fields into actual slots. Image draft parsing/persistence carries stable
owner/ref/revision only, and restoration requests fresh access. Pending slots mount
no canonical or empty-src media; retired video/audio decoders pause and release src.
Public/local blobs and operation original URLs stay exact.

The producer regression uses real route serialization, PostgreSQL17, exact-source
SQL/fences, SigV4 signer and consumer adapters, with external upload persistence and
byte decoding supplied as controlled boundaries. It is not a real-upload throughput
measurement. It also verifies signing failure, source replacement and unavailable
rows leave acquired success intact without an invented revision or grant. Actual
connected upload transport is separately documented in IMPORTS.md and was
rechecked natively on the final9df product pin. The focused producer/read-owner/metadata/
client/slot cohort passed85 tests; the final added conservative-failure cases passed
in the producer test separately (overlapping, not additive). Types, scoped lint,
exposure and diff checks passed. No SQL policy, release flag, quote or provider changed.


Final screenshots19/20 show the real candidate after verification. Mobile390×844:
135 results,12 mounted/decoded images, grid top351/end717, width348=scrollWidth348,
document height844 without a second page scroller, zero audio/video nodes. Desktop
1440×900:30 mounted rows, grid width1090=scrollWidth1090 and height526, zero AV.
Screenshot paths are local-only: `19-final-mobile-library.png` and
`20-final-desktop-library.png`. Earlier initial-useful-image snapshots are not final
decode counts. Browser ownership and all native observations belong to root IAB.

At the end of measured QA, the retained preview was optimized9df, synthetic A, `/app/library?view=saved`.
Baseline Next is stopped. Root reset its temporary viewport override to the ordinary
1280×720/DPR2, restored normal cache/unlimited throughput, disabled Fetch patterns,
and hid the IAB tab. These final preview settings differ from measured DPR1. Saved
private media use actual S3 HTTP without a public fulfillment pump; synthetic public
Recent media need the documented IAB operator transport. That preview limitation is
not a product failure. No shared Chrome session was used by the implementer.


Scoped review follow-up: SubtitlePreview's resize observer previously depended only
on canonical source URL. A frame mounted after delayed private access or recovered
by Retry could therefore miss observation and keep fallback caption geometry. The
effect now follows resolved access URL as well. Two actual component regressions
with a non-null subtitle document fail before the change, then pass with simulated
ResizeObserver notifications and frame cleanup/recovery assertions. The complete
private-source DOM file passes26 tests; frontend types and targeted ESLint pass.
This is a later Subtitle-only product correction, not part of the measured9df build.
Library, image-display/read and browse owners and locks remain unchanged; the whole
frontend tree is no longer identical to9df. Scoped re-review marked the finding addressed with no new breakage. The later
normal final build and read-only checks are recorded below.


Previous preview build (superseded by87dd below): immutable source `91c84bede7fb4e844d0f6b9d50b843f7d3648579`,
exported separately after stopping9df Next. Normal `npm run build` exits0 with
configuration unchanged and ordinary prebuild/lint/types/postbuild gates. No full
unchanged test suite or paired measurements were repeated. Postbuild checks pass:
anonymous assets401; one-use bootstrap307; actual browse/assets/ancillary200;
read-only SQL browse/saved/recent30 each with forbidden DDL rejected; actual12 jobs,
one audio/two video and intentional missing workflow404. These HTTP/SQL checks do
not claim another native browser run of the final source.

At that superseded91c stage, Library components, browse/read owners and shared
access hooks were identical to measured9df; SubtitleDocumentEditor.tsx was the only
changed product file. The baseline and9df apps had been stopped and their services
were then retained for review. The91c preview was subsequently stopped and replaced
by87dd. [final-preview-provenance.json](final-preview-provenance.json) now describes
that current87dd build and its broader exact product differences. Historical
measurements/screenshots retain their original source attribution.


Final reviewed source87dd37bc4ed423b2421329fdb281c5d99234ec98 has a fresh complete
source/controller-aligned runtime. The authored controller, bootstrap, seed, jobs
complement, storage fixture, migrations/schema and dependency inputs were unchanged
from91c. It starts with the original135 visible source identities and12 completed
synthetic jobs; no14-second native fixture or other extra source was introduced.
The final normal build passes with configuration unchanged and ordinary gates.

Root reports final pinned broad validation at that clean source: Fast11,027 passes
and1 existing skip; Integration1,792 passes and3 existing skips; Studio4 passes,
zero skips; every lane has zero failures. These are fresh final receipts, separate
from the historical9df Fast assertion failure and its focused correction above.
The final scoped review marks both whole-wave findings and the intermediate exact
output-facts regression addressed, with no new Critical/Important breakage. Required
remote CI and delivery authorization remain separate; no push or deployment occurred.

Bounded postbuild checks pass bootstrap307, browse/assets/header owners200, actual
read-only SQL readers30/30/30 with DDL rejected, and12 jobs including1 audio/2 video.
The new generated-video endpoint returns200 authenticated and401 anonymous for both
surfaces. Video lists exact outputs098/097/096 from job0 at5s960×54016:9,118 from
job7 at5s540×9609:16 and117 from job7 at5s960×54016:9. All have unknown audio presence
(null), preserved rather than invented. Upscale surface is empty because this seed
has no Upscale job. Pagination returns1 then4 distinct candidates. No Trash/restore
mutation was performed by the verifier; native root checks follow separately.

The previous91c controller was unexpectedly unavailable while its orphan Next still
answered401. The new development runtime briefly reached readiness during diagnosis;
it was immediately stopped. The old Next was then identified by its exact listening
port, PID/process group and captured export cwd, and terminated with scoped SIGTERM.
Its app port refused connections before the final build began. This brief development
overlap was not a measurement, and no performance claim includes it. No evidence
directory was removed. The unavailable old controller limits automatic cleanup of
its remaining services; any later cleanup requires explicit ownership verification.

Measurements still belong to9df. The final source also changes generated-video
picker visibility/facts and Studio active-surface reader lifecycle, in addition to
Subtitle geometry. Whole Library/frontend equality is no longer asserted. The exact
changed product paths and specifically unchanged display/read/browse owners appear
in final-preview-provenance.json, alongside the final build and redacted candidate
receipts. Completed final native observations and local archive attribution from
root are recorded below.


Final root IAB acceptance on87dd is complete. In Saved, searching096 returned one
asset; its confirmed Trash action succeeded1/1 and removed it from the search.
Upscale and Audio pickers then showed four exact generated video candidates without
096, while same-URL siblings097/098 remained separate. Restoring the single Trash
item succeeded1/1 and left Trash empty. Fresh route navigation/reopening restored
five candidates in Audio and Upscale, including096. Actual typed confirmation
inserted the source; Audio showed5s16:9 and returned focus to “Utiliser un rendu”.
Inline Preview096 played by native Space with readyState4,5s,960×540 and no media
error; Back released all dialog audio/video readers and restored its exact opener.
Upscale confirmed the restored source and played it natively with the same duration/
dimensions and no media error. Native checks used full route navigation; retained
hook revision cases remain separately covered by the actual DOM tests.

Transport qualification:096 is a synthetic public generated resource, registered
publicResource=true/requiresGrant=false. Its native playback used narrowly scoped
IAB Image/Media fulfillment, not private S3. The Upscale-specific generated endpoint
is empty because this corpus has no authored Upscale job; the visible Saved/general
generated path was tested natively, while actual Upscale-surface and historical
fallback cases retain their separate PostgreSQL coverage. No fixture policy/feature
flag was bypassed to expand native coverage. Private012 was separately opened through
actual S3 display access and decoded1024×1536 from its display-v1 WebP; closing left
zero readers and restored the exact012 opener.

Final acceptance screenshots `23-final-87dd-desktop.png` (1440×900) and
`24-final-87dd-mobile.png` (390×844) are retained locally. Both used DPR1 and explicit
full-viewport CDP capture. An earlier default23a capture and an810px clipped capture
are raw diagnostics, not acceptance screenshots. Desktop has30 rows and grid width
1090=scrollWidth1090, height526. Mobile has12 decoded images, grid top351/end717,
height366, width348=scrollWidth348, document width390 and zero audio/video nodes.
These final native observations are source-pinned in the local
`iab-functional-final-87dd.json`; no raw JSON, origin, capabilities or private paths
are published here. They are targeted functional checks, not repeated paired timings.

The final delivered IAB tab is hidden on the current87dd Saved view (111 saved
results). Root cleared the temporary viewport override, restored ordinary1280×720/
DPR2, cache enabled and unlimited throughput, and removed Fetch patterns. Chrome
remains unclaimed. Public synthetic Recent resources still require the documented
operator fulfillment; Saved private media use actual S3. No native Creator/Studio
release-gate bypass, paid generation or production action occurred.
