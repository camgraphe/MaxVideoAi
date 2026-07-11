# Auth Cookie Banner Conversion Design

## Objective

Keep the cookie consent experience legally and functionally unchanged while preventing it from obscuring the `/login` conversion flow.

The change is limited to the unauthenticated login surface. Other public, workspace, localized, and admin routes retain their current cookie banner layout and behavior.

## Current Evidence

The current `/login` page was reviewed at the same live state in desktop and mobile viewports.

- On desktop, the centered cookie card overlaps the lower part of the centered authentication card, hiding consent fields and the primary account-creation action until the banner is dismissed or the page is scrolled.
- On mobile, the existing compact action bar is appropriately small, but it can cover the secondary sign-in link at the bottom of the form.
- Consent actions, localization, saved preferences, focus restoration, and the preferences panel already work and must be preserved.

## Selected Design

### Desktop

At viewport widths of `1200px` and above, `/login` uses a compact cookie card anchored to the bottom-right corner. This threshold leaves a reliable gap between the centered `max-w-md` login card and the approximately `22rem` cookie card.

- Width: approximately `22rem`, using the existing cookie card, border, radius, surface, shadow, typography, and buttons.
- Placement: existing bottom spacing with a right offset; it must not overlap the centered `max-w-md` login card at standard desktop widths.
- Layout: copy, actions, and the optional preferences panel stack vertically inside the compact card.
- The title and explanatory body remain visible.

### Mobile and Tablet

Below `1200px`, `/login` keeps a compact bottom action bar.

- The long title and explanatory body stay hidden on the login route below `1200px`; they keep their current responsive behavior everywhere else.
- Accept, reject, and manage-preferences actions remain on one compact row whenever translations fit; wrapping remains allowed as a safe fallback.
- A route-scoped `4.5rem` flow spacer is rendered with the banner so the end of the login form can scroll fully above the fixed bar.
- The spacer exists only below `1200px` and only while a first consent choice is required.

### Preferences

Opening `Manage choices` must not return the login route to the wide centered banner layout.

- On desktop, preferences remain inside the bottom-right card and stack below the primary copy/actions.
- On mobile and tablet, the existing preferences panel remains reachable, readable, and scrollable within the existing height constraints.
- Escape-to-close, focus restoration, switch labels, save state, and saved-consent behavior remain unchanged.

## Technical Boundary

`CookieBanner` continues to own route detection and presentation orchestration. No login component or login layout receives cookie state.

The implementation will:

1. Derive a strict login-route flag from `usePathname`.
2. Apply auth-specific wrapper and card classes only when the route is exactly `/login`.
3. Render the mobile/tablet flow spacer from `CookieBanner` only when the first-choice banner is visible on `/login`.
4. Keep the existing consent client, copy tables, persistence, analytics effects, API calls, and preference controls unchanged.

No new route, state store, cookie, API, localization key, or design token is introduced.

## Accessibility and Error Handling

- All existing accessible names and button roles remain unchanged.
- The spacer is decorative and must be hidden from assistive technology.
- Keyboard access to accept, reject, manage, preference switches, and save remains unchanged.
- Focus restoration after closing preferences remains unchanged.
- Existing loading and persistence error messages remain inside the visible banner card.
- The fixed banner must not prevent keyboard or pointer access to login fields and actions once the page is scrolled to the end.

## Verification

### Automated

- Add a contract test proving `/login` receives the auth-specific corner layout.
- Add a contract test proving the route-scoped spacer exists only for the first-choice login banner.
- Lock the `1200px` corner placement and the stacked preferences layout.
- Keep the existing cookie architecture and login hydration contracts green.

### Visual and Interaction QA

- Compare before and after screenshots at the same desktop viewport and login state.
- Compare before and after screenshots at a `390 × 844` mobile viewport, including the bottom of the signup form.
- Confirm the primary signup action and secondary sign-in link can both sit above the cookie bar.
- Confirm `Manage choices`, Escape close, focus restoration, Accept all, and Reject all still work.
- Confirm a non-login public page keeps the existing centered banner.

## Non-goals

- Rewriting cookie copy.
- Changing consent defaults or legal semantics.
- Changing when analytics or advertising scripts load.
- Redesigning the login form.
- Applying the corner-card layout to the rest of the product.
