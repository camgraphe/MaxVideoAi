# Character Studio

The authenticated entry remains `/app/tools/character-builder`. The November 2026
first implementation replaces the creator UI without adding a second generation
pipeline. The approved proposal and phased scope live in
`docs/redesign/2026-11-03-character-studio-proposal.md` and
`docs/plans/2026-11-03-character-studio-implementation.md`.

## MCP and Studio integration (2026-11-06)

`server/character-studio/integration.ts` is the shared actor-aware owner for
saved identities, exact look selection and dedicated Recast. MCP and Studio
adapters use it rather than submitting a generic Wan quote. Character Builder
remains the creator of authored character/look recipes: generic generated images
cannot be saved as character recipes. Discovery supports case-insensitive exact
names and cursor pagination; duplicate names require an explicit selection.
Selection resolves the exact owned original, including looks beyond the first
page, into canonical Media. It neither generates nor charges.

The Studio character picker uses a separate `search` query for case-insensitive
literal name fragments, so `Dixie` finds `Dixie Trouble`. Filtering occurs on the
owned server query before its 12-character cursor page; pagination retains the
same search. The `name` filter remains an exact case-insensitive match for MCP,
the director and API callers. `%` and `_` have no wildcard meaning in `search`.
Both filters retain the 80-character limit and existing account/project gates.

The new MCP feature requires `MCP_CHARACTER_STUDIO_ENABLED=1`; purchase and
reference operations retain their existing independent gates. Studio additionally
requires `STUDIO_CHARACTER_STUDIO_ENABLED=1` and its existing conversational media
gates. These new flags are activated only in `character-studio-test`. Its MCP
resource is the exact stable test origin, not the production API. No wildcard
preview host is trusted. Metadata/SDK verification is separate from a real host
OAuth connection and does not establish automatic tool selection by that host.

The same `prepareRecast` materializes independent video/audio passages and obtains
the Character Recast commercial quote, currently provider cost ×2 in the test
policy. Duration, resolution, product and chosen original are immutable in that
quote. Its Recast binding and Studio journal entry commit in the same transaction.
Confirmation requires the exact amount, currency and explicit approval. The quote
is bound to the user, origin and OAuth client or Studio project; a generic Wan
quote cannot cross this product boundary. Concurrent/repeated confirmation
recovers the existing job and charge. Disabling execution prevents a new purchase
but retains accepted-job recovery. A temporarily missing accepted job is a
retryable recovery error, never permission for a replacement.

Character Builder and completed Recast gallery results use the shared Studio
continuation action. On explicit click it resolves the owned original into Media
before opening the film picker; a gallery index or thumbnail is never used as
source identity. Studio's named character/look picker imports that same original.
Project selection and timeline placement remain explicit, with account/request
cancellation on late responses.

Regression owners: `character-studio-integration-postgres`,
`mcp-character-studio`, `studio-character-recast-postgres`,
`studio-character-picker-dom`, and `character-studio-continuation-dom`, alongside
the existing financial, MCP client and Studio editor suites. Provider execution
is substituted in these tests; they do not authorize or certify a paid render.
No additional schema migration is needed beyond Character Studio migrations
93–95 and the existing Studio journal schema. Earlier dated sections below record
the implementation history; statements about the initial local-only Recast draft
do not describe the current hosted integration.

## Ownership

- `CharacterBuilderWorkspace.tsx` retains account isolation and wires generation,
  references, native image estimates, results, persistence and runtime overlays.
- `CharacterStudioComposer.client.tsx` owns the collapsible trait groups and output
  settings. Choice cards, reference slots and the exploration surface are separate
  colocated components. There is no composited or live generated preview.
- `character-studio-state.ts` owns new-character and inspiration transitions.
  Both reset only the editable draft; completed runs and refinements survive.
  Pending jobs remain owned by the existing polling hook.
- `frontend/src/lib/character-studio-catalog.ts` owns the shared eye, hair,
  wardrobe and scene IDs/prompts. Legacy hair/outfit IDs remain resolvable in
  `character-builder.ts`. New UI copy has EN/FR/ES projections.
- Optional `traits.eyeShape` and `traits.sceneId` remain compatible with old
  requests and schema-1 settings snapshots. Server sanitation rejects unknown
  new catalogue IDs. The prompt owner resolves IDs; the client does not concatenate
  hidden instructions into user notes.

A selected scene overrides the neutral studio instruction, including on a
character sheet. A bald selection excludes stale hair color/length constraints.
Free hair/clothing descriptions retain the existing override behavior and the UI
states that explicitly. Clicking another visual choice clears that override.

The image gallery mounts once, on its tab. Pagination attaches on tab activation
and observes the page viewport in grid mode. Old scroll-rail consumers retain
their existing hook behavior. Job IDs and exact original image URLs remain owned
by the current save/download/continuation actions.

## Generation readiness and price recovery (2026-11-05)

`useCharacterBuilderPrice` owns the current Nano Banana 2.1 estimate, selected
format/reference key, bounded request timeout, and explicit retry. The composer
keeps the price inside Generate and distinguishes loading from unavailable pricing.
A pending or failed replacement estimate cannot reuse an old amount or enable a
paid generation. Retry only reads a price; it never submits a generation. Image
traits and an uploaded photo remain optional; a pricing failure is not presented
as a missing character description.

Recast shows actionable missing-character/direction guidance near Generate and
highlights the corresponding controls. Motion video, written direction, dialogue
or reference audio are alternatives; a product is optional. Reading a file,
choosing its passage and retrieving a price have separate visible states. Exact
quote review and explicit paid confirmation retain their existing owner.

The local development server intentionally cannot read production-mode tariffs
from a remote database. Use the isolated deployed preview to exercise real prices
and generation; do not relax `customerTariffsEnabledByCode` or substitute a
production quote to make a local development button available.

## Media

### Recast character selection and video history (2026-11-05)

`CharacterStudioRecastPortrait` owns the character entry point and uploaded image
alternative. Opening it mounts `CharacterStudioRecastCharacterPicker`, which uses
an independent instance of `useCharacterStudioLibrary` with the workspace's
account capture. It loads saved characters and their paginated looks on demand;
it never changes the image editor's selected character or draft. Closing or
switching accounts retires pending responses. Failed list pagination retries its
original cursor and preserves earlier pages.

Picker cards use `LibraryImageThumbnail` for stored previews. Selecting an
identity or look sends its exact original image URL and source job ID through the
existing Recast preparation/ownership checks, with no upload or paid generation
on selection. It replaces only the portrait; source video, selected passages,
product, audio, dialogue, duration and format remain intact. The existing quote
key invalidates an unconfirmed price when that portrait changes. Native-dialog
cancel and selection restore focus, including when selection replaces the empty
opener with the Change character/look button. The account-keyed workspace remains
the owner of complete runtime isolation.

Recast navigation also exposes **My videos**, linking to the existing `/app`
owned-video history. Image history remains scoped to `surface=character`; Recast
jobs belong to `surface=video`. Neither entry point transfers preview media into
production. DOM coverage is in `character-studio-recast-character-picker.test.ts`;
account, payment and architecture suites retain their existing owners.

The marketing Recast CTA enters `/app/tools/character-builder?mode=recast`.
The account workspace consumes this mode only at mount, after auth resolves;
unknown values retain the character editor. It does not reset a saved draft,
select a reference or start a render. Subsequent tab choices stay under user
control, and the existing auth return target preserves the query string.

### Catalogue visuals

`frontend/public/assets/tools/character-studio/` contains compact image atlases.
The original generated images are illustrative catalogue choices, never uploaded
as the user's reference or inserted into result history. `provenance.json`
records their origin and each Poly Haven scene's source and CC0 attribution.
Hair cells retain square geometry, clothing/portraits 3:4, scenes 4:3; eye cells
are cropped in a wide frame without stretching their pixels.

## Checks and scope

The dated usability/competitor review lives in
`docs/redesign/2026-11-03-character-studio-usability-audit.md`. History loading,
empty and unavailable states are separate from pending generation cards.
`useCharacterBuilderHistoricalResults` projects feed failure as a boolean;
`CharacterStudioHistoryFeedback.client.tsx` owns localized feedback and retry.
Existing local outputs remain visible when remote history fails. Navigation's
new-character action is confined to character mode; mobile Explore explicitly
selects the exploration view. Custom hair/outfit descriptions take precedence
in collapsed summaries as they do in generation.

Focused checks cover catalogue-to-prompt mapping, sanitation and settings
recovery, new-draft transitions, preserved legacy choices, and all existing
account isolation/race conditions. Run:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/character-studio-behavior.test.ts tests/character-builder-account-lifecycle.test.ts tests/character-builder-workspace-architecture.test.ts tests/character-builder-server-architecture.test.ts
npm --prefix frontend run lint
npm run lint:exposure
pnpm --dir frontend exec tsc --noEmit
```

The saved-character delivery adds a durable named-character/looks library, described
below. The existing generation gallery remains separately labeled “My images”.
It does not create Recast jobs.
MaxVideoAI Recast service identity, quotes/transactions and the proposed provider
cost multiplier belong to subsequent deliveries. No tariff or model registry
change is included.

Local browser QA used public frontend settings only. The page renders and edits;
the local database, wallet and tariffs are unavailable. A generation attempt
returned 503 before provider dispatch. The final UI disables authenticated
generation while its current price is unavailable and never retains a previous
quality's price during loading. Paid generation, real imports and durable
account media must be validated in an appropriately configured test environment.

## Saved characters, looks and Recast handoff (2026-11-03)

`frontend/server/character-studio/` owns authenticated persistence and source
validation. Apply `neon/migrations/93_character_studio.sql` explicitly before
enabling the new endpoints. On a new database, bootstrap the baseline and then
apply the ordered migrations, including 00 (profiles) before 93.
No request creates tables. Missing schema/configuration returns private, no-store
503 responses and a retryable library error; no local success is fabricated.

`GET/POST /api/character-studio/characters` lists/saves characters;
`GET/PATCH /api/character-studio/characters/[characterId]` loads/renames them.
Lists page by immutable ID (12 identity summaries); detail pages contain the
identity recipe and 24 looks. Bodies are bounded and names are trimmed to 80
characters. Every read/write is account scoped. The composite look foreign key
prevents cross-account parent links; unique output keys make retries idempotent.

A save accepts only a job ID, exact original URL and display name. `source.ts`
verifies an owned, completed, visible Character Builder job and its output
projection. The stored recipe and thumbnail come from the server. A stored
`builder.characterId` determines which identity receives a look, regardless of
the draft currently open in the browser. Original URLs remain distinct from
display thumbnails. Saved records reference media; they do not create a second
copy or change media retention. A deleted/hidden identity source cannot start a
new look until it is available again.

`character-studio-look.ts` builds a new look and binds identity fields to the
saved recipe. The server resolves ownership and revalidates the original before
the existing generation runner can dispatch. Hair, clothes, accessories and
scene remain editable; the original identity reference is strong/strict. The
optional `characterId` travels through request, snapshot, draft and settings
reuse; a legacy snapshot or New character clears the context. This guides an
AI generation, so visual identity fidelity still requires review of the output.

`useCharacterStudioLibrary` owns account-scoped requests and guards late responses.
`useCharacterBuilderDraftScope` adds a shared draft revision for identity/look
loads, historical settings reuse and reference uploads. New look, settings reuse,
New character and inspiration invalidate older draft operations even within the
same account; generation completion and durable saves keep the account lifetime.
`character-studio-transitions.ts` owns these navigation/reset transitions.
Switching Character/Recast modes preserves the editable draft and its pending
reference uploads; clicking the already active mode is inert. A real mode change
still cancels pending library detail selection. Inspiration selection announces
the applied name and the visible styling sections; the mobile new-character
editor exposes a named Explore action below the photo entry.

Library retries repeat the failed list/detail read with its original character
and pagination cursor, preserving already loaded characters and looks. Rename
and presentation PATCH responses apply only their respective field, so a late
response cannot overwrite another completed edit. Mutation errors stay attached
to the detail selection that initiated them. The image-history media-save action
names My media explicitly; keeping a character/look uses the existing typed save
dialog label when the result's lineage is already known.

`CharacterStudioWorkspaceView` owns layout/tabs and `CharacterStudioOverlays`
owns dialogs/lightbox composition. Results expose Save and Recast; Mes personnages
exposes rename, New look, saved looks and Recast. New look opens styling controls
with an identity banner. Save resolves the clicked result's recipe before naming
it; the native dialog provides keyboard focus/cancel handling.

Recast receives the chosen **original** and name with a unique transfer ID. It
stays mounted between modes, preserves the source video and instructions, and
revokes only local blob URLs. This handoff makes the existing draft usable; paid
video generation, provider routing, quotes and transactions remain a later slice.

Focused coverage: `character-studio-library-postgres`, `character-studio-routes`,
`character-studio-look`, `character-studio-library-client`, `character-studio-ui`
plus the existing account lifecycle and workspace/server architecture suites.
Database tests use disposable PostgreSQL 17. The local test preview was also
verified with a persistent PostgreSQL 17 database, migration 93, loopback S3
storage and the Google Vertex image provider. An authenticated browser saved a
starter portrait, generated one look, reopened it after a reload and handed the
original to Recast. A local wallet credit permits testing the normal reservation
and charge path. Provider usage is real. For a development preview without GCS,
`GOOGLE_VERTEX_IMAGE_INLINE_ONLY=1` limits input references to 7 MiB each.

## Compact editor and Recast draft (2026-11-03)

The editor now fills the available viewport below the shared header and above
`--app-bottom-nav-height`. The settings and results panels scroll independently;
the mode selector and generation dock remain outside the settings scroller.
Mobile switches between the editor and results without discarding either state.
The former title/back/new-character banner is removed; the accessible new-character
button is a compact plus next to Character / Recast.

`CharacterStudioNavigation.client.tsx` owns mode/navigation presentation.
`CharacterStudioOutputSettings.client.tsx` owns the always-visible Portrait / Character
sheet cards and 1K / 2K / 4K selector in the generation dock (updated 2026-11-05).
Native radio groups preserve selection and keyboard navigation. Existing public portrait
and sheet examples illustrate these cards through small, lazy Next Image requests.
The live per-image price sits inside Generate with the shared app action/price styling;
the accessible price label repeats the selected resolution. The workspace remains the sole pricing
reader, with generation disabled when that price is unavailable. Resolution selection
normalizes legacy quality/format state. `CharacterStudioAdvancedSettings.client.tsx`
owns the collapsed consistency, reference-strength and additional-direction controls
inside the settings scroller, preserving the saved-character identity restrictions.
The composer owns nine trait disclosures,
including new photographic type/presentation/adult-age choices. The optional
`traits.characterType` is whitelisted in sanitation, compiled by the server prompt
owner and retained through snapshots, without invalidating older requests.
The new original identity atlas is presentation only, as documented in provenance.

`CharacterStudioRecast.client.tsx` is explicitly a **local draft**, not a generation
integration. It accepts a local source video, a replacement image and optional
instructions, provides native manual playback with `preload="none"`, and keeps
those choices while switching modes. Blob URLs are revoked on replacement/removal
and unmount; leaving Recast pauses both readers. The account-keyed workspace owns
its lifetime. The draft sends only timing and mode to the read-only estimate route. It does not upload media or reserve funds.
The disabled generation action explains that generation is not available. No
provider name or hypothetical tariff is shown. Durable Recast jobs and the public
service identity across billing/transactions remain a separate delivery.

Verification: 30 focused tests, TypeScript, lint (seven pre-existing warnings,
zero errors) and exposure checks. IAB checks cover a normal desktop, 1280×720,
390×844 and 320×700, navigation, selected cards and the fixed dock. At 320px the
document is 320×700 with no horizontally overflowing controls and the dock ends
at y=621, above the app navigation. A repository public 8-second dance fixture
verified local video import/playback, image import, instructions, tab preservation
and pause-on-leave. Test media was removed afterwards. Paid generation and
remote image uploads remain unverified in this environment without database keys.

The Scene disclosure also offers `traits.customSceneDescription` above the image
catalogue, limited to 1,000 characters in the UI and server sanitizer. It can define
a scene by itself or refine a selected preset; explicit directions take priority
in case of conflict. Either suppresses the neutral studio background instruction,
including on character sheets. The field follows existing draft/snapshot storage
and resets with New character. No reference image is generated or uploaded by this
text control.


## Nonhuman and custom character concepts

The type selector retains Naturel/Singulier/Exagéré and adds animal, insect,
fruit-head and alien choices. The original `creatures.webp` atlas adds 44 KB,
with four fixed square cells; provenance records its generation prompt and source.
These are inspiration thumbnails, never generation inputs.

Optional `traits.customCharacterDescription` is limited to 1,000 characters by
both the editor and server. Nonempty text replaces the selected type prompt;
selecting a card clears the text, matching hair/clothing overrides. Draft and
settings reuse preserve it; New character and inspirations reset it.

`trait-prompt.ts` owns trait-to-prompt compilation, while `prompt.ts` composes
references, layout and output instructions. `hasFlexibleCharacterAnatomy` in
`traits.ts` identifies nonhuman presets or a custom concept. Supporting appearance
choices are conditional on compatibility with that concept, and reference images
must not override its species/material. Portraits, sheets and full-body repairs
use concept-appropriate framing/textures instead of requiring human skin or feet.
Default/legacy human prompts retain their existing behavior.


Verification for this addition: 36 focused behavior/account/architecture tests,
TypeScript and exposure checks pass; frontend lint has no errors (seven existing
warnings elsewhere). Local IAB checks at 1227×1112 and 390×844 verify actual atlas
rendering, selected cards, custom override, persistence after reload and clearing
text on a new preset. At 390px the document remains 390px wide and Generate stays
above the bottom navigation. The local tariff remains unavailable, so no paid
character generation was performed; the new images are catalogue assets only.

## Custom colors

Hair, iris and complexion palettes share `CharacterStudioColorPicker.client.tsx`:
a compact Other chip opens a native color control plus a hex field. Apply commits
a valid choice; Cancel/Escape leave the existing trait unchanged. Presets close
the custom editor, and a custom chip can be removed. Other chip groups keep their
existing behavior. The panel stays in the settings scroller, preserving the fixed
generation dock.

`character-studio-colors.ts` owns color-key detection, strict hex normalization
(`#RGB`/`#RRGGBB` → uppercase `#RRGGBB`) and generation wording. Custom colors use
the existing trait `value`, so source-mode normalization, account-scoped drafts
and schema-1 settings reuse need no new storage format. The server accepts named
catalogue colors, auto/null and validated hex for these three fields; unsupported
values are discarded. Prompts identify hair, iris or skin/surface and treat the
hex as an sRGB reference adapted to scene lighting, not a pixel-exact guarantee.
Bald/custom-hairstyle overrides still suppress contradictory hair-color text.

Verification: 40 focused tests, TypeScript, exposure and lint checks pass (the
same seven unrelated lint warnings remain). IAB checks at 1227×1112 and 390×844
cover native-picker opening, invalid hex, apply, cancel, removal, preset return,
persistence after reload and the color summary. No horizontal overflow at 390px;
Generate remains visible. The existing local cookie-policy warning and unavailable
tariff remain unchanged; no paid generation was submitted.

### Product and dialogue in the Recast draft (2026-11-04)

A replacement portrait and a product photograph occupy independent slots. A
handoff changes only the portrait. The Direction / Dialogue switch retains the
scene instruction, optional spoken line and optional MP3/WAV performance guide.
Audio input has a 15 MiB file cap. The applied passage, rather than the original recording, is limited to 15 seconds. Unmounting
the editor, replacing or removing media and navigation must not leak object URLs
or let a delayed audio probe replace a newer selection. Leaving Recast pauses
its video and audio players.

The shooting brief is a local JSON export of the source name, stable character
and product roles, dialogue, audio filename and assembled prompt. It contains no
blob URLs or private grants; keep the actual media beside it. It neither uploads
nor orders a render. At this stage the in-app video submit was unavailable. The private
marketing review used five distinct saved looks and corresponding authentic
YouTube source clips; offline sources and connected-account quotes do not imply
approval to publish a demo or change a production tariff.

### Character Studio image policy, casting notes and sheets (2026-11-04)

New portraits, looks and sheets all use Nano Banana 2.1, one image per request.
The display and wallet use the same resolution-specific image tariff and displayed
revision. Old jobs keep their original engine, settings and receipt. Do not
multiply the current image tariff by a historical quality or format quantity.

Migration 94 adds owner-scoped editorial casting notes to the saved character;
these editable notes are separate from the immutable source and look snapshots.
Unset notes display the localized generation choices. Only the stored source
image is the identity reference; no assumed personal attributes are inferred.
The library's sheet action opens a 1K draft with a neutral background and four
large aligned views. Generation is still an explicit user action. The eight-view
sheet remains available from the ordinary composer on a fresh draft. The saved sheet
viewer keeps the original file intact alongside the identity reference.

### Duration and estimated price in the Recast draft

The draft suggests the length of the selected video passage, then that of the
selected audio passage, then the script length at the Audio tool’s 150 words per minute.
A direction without timing starts at six seconds. Suggestions round up to whole
output seconds. An explicit selection takes precedence until the user chooses
the automatic suggestion again. Overlong speech remains visible for editing.
A reference clip can be up to 15 seconds, with at most 30 seconds of combined
input and output. The draft preserves fractional source seconds for pricing.

The read-only Recast estimate projects the requested duration and source duration
into the current 720p model price. Editing local media or the duration invalidates
the displayed estimate. The isolated development preview can opt into the public
price reader with CHARACTER_STUDIO_PREVIEW_PUBLIC_PRICING=1. Only the normalized
mode, audio flag, resolution and durations are sent. Reserving funds would require
a separate server quote from owned media, including its verified duration.


Recast uses the same lazy `VideoExcerptSelector` as Modify. Local MP4/MOV (up
to 100 MiB) and MP3/WAV (up to 15 MiB) retain their original object URL. A file
over 15 s requires an explicit selection before a price or brief is available.
Shorter files default to the whole track and can be trimmed too. Cancelling
leaves the committed range unchanged. The local readers are cued and bounded to
the selected interval. The JSON brief records each original name and its separate
`videoPassage` / `audioPassage` (startSec inclusive, endSec exclusive and
originalDurationSec). This is a non-destructive edit list, not encoded media.
The Recast purchase action uploads local originals to the authenticated account
and sends the independent ranges to the existing video and audio excerpt workers.
Their distinct, measured assets are the references in the wallet quote. The
server resolves a saved portrait from its original Character Builder output.
Preparing a price can be cancelled without clearing the scene. Cancellation
aborts its upload/quote requests and removes pending upload cache entries;
a failed upload also cancels its pending siblings, while successful owned
uploads remain reusable. Multipart cleanup retains
its independent request so cancelling does not suppress cleanup. Late responses
cannot overwrite a newer attempt. Upload error strings and structured errors
retain their cause, with image/video/audio-specific replacement guidance.
Resolution (480p, 720p or 1080p) and framing (Auto, 9:16, 16:9, 1:1, 3:4 or
4:3) participate in the brief, estimate and exact request. The default is 720p Auto.
The second click confirms the reviewed quote ID, amount and currency. Any edit
retires that review. Migration 95 binds Recast quotes to their owning account
and canonical request in the quote transaction. The shared reservation service
verifies price, references, scope and expiry and claims one job per quote.

The isolated loopback preview can explicitly opt into
`CHARACTER_STUDIO_RECAST_REHEARSAL=1` with its local test database and MinIO
bucket. It encodes and probes the selected passages locally, then shows their
published price. It issues no confirmable wallet quote. Live ordering defaults to off. Enable `CHARACTER_STUDIO_RECAST_LIVE_ENABLED=1`
only for a qualified environment with a private HTTPS storage backend and an enabled provider for the selected mode.

### Recast passage regression checks (2026-11-04)

`lib/media-excerpt-timing.ts` removes subtraction noise only within floating-point
precision. The shared selector, range validation and Recast request use it so
1.1–16.1 seconds is accepted as a 15-second passage. Start/end values and
frame-derived fractional minima retain their precision. Recast's native readers
pause at the selected endpoint and cue the beginning on replay.

`character-studio-recast-pricing-ui` exercises real React controls and transport
with controlled HTTP/media boundaries: independent selections, cancel, file
replacement, late responses, reviewed-price invalidation, cached original uploads,
manual/automatic output timing and all three resolutions. The media-content test
decodes the prepared late video/audio sections to verify their content, not only
their duration. The PostgreSQL quote/charge test keeps its simulated provider.
See `docs/redesign/2026-11-04-character-studio/recast-test-report.md` for the local
rehearsal results and remaining live-browser/provider verification limits.

### Price and payment validation (2026-11-04)

`tests/helpers/character-recast-harness.ts` creates a disposable PG17 ledger and
reviewed test tariff cells through the existing append-only owner. It substitutes
only the provider execution and excerpt storage boundaries; preparation,
normalization, ownership, quote locking, reservation and receipts remain real.
The price matrix covers three modes, three resolutions and three durations,
independent 7.5 s video / 5.25 s audio excerpts, all six framings and input/output
limits. Nano Banana 2.1 creation/editing checks cover one image at 1K/2K/4K,
including the displayed tariff revision and immutable receipt. These fixtures
establish consistency, not approval of a new commercial tariff.

Wan 3 Prime reference mode preserves explicitly numbered reference order, just like its
video-edit mode. The Recast brief explicitly identifies image 1 as the character
and image 2 as the optional product. Never sort these by asset ID: that can change
the meaning of a product scene.
`prepareRecast` authors contiguous slots for character, product and audio.
Historical Wan `ref2v` requests without slots retain their original canonical
ordering and hash; already stored slot-bearing preview requests also remain
unchanged. Normalization must never add slots to historical requests while
reading a quote, because that would reject an already paid job before recovery.
`tests/wan-prime-reference-compatibility.test.ts` locks both request hashes and
prepared/claimed/accepted reads, retaining rejection of tampered hashes.

The confirmation UI retains an uncertain purchase after network failure, keeps
the setup locked and offers recovery using the same quote even after expiry.
Only a definitive rejection allows a new review. The server already recovers
claimed/accepted quotes before enforcing expiry; it never resubmits them.
Insufficient funds offers a billing link in a separate tab, and the same reviewed
quote can be retried after topup. The server remains authoritative for funds.
This purchase recovery lasts for the mounted draft. Leaving while confirmation is
pending or uncertain triggers a warning; a local scene draft never restores a
purchase token or starts another render automatically.
An external Character handoff during this lock is rejected with an explanation;
it cannot replace the recovery action or apply itself silently after unlocking.
A new explicit selection is required. The selection effect also preserves an
initial handoff through React Strict Mode's effect replay.

### Local scene recovery and reset (2026-11-06)

`useRecastDraft` owns one IndexedDB scene per signed-in account on this device.
It serializes saves, flushes edits on route unmount, and restores drafts younger
than seven days. `recast-draft-store.ts` persists original Files, selected video
and audio ranges, portrait/product references, direction, dialogue, duration,
resolution and framing. It never persists blob URLs, estimates or purchase tokens.
Fresh object URLs are created in effects and metadata revalidates restored ranges;
React Strict Mode replay must not revoke the current playable URL.

New scene uses an in-page dialog when content exists; never use `window.confirm`
for this action because it blocks the host browser. Initial focus and Escape keep
the scene, and cancel restores focus to New scene. Only explicit confirmation
clears the account draft and remounts the
form, canceling pending price preparation and ignoring a stale character handoff.
It is disabled during confirmation/recovery. Storage failures remain visible and
protect reload/window close and ordinary link navigation. Browser storage is a
device-local convenience, not a cross-device backup. Every restored scene requires
a fresh exact quote. The mode is retained in the URL across reloads.

On mobile, output settings and quote details are collapsible; the selected
resolution/format/duration and exact price remain visible. Desktop retains the
expanded controls. `character-studio-recast-pricing-ui.test.ts` covers scene
restoration, independent passages, reset races, failed storage, account separation
and uncertain-payment locking. The payment UI tests continue to target the actual
purchase action, independently of the new disclosure buttons.

For local Studio QA, enable the conversation, actions, editing and media flags in
the isolated development launcher as well as `STUDIO_CHARACTER_STUDIO_ENABLED`.
Studio's shared `isStudioSameOriginRequest` keeps production origin checks intact.
In development only, it accounts for NextURL's loopback normalization by requiring
the exact `127.0.0.1`/IPv6 Host, matching protocol and port, a canonical Origin and
no cross-site Fetch Metadata. `studio-conversation-editing-route.test.ts` covers
the local request and rejects foreign hosts, ports, paths and cross-site requests.

Recast PostgreSQL tests verify expired/tampered quotes, tariff revision changes,
fund depletion, concurrent confirmation, lost-response recovery, one-time refund,
unknown provider acceptance and a failed output copy followed by storage recovery.
The copy test uses the actual Alibaba poll owner against the disposable ledger;
provider task reads, storage and media projection adapters remain simulated.

### Hosted preview and commercial policy

A hosted preview may run real paid generations. It needs its own migrated test
database and accounts/wallet, HTTPS media storage reachable by the provider,
provider credentials/routing, working excerpt workers, and a poller targeting that
same database until originals are durably copied. Do not assume production cron
automatically follows a preview. The localhost-only rehearsal is a different mode.
See `docs/redesign/2026-11-04-character-studio/preview-and-pricing.md` for the
current setup evidence, proposed tariff comparison and content promotion path.

## Public marketing (2026-11-05)

Character Studio keeps the existing `/tools/character-builder` intent owner and
its FR/ES localized paths. Landing orchestration remains in
`src/components/tools/character-builder/landing/CharacterBuilderLandingView.tsx`;
section JSX and scoped responsive styles are colocated. `toolMarketing.characterBuilder`
copy supplies visible FAQ/steps and their existing structured-data owners. Retain
metadata titles/descriptions until a separately measured snippet change is approved.
The Outreach baseline and media provenance live in
`docs/redesign/2026-11-05-character-studio-marketing/`.

Optional Recast demonstrations use `server/character-studio/marketing-demos.ts`.
The public direct-membership playlist `character-studio-recast` owns placement;
only the two reviewed independent marketing copies are projected to the client.
No private job or personal media URL fallback. Failure or a 1.5-second catalog
budget yields explicitly labeled frame images, not a disabled or fake player.
Publishing those examples still uses the existing admin marketing-copy workflow;
do not seed public production rows from the preview database. Manual playback
uses `PublicVideoPlayer` and retains original fidelity, no preload and a deferred
poster. The shared Tools catalogue and public hub show major workshops first,
with Character Studio as their first workshop; quick tools remain below.
