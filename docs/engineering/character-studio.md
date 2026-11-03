# Character Studio

The authenticated entry remains `/app/tools/character-builder`. The November 2026
first implementation replaces the creator UI without adding a second generation
pipeline. The approved proposal and phased scope live in
`docs/redesign/2026-11-03-character-studio-proposal.md` and
`docs/plans/2026-11-03-character-studio-implementation.md`.

## Ownership

- `CharacterBuilderWorkspace.tsx` retains account isolation and wires generation,
  references, billing-product reads, results, persistence and runtime overlays.
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

## Media

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
enabling the new endpoints; the application baseline bootstrap also includes it.
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
Database success paths run on disposable PostgreSQL 17. Browser QA covers desktop
1280×720 and mobile 390×844 navigation and honest unavailable states; this local
server has no database/provider configuration. No hosted migration or paid
generation was performed in this delivery.

## Compact editor and Recast draft (2026-11-03)

The editor now fills the available viewport below the shared header and above
`--app-bottom-nav-height`. The settings and results panels scroll independently;
the mode selector and generation dock remain outside the settings scroller.
Mobile switches between the editor and results without discarding either state.
The former title/back/new-character banner is removed; the accessible new-character
button is a compact plus next to Character / Recast.

`CharacterStudioNavigation.client.tsx` owns mode/navigation presentation.
`CharacterStudioOutputSettings.client.tsx` owns output/quality/format controls;
quality still normalizes the allowed format. The composer owns nine disclosures,
including new photographic type/presentation/adult-age choices. The optional
`traits.characterType` is whitelisted in sanitation, compiled by the server prompt
owner and retained through snapshots, without invalidating older requests.
The new original identity atlas is presentation only, as documented in provenance.

`CharacterStudioRecast.client.tsx` is explicitly a **local draft**, not a generation
integration. It accepts a local source video, a replacement image and optional
instructions, provides native manual playback with `preload="none"`, and keeps
those choices while switching modes. Blob URLs are revoked on replacement/removal
and unmount; leaving Recast pauses both readers. The account-keyed workspace owns
its lifetime. There is no upload, provider call, generated output, quote or debit.
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
