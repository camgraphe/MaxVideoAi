# Conversion Workspace Performance Design

## Goal

Reduce the JavaScript and third-party work performed when a visitor first opens `/app`, without changing the visible workspace, engine behavior, authentication flow, payment flow, routes, or SEO output.

## Baseline

The production build reports `/app` at roughly 394 kB of first-load JavaScript. The route currently prepares payment code and several model-specific or modal-only interfaces before the visitor needs them.

## Design

- Keep the core composer, engine selector, preview, and gallery immediately available.
- Load Luma Ray 3.2 keyframes and Gemini Omni controls only when their matching engine/workflow is active.
- Load the Storyboard launcher, authentication gate, and top-up interface only when their modal is open.
- Do not initialize Stripe.js during workspace mount. Load it only when a hosted checkout response requires the legacy Stripe redirect fallback. Direct checkout URLs continue to redirect without Stripe.js.
- Preserve existing loading, focus, copy, analytics, checkout challenge, and return-target behavior.

## Guardrails

- No route, metadata, canonical, hreflang, or sitemap changes.
- No new layout or placeholder visible in the normal workspace.
- No generation, pricing, upload, polling, or storage contract changes.
- Add a source-level architecture contract so interaction-only modules cannot silently become eager imports again.
- Compare production build route metrics before and after the change.
