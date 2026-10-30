# Refinement 6 — common command bar

2026-10-28. Adrien selected the “Barre commune” proposal and asked to see it adapted in the app, in draft PR #555.

Video / Image / Audio share a compact row with the visible creation operations above the composer. They wrap into two groups when space is limited. The alternative with two permanent rows was reviewed; the common row was chosen to preserve conversation space. Video and image use this layout; audio retains its dedicated intent/settings arrangement.

The selected video/image model moves beside References and opens the existing model picker. Its old standalone strip and Previous settings action are omitted in this development preview. Keep all existing picker availability and selection callbacks. Required source inputs remain directly accessible before writing.

The assistant has a single outer boundary, a bounded scrolling transcript, a persistent reply field and a compact proposal action row. Review replaces the transcript with the complete editable suggestion; Use prompt remains outside its scroll region. Expand enlarges only the conversation. No model calls, credit changes or media submissions are added.

Price-affecting settings and Generate remain in the existing toolbar with existing quote behavior. Player components, dimensions, playback behavior and gallery rail stay unchanged. The existing development-only gate scopes the entire preview; production retains the current arrangement. No new dependency or state library.

## Verification

- 13 prompt-assistance reducer/DOM/browser tests pass. Review replacement was reproduced with a failing assertion before implementation. The reply field remains stable through the first reply, ten exchanges and Review at 320/390/768/1024/1440 px. New command-bar checks cover single navigation, visible operations, one model trigger in either tab, expansion, audio navigation and production-off behavior at 320/390/768/1440 px.
- 84 relevant workspace/image/composer architecture and source-workflow contracts pass. TypeScript and public-exposure checks pass. Frontend lint reports no errors and the same seven pre-existing warnings outside this change.
- Authenticated `/app` and `/app/image` open the existing model picker from the new location. The video quote changes from $1.35 at 4 seconds to $1.69 at 5 seconds for the existing Seedance 2.5 / 480p / 21:9 / audio-on selection; restored to 4 seconds and $1.35. No Generate action was used. Manual draft text was preserved.
- Independent read-only review of `a75d48f62..92c012840`: no material regression. Deferred P3: at 320 px in French, the proposal status can push its actions into the row's right padding; they remain usable and inside the actual mobile workspace boundary. English and Spanish probes fit. The reviewed UI is English.

Authenticated screenshots stay private because they include wallet/history. The local development server remains available for user review. The full production build was not repeated during this refinement; latest production-build qualification belongs to PR CI. Physical mobile keyboards and true browser zoom still require separate qualification. This remains a simulated assistant, so none of these checks establishes live LLM quality.
