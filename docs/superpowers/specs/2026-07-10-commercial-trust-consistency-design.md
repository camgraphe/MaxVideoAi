# Commercial Trust Consistency Design

## Objective

Make the public Status, Examples, watch-page, and Pricing journey commercially honest and internally consistent without changing public routes, generation pricing, wallet behavior, or SEO route ownership.

The primary journey is:

1. A visitor browses `/examples` and understands that each card opens a detailed example.
2. The visitor opens a watch page and sees the prompt, recorded render settings, recorded render cost, and a clear recreation action.
3. The visitor selects `Recreate this video`.
4. `/app?from=job_*` restores the engine, prompt, duration, resolution, aspect ratio, audio choice, preview, and current live Generate price without showing a contradictory error.
5. If the visitor checks `/status`, MaxVideoAI shows only the current administrator-published service notice or an honest empty state.
6. `/pricing` remains the source of truth for current comparison scenarios and links to the app for an exact live quote.

## Evidence

The July 10 audit confirmed:

- `/status` currently presents hard-coded subsystem states, an old Pika incident, continuous telemetry, automatic rerouting, RSS, and email-alert claims even though the route renders dictionary data rather than public operational telemetry.
- Workspace notification copy still describes status digests as `Coming soon`.
- `/examples` says pricing is shown per clip, but `buildClientVideo` always sets `priceLabel: null` and gallery cards do not display a price.
- The watch page correctly shows the prompt, settings, and `$3.28` recorded cost for the audited Kling 3 Pro example.
- `Recreate this video` correctly restores Kling 3 Pro, the prompt, `15s`, `1080p`, `16:9`, audio on, the preview, and a current `$3.28` Generate quote.
- The recreation succeeds while the Workspace simultaneously displays `No engines available to apply this snapshot`. The shared-video settings effect applies before the engine catalog is ready, reports an error, then succeeds on a later pass without clearing the stale notice.

Audit captures are stored under `output/audits/2026-07-10-commercial-trust/` and remain untracked QA evidence.

## Scope

This lot includes:

- replacing the fictional Status dashboard with a compact, truthful service-information page;
- using the existing administrator-managed service notice as the only dynamic public status source;
- aligning Examples hero, card affordances, FAQs, metadata, and localized copy with the real gallery-to-watch-page flow;
- clarifying that the watch page shows a recorded render cost while the Workspace shows the current live quote;
- preventing shared-video snapshot application until engines are available;
- preserving recreation behavior for guests and authenticated users;
- focused route, localization, accessibility, SEO, and Workspace hydration tests.

## Out Of Scope

- A provider-by-provider uptime dashboard.
- Public queue latency, SLA, webhook, wallet, billing, or regional routing telemetry.
- A new incident-history database or public incident timeline.
- Better Uptime, Instatus, Statuspage, or another external status provider.
- RSS, email, web-push, or incident-subscription functionality.
- Changes to pricing calculations, member discounts, wallet minimums, taxes, refunds, or provider costs.
- Displaying current live prices directly on Examples gallery cards.
- Skipping the watch page or adding a second direct-to-Generate gallery flow.
- Changes to public paths, localized slugs, redirects, canonical URLs, hreflang groups, sitemaps, or route groups.
- The later signup-density, funnel-measurement, or performance lots.

## Chosen Approach

Use an honest bridge between the existing administrator-managed service notice and the existing public conversion journey.

This approach is preferred over a new real-time dashboard because MaxVideoAI does not currently have a public operational telemetry contract or incident store. It is preferred over deleting `/status` because the route is linked from Contact and the footer, owns localized SEO metadata, and is a standard trust destination. It is preferred over an external provider because that would add infrastructure and operating work unrelated to the immediate conversion inconsistency.

The Status page becomes smaller and more truthful. Examples continues to lead to a richer watch page. Pricing continues to own current comparison scenarios. The Workspace recreation bug is fixed at its hydration boundary.

## Status Page

### Source of truth

`getServiceNoticeSetting()` is the only dynamic status source for this lot. The public page reads the same setting used by `/api/service-notice` and the Workspace header.

The page must not infer that every subsystem is operational when no notice is active. The empty state says only that MaxVideoAI has no active service notice.

The administrator-authored notice is rendered verbatim because the existing setting stores one message rather than locale variants. The surrounding heading, state label, recovery guidance, and support copy remain localized in English, French, and Spanish.

### Page structure

The retained `/status` route contains:

1. `Service status` heading and a short explanation that this page publishes current MaxVideoAI service notices.
2. A current-notice card:
   - active state: `Active service notice` plus the administrator-published message;
   - empty state: `No active service notice` plus neutral copy that avoids an uptime guarantee.
3. A `If a generation is affected` section explaining that failed generations follow the existing refund behavior and that delayed jobs should not be resubmitted blindly.
4. A `Need help?` section linking to support and instructing users to include the job ID and engine name.
5. Existing related links where they remain valid.

The page removes:

- hard-coded Engine routing, Queue processing, Wallet + billing, and Callbacks & webhooks cards;
- the hard-coded 2024 Pika incident;
- claims of continuously refreshed telemetry, automatic regional failover, 60-second queue updates, RSS, email digest, public root-cause reports, or subscription controls.

### Rendering and failure state

The Status route stays a Server Component. It reads `getServiceNoticeSetting()` through a small route-local data boundary. A database error already resolves to the disabled empty setting; the public page therefore renders the neutral empty state rather than an error or a false operational claim.

The page may revalidate on a short interval, but it must not introduce a client polling loop or a second service-notice contract.

## Examples Gallery

### Visitor expectation

The gallery remains a discovery surface. The whole card continues to open the watch page. The watch page remains the only place that exposes complete settings, recorded cost, and the recreation action.

### Copy and affordance

The English hub promise becomes equivalent to:

`Open any example to inspect its prompt, settings and recorded cost, then recreate it in the workspace.`

French and Spanish convey the same meaning without promising a price directly on every gallery card.

Every card gains a compact, non-duplicative affordance such as `View settings & price`. The card remains one primary watch-page link; the affordance must not create a nested duplicate link. Existing model links remain available.

The main featured example CTA uses the same expectation. FAQ answers explain that price and settings appear after opening the example. Metadata may retain high-intent `examples`, `prompts`, `models`, `pricing`, and `recreate` language, but it must not claim that the gallery grid itself displays a per-clip price.

### Accessibility

- Card accessible names describe opening the example details, not directly cloning or generating.
- The new visual affordance is represented in the card accessible name or nearby descriptive text.
- Existing keyboard focus, full-card hit target, model link, video semantics, and reduced-motion behavior remain intact.

## Watch Page And Price Language

The watch page keeps its existing hierarchy and recreation CTAs.

The displayed job cost is historical evidence from that render. Labels that currently call the same value both `Render cost` and `Estimated price` are normalized to `Recorded render cost` or locale-equivalent copy.

The Workspace Generate button remains the authority for the current live price after recreation. The design must not imply that a historical example cost is guaranteed if catalog pricing or settings support changes later.

No pricing algorithm or watch-page structured-data contract changes in this lot.

## Workspace Recreation Hydration

The existing `?from=job_*` contract remains unchanged.

The shared-video settings application effect must wait until the engine catalog is non-empty before calling `resolveVideoSettingsSnapshot`. Once engines are available, it applies the snapshot exactly once for the current shared video and allows the existing URL cleanup to remove `from` after the source video loads.

The fix must not:

- silently select a different engine when the recorded engine is still available;
- clear an unrelated service, upload, billing, or generation notice;
- change draft-storage precedence outside the explicit shared-video handoff;
- change authentication, pricing, generation, polling, or asset-upload behavior.

The resolver's existing legacy engine-token and fallback policy remains unchanged in this lot. A temporary empty catalog must never produce a recreation error before that policy can run.

## Pricing Page

`/pricing` remains the current-price comparison surface.

This lot does not change pricing matrices, scenario builders, engine rankings, amounts, or checkout behavior. It only aligns cross-surface language:

- Examples points visitors to watch pages for recorded settings and cost.
- Watch pages identify the value as a recorded render cost.
- The Workspace identifies the Generate amount as the current live quote.
- Pricing continues to tell visitors to open the app for the exact live quote before generation.

## Localization And SEO

- English is the primary copy-review surface.
- French and Spanish receive equivalent Status, Examples, watch-price, and card-affordance copy in the same lot.
- `/status`, `/fr/statut`, and `/es/estado` remain valid.
- Examples localized routes, model landing routes, watch routes, and `/pricing` remain unchanged.
- Status canonical, hreflang, sitemap, and indexability behavior remain unchanged.
- Status metadata and keywords describe service notices and service information rather than price calculators.
- Examples JSON-LD and FAQ content must match the visible behavior after the copy update.

## Testing

Focused automated coverage must prove:

1. Status renders the active administrator notice when enabled.
2. Status renders a neutral empty state when no notice is active or the setting cannot be loaded.
3. Status source no longer contains fictional subsystem states, the Pika incident, RSS/email subscription claims, or continuous-telemetry claims.
4. English, French, and Spanish Status and Examples copy express the same behavior.
5. Examples cards communicate `View settings & price` while still linking to the watch page.
6. Examples FAQ no longer claims that gallery cards display a price.
7. Watch-page cost language distinguishes recorded cost from the Workspace live quote.
8. Shared-video hydration does not call snapshot resolution while the engine catalog is empty.
9. Once engines load, the source engine, prompt, duration, resolution, aspect ratio, audio, and preview are restored without the false notice.
10. Legacy and unavailable engine identifiers continue to follow the existing resolver fallback contract.
11. Existing canonical, hreflang, localized-slug, JSON-LD, sitemap, and route architecture tests continue to pass.

Manual browser coverage includes:

- English desktop Status with and without an active service notice;
- English Examples gallery to watch page;
- guest watch page to recreated Workspace;
- authenticated watch page to recreated Workspace;
- French and Spanish route/copy smoke checks;
- keyboard focus on gallery cards and recreation CTAs;
- mobile reflow for Status, Examples cards, watch details, and the Workspace notice area.

## Acceptance Criteria

- No public page claims MaxVideoAI exposes live operational telemetry that it does not expose.
- `/status` remains reachable, localized, canonical, and useful.
- The current administrator service notice is the only public dynamic Status datum.
- Examples accurately explains where visitors will see settings and price.
- The watch page remains the required bridge between discovery and recreation.
- A recreated example restores its settings without a contradictory `No engines available` message.
- Recorded render cost and current live quote are distinguishable.
- Pricing calculations and public routes remain unchanged.
