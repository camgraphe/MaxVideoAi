# Character Studio

The authenticated entry remains `/app/tools/character-builder`. The November 2026
first implementation replaces the creator UI without adding a second generation
pipeline. The approved proposal and phased scope live in
`docs/redesign/2026-11-03-character-studio-proposal.md` and
`docs/plans/2026-11-03-character-studio-implementation.md`.

## Ownership

- `CharacterBuilderWorkspace.tsx` retains account isolation and wires generation,
  references, billing-product reads, results, persistence and runtime overlays.
- `CharacterStudioComposer.client.tsx` owns the six collapsible groups and output
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

`frontend/public/assets/tools/character-studio/` contains five compact atlases.
The original generated images are illustrative catalogue choices, never uploaded
as the user's reference or inserted into result history. `provenance.json`
records their origin and each Poly Haven scene's source and CC0 attribution.
Hair cells retain square geometry, clothing/portraits 3:4, scenes 4:3; eye cells
are cropped in a wide frame without stretching their pixels.

## Checks and scope

Focused checks cover catalogue-to-prompt mapping, sanitation and settings
recovery, new-draft transitions, preserved legacy choices, and all existing
account isolation/race conditions. Run:

```sh
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/character-studio-behavior.test.ts tests/character-builder-account-lifecycle.test.ts tests/character-builder-workspace-architecture.test.ts tests/character-builder-server-architecture.test.ts
npm --prefix frontend run lint
npm run lint:exposure
pnpm --dir frontend exec tsc --noEmit
```

This first delivery does not create a durable named-character/looks database or
Recast jobs. The existing image gallery is accurately labeled “My images”.
MaxVideoAI Recast service identity, quotes/transactions and the proposed provider
cost multiplier belong to subsequent deliveries. No tariff or model registry
change is included.

Local browser QA used public frontend settings only. The page renders and edits;
the local database, wallet and tariffs are unavailable. A generation attempt
returned 503 before provider dispatch. The final UI disables authenticated
generation while its current price is unavailable and never retains a previous
quality's price during loading. Paid generation, real imports and durable
account media must be validated in an appropriately configured test environment.

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
