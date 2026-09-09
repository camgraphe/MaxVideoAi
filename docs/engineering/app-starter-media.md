# App starter media and first creation

Video keeps the existing `STARTER_PLAYLIST_SLUG` / `starter` playlist through
`listStarterPlaylistVideos`, including visitor mode and the empty owned video feed.
No homepage source, composition, encoding or manifest was changed.

Image and Audio use `starter-image` and `starter-audio`. Migration
`43_app_starter_playlists.sql` creates the editorial containers idempotently without
changing existing contents or inserting fake generations. Apply it through the
normal application migration process. It has been exercised twice on local QA
PostgreSQL only, not on production.

`frontend/lib/starter-media.ts` owns the bundled selections; the read-only
`frontend/server/starter-media.ts` reads ordered public playlist entries and uses the
bundled selection when the playlist has no admissible media or is unavailable.
`/api/starter-media` returns only these public fields. Unknown origins and signed URLs
are excluded, and each query filters the requested surface before its limit. Admin
playlist candidate search now admits audio-only jobs. Editorial playlists override
bundled samples; these built-ins are not database generation records.

`StarterMediaShelf.client.tsx` displays the collection outside owned history. Image
uses it in the empty rail, with a button that sets only the prompt; it does not switch
models, charge, generate, save to Media, or pretend the displayed artwork came from
the currently selected model. Audio contains one English spoken voice, the existing YouTube electro-funk
instrumental, and a newly generated English song. The sample categories are explicit;
these are demonstration excerpts, not account-owned generations.
Playback is manual with `preload="none"`; a new sample pauses the previous one.

## Artwork and delivery

The final generated artwork is deliberately playful and specific: Night shift (a
raccoon at the laundromat), Acid portrait (flash-lit punk portrait), and Disco motel
(pink desert and tennis-ball pool). Generated with the built-in image tool on
2026-09-09; no attribution to an app model is claimed. Earlier generic product,
portrait and observatory drafts were not included in the app.

The repository ships 1024px WebP display files at 178714, 142914 and 181678 bytes
respectively (503306 bytes total before responsive Next Image delivery). Filename
suffixes are content hashes. Never replace bytes under a retained hashed filename;
prepare a new file and update the catalog. Original PNGs remain in the generation
archive; no download/edit-original action is offered by this sample shelf.
Responsive images are lazy with fixed square geometry. Audio display copies use hashed filenames and manual playback. The 10.34-second
voice is the original 128 kbps mono output (167068 bytes). The instrumental is a
24-second, 128 kbps excerpt (384983 bytes). The song is a 28-second, 128 kbps excerpt
of the second chorus and ending (448931 bytes), starting at 49.5 seconds, with a
1.5 dB reduction and short fades. Original full tracks are preserved outside the
public display directory. See `evidence/app-starter-audio-2026-09-09.json`.

## Validation and limits

- Focused starter, Image, Audio and admin playlist contracts: 30 tests passed.
- TypeScript and frontend ESLint passed for the starter changes.
- Browser: new-account Image shows the three samples; clicking the first fills the
  prompt and leaves generation manual. At 390px viewport, document width was 378px
  on both Image and Audio. Desktop Image screenshot verified the right sample rail.
- Audio rendered three manual controls; all had `readyState=0` before interaction.
  Native first-play and Safari/iOS playback have not been validated in this session.
- Public starter API returned 200 anonymously. Migration was run twice successfully
  on disposable local QA tables after matching their deliberately minimal schema.
- These are functional/loading-policy observations, not comparable production
  Core Web Vitals evidence. Production build, cold/warm performance comparison and
  field metrics remain rollout checks.

## Related acquisition work in this branch

The first signed-in video visit stays in the composer with its existing starter feed.
Studio presentation is public while editor routes still use central access checks.
Media and Activity empty states distinguish examples from owned assets. Explicit
same-tab sign-in preserves a guest form snapshot for 30 minutes with a one-use token;
URLs contain no form text. Image storage is scoped per account; the old ambiguous
unscoped draft is deliberately not imported into a different account.

Before the starter addition, the full suite ran 5347 tests: 5342 passed and five
integration cases refused the local QA environment file. Removing that file and
rerunning the affected integration cases plus feed-policy checks passed all 15 tests.
The editor suite passed all 532 tests. This is not a claim that the full suite was
rerun after the final starter addition. No app generation, customer-wallet charge, production database change or deployment
was performed. The subsequent audio replacement used two explicitly requested
provider generations: one MiniMax Speech-02 HD narration and one MiniMax Music 2.6
song. The instrumental reuses the existing YouTube generation. Native accents and
subjective music quality still need listening feedback; transcription verifies words,
not accent quality.

### Gallery selection and composer synchronization

Video sample selection (rail clicks and guided previous/next arrows) uses the existing gallery `open` action to apply the prompt and basic settings immediately, then hydrate the saved job settings. The composer and its reference state use the confirmed draft owner, including the isolated public visitor scope; upload and private-library commands still require a confirmed account. Pricing continues through the existing preflight for the resulting form.

Job recall tracks its own immediate settings commit and rejects replies superseded by another selection, a subsequent draft edit, an account transition or unmount. This prevents the immediate tile update from invalidating its own detail request. DOM coverage in `workspace-active-draft-dom.test.ts` exercises signed-in and public recall, reference restoration, and stale replies.

### Release qualification, 2026-09-09

The final acquisition and responsive changes passed an isolated Node 22 production
build, including model-registry, public-rendition and home-poster prebuild gates,
frontend lint and type checking. Locale parity, SEO and public-media-origin checks
also passed. Gallery synchronization passed 42 focused tests; responsive toolbar
and shell contracts passed after the final CSS changes.

The broad test run used PostgreSQL 17. Environment/history-dependent cases were
rerun from a committed isolated snapshot with source ancestry. Real local OAuth/MCP,
owner-scoped montage HTTP, missing-migration rejection and Studio route access passed.
One Studio browser integration timed out during its initial page navigation; it
remains unqualified rather than reported as a pass. Production schema/configuration,
preview end-to-end generation/payment/MCP and field performance remain release gates.
The actual app configuration was restored after QA; anonymous video history returns
the configured welcome playlist with 11 accessible MP4 previews.
