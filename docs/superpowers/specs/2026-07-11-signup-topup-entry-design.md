# Signup and top-up entry continuity design

## Goal

Remove avoidable friction between public/workspace CTAs, authentication, and the first wallet top-up while preserving all public routes and the existing auth UI.

## Findings

- Public and mobile links labelled `Log in` currently open `/login?next=/app`, whose default mode is signup. Existing users therefore land on the wrong tab.
- The workspace header links to bare `/login` and `/login?mode=signin`. On routes such as `/app?engine=seedance-2-0` or `/billing?amount=2500&currency=USD`, using the header can lose the selected engine or top-up amount.
- Audio and Library account gates also rely on referrer/storage fallback instead of carrying an explicit return target.
- Feature-specific auth modals preserve return targets, but each rebuilds login URLs independently and leaves signup mode implicit.

## Design

- Add one browser-safe helper for explicit signup/signin login URLs.
- Add one helper that combines the current pathname and query string for auth return targets.
- Make every `Create account` entry explicit with `mode=signup`.
- Make every `Log in` or `Sign in` entry explicit with `mode=signin`.
- Preserve the current pathname and query from the workspace header and its mobile menu.
- Preserve fixed feature targets from Audio, Library, Storyboard, image/video workspace gates, Billing, and tool gates.
- Keep the login route, form, copy, OAuth flow, email confirmation flow, and next-target sanitizer unchanged.

## Acceptance criteria

- `Log in` opens the sign-in tab; `Create account` opens the signup tab.
- `/app?engine=seedance-2-0` survives a header auth handoff.
- `/billing?amount=2500&currency=USD` survives both header and Billing modal auth handoffs.
- Audio and Library return to their original route after auth.
- Existing auth gates keep their visual design and accessible modal behavior.
- No external or untrusted redirect target is introduced.
