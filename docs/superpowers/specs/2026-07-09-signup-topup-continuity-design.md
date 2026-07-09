# Signup-to-Top-up Continuity Design

## Objective

Ensure that a visitor who selects a wallet top-up amount, creates or signs into an account, and returns to billing keeps the original amount, currency, and destination. The same change establishes an accessible modal baseline for the billing and workspace authentication/top-up gates.

The primary success scenario is:

1. A signed-out visitor selects USD 25 on `/billing`.
2. The visitor chooses to continue to checkout.
3. MaxVideoAI asks the visitor to create an account or sign in.
4. Authentication completes through password or Google OAuth.
5. The visitor returns to `/billing?amount=2500&currency=USD`.
6. USD 25 remains selected and checkout can continue without re-entering the choice.

## Scope

This first conversion-repair lot includes:

- a validated billing-intent query contract;
- preservation of the billing destination through password and Google authentication;
- correct signup-versus-signin analytics classification for Google OAuth;
- billing selection hydration from the validated query;
- accessible behavior for billing and workspace authentication/top-up modals;
- focused behavior and architecture tests.

The broader audit remains ordered as follows after this lot:

1. Unify workspace top-up with the billing checkout pipeline.
2. Rework the guest workspace first viewport around prompt, price, and Generate.
3. Correct trust and commercial inconsistencies on Status, Examples, and pricing surfaces.
4. Add source- and cohort-based funnel measurement.
5. Optimize workspace performance and large-file architecture.

## Out of Scope

- Stripe API, wallet API, database, price, tax, or exchange-rate changes.
- A new global state library.
- Persisting prompt or uploaded media through signup.
- Redesigning the billing, login, or workspace visual language.
- Removing or weakening legal consent requirements.
- Implementing the later audit phases listed above.

## Chosen Approach

Use a validated return URL as the source of truth. The billing selection is encoded as a same-origin relative path such as `/billing?amount=2500&currency=USD`, then passed through the existing `next` authentication contract.

This is preferred over a database-backed pending checkout because the intent is temporary, contains no secret data, and must also work before an account exists. It is preferred over storage-only state because the URL remains inspectable, testable, and resilient across OAuth redirects and new tabs.

Session/local storage may continue to support the existing login redirect fallback, but it does not become a second billing-intent model.

## Billing Intent Contract

Create a route-local pure helper under billing that owns the following contract:

```ts
type BillingIntent = {
  amountCents: number;
  currency: 'USD';
};
```

For this lot:

- `amount` is an integer number of USD cents.
- The minimum accepted amount is 1000 cents, matching the current wallet minimum.
- The amount must be a finite safe integer. The wallet endpoint currently defines no product maximum, so this lot must not invent a client-only cap that would reject an otherwise valid custom top-up.
- `currency` is normalized to uppercase and only `USD` is accepted for URL hydration in this lot.
- Missing or invalid values produce the current default tier of 1000 cents and USD.
- Unknown query parameters are not copied into the login return target.
- Serialization is deterministic: `amount` first, then `currency`.

The helper exposes pure functions to parse search parameters and build the canonical billing target. It does not read `window`, React state, cookies, or authentication state.

## Authentication Flow

### Password signup

The immediate-session branch in `useLoginPageController` must redirect to the already sanitized `safeNextPath`. It must never replace the selected destination with `/generate`.

When email confirmation is required, the existing auth callback continues to carry the same sanitized `next` value through `emailRedirectTo`.

### Password signin

Existing behavior already redirects through the resolved safe target and remains unchanged except for regression coverage.

### Google OAuth

The pending Google marker records both its creation time and the auth mode active when OAuth starts:

```ts
type PendingGoogleAuth = {
  createdAt: number;
  mode: 'signup' | 'signin';
};
```

The marker keeps the existing ten-minute expiry. Legacy markers containing only `createdAt` remain consumable and default to `signin`, preventing old browser state from breaking the flow.

After OAuth exchange succeeds:

- a pending `signup` marker records `sign_up_completed`;
- a pending `signin` or legacy marker records `login_completed`;
- the sanitized billing target remains the redirect destination;
- the marker is consumed once.

OAuth callback failures clear the pending marker and retain the existing localized error behavior.

## Billing State Flow

`BillingClient` reads the current search parameters and asks the billing-intent helper for a validated intent. It then:

- initializes `useBillingTopupSelection` with the validated amount;
- builds the authentication return target from the validated amount and currency;
- keeps the current billing route when no explicit intent exists;
- resets checkout/captcha transient state when the hydrated or manually selected amount changes, preserving existing behavior.

The initial URL hydration occurs deterministically and must not overwrite a manual selection after the user interacts with the page. A later browser navigation to a different billing-intent URL may update the selection only if the route search parameters themselves changed.

The checkout request continues to validate the amount server-side. Client-side parsing is a usability and continuity layer, not an authorization boundary.

## Accessible Modal Baseline

Introduce a small shared client-side modal behavior primitive or hook in `frontend/components/ui`. It owns behavior, while route-local modal components retain their copy and visual composition.

Every migrated modal must provide:

- `role="dialog"` and `aria-modal="true"`;
- an `aria-labelledby` reference to a unique visible title;
- optional `aria-describedby` for explanatory copy;
- initial focus on the safest meaningful control, normally the primary action or close button;
- Tab and Shift+Tab containment within the dialog;
- Escape-to-close unless a checkout request is actively submitting;
- restoration of focus to the element that opened the modal;
- body scroll locking while open, with the previous overflow value restored on close;
- backdrop click closure where the existing modal already supports it;
- no closure when clicking inside dialog content.

The first migration covers:

- `BillingAuthGateModal`;
- `WorkspaceAuthGateModal`;
- `WorkspaceTopUpModal`.

This migration must preserve dynamic imports and route-local ownership required by the workspace architecture guide.

## Error Handling and Safety

- Invalid, negative, fractional, unsafe-integer, or unsupported-currency query values fall back to the default tier.
- `sanitizeNextPath` remains the final open-redirect boundary.
- The billing-intent builder emits only the `/billing` path and its allowlisted parameters.
- Browser storage failures remain non-fatal.
- Missing focus targets fall back to the dialog container using `tabIndex={-1}`.
- Modal cleanup always restores body scroll and the opener focus, including unmount during navigation.
- Existing checkout errors, rate limits, captcha flow, and Stripe redirect behavior remain unchanged.

## Analytics

The lot corrects event classification without adding a new analytics backend:

- password signup continues to emit `sign_up_started` and `sign_up_completed`;
- Google signup emits `sign_up_completed` instead of `login_completed`;
- Google signin continues to emit `login_completed`;
- the billing checkout event continues to include amount and normalized currency;
- no email, prompt, or other personal content is added to analytics payloads.

## Testing Strategy

Implementation follows red-green-refactor. Each production behavior starts with a focused failing test.

Required automated coverage:

1. Billing-intent parsing accepts valid cents and USD.
2. Billing-intent parsing rejects missing, fractional, negative, below-minimum, unsafe-integer, and unsupported-currency values.
3. Billing target serialization is deterministic and excludes unknown query parameters.
4. Password signup immediate-session redirect uses `safeNextPath`, not `/generate`.
5. Google pending auth preserves signup/signin mode, expires after ten minutes, consumes once, and reads legacy markers safely.
6. OAuth completion maps pending mode to the correct analytics event.
7. Billing selection initializes from the validated intent and does not regress the default tier.
8. Billing and workspace modal contracts include dialog semantics, named titles, Escape handling, focus containment/restoration, and scroll cleanup.
9. Existing login, billing, workspace architecture, generation, and checkout tests remain green.

Focused checks run before the full suite:

```bash
pnpm test:validate -- tests/login-page-architecture.test.ts
pnpm test:validate -- tests/login-oauth-cookie-fallback.test.ts
pnpm test:validate -- tests/billing-page-architecture.test.ts
pnpm test:validate -- tests/workspace-pricing-gate-hook-contract.test.ts
```

The project test runner currently expands to the repository test set, so implementation may use the underlying `tsx --test` command for genuinely focused red/green cycles.

Final verification:

```bash
npm --prefix frontend run lint
npm run lint:exposure
pnpm test:validate
npm --prefix frontend run build
git diff --check
```

Manual smoke coverage includes password signup, Google OAuth return-target construction, billing reload with a valid and invalid query, keyboard-only modal operation, mobile modal layout, and checkout start without completing a real payment.

## Acceptance Criteria

- A signed-out visitor selecting USD 25 returns from either supported authentication method to `/billing?amount=2500&currency=USD` with USD 25 selected.
- Immediate password signup never hardcodes `/generate` when a valid target exists.
- Invalid billing-intent queries cannot select an invalid checkout amount.
- Google signup and signin generate distinct completion events.
- The three migrated modals meet the behavioral requirements in the accessible modal baseline.
- Existing Stripe, captcha, wallet, consent, locale, and checkout behavior remains intact.
- Focused tests, the full validation suite, lint, exposure lint, production build, and `git diff --check` pass.
