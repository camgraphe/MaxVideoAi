# Signup Density and Continuity Design

## Objective

Reduce avoidable friction between the guest Workspace account gate and a completed signup while preserving the current MaxVideoAI visual language, authentication methods, consent semantics, return target, analytics, public routes, and SEO behavior.

The primary journey is:

1. A guest configures a render in `/app` or `/app/image` and sees the current Generate quote.
2. The guest selects Generate and receives a concise account gate.
3. The guest chooses Create account.
4. `/login?next=/app` shows the correct signup state on its first render, without a sign-in/signup content shift.
5. The guest can continue with Google or complete the visible email form.
6. Validation is expressed in the product locale, beside the relevant field, with an accessible focus and error relationship.
7. After authentication or email confirmation, the existing `next` contract returns the user to the intended Workspace route.

## Evidence

The July 11 audit checked the live English flow on desktop and at a 390 × 844 mobile viewport without creating an account or completing OAuth.

It confirmed:

- the guest Workspace keeps the selected engine, prompt, settings, and Generate price visible before the account gate;
- the account gate clearly offers Create account, Sign in, and Maybe later;
- the desktop signup surface is visually consistent with the current product;
- the mobile signup document is 916 px high in an 844 px viewport before the software keyboard opens;
- the segmented Sign in/Create account control is duplicated by another mode-changing action below the form;
- direct `?mode=signin` navigation initially renders signup and changes to sign-in after the query-sync effect runs;
- submitting the English signup form empty can display a French browser-native validation message because native validation follows browser language rather than product language;
- the Google label is hard-coded in English even though localized copy already exists;
- password and password-confirmation fields do not offer a visibility control;
- the current `/app` return target and earlier signup-continuity fixes are present and must remain unchanged.

Audit captures and notes are local QA evidence under `output/audits/2026-07-11-signup-density/` and are not product assets.

## Scope

This lot includes:

- tightening the existing signup and shared sign-in surface, especially at mobile widths;
- preserving the current single-page email signup rather than introducing a wizard;
- keeping Google and email choices visible without progressive disclosure;
- removing duplicate mode-changing actions below signup and sign-in forms;
- resolving the initial auth mode before the client surface renders;
- resolving the initial product locale before the client surface renders when an existing locale cookie is available;
- using the existing localized Google label instead of hard-coded English;
- adding accessible password visibility controls using the existing icon library;
- replacing browser-native required-field bubbles with localized, app-owned validation for the login forms;
- localizing application-authored validation, loading, success, and recovery copy in English, French, and Spanish;
- refining the account-gate and signup reassurance copy without promising free generations, credits, uptime, or a guaranteed price;
- preserving the current account, OAuth, consent, analytics, redirect, and SEO contracts;
- focused unit, architecture, localization, accessibility, responsive, auth, and redirect regression coverage.

## Out of Scope

- Removing email signup or making Google mandatory.
- Collapsing the email form behind an extra action.
- Splitting signup into multiple steps.
- Combining the Terms, Privacy, minimum-age, or marketing consent controls.
- Preselecting optional marketing consent.
- Changing the configured minimum age.
- Changing Supabase Auth, OAuth scopes, PKCE, confirmation-email behavior, password-reset behavior, or callback routes.
- Changing legal-consent persistence, consent API payloads, re-consent behavior, or legal document routes.
- Changing analytics event names, funnel stages, journey attribution, consent gating, or Stripe metadata.
- Granting signup credits, changing wallet minimums, changing prices, or changing top-up behavior.
- Changing `/login`, `/app`, `/app/image`, `/auth/callback`, canonical URLs, robots directives, redirects, or sitemap behavior.
- Redesigning the Workspace, account gate, global header, or design system.
- The later route-performance and bundle-size lot.

## Chosen Approach

Use a compact one-page signup that keeps both authentication methods visible.

This approach is preferred over Google-first progressive disclosure because it does not add a click or demote email users. It is preferred over a two-step email flow because the current form is short enough to fit once duplicated actions and excess mobile spacing are removed. It also has the lowest risk to the existing auth, consent, analytics, and return-target contracts.

The work should refine the existing MaxVideoAI card, spacing tokens, buttons, inputs, borders, typography, and icons. It must not introduce a new visual system or a materially different authenticated experience.

## Guest Account Gate

### Retained structure

The account gate keeps:

- `Create an account to render` as the clear heading;
- Create account as the primary action;
- Sign in as the secondary action;
- Maybe later as the reversible dismissal;
- the existing accessible dialog, focus trap, Escape behavior, focus restoration, and scroll lock;
- the existing `next` target generated by the Workspace.

### Reassurance copy

The body should explain two facts only:

1. Guests can explore the Workspace and starter renders before signup.
2. Creating an account returns them to the Workspace so they can continue.

It must not claim that a render is free, that credits are included, that the current price is guaranteed after authentication, or that every unsaved browser value survives across devices. If continuity copy mentions saved work, it must be limited to the same browser and backed by the existing draft-storage behavior.

The modal should not repeat the Generate price. The Generate button remains the visible quote authority before the gate, and the post-auth Workspace recalculates the live price.

## Auth Surface Hierarchy

### Mode control

The segmented Sign in/Create account control remains the single visible mode switch for the normal sign-in and signup states.

The duplicate bottom actions are removed:

- `Already have an account? Sign in` below signup;
- `Create a new account instead` below sign-in.

The segmented control receives an explicit localized accessible group label and selected-state semantics. The submit action remains distinct through form context and button type.

Password reset keeps its focused recovery hierarchy and one Back to sign in action. The reset state must not add another competing signup action.

### Authentication methods

Google remains first because it is the shortest path. The email form remains expanded immediately below it. The divider remains but uses the existing localized copy.

The Google button must render `authCopy.google` and preserve its current icon, loading guard, disabled state, `aria-busy`, OAuth intent marker, redirect target, and analytics behavior.

### Form fields

Email signup retains:

- Email;
- Password;
- Confirm password;
- Terms and Privacy acceptance;
- minimum-age confirmation;
- optional marketing consent;
- Create account.

Sign-in retains Email, Password, Sign in with email, and Forgot password.

All text inputs keep their existing names and autocomplete contracts. Password fields gain reveal/hide buttons positioned inside or immediately beside the input without reducing the typing area below a comfortable mobile width.

Reveal controls use the existing icon library and localized accessible labels equivalent to `Show password` and `Hide password`. The confirmation field has its own state. Toggling visibility must not change the field value, focus order, autocomplete value, or validation result.

## Responsive Density

### Desktop

- Keep the current centered `max-w-md` card.
- Keep the existing border, surface, shadow, radius, typography, and primary/outline button hierarchy.
- Preserve comfortable whitespace; the desktop change should look like a refinement, not a compressed mobile form enlarged for desktop.

### Mobile

At widths below the existing small breakpoint:

- reduce the outer page padding from the desktop value;
- reduce the space between Back and the card;
- reduce card padding and vertical stack gaps using existing spacing tokens or their current Tailwind equivalents;
- keep every text field and primary action at least 44 px high;
- keep checkbox labels as the full interactive target;
- keep legal links readable and tappable without horizontal overflow;
- keep the primary Create account action visible within a 390 × 844 English viewport before the software keyboard opens;
- allow normal vertical scrolling for longer French and Spanish copy, browser zoom, and validation states;
- never create document-level horizontal scrolling at 320, 360, or 390 px.

No fixed card height or clipped overflow is allowed. Density comes from removing duplication and tightening spacing, not reducing legibility.

## Initial Mode and Locale Stability

### Initial auth mode

The route must derive a bounded initial mode from the incoming `mode` search parameter before rendering the client auth surface.

Accepted values remain:

- `signup`;
- `signin`;
- `reset`.

Missing or invalid values default to `signup`. OAuth and password-reset hooks may still change mode later for a valid callback or user action, but normal `?mode=signin` navigation must not first render signup.

The route should remain a thin orchestrator. A focused pure resolver owns search-parameter validation, while a route-local client component owns the existing controller and interactive surface.

### Initial product locale

When `NEXT_LOCALE` or `mvid_locale` contains a supported locale, the route passes that locale into the client controller as the initial locale. Unsupported or missing values default to English.

The browser locale remains available for the existing consent-record payload, but it must not cause the visible auth interface to switch languages after first paint. Current English, French, and Spanish dictionaries remain the only UI copy sources.

## Validation and Feedback

### App-owned validation

The sign-in, signup, and reset forms use `noValidate` and a pure route-local validation module so visible validation follows the product locale rather than browser language.

Signup validation covers:

- email required;
- email format;
- password required;
- password minimum length from the existing six-character contract;
- confirmation required;
- password mismatch;
- Terms and Privacy acceptance;
- minimum-age confirmation.

Sign-in covers required email, email format, and required password. Reset covers required email and email format.

Optional marketing consent never produces a validation error.

### Error presentation

- Each invalid field or consent receives a localized inline error.
- The control receives `aria-invalid="true"` and an `aria-describedby` reference to its error.
- The first invalid control receives focus after a rejected submit.
- A concise form-level live region announces that the form needs attention without duplicating every field message.
- Correcting a field clears only that field's local validation error.
- Provider, network, OAuth, and consent-persistence failures remain visible in the existing form-level status/error area.

Application-authored loading, success, and fallback strings move into the auth dictionaries. Raw Supabase errors may remain provider-sourced when no stable application mapping exists; this lot does not invent translations for arbitrary backend text.

Validation must run before signup-start analytics or external auth/account requests. Existing successful analytics and navigation behavior remains unchanged.

## Continuity and Data Flow

The existing safe `next` contract remains authoritative.

- The guest Workspace continues to send `/login?next=/app` or the current allowlisted equivalent.
- Immediate password signup continues to call the existing authenticated redirect with `safeNextPath`.
- Email confirmation and Google OAuth continue to encode the allowlisted callback target.
- The login target storage, onboarding-skip behavior, and last-target fallback remain unchanged.
- Switching between sign-in and signup keeps the current email/password values as it does today.
- Removing duplicate bottom mode actions must not remove the current sign-in-to-signup recovery suggestion for invalid credentials.

The auth surface may receive a small presentation hint indicating that the safe target is a Workspace route. This hint may choose continuity copy but must never expose arbitrary query strings or untrusted target text.

## Accessibility

The lot must preserve or improve:

- one `h1` describing the current auth task;
- programmatic labels for every input and checkbox;
- a named mode-switch group with selected-state semantics;
- visible keyboard focus using existing focus tokens;
- logical focus order from Back through mode, Google, email fields, consents, and submit;
- 44 px minimum primary controls on mobile;
- explicit password reveal names and states;
- field-level error relationships and first-error focus;
- live feedback for loading, success, and failure states;
- legal links opening as they do today without making the surrounding checkbox label ambiguous;
- reduced layout shift on direct sign-in and reset URLs.

Automated checks cannot establish full screen-reader compliance. Manual keyboard and at least one screen-reader smoke check are required before merge.

## Architecture Boundaries

The route keeps the repository's page-orchestrator rule:

- `page.tsx` parses bounded initial route inputs and renders a route-local client owner;
- a focused route-local client component calls `useLoginPageController` and renders `LoginAuthSurface`;
- a pure route-local module resolves initial mode, locale, and validation results;
- `useLoginPageController` continues to own Supabase operations, analytics orchestration, consent submission, and redirects;
- `LoginAuthSurface` owns presentation and composes focused password-field and field-error primitives when extraction keeps it understandable;
- copy remains in the existing typed auth dictionaries;
- no server-only module, cookie API, secret, or Node API is imported into client files.

The current login architecture contracts must be updated to lock these boundaries instead of preserving the effect-based query-mode owner.

## Localization and SEO

- English remains the primary visual-review surface.
- French and Spanish receive equivalent new mode-group, password-visibility, validation, status, and continuity copy in the same lot.
- The hard-coded English Google label is removed.
- Existing `/login` metadata, canonical URL, `noindex, nofollow`, Open Graph data, and Twitter metadata remain unchanged.
- No localized marketing slug, hreflang group, sitemap entry, redirect, or public route is added or removed.
- Longer localized legal and validation copy may scroll vertically but must not overflow horizontally.

## Analytics and Privacy

Existing event names and meanings remain unchanged, including:

- `sign_up_started`;
- `sign_up_completed`;
- `login_completed`.

The existing distinction between Google signup and sign-in remains intact. No event may contain email, password, confirmation, consent text, raw error text, or an unbounded `next` value.

Local validation failures do not emit signup-start or completion events. Password visibility toggles and mode switches do not require new analytics in this lot.

## Testing

Focused automated coverage must prove:

1. Initial mode resolution accepts only signup, sign-in, and reset and defaults safely.
2. Direct sign-in and reset requests render the correct mode without a signup-first effect.
3. Initial locale resolution accepts only English, French, and Spanish locale cookies.
4. English, French, and Spanish dictionaries contain every new auth field.
5. The Google button uses localized copy.
6. Signup, sign-in, and reset validation return the expected field errors without browser-native validation.
7. Invalid submit focuses the first invalid control and exposes `aria-invalid` and `aria-describedby`.
8. Password reveal controls preserve values, autocomplete, independent confirmation visibility, and accessible names.
9. The bottom duplicate mode actions are absent while the segmented mode control remains.
10. Existing Google OAuth intent, PKCE, callback, cookie fallback, password signup, consent submission, analytics, and safe-next tests still pass.
11. `/login` metadata and noindex behavior remain unchanged.
12. The auth route and controller remain within their architecture boundaries.

Manual browser coverage includes:

- guest desktop Workspace → Generate → account gate → signup;
- guest mobile Workspace → Generate → account gate → signup;
- direct signup, sign-in, and reset URLs on a fresh load;
- English 390 × 844 signup with the primary CTA visible before keyboard opening;
- English desktop signup at 1440 × 1024;
- French and Spanish signup reflow at 390 px;
- empty, malformed email, short password, mismatch, missing Terms, and missing age states;
- password visibility with keyboard and touch;
- Tab, Shift+Tab, Enter, Space, focus restoration, and first-invalid focus;
- one screen-reader smoke check for mode selection, password visibility, and field errors;
- no real account creation, OAuth completion, or payment during visual QA.

## Acceptance Criteria

- The account gate remains reversible and clearly explains why an account is required.
- The signup card keeps Google and email choices visible on one page.
- The primary English signup CTA is visible in a 390 × 844 viewport before keyboard opening.
- Duplicate bottom sign-in/signup actions are removed.
- Direct sign-in and reset URLs do not first render signup.
- Validation follows the product locale and is programmatically tied to the invalid control.
- Password and confirmation fields have accessible independent reveal controls.
- Google and every new application-authored string are localized in English, French, and Spanish.
- Terms, Privacy, minimum-age, and optional-marketing consent semantics remain unchanged.
- Safe return to the intended Workspace, OAuth, email confirmation, analytics, and legal-consent persistence remain unchanged.
- `/login`, auth callbacks, public routes, metadata, canonical behavior, robots behavior, and SEO output remain unchanged.
