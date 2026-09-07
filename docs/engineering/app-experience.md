# Application presentation and preferences

## Scope and ownership

`AppExperienceRoot` enables the product presentation on `/app`, `/dashboard`, `/settings`, `/jobs`, `/billing` and `/account/connections`, including descendants. It lives inside the existing core providers. `frontend/src/styles/app-experience.css` owns scoped application colors, type, navigation and surface composition. Shared marketing tokens and primitives retain their defaults outside this wrapper. The locally licensed Geist font is registered in the core layout without a global preload; provenance is beside the font.

Use responsibility classes such as `app-model-strip`, `app-prompt-surface`, `app-reference-surface` and `app-result-details`. Prefer an open layout with dividers and a single input surface. Avoid creating another nested card to restyle a section. Keep enabled/disabled, focus, selected and reduced-motion states explicit. Product navigation groups existing URLs by use and provides four labelled mobile destinations plus the complete menu.

`WorkspaceCreationHeading` is shared by the video boot/runtime and image creation surfaces. Empty creators retain model selection without mounting an empty player. Existing posters, loading results and actual readers preserve their media contracts. `AppClient` and `ImageWorkspace` remain orchestrators; generation, pricing, references, drafts and polling remain in their original hooks. Engine dropdown rendering remains separate from interaction state; its mobile family picker is native, its geometry is viewport-bounded and keyboard model selection only visits mounted enabled options.

## Library and results

`useLibraryPageData` owns account-scoped SWR infinite listing and controlled server search. The presentation consumes that contract; it must not reintroduce search limited to already loaded items. Listing APIs add `nextCursor`/`hasMore` while retaining existing arrays. Search, kind, source and exact owned job filters apply before pagination; current and legacy origins deduplicate before cursor boundaries. The executable library/PostgreSQL tests cover the query contract.

Grid readers keep thumbnails/previews separate from originals, and incidental video only mounts for playback intent. Download/reuse/save actions retain original assets. The result lightbox uses `useAccessibleModal` for focus entry, containment, Escape and restoration. Primary actions and Close remain named and visible on mobile; secondary metadata can be expanded.

## Account preferences

The settings page remains a route shell. `AccountSettingsPanel` renders the form, `useAccountNameForm` owns lifecycle and `account-preferences.ts` owns validated name updates. Names are trimmed, 1–80 characters, and only `name`/`full_name` metadata is patched. The update uses a captured and verified bearer token, preventing a later ambient session switch from retargeting the write. User changes reset stale form responses. Email is read-only in this lot.

`useThemePreference` owns `light`, `dark` and explicit `system` preference, synchronizes header/settings and other tabs, and falls back to in-memory state if storage is unavailable. Missing or invalid `mv-theme` retains the existing light default. System changes are followed only when the user chose System. Locale uses the existing app locale switch.

## Qualification boundaries

Desktop/mobile screenshots come from real rendered components. Library pagination, result states and the populated account form can be exercised with explicitly local fixtures; these do not prove live login, account saving, paid generation, upload, export or Safari behavior. Keep temporary fixture routes out of production. Initial loading changes require comparable production baseline/candidate evidence; local Lighthouse is synthetic and is not field INP or production Core Web Vitals.

Studio canvas redesign and saved timeline assembly remain a separate integration lot. The current optional MCP montage tool prepares a read-only edit plan with `persisted: false`; see `mcp-montage-preparation.md`. Do not expose it as a saved project or enable discovery by default.
