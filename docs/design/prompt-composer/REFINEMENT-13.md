# Image gallery and Audio composer parity

2026-10-29 · draft PR #555.

The Image workspace now uses the same creation/gallery navigation and responsive
rail widths as Video in the assistance preview. At large desktop sizes the rail
is 280 px instead of 320 px (12.5% narrower). Activity, Recents and View all sit
above the rail; the former Latest renders/View all row is removed. The first
image aligns with the preview. Mobile retains explicit gallery shortcuts and
an Activity/Recents switch above the cards. The existing image gallery, pending
jobs, starter shelf, preview actions, original media and generation flow stay
with their current owners.

Recents uses the shared account-scoped completed-image feed and its existing
cache. It starts loading only when opened, with no new initial-page request or
polling timer. Choosing an image opens the existing Image add/replace
confirmation; full slots require an explicit replacement. Insertion still uses
the guarded image library callback. View all opens `/app/library`.
`ImageWorkspaceShell` now owns `AppCreationContent`; loading and empty surfaces
keep the same navigation. Production with the assistance flag off retains its
previous rail layout.

Audio's page-wide focus and minimum-height rules no longer override controls
inside the shared prompt composer. The textbox uses the rounded outer focus
border, and Send remains circular at 38 × 38 px. Keyboard focus remains visible
on buttons and the page's other controls. No audio setting or submission logic
changes.

## Verification

- Real-component browser fixtures, with only host/auth/network adapters replaced,
  cover Chromium and WebKit. Image checks 390, 768, 800, 1105 and 1440 px:
  rail/navigation alignment, one exposed View all link, no duplicate rail title,
  Recents lazy load, exact-original reference insertion, explicit replacement,
  preserved prompt and no horizontal overflow.
- Audio checks all five intents, light/dark themes, 320/390/1105 px, empty and
  populated conversations, textarea focus, circular Send geometry, keyboard
  indicators and touch font size. The fixture includes the real Audio page CSS
  wrapper that was missing from earlier component-only coverage.
- Image workspace/session architecture checks and existing recent-media tests
  remain part of validation. TypeScript and ESLint are run for the patch.
- Live Image review confirms the narrower rail, aligned first card, functioning
  Recents and Media link. Audio's corrected focused composer was visually
  reviewed with synthetic conversation data. No generation or paid LLM call was
  made and the live user's draft was not edited.

The development-only assistant simulation and the previously documented local
Draft billing limitation are unchanged. This refinement does not qualify the
assistant's paid production backend or deployed Draft quotes.
