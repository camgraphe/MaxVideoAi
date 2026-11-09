# Create media picker correction

The user reported the production picker is difficult to use and specified its interaction: clicking a thumbnail must add one reference directly, while checkboxes prepare multiple references for one grouped addition. They also requested complete media discovery and an explicit connection to Character Studio.

## Confirmed production behavior

- On `b08af8a3`, a thumbnail opens Preview; Choose only stages it, then Use selection is still required.
- The Images group accepts two references atomically. The empty indexed Image reference 1 entry advertises Maximum 10 but permits only one checkbox selection.
- Source categories remain present. Ordinary pickers still browse saved assets and search loaded pages, unlike the common library.
- Character Studio media and saved Character/Look entities are different objects; their existing identity and capacity rules must remain distinct.

## Product decisions supplied by the user

- Thumbnail activation accepts only that exact candidate through existing validation and insertion owners. It must never accidentally submit a previously staged basket.
- Checkboxes stage ordered candidates; one explicit button adds the full basket. Cancel discards pending choices.
- A separate Preview action remains available without changing the basket. Library management continues to open its viewer on thumbnail activation.
- An empty slot in an appendable group behaves like Add references. Occupied slots, start/end images, Kling slots and other single-role targets remain exact single replacements.
- Ordinary media browsing uses the existing account-scoped common browse API, server search and cursor pagination. Specialized generated-video and Character entity policies remain authoritative.
- Display clear source/compatibility labels, numbered selections, readable move/remove controls and an explicit Character Studio link. Preserve selection order.

## Approach

Reuse the existing picker, common browse reader and guarded receivers. A visual-only change would leave the wrong click and source behavior; bypassing the receivers would lose ownership, source-version and model-budget protection. No new UI framework or state library is needed.

## Constraints and evidence

Preserve originals, owner isolation, source proofs, Trash/version rejection, stale-context fences and atomic insertion. No paid generation, customer-media changes, credential/configuration changes or local browser processes. Use native Codex IAB for live/local UI and hosted browser CI. Deliver through a normal PR, required CI, Git deployment and exact-domain verification. Record live reproduction and before/after evidence in the external live-QA investigation folder.
