# MaxVideoAI admin — operator guide

The admin has five work areas: Overview, Users, Transactions, Generations and Content. Settings holds operational, billing-product and compliance tools. An admin account is required; access checks run on the server.

## Daily check

1. Open **Overview → Today**. “Today” starts at midnight in Europe/Madrid. Switch to “Last 24 hours” for a rolling window. An unavailable source is labelled unavailable; do not treat it as zero.
2. Open **Transactions** to review wallet activity and **Checkout review** for payment anomalies. The history uses server-side search and pagination. Choose Today, Last 24 hours or All time, enter a search term and submit it. A receipt link opens that receipt even when it is outside the current page.
3. Search **Users** when starting from an email address. A user's detail page links to the complete account transaction history. Use **Generations** to inspect the related job and provider details when needed.
4. Open **Content → Moderation** for media review, **Articles** for editorial review and publication, and **Site placements** for gallery order. Publication and placement are separate decisions: placing media never makes a private asset public.

## Site placements

Existing galleries retain their current behavior until a destination is explicitly adopted. After Neon migration `52_playlist_curations.sql` is applied, choose a destination, select **Manual order** or **Featured + Automatic**, and edit a draft. Drag a video or use the keyboard controls to change its manual/featured position. In the automatic mode, the remaining eligible videos follow the featured rows; local exclusions remove videos from that destination only.

Use **Preview** to see the resulting public gallery, then **Save changes** to apply it. **Cancel** restores the saved draft. If another admin or a source playlist changes before saving, reload and review the new preview. A configured empty gallery stays empty. Initial galleries above 2,000 items require a bounded migration before adoption. Homepage and starter placements keep their existing manual workflows.

The automatic portion orders by video creation time. Republishing an older video does not move it to the top automatically. Public reads recheck visibility, indexability, deletion, completion and playable media; private or removed assets do not become eligible merely because they were featured earlier.

## Settings and external tools

**Settings** groups service notice, infrastructure costs, audit history, billing products and compliance tools. Model pricing is managed through the engineering workflow. Existing database pricing overrides remain effective; hiding the former editor did not change any price or its precedence. Theme values already stored in the database still apply to the site, although the admin theme editor is retired.

Use the external **Search Console** link for search traffic and URL inspection. Old `/admin/seo/*` bookmarks lead to `/admin/seo`, where the link and the separate **Video publishing** workspace are available. Video publishing controls remain in MaxVideoAI; the old in-app Search Console refresh and inspection actions are retired.

## Before production adoption

Review the current PR and its Quality CI against the exact commit to be delivered. Integrate any intervening changes from `main`, then requalify. Apply migration 52 through the normal Neon migration process before using the new placement editor. Review and save destinations individually; do not bulk-convert existing collections. Check live prices and database overrides against the expected quotes before any future pricing-governance change. The admin redesign itself performs no such change.

Architecture, data ownership and test contracts are in [the admin engineering guide](../engineering/admin-routes.md). The implementation evidence and its limits are in [the validation record](../plans/2026-09-22-admin-redesign-validation.md).
