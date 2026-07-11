# Signup Density and Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make guest-to-signup conversion denser, stable on first render, locally validated, and accessible while preserving Google/email auth, consent capture, safe Workspace return, analytics, routes, and SEO.

**Architecture:** Convert `/login` back into a thin Server Component that resolves bounded initial mode and locale, then pass those values to a route-local client owner and the existing controller. Keep validation in a pure route-local module, password visibility in a focused component, and all application-authored copy in the existing typed dictionaries. Video and image account gates retain their existing routes and actions while sharing truthful continuity language and accessible modal behavior.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript 5.4, Tailwind CSS, Lucide React, Supabase Auth, next-intl message JSON, Node test runner through `tsx`, existing in-app Browser QA.

## Global Constraints

- Preserve `/login`, `/app`, `/app/image`, `/auth/callback`, their query parameters, canonical URLs, robots behavior, redirects, and route groups.
- Keep Google and email authentication visible on one page; do not add progressive disclosure or a signup wizard.
- Keep Terms, Privacy, minimum-age, and optional-marketing controls separate and preserve their existing API payloads.
- Keep the password minimum at six characters.
- Preserve Supabase Auth, PKCE, OAuth intent classification, email confirmation, password reset, safe `next` storage, onboarding-skip behavior, and callback behavior.
- Preserve `sign_up_started`, `sign_up_completed`, and `login_completed` names and consent-aware attribution behavior.
- Do not emit signup-start analytics for client-validation failures.
- Preserve raw provider error display when there is no stable application mapping.
- Update English, French, and Spanish application copy together.
- Keep every primary input and action at least 44 px high on mobile.
- At 390 × 844 in English, show the initial Create account CTA without horizontal overflow and before the software keyboard opens.
- Do not add a runtime or test dependency.
- Follow red-green-refactor and commit each independently testable task.

---

## File Structure

### New route-local owners

- `frontend/app/(core)/login/_components/LoginPageClient.tsx`: interactive page owner; receives server-resolved `initialMode` and `initialLocale` and composes the existing controller with `LoginAuthSurface`.
- `frontend/app/(core)/login/_components/LoginPasswordField.tsx`: password input, independent visibility state, Lucide icon, accessible toggle, and inline error relationship.
- `frontend/app/(core)/login/_lib/login-route-state.ts`: pure bounded initial mode and locale resolvers.
- `frontend/app/(core)/login/_lib/login-validation.ts`: pure mode-aware field validation and deterministic first-invalid-field order.
- `tests/login-route-state.test.ts`: initial mode and locale behavior.
- `tests/login-validation.test.ts`: sign-in, signup, and reset validation behavior.
- `tests/login-auth-surface-contract.test.ts`: presentation, localization, password visibility, density, and accessibility ownership.
- `tests/login-copy-localization.test.ts`: English/French/Spanish auth dictionary parity and removal of hard-coded application copy.

### Existing owners to modify

- `frontend/app/(core)/login/page.tsx`: Server Component route orchestrator.
- `frontend/app/(core)/login/_hooks/useLoginPageController.ts`: accepts initial route state, owns field-error state/focus, consumes pure validation, and uses localized application feedback.
- `frontend/app/(core)/login/_hooks/useLoginAuthHashSession.ts`: consumes localized completing-sign-in/fallback copy.
- `frontend/app/(core)/login/_hooks/useLoginOAuthCodeExchange.ts`: consumes localized completing-sign-in copy without re-detecting visible locale.
- `frontend/app/(core)/login/_components/LoginAuthSurface.tsx`: compact shared auth layout, app-owned validation markup, named mode group, localized Google label, and no duplicate bottom mode actions.
- `frontend/messages/en.json`, `frontend/messages/fr.json`, `frontend/messages/es.json`: auth validation, feedback, mode-group, password visibility, continuity, and gate copy.
- `frontend/app/(core)/(workspace)/app/_lib/workspace-copy.ts`: English video gate fallback.
- `frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-copy.ts`: English image gate fallback.
- `frontend/app/(core)/(workspace)/app/image/_components/ImageAuthGateModal.tsx`: accessible-modal parity with the video gate.
- `tests/login-hydration-contract.test.ts`, `tests/login-page-architecture.test.ts`: new server/client and route-state boundaries.
- `tests/workspace-pricing-gate-hook-contract.test.ts`, `tests/image-workspace-split-contract.test.ts`, `tests/workspace-locale-copy.test.ts`: gate continuity and accessibility regressions.

### File removed

- `frontend/app/(core)/login/_hooks/useLoginModeFromQuery.ts`: effect-based query mode hydration is replaced by the server-resolved initial contract.

---

### Task 1: Resolve Login Mode and Locale Before Client Render

**Files:**
- Create: `frontend/app/(core)/login/_lib/login-route-state.ts`
- Create: `frontend/app/(core)/login/_components/LoginPageClient.tsx`
- Create: `tests/login-route-state.test.ts`
- Modify: `frontend/app/(core)/login/page.tsx`
- Modify: `frontend/app/(core)/login/_hooks/useLoginPageController.ts`
- Modify: `tests/login-hydration-contract.test.ts`
- Modify: `tests/login-page-architecture.test.ts`
- Delete: `frontend/app/(core)/login/_hooks/useLoginModeFromQuery.ts`

**Interfaces:**
- Produces: `resolveInitialAuthMode(value): AuthMode` and `resolveInitialAuthLocale(...candidates): Locale`.
- Produces: `LoginPageClient({ initialMode, initialLocale })`.
- Changes: `useLoginPageController({ initialMode, initialLocale })`.
- Preserves: mode changes after first render, OAuth callback mode updates, and existing `next` resolution.

- [ ] **Step 1: Write failing pure route-state tests**

Create `tests/login-route-state.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveInitialAuthLocale,
  resolveInitialAuthMode,
} from '../frontend/app/(core)/login/_lib/login-route-state';

test('login mode accepts only the supported scalar query values', () => {
  assert.equal(resolveInitialAuthMode('signup'), 'signup');
  assert.equal(resolveInitialAuthMode('signin'), 'signin');
  assert.equal(resolveInitialAuthMode('reset'), 'reset');
  assert.equal(resolveInitialAuthMode(undefined), 'signup');
  assert.equal(resolveInitialAuthMode('other'), 'signup');
  assert.equal(resolveInitialAuthMode(['signin', 'signup']), 'signin');
});

test('login locale accepts the first supported cookie value', () => {
  assert.equal(resolveInitialAuthLocale('fr', 'en'), 'fr');
  assert.equal(resolveInitialAuthLocale('de', 'es'), 'es');
  assert.equal(resolveInitialAuthLocale(undefined, 'EN'), 'en');
  assert.equal(resolveInitialAuthLocale('pt', undefined), 'en');
});
```

- [ ] **Step 2: Replace old architecture expectations with failing server-boundary expectations**

In `tests/login-page-architecture.test.ts`, replace `useLoginModeFromQuery` assertions with:

```ts
const pageClientPath = join(root, 'frontend/app/(core)/login/_components/LoginPageClient.tsx');
const routeStatePath = join(root, 'frontend/app/(core)/login/_lib/login-route-state.ts');
const pageClientSource = readFileSync(pageClientPath, 'utf8');
const routeStateSource = readFileSync(routeStatePath, 'utf8');

assert.ok(existsSync(pageClientPath));
assert.ok(existsSync(routeStatePath));
assert.doesNotMatch(pageSource, /'use client'/);
assert.match(pageSource, /from 'next\/headers'/);
assert.match(pageSource, /<LoginPageClient/);
assert.match(pageSource, /resolveInitialAuthMode\(searchParams\.mode\)/);
assert.match(pageSource, /resolveInitialAuthLocale\(/);
assert.match(pageClientSource, /'use client'/);
assert.match(pageClientSource, /useLoginPageController\(\{ initialMode, initialLocale \}\)/);
assert.match(routeStateSource, /export function resolveInitialAuthMode/);
assert.match(routeStateSource, /export function resolveInitialAuthLocale/);
assert.doesNotMatch(controllerSource, /useLoginModeFromQuery/);
```

In `tests/login-hydration-contract.test.ts`, remove the deleted hook path and add:

```ts
const routeStateSource = readFileSync(
  join(process.cwd(), 'frontend/app/(core)/login/_lib/login-route-state.ts'),
  'utf8'
);

assert.match(routeStateSource, /value === 'signin'/);
assert.match(routeStateSource, /value === 'reset'/);
assert.doesNotMatch(loginSources, /new URLSearchParams\(window\.location\.search\)[\s\S]*setMode/);
```

- [ ] **Step 3: Run the focused tests and confirm red**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/login-route-state.test.ts \
  tests/login-hydration-contract.test.ts \
  tests/login-page-architecture.test.ts
```

Expected: FAIL because `login-route-state.ts` and `LoginPageClient.tsx` do not exist and `page.tsx` is still a Client Component.

- [ ] **Step 4: Implement the pure route-state contract**

Create `frontend/app/(core)/login/_lib/login-route-state.ts`:

```ts
import { LOCALE_OPTIONS, type AuthMode, type Locale } from './login-copy';

export type LoginQueryValue = string | string[] | undefined;

export function resolveInitialAuthMode(value: LoginQueryValue): AuthMode {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === 'signin' || candidate === 'reset' || candidate === 'signup'
    ? candidate
    : 'signup';
}

export function resolveInitialAuthLocale(
  ...candidates: Array<string | null | undefined>
): Locale {
  for (const candidate of candidates) {
    const normalized = candidate?.trim().slice(0, 2).toLowerCase();
    if (normalized && LOCALE_OPTIONS.includes(normalized as Locale)) {
      return normalized as Locale;
    }
  }
  return 'en';
}
```

- [ ] **Step 5: Split the route and client owner**

Create `frontend/app/(core)/login/_components/LoginPageClient.tsx`:

```tsx
'use client';

import { LoginAuthSurface } from './LoginAuthSurface';
import { useLoginPageController } from '../_hooks/useLoginPageController';
import type { AuthMode, Locale } from '../_lib/login-copy';

export function LoginPageClient({
  initialMode,
  initialLocale,
}: {
  initialMode: AuthMode;
  initialLocale: Locale;
}) {
  const controller = useLoginPageController({ initialMode, initialLocale });
  return <LoginAuthSurface {...controller} />;
}
```

Replace `frontend/app/(core)/login/page.tsx` with:

```tsx
import { cookies } from 'next/headers';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { LoginPageClient } from './_components/LoginPageClient';
import {
  resolveInitialAuthLocale,
  resolveInitialAuthMode,
} from './_lib/login-route-state';

export const dynamic = 'force-dynamic';

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  return (
    <LoginPageClient
      initialMode={resolveInitialAuthMode(params.mode)}
      initialLocale={resolveInitialAuthLocale(
        cookieStore.get(LOCALE_COOKIE)?.value,
        cookieStore.get('NEXT_LOCALE')?.value
      )}
    />
  );
}
```

- [ ] **Step 6: Initialize the controller from the server contract**

Change the controller signature and initial state:

```ts
type UseLoginPageControllerOptions = {
  initialMode: AuthMode;
  initialLocale: Locale;
};

export function useLoginPageController({
  initialMode,
  initialLocale,
}: UseLoginPageControllerOptions) {
  const router = useRouter();
  const [locale] = useState<Locale>(initialLocale);
  const [mode, setMode] = useState<AuthMode>(initialMode);
```

Remove the `useLoginModeFromQuery` import/call, the `detectLocale` import used only by the controller, the final locale-detection effect, and delete `useLoginModeFromQuery.ts`. Do not change `useLoginNextTarget`.

- [ ] **Step 7: Verify green and commit**

Run the Step 3 command, then:

```bash
pnpm --prefix frontend exec tsc --noEmit
git diff --check
git add \
  'frontend/app/(core)/login/page.tsx' \
  'frontend/app/(core)/login/_components/LoginPageClient.tsx' \
  'frontend/app/(core)/login/_hooks/useLoginPageController.ts' \
  'frontend/app/(core)/login/_hooks/useLoginModeFromQuery.ts' \
  'frontend/app/(core)/login/_lib/login-route-state.ts' \
  tests/login-route-state.test.ts \
  tests/login-hydration-contract.test.ts \
  tests/login-page-architecture.test.ts
git commit -m "fix: stabilize initial auth mode"
```

Expected: focused tests and typecheck pass; commit contains only route-state and boundary changes.

---

### Task 2: Add Pure Localized Form Validation

**Files:**
- Create: `frontend/app/(core)/login/_lib/login-validation.ts`
- Create: `tests/login-validation.test.ts`
- Create: `tests/login-copy-localization.test.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`

**Interfaces:**
- Produces: `AuthFieldName`, `AuthValidationErrorCode`, `AuthFieldErrors`, `AuthValidationResult`, and `validateAuthForm(input)`.
- Produces dictionary keys: `modeGroup`, `passwordVisibility`, `validation`, and `feedback`.
- Validation remains independent of React, dictionaries, Supabase, and browser APIs.

- [ ] **Step 1: Write failing validation behavior tests**

Create `tests/login-validation.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAuthForm } from '../frontend/app/(core)/login/_lib/login-validation';

const valid = {
  email: 'creator@example.com',
  password: 'secret1',
  confirm: 'secret1',
  acceptTerms: true,
  ageConfirmed: true,
};

test('signup validation reports deterministic field errors', () => {
  assert.deepEqual(
    validateAuthForm({
      mode: 'signup',
      email: '',
      password: '',
      confirm: '',
      acceptTerms: false,
      ageConfirmed: false,
    }),
    {
      errors: {
        email: 'emailRequired',
        password: 'passwordRequired',
        confirm: 'confirmRequired',
        acceptTerms: 'termsRequired',
        ageConfirmed: 'ageRequired',
      },
      firstInvalidField: 'email',
    }
  );
});

test('signup validation distinguishes email, length, and mismatch failures', () => {
  assert.equal(validateAuthForm({ ...valid, mode: 'signup', email: 'invalid' }).errors.email, 'emailInvalid');
  assert.equal(validateAuthForm({ ...valid, mode: 'signup', password: '123', confirm: '123' }).errors.password, 'passwordTooShort');
  assert.equal(validateAuthForm({ ...valid, mode: 'signup', confirm: 'other12' }).errors.confirm, 'passwordMismatch');
});

test('signin and reset validate only fields present in their modes', () => {
  assert.deepEqual(validateAuthForm({ ...valid, mode: 'signin', password: '' }), {
    errors: { password: 'passwordRequired' },
    firstInvalidField: 'password',
  });
  assert.deepEqual(validateAuthForm({ ...valid, mode: 'reset', email: '' }), {
    errors: { email: 'emailRequired' },
    firstInvalidField: 'email',
  });
});

test('valid values produce no errors', () => {
  assert.deepEqual(validateAuthForm({ ...valid, mode: 'signup' }), {
    errors: {},
    firstInvalidField: null,
  });
});
```

- [ ] **Step 2: Write failing locale-parity tests**

Create `tests/login-copy-localization.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import en from '../frontend/messages/en.json';
import fr from '../frontend/messages/fr.json';
import es from '../frontend/messages/es.json';

function scalarPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child)
      ? scalarPaths(child, path)
      : [path];
  });
}

function readPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) =>
    current && typeof current === 'object'
      ? (current as Record<string, unknown>)[key]
      : undefined, value);
}

test('auth locales cover every English auth copy field', () => {
  const expected = scalarPaths(en.auth);
  for (const [locale, copy] of Object.entries({ fr: fr.auth, es: es.auth })) {
    const missing = expected.filter((path) => typeof readPath(copy, path) !== 'string');
    assert.deepEqual(missing, [], `${locale} missing: ${missing.join(', ')}`);
  }
});

test('auth copy includes localized mode, visibility, validation, and feedback groups', () => {
  for (const copy of [en.auth, fr.auth, es.auth]) {
    assert.equal(typeof copy.modeGroup, 'string');
    assert.equal(typeof copy.passwordVisibility.show, 'string');
    assert.equal(typeof copy.validation.formAttention, 'string');
    assert.equal(typeof copy.validation.emailRequired, 'string');
    assert.equal(typeof copy.validation.ageRequired, 'string');
    assert.equal(typeof copy.feedback.completingSignIn, 'string');
    assert.equal(typeof copy.feedback.googleRedirecting, 'string');
  }
});
```

- [ ] **Step 3: Run tests and confirm red**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/login-validation.test.ts \
  tests/login-copy-localization.test.ts
```

Expected: FAIL because the validation module and new dictionary groups do not exist.

- [ ] **Step 4: Implement the pure validation module**

Create `frontend/app/(core)/login/_lib/login-validation.ts`:

```ts
import type { AuthMode } from './login-copy';

export type AuthFieldName =
  | 'email'
  | 'password'
  | 'confirm'
  | 'acceptTerms'
  | 'ageConfirmed';

export type AuthValidationErrorCode =
  | 'emailRequired'
  | 'emailInvalid'
  | 'passwordRequired'
  | 'passwordTooShort'
  | 'confirmRequired'
  | 'passwordMismatch'
  | 'termsRequired'
  | 'ageRequired';

export type AuthFieldErrors = Partial<Record<AuthFieldName, AuthValidationErrorCode>>;

export type AuthValidationInput = {
  mode: AuthMode;
  email: string;
  password: string;
  confirm: string;
  acceptTerms: boolean;
  ageConfirmed: boolean;
};

export type AuthValidationResult = {
  errors: AuthFieldErrors;
  firstInvalidField: AuthFieldName | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;
const SIGNUP_FIELD_ORDER: AuthFieldName[] = [
  'email', 'password', 'confirm', 'acceptTerms', 'ageConfirmed',
];

export function validateAuthForm(input: AuthValidationInput): AuthValidationResult {
  const errors: AuthFieldErrors = {};
  const email = input.email.trim();
  if (!email) errors.email = 'emailRequired';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'emailInvalid';

  if (input.mode !== 'reset') {
    if (!input.password) errors.password = 'passwordRequired';
    else if (input.mode === 'signup' && input.password.length < 6) {
      errors.password = 'passwordTooShort';
    }
  }

  if (input.mode === 'signup') {
    if (!input.confirm) errors.confirm = 'confirmRequired';
    else if (input.password !== input.confirm) errors.confirm = 'passwordMismatch';
    if (!input.acceptTerms) errors.acceptTerms = 'termsRequired';
    if (!input.ageConfirmed) errors.ageConfirmed = 'ageRequired';
  }

  const order = input.mode === 'reset'
    ? ['email']
    : input.mode === 'signin'
      ? ['email', 'password']
      : SIGNUP_FIELD_ORDER;
  return {
    errors,
    firstInvalidField:
      (order.find((field) => errors[field as AuthFieldName]) as AuthFieldName | undefined) ?? null,
  };
}
```

- [ ] **Step 5: Add exact localized copy groups**

Add these groups under `auth` in `frontend/messages/en.json`:

```json
"modeGroup": "Choose account access mode",
"passwordVisibility": {
  "show": "Show password",
  "hide": "Hide password"
},
"validation": {
  "formAttention": "Check the highlighted fields and try again.",
  "emailRequired": "Enter your email address.",
  "emailInvalid": "Enter a valid email address.",
  "passwordRequired": "Enter your password.",
  "passwordTooShort": "Use at least 6 characters.",
  "confirmRequired": "Confirm your password.",
  "passwordMismatch": "Passwords do not match.",
  "termsRequired": "Accept the Terms of Service and Privacy Policy to continue.",
  "ageRequired": "Confirm that you meet the minimum age requirement."
},
"feedback": {
  "signingIn": "Signing in…",
  "signinRedirecting": "Signed in. Redirecting…",
  "signinSuggestion": "We couldn't sign you in with those details. If you're new, create your account without retyping anything.",
  "signupSuggestionReady": "Great, let's create your account.",
  "creatingAccount": "Creating account…",
  "accountRedirecting": "Account created. Redirecting…",
  "confirmEmail": "Check your inbox to confirm your email.",
  "sendingReset": "Sending reset link…",
  "resetSent": "Password reset email sent.",
  "googleUnavailable": "Google sign-in is unavailable because the auth redirect URL could not be resolved.",
  "googleRedirecting": "Redirecting to Google…",
  "completingSignIn": "Completing sign-in…",
  "completeSignInError": "Unable to complete sign-in.",
  "consentSaveError": "We couldn't save your consent choices. Please try again."
}
```

Use these exact French groups in `frontend/messages/fr.json`:

```json
"modeGroup": "Choisir le mode d’accès au compte",
"passwordVisibility": {
  "show": "Afficher le mot de passe",
  "hide": "Masquer le mot de passe"
},
"validation": {
  "formAttention": "Vérifiez les champs signalés puis réessayez.",
  "emailRequired": "Saisissez votre adresse e-mail.",
  "emailInvalid": "Saisissez une adresse e-mail valide.",
  "passwordRequired": "Saisissez votre mot de passe.",
  "passwordTooShort": "Utilisez au moins 6 caractères.",
  "confirmRequired": "Confirmez votre mot de passe.",
  "passwordMismatch": "Les mots de passe ne correspondent pas.",
  "termsRequired": "Acceptez les Conditions d’utilisation et la Politique de confidentialité pour continuer.",
  "ageRequired": "Confirmez que vous respectez l’âge minimum requis."
},
"feedback": {
  "signingIn": "Connexion…",
  "signinRedirecting": "Connexion réussie. Redirection…",
  "signinSuggestion": "Ces informations ne permettent pas de vous connecter. Si vous êtes nouveau, créez votre compte sans tout ressaisir.",
  "signupSuggestionReady": "Parfait, créons votre compte.",
  "creatingAccount": "Création du compte…",
  "accountRedirecting": "Compte créé. Redirection…",
  "confirmEmail": "Consultez votre boîte de réception pour confirmer votre e-mail.",
  "sendingReset": "Envoi du lien…",
  "resetSent": "E-mail de réinitialisation envoyé.",
  "googleUnavailable": "La connexion Google est indisponible car l’URL de redirection n’a pas pu être déterminée.",
  "googleRedirecting": "Redirection vers Google…",
  "completingSignIn": "Finalisation de la connexion…",
  "completeSignInError": "Impossible de finaliser la connexion.",
  "consentSaveError": "Impossible d’enregistrer vos choix de consentement. Réessayez."
}
```

Use these exact Spanish groups in `frontend/messages/es.json`:

```json
"modeGroup": "Elegir el modo de acceso a la cuenta",
"passwordVisibility": {
  "show": "Mostrar contraseña",
  "hide": "Ocultar contraseña"
},
"validation": {
  "formAttention": "Revisa los campos señalados e inténtalo de nuevo.",
  "emailRequired": "Introduce tu correo electrónico.",
  "emailInvalid": "Introduce un correo electrónico válido.",
  "passwordRequired": "Introduce tu contraseña.",
  "passwordTooShort": "Usa al menos 6 caracteres.",
  "confirmRequired": "Confirma tu contraseña.",
  "passwordMismatch": "Las contraseñas no coinciden.",
  "termsRequired": "Acepta los Términos de servicio y la Política de privacidad para continuar.",
  "ageRequired": "Confirma que cumples la edad mínima requerida."
},
"feedback": {
  "signingIn": "Iniciando sesión…",
  "signinRedirecting": "Sesión iniciada. Redirigiendo…",
  "signinSuggestion": "No pudimos iniciar sesión con esos datos. Si eres nuevo, crea tu cuenta sin volver a escribirlos.",
  "signupSuggestionReady": "Perfecto, vamos a crear tu cuenta.",
  "creatingAccount": "Creando cuenta…",
  "accountRedirecting": "Cuenta creada. Redirigiendo…",
  "confirmEmail": "Revisa tu bandeja de entrada para confirmar el correo.",
  "sendingReset": "Enviando enlace…",
  "resetSent": "Correo de restablecimiento enviado.",
  "googleUnavailable": "El acceso con Google no está disponible porque no se pudo resolver la URL de redirección.",
  "googleRedirecting": "Redirigiendo a Google…",
  "completingSignIn": "Completando el inicio de sesión…",
  "completeSignInError": "No se pudo completar el inicio de sesión.",
  "consentSaveError": "No pudimos guardar tus opciones de consentimiento. Inténtalo de nuevo."
}
```

Also change `auth.modes.signup.description` to these exact values:

- English: `Create your account, confirm your email, and return to the workspace to start your render.`
- French: `Créez votre compte, confirmez votre e-mail, puis revenez dans le studio pour lancer votre rendu.`
- Spanish: `Crea tu cuenta, confirma el correo y vuelve al workspace para iniciar el render.`

- [ ] **Step 6: Verify green and commit**

Run the Step 3 command, then:

```bash
pnpm --prefix frontend exec tsc --noEmit
git diff --check
git add \
  'frontend/app/(core)/login/_lib/login-validation.ts' \
  frontend/messages/en.json \
  frontend/messages/fr.json \
  frontend/messages/es.json \
  tests/login-validation.test.ts \
  tests/login-copy-localization.test.ts
git commit -m "feat: add localized auth validation"
```

Expected: validation and locale-parity tests pass and JSON parses successfully.

---

### Task 3: Integrate Validation, Focus, and Localized Feedback

**Files:**
- Create: `tests/login-validation-integration.test.ts`
- Modify: `frontend/app/(core)/login/_hooks/useLoginPageController.ts`
- Modify: `frontend/app/(core)/login/_hooks/useLoginAuthHashSession.ts`
- Modify: `frontend/app/(core)/login/_hooks/useLoginOAuthCodeExchange.ts`
- Modify: `tests/login-page-architecture.test.ts`

**Interfaces:**
- Controller produces: `fieldErrors`, `formAttention`, `confirmRef`, `termsRef`, `ageRef`, and error-clearing change handlers.
- Controller consumes: `validateAuthForm()` and `authCopy.feedback`.
- Surface will consume these props in Task 4.

- [ ] **Step 1: Write a failing integration contract**

Create `tests/login-validation-integration.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const controller = readFileSync('frontend/app/(core)/login/_hooks/useLoginPageController.ts', 'utf8');
const hashSession = readFileSync('frontend/app/(core)/login/_hooks/useLoginAuthHashSession.ts', 'utf8');
const oauthExchange = readFileSync('frontend/app/(core)/login/_hooks/useLoginOAuthCodeExchange.ts', 'utf8');

test('controller validates before auth calls and focuses the first invalid field', () => {
  assert.match(controller, /validateAuthForm\(/);
  assert.match(controller, /setFieldErrors\(result\.errors\)/);
  assert.match(controller, /firstInvalidField/);
  assert.match(controller, /fieldRefs\[result\.firstInvalidField\]/);
  const validationIndex = controller.indexOf('validateAuthForm(');
  const signupRequestIndex = controller.indexOf('supabase.auth.signUp');
  assert.ok(validationIndex >= 0 && validationIndex < signupRequestIndex);
});

test('controller localizes application feedback without changing provider errors', () => {
  for (const key of [
    'signingIn', 'signinRedirecting', 'signinSuggestion', 'signupSuggestionReady',
    'creatingAccount', 'accountRedirecting', 'confirmEmail', 'sendingReset',
    'resetSent', 'googleUnavailable', 'googleRedirecting', 'consentSaveError',
  ]) {
    assert.match(controller, new RegExp(`authCopy\\.feedback\\.${key}`));
  }
  assert.match(controller, /setError\(error\.message\)/);
  assert.match(hashSession, /authCopy\.feedback\.completingSignIn/);
  assert.match(oauthExchange, /authCopy\.feedback\.completingSignIn/);
});

test('local validation failures occur before signup analytics', () => {
  const signupStart = controller.indexOf("dispatchAnalyticsEvent('sign_up_started'");
  const validation = controller.indexOf("validateCurrentForm('signup')");
  assert.ok(validation >= 0 && validation < signupStart);
});
```

- [ ] **Step 2: Run the contract and confirm red**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/login-validation-integration.test.ts \
  tests/login-signup-redirect-contract.test.ts \
  tests/login-google-auth-intent.test.ts
```

Expected: FAIL because the controller does not yet consume the validation module or localized feedback.

- [ ] **Step 3: Add controller validation state and deterministic focus**

In `useLoginPageController.ts`, import `useMemo` and validation types/helpers. Add:

```ts
const confirmRef = useRef<HTMLInputElement>(null);
const termsRef = useRef<HTMLInputElement>(null);
const ageRef = useRef<HTMLInputElement>(null);
const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
const [formAttention, setFormAttention] = useState(false);

const fieldRefs = useMemo(() => ({
  email: emailRef,
  password: passwordRef,
  confirm: confirmRef,
  acceptTerms: termsRef,
  ageConfirmed: ageRef,
}), [emailRef, passwordRef]);

const clearFieldError = useCallback((field: AuthFieldName) => {
  setFieldErrors((current) => {
    if (!current[field]) return current;
    const next = { ...current };
    delete next[field];
    return next;
  });
}, []);

const handleModeChange = useCallback((nextMode: AuthMode) => {
  setMode(nextMode);
  setFieldErrors({});
  setFormAttention(false);
}, []);

const validateCurrentForm = useCallback((targetMode: AuthMode) => {
  const result = validateAuthForm({
    mode: targetMode,
    email,
    password,
    confirm,
    acceptTerms,
    ageConfirmed,
  });
  setFieldErrors(result.errors);
  setFormAttention(Boolean(result.firstInvalidField));
  if (result.firstInvalidField) {
    fieldRefs[result.firstInvalidField].current?.focus();
    return false;
  }
  return true;
}, [acceptTerms, ageConfirmed, confirm, email, fieldRefs, password]);
```

Call `validateCurrentForm('signin')`, `validateCurrentForm('signup')`, or `validateCurrentForm('reset')` immediately after `preventDefault()` and before setting loading state, analytics, fetch, or Supabase calls. Remove the old password/mismatch/terms/age conditional block from `signUpWithPassword`.

Return `fieldErrors`, `formAttention`, the three new refs, and change handlers that update the value then call `clearFieldError` for the corresponding field. Mode changes clear local field errors and form attention but preserve existing field values.

Delete the old `termsError` boolean state, its mode-change cleanup effect, and the English-string comparison in `handleAcceptTermsChange`. Return `onModeChange: handleModeChange`; make the Terms and age change handlers clear `acceptTerms` and `ageConfirmed` field errors respectively.

- [ ] **Step 4: Replace application-authored controller strings with dictionary values**

Use the exact mappings:

```ts
setStatus(authCopy.feedback.signingIn);
setStatus(authCopy.feedback.signinSuggestion);
setStatus(authCopy.feedback.signinRedirecting);
setStatus(authCopy.feedback.signupSuggestionReady);
setStatus(authCopy.feedback.creatingAccount);
setStatus(authCopy.feedback.accountRedirecting);
setStatus(authCopy.feedback.confirmEmail);
setStatus(authCopy.feedback.sendingReset);
setStatus(authCopy.feedback.resetSent);
setStatus(authCopy.feedback.googleUnavailable);
setStatus(authCopy.feedback.googleRedirecting);
```

When consent persistence throws, display `authCopy.feedback.consentSaveError`; keep the server/provider error only in logs if one already exists. Keep `setError(error.message)` for Supabase provider errors.

Pass `authCopy` into `useLoginAuthHashSession`. Replace its static completion/fallback strings with:

```ts
setStatus(authCopy.feedback.completingSignIn);
setError(error.message ?? authCopy.feedback.completeSignInError);
```

In `useLoginOAuthCodeExchange`, replace `setStatus('Completing sign-in…')` with `setStatus(authCopy.feedback.completingSignIn)` and use the existing localized callback error for callback failures.

- [ ] **Step 5: Verify green and commit**

Run the Step 2 command plus:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/login-*.test.ts
pnpm --prefix frontend exec tsc --noEmit
git diff --check
git add \
  'frontend/app/(core)/login/_hooks/useLoginPageController.ts' \
  'frontend/app/(core)/login/_hooks/useLoginAuthHashSession.ts' \
  'frontend/app/(core)/login/_hooks/useLoginOAuthCodeExchange.ts' \
  tests/login-validation-integration.test.ts \
  tests/login-page-architecture.test.ts
git commit -m "fix: localize auth form feedback"
```

Expected: all login tests and typecheck pass; safe-next tests remain unchanged.

---

### Task 4: Compact and Clarify the Shared Auth Surface

**Files:**
- Create: `frontend/app/(core)/login/_components/LoginPasswordField.tsx`
- Create: `tests/login-auth-surface-contract.test.ts`
- Modify: `frontend/app/(core)/login/_components/LoginAuthSurface.tsx`
- Modify: `tests/login-page-architecture.test.ts`

**Interfaces:**
- Produces: `LoginPasswordField` with controlled value, forwarded ref, localized reveal label, inline error, and unchanged autocomplete.
- Consumes: controller field errors, refs, attention state, and existing callbacks.
- Removes: duplicate bottom normal-mode actions only; reset and invalid-signin recovery actions remain.

- [ ] **Step 1: Write the failing surface contract**

Create `tests/login-auth-surface-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const surfacePath = 'frontend/app/(core)/login/_components/LoginAuthSurface.tsx';
const passwordPath = 'frontend/app/(core)/login/_components/LoginPasswordField.tsx';
const surface = readFileSync(surfacePath, 'utf8');

test('login surface delegates password visibility to a focused component', () => {
  assert.ok(existsSync(passwordPath));
  const password = readFileSync(passwordPath, 'utf8');
  assert.match(surface, /<LoginPasswordField/);
  assert.match(password, /from 'lucide-react'/);
  assert.match(password, /aria-pressed=\{visible\}/);
  assert.match(password, /authCopy\.passwordVisibility/);
  assert.match(password, /autoComplete/);
});

test('login surface owns localized app validation and no native bubbles', () => {
  assert.match(surface, /noValidate/);
  assert.match(surface, /aria-invalid=/);
  assert.match(surface, /aria-describedby=/);
  assert.match(surface, /authCopy\.validation\.formAttention/);
  assert.match(surface, /role="alert"/);
  assert.match(surface, /authCopy\.google/);
  assert.doesNotMatch(surface, />\s*Continue with Google\s*</);
});

test('mode switch is named and duplicate bottom actions are removed', () => {
  assert.match(surface, /role="group"/);
  assert.match(surface, /aria-label=\{authCopy\.modeGroup\}/);
  assert.match(surface, /aria-pressed=\{effectiveMode === 'signin'\}/);
  assert.match(surface, /aria-pressed=\{effectiveMode === 'signup'\}/);
  assert.doesNotMatch(surface, /authCopy\.links\.haveAccount/);
  assert.doesNotMatch(surface, /authCopy\.links\.newAccount/);
  assert.match(surface, /authCopy\.forgotPassword/);
  assert.match(surface, /authCopy\.links\.backToSignIn/);
});

test('mobile density keeps readable controls without clipped overflow', () => {
  assert.match(surface, /p-4 sm:p-6/);
  assert.match(surface, /mb-3 sm:mb-6/);
  assert.doesNotMatch(surface, /overflow-hidden/);
});
```

- [ ] **Step 2: Run the contract and confirm red**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/login-auth-surface-contract.test.ts \
  tests/login-page-architecture.test.ts
```

Expected: FAIL because the password component, validation markup, named mode group, and compact classes are absent.

- [ ] **Step 3: Create the focused password field**

Create `LoginPasswordField.tsx`:

```tsx
'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type LoginPasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> & {
  inputId: string;
  label: string;
  showLabel: string;
  hideLabel: string;
  errorId: string;
  errorMessage?: string;
};

export const LoginPasswordField = forwardRef<HTMLInputElement, LoginPasswordFieldProps>(
  function LoginPasswordField({
    label,
    inputId,
    showLabel,
    hideLabel,
    errorId,
    errorMessage,
    className,
    ...inputProps
  }, ref) {
    const [visible, setVisible] = useState(false);
    const toggleLabel = visible ? hideLabel : showLabel;
    return (
      <div className="block text-sm">
        <label htmlFor={inputId} className="mb-1 block text-text-secondary">{label}</label>
        <span className="relative mt-1 block">
          <Input
            {...inputProps}
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={`min-h-11 pr-12 ${className ?? ''}`}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? errorId : undefined}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute inset-y-0 right-0 min-h-11 w-11 px-0"
            aria-label={toggleLabel}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
          </Button>
        </span>
        {errorMessage ? <span id={errorId} className="mt-1 block text-xs text-state-warning">{errorMessage}</span> : null}
      </div>
    );
  }
);
```

- [ ] **Step 4: Apply compact layout and validation markup**

In `LoginAuthSurface.tsx`:

- change main padding to `p-4 sm:p-6`;
- change Back wrapper to `mb-3 w-full max-w-md sm:mb-6`;
- change card to `w-full max-w-md space-y-4 rounded-card border border-border bg-surface p-4 shadow-card sm:space-y-6 sm:p-6`;
- change header spacing to `space-y-3`;
- name the mode wrapper with `role="group" aria-label={authCopy.modeGroup}`;
- add `aria-pressed` to both mode buttons;
- keep each mode button at `min-h-11` on mobile;
- render `{authCopy.google}`;
- add `noValidate` to all three forms;
- use `mt-1` rather than the duplicated label margin plus input `mt-2`;
- add `min-h-11` to the email input in normal and reset forms;
- render email, Terms, and age errors with stable ids;
- pass password and confirmation errors to `LoginPasswordField`;
- render the form-attention live region:

```tsx
<p role="alert" className="sr-only">
  {formAttention ? authCopy.validation.formAttention : ''}
</p>
```

Resolve error codes with:

```ts
const fieldError = (field: AuthFieldName) => {
  const code = fieldErrors[field];
  return code ? authCopy.validation[code] : undefined;
};
```

Remove the normal signup `authCopy.links.haveAccount` button and normal sign-in `authCopy.links.newAccount` button. Keep Forgot password, reset Back to sign in, and the invalid-credential `signupSuggestion` card/actions.

- [ ] **Step 5: Verify focused tests, lint, and commit**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/login-auth-surface-contract.test.ts \
  tests/login-validation.test.ts \
  tests/login-validation-integration.test.ts \
  tests/login-page-architecture.test.ts
npm --prefix frontend run lint
pnpm --prefix frontend exec tsc --noEmit
git diff --check
git add \
  'frontend/app/(core)/login/_components/LoginAuthSurface.tsx' \
  'frontend/app/(core)/login/_components/LoginPasswordField.tsx' \
  tests/login-auth-surface-contract.test.ts \
  tests/login-page-architecture.test.ts
git commit -m "feat: compact the signup surface"
```

Expected: focused tests, lint, and typecheck pass; the surface keeps route behavior unchanged.

---

### Task 5: Align Video and Image Account-Gate Continuity

**Files:**
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Modify: `frontend/app/(core)/(workspace)/app/_lib/workspace-copy.ts`
- Modify: `frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-copy.ts`
- Modify: `frontend/app/(core)/(workspace)/app/image/_components/ImageAuthGateModal.tsx`
- Modify: `tests/workspace-pricing-gate-hook-contract.test.ts`
- Modify: `tests/image-workspace-split-contract.test.ts`
- Modify: `tests/workspace-locale-copy.test.ts`

**Interfaces:**
- Preserves both existing `loginRedirectTarget` URL shapes and button hierarchy.
- Adds image-gate `useAccessibleModal` parity with video.
- Changes copy only; no price, draft, generation, auth, or redirect computation changes.

- [ ] **Step 1: Add failing gate copy and accessibility assertions**

Add to `tests/workspace-locale-copy.test.ts`:

```ts
test('video and image auth gates promise only a return to the workspace', () => {
  for (const [locale, messages] of Object.entries(localeMessages)) {
    for (const gate of [messages.workspace.generate.authGate, messages.workspace.image.authGate]) {
      assert.match(gate.body, /return|ramèner|volver/i, `${locale} should explain Workspace return`);
      assert.doesNotMatch(gate.body, /free|gratuit|gratis|credit|crédit|price|prix|precio/i);
    }
  }
});
```

Add to `tests/image-workspace-split-contract.test.ts`:

```ts
assert.match(runtimeModalsSource, /<ImageAuthGateModal\b/);
const imageAuthGateSource = readFileSync(path.join(imageDir, '_components/ImageAuthGateModal.tsx'), 'utf8');
assert.match(imageAuthGateSource, /useAccessibleModal/);
assert.match(imageAuthGateSource, /role="dialog"/);
assert.match(imageAuthGateSource, /aria-modal="true"/);
assert.match(imageAuthGateSource, /data-modal-initial-focus="true"/);
```

Keep the existing video assertions for `ButtonLink` and encoded `loginRedirectTarget`.

- [ ] **Step 2: Run the focused gate tests and confirm red**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/workspace-locale-copy.test.ts \
  tests/workspace-pricing-gate-hook-contract.test.ts \
  tests/image-workspace-split-contract.test.ts
```

Expected: FAIL because current copy does not explain the return and the image modal lacks the accessible-modal hook.

- [ ] **Step 3: Apply exact continuity copy to defaults and dictionaries**

Use these body strings in `DEFAULT_WORKSPACE_COPY.authGate.body` and `workspace.generate.authGate.body`:

```text
EN: Explore the workspace with starter renders. Create an account and we'll return you here to continue.
FR: Explorez l’espace de travail avec les rendus de démonstration. Créez un compte et nous vous ramènerons ici pour continuer.
ES: Explora el workspace con renders de muestra. Crea una cuenta y volverás aquí para continuar.
```

Use these body strings in `DEFAULT_COPY.authGate.body` and `workspace.image.authGate.body`:

```text
EN: Explore the image workspace first. Create an account and we'll return you here to continue.
FR: Explorez d’abord l’espace image. Créez un compte et nous vous ramènerons ici pour continuer.
ES: Explora primero el workspace de imágenes. Crea una cuenta y volverás aquí para continuar.
```

Do not change title, primary, secondary, close, upload lock, or redirect strings.

- [ ] **Step 4: Give the image gate accessible-modal parity**

Import the existing shared hook. Keep the exported `ImageAuthGateModal` as the open-state guard and render an inner component so the hook is mounted only while the modal is open:

```tsx
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';

type ImageAuthGateModalProps = {
  open: boolean;
  copy: ImageWorkspaceCopy['authGate'];
  loginRedirectTarget: string;
  onClose: () => void;
};

export function ImageAuthGateModal(props: ImageAuthGateModalProps) {
  if (!props.open) return null;
  return <ImageAuthGateDialog {...props} />;
}

function ImageAuthGateDialog({
  copy,
  loginRedirectTarget,
  onClose,
}: Omit<ImageAuthGateModalProps, 'open'>) {
  const { dialogRef, onDialogKeyDown } = useAccessibleModal<HTMLDivElement>({ onClose });
  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6">
      <div className="absolute inset-0" role="presentation" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-auth-gate-title"
        aria-describedby="image-auth-gate-description"
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 id="image-auth-gate-title" className="text-base font-semibold text-text-primary">{copy.title}</h2>
            <p id="image-auth-gate-description" className="mt-2 text-sm text-text-secondary">{copy.body}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
            aria-label={copy.close}
          >
            {copy.close}
          </Button>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <ButtonLink
            href={`/login?next=${encodeURIComponent(loginRedirectTarget)}`}
            size="sm"
            className="px-4"
            data-modal-initial-focus="true"
          >
            {copy.primary}
          </ButtonLink>
          <ButtonLink
            href={`/login?mode=signin&next=${encodeURIComponent(loginRedirectTarget)}`}
            variant="outline"
            size="sm"
            className="px-4"
          >
            {copy.secondary}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
```

On the card add:

```tsx
ref={dialogRef}
role="dialog"
aria-modal="true"
aria-labelledby="image-auth-gate-title"
aria-describedby="image-auth-gate-description"
tabIndex={-1}
onKeyDown={onDialogKeyDown}
```

Give the heading and body those ids. Add `data-modal-initial-focus="true"` to the Create account `ButtonLink`. Preserve overlay dismissal and both hrefs.

- [ ] **Step 5: Verify green and commit**

Run the Step 2 command, then:

```bash
pnpm --prefix frontend exec tsc --noEmit
git diff --check
git add \
  frontend/messages/en.json \
  frontend/messages/fr.json \
  frontend/messages/es.json \
  'frontend/app/(core)/(workspace)/app/_lib/workspace-copy.ts' \
  'frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-copy.ts' \
  'frontend/app/(core)/(workspace)/app/image/_components/ImageAuthGateModal.tsx' \
  tests/workspace-locale-copy.test.ts \
  tests/workspace-pricing-gate-hook-contract.test.ts \
  tests/image-workspace-split-contract.test.ts
git commit -m "fix: clarify workspace signup continuity"
```

Expected: video/image gate tests and typecheck pass; redirects and generation code are untouched.

---

### Task 6: Run Full Regression and Blocking Visual QA

**Files:**
- Modify only if a check identifies a defect in the approved scope.
- Create local untracked evidence under `output/audits/2026-07-11-signup-density/final/`.

**Interfaces:**
- Consumes all prior tasks.
- Produces a merge-ready branch with automated and screenshot evidence.

- [ ] **Step 1: Run all focused auth, gate, locale, analytics, and redirect tests**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/login-*.test.ts \
  tests/auth-callback-redirect.test.ts \
  tests/auth-hash-session-contract.test.ts \
  tests/hosted-wallet-checkout-return.test.ts \
  tests/workspace-locale-copy.test.ts \
  tests/workspace-pricing-gate-hook-contract.test.ts \
  tests/image-workspace-split-contract.test.ts
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 2: Run repository-wide verification**

Run:

```bash
pnpm run test:validate
npm --prefix frontend run lint
pnpm --prefix frontend exec tsc --noEmit
npm run lint:exposure
git diff --check
```

Expected: full repository tests, ESLint, TypeScript, public-exposure guard, and whitespace checks pass.

- [ ] **Step 3: Run the production build**

Run:

```bash
pnpm --prefix frontend run build
```

Expected: Next.js compilation, static generation, and sitemap postbuild finish successfully. `/login` remains noindexed and present in the route manifest.

- [ ] **Step 4: Start the local app for the selected in-app Browser**

Run:

```bash
pnpm --prefix frontend dev
```

Use the existing in-app Browser, not a standalone Playwright browser. Do not create an account, complete OAuth, or make a payment.

- [ ] **Step 5: Capture and inspect settled desktop states**

At 1440 × 1024 capture:

1. `/app` guest before Generate;
2. video account gate;
3. `/login?next=%2Fapp` signup;
4. `/login?mode=signin&next=%2Fapp` sign-in;
5. `/login?mode=reset&next=%2Fapp` reset.

For every capture, inspect the saved image and reject loading, blank, cropped, wrong-route, or wrong-mode captures.

- [ ] **Step 6: Capture and inspect settled mobile states**

At 390 × 844 capture:

1. video account gate;
2. image account gate;
3. signup initial state;
4. signup empty-submit validation;
5. signup password revealed and confirmation hidden;
6. sign-in direct load;
7. reset direct load.

Verify:

- no document horizontal overflow;
- English Create account CTA visible before keyboard opening;
- no native browser validation bubble;
- first invalid field focused;
- mode group selection announced by state;
- password reveal keeps the value and exposes correct localized name;
- image modal traps focus, restores focus, and closes on Escape;
- longer French and Spanish text scrolls vertically without clipping.

- [ ] **Step 7: Perform blocking visual comparison**

Place each pre-change audit screenshot beside its matching final screenshot at the same viewport. Inspect the combined comparison for:

- preserved typography, colors, borders, shadows, radii, input heights, and button hierarchy;
- reduced redundant space rather than smaller unreadable text;
- legal links and checkbox rows that remain aligned;
- no clipped error text, icon overlap, or CTA overflow;
- no unexpected redesign of the account gate or desktop card.

Fix visible mismatches within scope, rerun the focused tests for touched files, and repeat the comparison until the final capture is accepted.

- [ ] **Step 8: Confirm the intentional diff and commit verification-only fixes**

Run:

```bash
git status --short
git diff --stat main...HEAD
git diff --check main...HEAD
git log --oneline main..HEAD
```

Expected: only the spec, plan, login route, auth copy, video/image gate copy, image modal, and their tests differ from `main`.

If visual QA required a source fix, stage only its exact files and commit:

```bash
git commit -m "fix: close signup density QA gaps"
```

Do not create an empty verification commit.

---

## Coverage Map

- Guest account-gate continuity: Task 5, Task 6 Steps 5–7.
- One-page Google and email visibility: Task 4, Task 6 Steps 5–7.
- Mobile density and CTA visibility: Task 4, Task 6 Steps 6–7.
- Duplicate mode-action removal: Task 4.
- First-render mode stability: Task 1, Task 6 Steps 5–6.
- First-render locale stability: Task 1 and Task 2.
- Localized validation and application feedback: Tasks 2–4.
- Password visibility: Task 4.
- Terms, age, and marketing semantics: Tasks 2–4 regression tests.
- Google OAuth, password auth, reset, confirmation, and safe return: Tasks 1–3 and Task 6 Steps 1–3.
- Analytics and privacy invariants: Task 3 and Task 6 Step 1.
- Image/video parity and accessible modal behavior: Task 5.
- Routes, metadata, canonical, robots, exposure, and build: Task 6 Steps 2–3.
