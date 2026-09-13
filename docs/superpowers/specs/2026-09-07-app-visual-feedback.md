# App visual feedback and retirement of membership discounts

The user's four annotated comments on `/app` are the authority for this increment.

- Group Images, Videos and Audio in a lighter segmented control, with a compact refresh action. Keep readable labels, keyboard access, loading/error states and comfortable touch targets.
- Remove the misleading nested rounded frames around the workspace video preview. Preserve complete media visibility, aspect ratio, original media URLs, first-paint geometry and existing playback/loading behavior.
- Remove the duplicate Library action from the creation heading. The main Media navigation remains the full library entry; Recents remains a quick way to reuse media.
- Place generation settings, quantity and Generate together when the actual available width permits. Wrap intentionally on narrower containers; never overlap, clip pricing or hide Options. Check light/dark, video/image and mobile.
- Retire membership discounts for new prices across app, public estimators and agent/MCP quotes. Remove active promotion of member/Plus/Pro price benefits. Retain historical paid snapshots, receipts, refunds, included trials and auditable administration history. Existing old quotes must not silently charge a newly calculated amount: use the existing requote/confirmation protection.

Work remains in the existing isolated branch. No production data migration, paid generation, external publishing, push or merge is part of this increment. Connected visual checks use the existing disposable preview database only.
