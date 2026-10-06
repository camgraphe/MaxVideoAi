# Connect menu — visual and interaction verification

Date: 2026-10-06. Scope: the application header's assistant disclosure.

## Evidence

- Selected visual: `/Users/adrienmillot/.codex/generated_images/01a0feee-9792-70b2-8081-ae5f8e59c12c/exec-27074d74-92dc-4b4f-9857-6dcb9e5195a6.png` (1672 × 941 pixels).
- Browser-rendered implementation: `http://connect-menu.localhost:3217/app/studio`, anonymous English guest demonstration, expanded Connect, Claude hovered, dark theme.
- Implementation screenshot: `.reports/connect-menu/desktop-dark.jpg` (1280 × 720 pixels, 1280 × 720 CSS viewport, density 1).
- Full comparison: `.reports/connect-menu/full-comparison.png`; selected image normalized proportionally to the 1280 × 720 viewport, source left and implementation right.
- Focused comparison: `.reports/connect-menu/panel-comparison.png`; source and implementation panels enlarged uniformly by 2 for typography, branding and spacing inspection. Original images are unchanged.
- Additional browser captures: `.reports/connect-menu/desktop-light.jpg`, `mobile-dark.jpg` (390 × 844), `mobile-320.jpg` (320 × 568). Evidence images are local, ignored QA artifacts.

## Findings and comparison history

The first browser pass revealed that mouse entry opened the panel and the subsequent click immediately closed it. The disclosure now distinguishes hover opening from deliberate click/keyboard opening. A regression assertion failed before the fix and passed afterward; a browser click then visibly kept the panel open. Outside interaction, focus leaving and Escape dismiss it.

The final combined full-view and focused comparisons show no actionable P0/P1/P2 issue within the approved scope. The actual Studio imagery, conversation, sidebar and composer retain their existing owners and geometry.

## Required fidelity surfaces

- **Typography:** existing application font and weights retained. Connect is 13 px; panel heading 15 px; supporting copy 12 px; integration labels 13 px. Names and localized destinations are readable, without truncation.
- **Spacing and layout:** one text trigger, five vertical integration rows and a separate footer. The implementation uses a 292 px panel and minimum 46 px link rows for the existing application's touch targets. It aligns to the trigger edge instead of the generated image's slight offset into the wallet area. These are intentional production constraints; the overall hierarchy and restrained composition are preserved.
- **Colors and tokens:** existing app canvas, panel, line, accent and floating-shadow tokens support light and dark. Hover uses the established warm accent surface; the generated mock's subtly different charcoal tone is not introduced as a new palette.
- **Image and icon fidelity:** shared authentic partner marks are retained, reduced to 20 px inside the panel. No provider marks remain in the header trigger. Existing Lucide chevron and arrows supply the fine controls; no raster mock is used as functional UI.
- **Copy and content:** English matches the selected heading, supporting text and footer. French and Spanish adapt these strings while retaining the short Connect trigger. Publication gating and all five registry-owned integration routes remain intact; this menu does not represent a user's live connection status.

## Interaction and responsive checks

Focused real-component tests cover publication withdrawal, EN/FR/ES routes, new-tab safety, click toggling after hover, touch-versus-mouse behavior, pointer transition into the panel, leaving hover, ArrowDown focus, Escape focus restoration and outside dismissal. The browser additionally confirmed the expanded dark/light panels, real hover feedback, click opening, appearance controls and small-screen layout. At 320 px, document width remains 320 px; panel bounds are x=17…309 and y=57.5…443.5.

Browser console inspection found earlier local bootstrap errors caused by absent public authentication settings before preview configuration. The preview subsequently reused only existing public auth settings and disabled the local admin bypass; no production database, generation or billing operation was used. Initial signed-in loopback state was avoided by using a dedicated localhost hostname, preserving the existing session. Authenticated billing/backend behavior is outside this presentation change and remains covered by required CI.

The local server also reported cookie-version/persistence 500 responses and wallet 503 responses because this isolated preview has no `DATABASE_URL`. These backend limitations are explicitly excluded from a claim of clean full-app runtime logs. They did not prevent the disclosure, theme, links or responsive checks; production runtime verification remains a separate release gate.

## Follow-up polish

P3 only: the live app intentionally preserves its own typeface, theme tokens, touch target sizes and trigger alignment rather than reproducing every generated pixel. No new artwork or font asset is required.

final result: passed
