# Homepage conversion performance design

## Goal

Reduce the transfer and hydration cost of the default English homepage at `/` without changing its visible design, content, navigation, metadata, canonical URL, hreflang output, JSON-LD, or localized routes.

## Finding

The Next.js build summary reports `/` at 231 kB of first-load JavaScript and `/[locale]` at 124 kB. Direct inspection of the production HTML shows that this comparison is misleading: `/` and `/fr` load comparable JavaScript payloads once their nested layouts are included.

The real default-homepage overhead is the complete client translation catalog. The English catalog is serialized through `I18nProvider`, even though the homepage's client components only read the `nav` and `footer` namespaces. The homepage body content is already localized on the server and passed to its interactive components as props.

## Design

- Keep `LocaleLayout` full-catalog by default so every existing localized and unprefixed marketing route preserves its current behavior.
- Add an optional list of client message namespaces to the manual default-locale layout composition.
- Use that option only from `frontend/app/(root)/page.tsx`.
- Serialize `nav` and `footer` for `/`, because `MarketingNav`, `MarketingFooter`, and `LanguageToggle` are the only homepage client surfaces that read the custom i18n context.
- Preserve the same selected dictionary object as the English fallback.
- Add an architecture contract that fails if homepage components start reading client translations without expanding the declared scope.

## Non-goals

- No redirect between `/` and `/en`.
- No route-group migration.
- No copy, layout, visual, CTA, pricing, or media changes.
- No reduction of translation data on other routes or locales.
- No removal of analytics, consent, auth snapshot, navigation, or footer behavior.

## Acceptance criteria

- `/` renders the same visible homepage and marketing shell.
- `/` retains its canonical, hreflang alternates, and structured data.
- Navigation, account state, language selector, theme toggle, homepage CTA, and footer links remain interactive.
- `/fr` and the other localized routes continue receiving the full dictionary.
- The production HTML transferred for `/` is materially smaller.
- Focused contracts, TypeScript, lint, exposure lint, production build, and browser QA pass.
