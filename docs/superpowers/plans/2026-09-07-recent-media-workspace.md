# Recent Media and Workspace Navigation Implementation Plan

**Goal:** Make recent media reusable in the current draft, preserve visible workspace controls while scrolling, and restore wallet/site access in the approved prototype.

**Architecture:** One visual owner extends the isolated concept. Recent-media presentation receives media IDs and destination actions; click and internal drag use the same role/budget validation. Production integration must use the existing media feed, wallet owner and localized navigation, not fixture data.

**Spec:** User feedback of 7 September 2026: scroll visibility, recent outputs, drag into references, shared recents with Studio, wallet and site navigation. Existing conservation contract remains authoritative.

## Constraints

- Branch `codex/app-experience-first-lot`; no merge, deployment, payment or account writes.
- Local examples stay identified as examples. No invented balance, generation date, connection origin or persisted Studio insertion.
- Essential actions named, 44 px targets, keyboard/touch alternatives, reduced motion. Price and navigation occupy layout space instead of covering the editor.
- Only internal known media IDs can be dropped. Type, role, total and per-role limits are checked again at insertion. Multiple possible roles require a choice; replacement needs confirmation and is undoable.
- Reference-count changes retain the price guard: no text-only amount reused for a reference draft.
- Marketing pages open separately without losing the local draft. Wallet remains visibly unavailable until the real account is connected.

## Tasks

- [x] `recent-media.js`, `app.js`, `preview.py`: common recent-media list, recent-first local order, all three media kinds, explicit Add in reference action, click/drop shared insertion, named role choice and confirmed replacement/undo. Promote imported/simulated local media without fabricating a job.
- [x] `app.js`, `app.css`: bounded creator viewport with a scrollable work area and non-overlapping footer, independently scrollable desktop shelf, named mobile Recents panel. Preserve focus/scroll through reference actions.
- [x] `data.js`, `app.js`, `app.css`: original wallet/site icons, visible wallet entry and unavailable state, separate MaxVideoAI menu with verified existing site destinations, related model information accessible from comparison. No fake balance.
- [x] `integration-contract.md`, `experience-map.md`, `review.md`: shared recents destination contract for references/project/canvas, real wallet owner, navigation rationale and reference sources. Studio insertion remains explicitly unimplemented until its persistence contract is connected.
- [x] Verify native drag, touch/keyboard equivalent, ambiguous roles, limits, replacement cancellation/undo, recent ordering, price invalidation, site-menu draft preservation and scrolling at 1440/900/390/320 widths including short landscape. Run syntax and whitespace checks; record untested real-device limits.

## Production interfaces to retain

`HeaderWalletStatus` / `useHeaderAccountState` own the real wallet; `useWorkspaceWalletPreflight` owns submission balance checks. `useWorkspaceAssetLibrary` and `useLibraryPageData` supply existing media feeds. Recent outputs must be sorted by actual creation time and account ownership, preserve original/thumbnail separation, and show provenance only when recorded. Studio reuses those identities and media presentation with its own insertion command, transaction and autosave rules.

## Navigation decision

Wallet stays in the creation app. Quick comparison belongs beside the model picker; longer guides, detailed comparisons, model pages and public pricing belong in a named site menu opening a separate tab. This preserves the workspace while keeping discovery/help available. It is a design recommendation, not a measured conversion claim. Adobe documents credit access from the account menu/in-app panel; Runway keeps billing in its app dashboard. Sources will be recorded in the review.

## Verification record

Completed browser checks and final viewport measurements are recorded in `docs/design/global-app-concept/review.md`. Internal native drag, explicit keyboard insertion, type/capacity guards, role selection, replacement/cancellation/undo, audio recent ordering, menu/wallet draft preservation and independent scrolling were exercised. Corrections cover the mobile footer, short landscape navigation, and audio reader geometry. File import was not replayed in this lot; its existing handler was inspected and its promotion call shares the exercised recent ordering. Physical devices, virtual keyboards, live balances, real media feeds and persisted Studio insertion remain outside this prototype.
