# Refinement 6 — common command bar

2026-10-28. Adrien selected the “Barre commune” proposal and asked to see it adapted in the app, in draft PR #555.

Video / Image / Audio share a compact row with the visible creation operations above the composer. They wrap into two groups when space is limited. The alternative with two permanent rows was reviewed; the common row was chosen to preserve conversation space. Video and image use this layout; audio retains its dedicated intent/settings arrangement.

The selected video/image model moves beside References and opens the existing model picker. Its old standalone strip and Previous settings action are omitted in this development preview. Keep all existing picker availability and selection callbacks. Required source inputs remain directly accessible before writing.

The assistant has a single outer boundary, a bounded scrolling transcript, a persistent reply field and a compact proposal action row. Review replaces the transcript with the complete editable suggestion; Use prompt remains outside its scroll region. Expand enlarges only the conversation. No model calls, credit changes or media submissions are added.

Price-affecting settings and Generate remain in the existing toolbar with existing quote behavior. Player components, dimensions, playback behavior and gallery rail stay unchanged. The existing development-only gate scopes the entire preview; production retains the current arrangement. No new dependency or state library.

Verification: focused layout/interaction and workspace contracts, typecheck, lint/exposure, and authenticated local smoke checks without Generate. Evidence and results will be recorded after validation.
