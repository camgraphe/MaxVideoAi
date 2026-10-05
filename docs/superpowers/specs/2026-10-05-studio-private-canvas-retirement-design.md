# Retire the private Studio Canvas

The owner confirms the old Canvas was private and its saved projects were personal tests. Delete those projects rather than migrate them. Keep the public conversational Studio, its shared MCP capabilities, media ownership, timeline, playback, exports, generation and assistance billing intact.

## Product behavior

Studio has one interface. The project picker shows supported conversational projects only and has no Canvas/template entry. Old Canvas/project URLs redirect to the Studio entry without mounting or importing the old editor. Published MCP montage results link to the conversational project. Existing marketing entry and media handoff paths must either use the current interface or be removed only when they have no live producers.

## Code boundaries

Use a resolved import graph to separate retained timeline, playback, certification, persistence and export code from old editor-only code. Remove the old React Flow editor, its controls, templates and local-only project management where no supported consumer remains. Move retained modules out of the retired route owner into a clearly documented shared Studio owner; preserve behavior and public contracts. Update architecture tests to enforce one UI and no legacy editor/runtime dependency.

Do not remove financial recovery or historical receipts, current conversations, media-library assets, jobs, generation quotes, export-worker dependencies or capability policies merely because their names contain workspace or legacy.

## Data retirement

Inventory the actual project rows and associations before selecting IDs. Distinguish old Canvas projects from current projects using persistence and conversation evidence; do not assume all connected projects are new or all projects before a date are old. Apply only the reviewed bounded ID set in a transaction after a read-only preview. Block if any selected project contains current conversation activity, live work or a changed snapshot. Preserve shared media and financial audit references. No database table drops and no automatic destructive migration for other environments.

## Verification

Retained timeline/edit/export/capability and MCP tests must pass. Replace tests that specifically demand the deleted private editor with retirement contracts. Check all production module imports and TypeScript, lint, exposure and route builds. Smoke-test authenticated Studio entry, project selection, media picker, appearance menu, timeline and retired URL redirects. Rehearse data retirement against isolated PostgreSQL/production clone as appropriate, assert exact scope and idempotence, and record live before/after counts.

Deliver through the normal clean-branch, GitHub PR, Quality CI and Git-backed Vercel main path already authorized in this conversation. Verify both live domains against the merged commit. Report code reduction and measured validation without claiming an unmeasured browser speedup.
