# CSS Style Guide (Figma recap)

## Scope
This recap covers the CSS architecture, color system, and reusable rules in the frontend.

Primary sources:
- `frontend/tailwind.config.ts`
- `frontend/app/globals.css`
- `frontend/src/styles/tokens.css`
- `frontend/src/styles/skeleton.css`
- `frontend/components/**/*.module.css`
- `frontend/app/(localized)/[locale]/(marketing)/blog/blog-prose.css`

## Architecture overview
- Tailwind is the main styling layer. Most elements are styled via utility classes in JSX.
- A small set of global CSS files define tokens, baseline rules, and a few reusable classes.
- Component CSS modules are used for complex animations/layout that would be noisy in Tailwind.
- Colors exist in two parallel places: Tailwind theme tokens and CSS variables in `tokens.css`.

## Foundations

### Colors (semantic tokens)
Defined in:
- `frontend/tailwind.config.ts` as Tailwind theme colors
- `frontend/src/styles/tokens.css` as CSS variables

Palette:
- `bg`: `#F8F9FA`
- `surface`: `#FFFFFF`
- `border`: `#D1D5DB`
- `hairline`: `#E5E7EB`
- `text-primary`: `#111111`
- `text-secondary`: `#374151`
- `text-muted`: `#6B7280`
- `accent`: `#4F5D75`
- `accentSoft`: `#61708B`
- `ring`: `#9DA7B8`

Notes:
- Global body background uses a light gradient: `#F8F9FA -> #F3F5F7` in `frontend/app/globals.css`.
- Scrollbar track uses `hairline`; thumb is a semi-transparent slate in `frontend/app/globals.css`.

### Typography
Defined in `frontend/tailwind.config.ts`:
- `font-sans` / `font-display`: `"Geist"`, `"Inter"`, `system-ui`, `sans-serif`

Blog prose (`frontend/app/(localized)/[locale]/(marketing)/blog/blog-prose.css`):
- Uses Tailwind Typography plugin with custom sizing and color overrides.

### Radius
Defined in `frontend/tailwind.config.ts` and `frontend/src/styles/tokens.css`:
- `card`: `12px`
- `input`: `10px`
- `pill`: `9999px`

Usage (premium rules)
- `pill = 9999px` is fine, but **limit it to**: chips/tags/badges, small toggles, tiny pill buttons.
- Avoid `pill` on large CTAs and large containers (can feel too playful / “bubble UI”).
- Recommended mapping:
  - Chips/Badges → `rounded-pill`
  - Inputs + standard buttons → `rounded-input` (10px)
  - Cards/Panels → `rounded-card` (12px)
  - Modals/Popovers (premium) → consider a larger radius (ex: 16px) via a dedicated token.

### Shadows
Defined in `frontend/tailwind.config.ts` and `frontend/src/styles/tokens.css`:
- `card`: `0 1px 2px rgba(16,24,40,.06), 0 6px 16px rgba(16,24,40,.06)`
- `float`: `0 6px 16px rgba(16,24,40,.08)`

### Motion
Key animations:
- `mosaicDrift` in `frontend/app/globals.css` (background drift)
- `shimmer` in `frontend/src/styles/skeleton.css` (skeleton loading)
- `button-pop` in `frontend/tailwind.config.ts`
- `orbitSpin`, `orbitDrift`, `orbitLineDrift`, `portalBreath`, `portalRipple`, `portalWave` in `frontend/components/marketing/examples-orbit.module.css`
- `equalizerPulse` in `frontend/components/ui/audio-badge.module.css`

Reduced-motion handling:
- Global opt-out in `frontend/app/globals.css` using `prefers-reduced-motion`.

## Reusable global classes
From `frontend/src/styles/tokens.css`:
- `.card`: surface, border, radius, and shadow using CSS variables
- `.chip`: inline pill with muted text and light surface
- `.chip--accent`: accent chip variant
- `.overlay-btn`: frosted button style with hover color change

From `frontend/src/styles/skeleton.css`:
- `.skeleton`: shimmer loading placeholder

From `frontend/app/globals.css`:
- `.shadow-card`, `.shadow-float`: Tailwind shadow aliases
- `.focus-ring`: shared focus treatment

## Component-specific CSS modules

### `frontend/components/marketing/examples-orbit.module.css`
- Custom properties used per element for animation offsets:
  - `--orbit-x`, `--orbit-y`, `--orbit-drift-duration`, `--orbit-delay`, etc.
- Applies orbit and portal animations with layered gradients and shadows.

### `frontend/components/examples/examples-masonry.module.css`
- Flex masonry layout with responsive column stacking.

### `frontend/components/examples/examples-media.module.css`
- Forces media to fill container size.

### `frontend/components/ui/audio-badge.module.css`
- Equalizer bars using `currentColor` for quick theme switching.

### `frontend/app/(localized)/[locale]/(marketing)/blog/blog-prose.css`
- Rich text styling via Tailwind Typography with custom colors and spacing.

## How styles are applied (object-by-object vs variables)
- Primary approach is object-by-object via Tailwind utility classes in JSX.
- Reusable design tokens exist as:
  - Tailwind theme tokens (preferred for utility usage)
  - CSS variables in `tokens.css` (used by `.card`, `.chip`, `.overlay-btn`)
- Component CSS modules use custom properties for animation parameters and layout, not for global theme colors.

## Notes / risks
- Colors are duplicated in Tailwind theme and CSS variables. Keep them in sync to avoid drift.
- Hard-coded colors exist in component modules (e.g. portal gradients, skeleton, scrollbar thumb).

## MaxVideoAI - Color tokens (Light/Dark) + placeholders

Objectif : avoir **un inventaire unique** (Figma-style) des couleurs deja definies + les **tokens manquants** a prevoir pour un theme complet (et un dark mode futur) sans refactor massif.

---

## 1) Couleurs definies (Figma variables)

### Color / Light

#### Brand (7)

* `color.light.brand.primary` - `#426AAE`
* `color.light.brand.primaryHover` - `#355A95`
* `color.light.brand.primaryActive` - `#2B4F8A`
* `color.light.brand.secondary` - `#4C6898`
* `color.light.brand.subtle` - `#E6ECF5`
* `color.light.brand.onSubtle` - `#131A22`
* `color.light.brand.onPrimary` - `#FFFFFF`

#### Accent (4 + extensions)

* `color.light.accent.accent` - `#0EA5E9`
* `color.light.accent.accentHover` - `#0284C7`
* `color.light.accent.accentSubtle` - `#E0F2FE`
* `color.light.accent.onAccent` - `#FFFFFF`

Extensions (valeurs derivees / hors collection initiale)

* `color.light.accent.accentActive` - `#0169A3`

> Note (accent: palette actuelle vs palette cible)
>
> * Palette actuelle (code) : `accent = #4F5D75` (accent neutre/bleute deja present dans l'UI)
> * Palette cible (Figma/doc) : `accent = #0EA5E9` (cyan premium)
>
> Decision (ce doc) : on adopte la palette cible comme reference. Le but est de migrer vers ces valeurs **sans casser l'UI**, en commencant par les primitives (buttons/links/chips/focus) et en gardant uniquement les exceptions branding/marketing.

#### Neutral (6)

* `color.light.neutral.0` - `#FFFFFF`
* `color.light.neutral.50` - `#F7F8FA`
* `color.light.neutral.100` - `#EEF1F5`
* `color.light.neutral.300` - `#C2CAD6`
* `color.light.neutral.600` - `#5D6B7A`
* `color.light.neutral.900` - `#131A22`

Neutral extensions (light) - valeurs UI utiles hors 6-step

* `color.light.neutralExt.textMuted` - `#7A8797`
* `color.light.neutralExt.borderHover` - `#9AA7B6`
* `color.light.neutralExt.borderDisabled` - `#D6DCE5`
* `color.light.neutralExt.textDisabled` - `#9AA7B6`

#### Semantic (4)

* `color.light.semantic.success.600` - `#1F9D72`
* `color.light.semantic.warning.600` - `#D97706`
* `color.light.semantic.error.600` - `#DC2626`
* `color.light.semantic.info.600` - `#2563EB`

---

### Color / Dark

#### Brand (7)

* `color.dark.brand.primary` - `#5B7CFA`
* `color.dark.brand.primaryHover` - `#4A6BE0`
* `color.dark.brand.primaryActive` - `#3F5FCA`
* `color.dark.brand.secondary` - `#6B86B3`
* `color.dark.brand.subtle` - `#152033`
* `color.dark.brand.onSubtle` - `#EAF0FF`
* `color.dark.brand.onPrimary` - `#FFFFFF`

#### Accent (4 + extensions)

* `color.dark.accent.accent` - `#0EA5E9`
* `color.dark.accent.accentHover` - `#0284C7`
* `color.dark.accent.accentSubtle` - `#0B2A3A`
* `color.dark.accent.onAccent` - `#FFFFFF`

Extensions (valeurs derivees / hors collection initiale)

* `color.dark.accent.accentActive` - `#0169A3`

#### Neutral (6)

* `color.dark.neutral.0` - `#F7F8FA`
* `color.dark.neutral.50` - `#E7ECF3`
* `color.dark.neutral.100` - `#C9D2DE`
* `color.dark.neutral.300` - `#6B778A`
* `color.dark.neutral.600` - `#2A3440`
* `color.dark.neutral.900` - `#0B0F14`

Neutral extensions (dark) - valeurs UI utiles hors 6-step

* `color.dark.neutralExt.surface` - `#141B24`
* `color.dark.neutralExt.surface2` - `#1B2430`
* `color.dark.neutralExt.surface3` - `#0F141C`
* `color.dark.neutralExt.border` - `#253041`
* `color.dark.neutralExt.hairline` - `#1E2734`
* `color.dark.neutralExt.borderHover` - `#3B4A5F`

#### Semantic (4)

* `color.dark.semantic.success.600` - `#34D399`
* `color.dark.semantic.warning.600` - `#FBBF24`
* `color.dark.semantic.error.600` - `#F87171`
* `color.dark.semantic.info.600` - `#60A5FA`

---

## 2) Tokens "UI theme" (remplis)

Ces tokens sont la couche **semantique UI** (marketing + app). Ils doivent eviter les hexs dans les composants.

### Convention de naming

* Figma : `ui.surface2`, `ui.textPrimary` (camelCase)
* CSS vars runtime : `--surface-2`, `--text-primary` (kebab-case)
* Tailwind keys : `surface-2`, `text-primary` (kebab-case)

### UI tokens - Light

#### Surfaces & layout

* `ui.bg` - `#F7F8FA`
* `ui.surface` - `#FFFFFF`
* `ui.surface2` - `#F7F8FA`
* `ui.surface3` - `#EEF1F5`
* `ui.surfaceHover` - `#EEF1F5`
* `ui.surfaceDisabled` - `#EEF1F5`

#### Borders

* `ui.border` - `#C2CAD6`
* `ui.hairline` - `#EEF1F5`
* `ui.borderHover` - `#9AA7B6` (= `color.light.neutralExt.borderHover`)
* `ui.borderDisabled` - `#D6DCE5` (= `color.light.neutralExt.borderDisabled`)

#### Text

* `ui.textPrimary` - `#131A22`
* `ui.textSecondary` - `#5D6B7A`
* `ui.textMuted` - `#7A8797` (= `color.light.neutralExt.textMuted`)
* `ui.onSurface` - `#131A22`
* `ui.onSurfaceMuted` - `#5D6B7A`
* `ui.textDisabled` - `#9AA7B6` (= `color.light.neutralExt.textDisabled`)

#### Interactive

* `ui.brand` - `#426AAE`
* `ui.brandHover` - `#355A95`
* `ui.brandActive` - `#2B4F8A`
* `ui.onBrand` - `#FFFFFF`

* `ui.accent` - `#0EA5E9`
* `ui.accentHover` - `#0284C7`
* `ui.accentActive` - `#0169A3`
* `ui.accentSubtle` - `#E0F2FE`
* `ui.onAccent` - `#FFFFFF`

Note: en code, `accentSoft` existe encore. Cote design system, on le remplace par `ui.accentSubtle` (et on documente `accentSoft` comme legacy/deprecated lors de l'implementation).

* `ui.link` - `#426AAE`
* `ui.linkHover` - `#355A95`
* `ui.ring` - `rgba(14, 165, 233, 0.35)`

Note: changement visuel attendu. Ancien ring (code) etait plutot neutre (`#9DA7B8`). Le nouveau ring est teinte accent (rgba) pour aligner focus/active avec la palette cible.

#### Overlays

* `ui.overlayBg` - `rgba(19, 26, 34, 0.70)`
* `ui.overlaySurface` - `#FFFFFF`
* `ui.overlayInk` - `#131A22`
* `ui.overlayMuted` - `#5D6B7A`

#### Loading / placeholders

* `ui.placeholder` - `#EEF1F5`
* `ui.skeleton` - `#EEF1F5`

#### Semantic (base + derives)

* `ui.success` - `#1F9D72`
* `ui.successBg` - `rgba(31, 157, 114, 0.12)`
* `ui.successBorder` - `rgba(31, 157, 114, 0.35)`
* `ui.onSuccess` - `#131A22`

* `ui.warning` - `#D97706`
* `ui.warningBg` - `rgba(217, 119, 6, 0.12)`
* `ui.warningBorder` - `rgba(217, 119, 6, 0.35)`
* `ui.onWarning` - `#131A22`

* `ui.error` - `#DC2626`
* `ui.errorBg` - `rgba(220, 38, 38, 0.12)`
* `ui.errorBorder` - `rgba(220, 38, 38, 0.35)`
* `ui.onError` - `#131A22`

* `ui.info` - `#2563EB`
* `ui.infoBg` - `rgba(37, 99, 235, 0.12)`
* `ui.infoBorder` - `rgba(37, 99, 235, 0.35)`
* `ui.onInfo` - `#131A22`

#### Shadows

* `ui.shadowCard` - `0 1px 2px rgba(16,24,40,.06), 0 6px 16px rgba(16,24,40,.06)`
* `ui.shadowFloat` - `0 6px 16px rgba(16,24,40,.08)`

---

### UI tokens - Dark

#### Surfaces & layout

* `ui.bg` - `#0B0F14` (= `color.dark.neutral.900`)
* `ui.surface` - `#141B24` (= `color.dark.neutralExt.surface`)
* `ui.surface2` - `#1B2430` (= `color.dark.neutralExt.surface2`)
* `ui.surface3` - `#0F141C` (= `color.dark.neutralExt.surface3`)
* `ui.surfaceHover` - `#1B2430`
* `ui.surfaceDisabled` - `#0B0F14`

#### Borders

* `ui.border` - `#253041` (= `color.dark.neutralExt.border`)
* `ui.hairline` - `#1E2734` (= `color.dark.neutralExt.hairline`)
* `ui.borderHover` - `#3B4A5F` (= `color.dark.neutralExt.borderHover`)
* `ui.borderDisabled` - `#1E2734`

#### Text

* `ui.textPrimary` - `#F7F8FA`
* `ui.textSecondary` - `#C9D2DE`
* `ui.textMuted` - `#6B778A`
* `ui.onSurface` - `#F7F8FA`
* `ui.onSurfaceMuted` - `#C9D2DE`
* `ui.textDisabled` - `#6B778A`

#### Interactive

* `ui.brand` - `#5B7CFA`
* `ui.brandHover` - `#4A6BE0`
* `ui.brandActive` - `#3F5FCA`
* `ui.onBrand` - `#FFFFFF`

* `ui.accent` - `#0EA5E9`
* `ui.accentHover` - `#0284C7`
* `ui.accentActive` - `#0169A3`
* `ui.accentSubtle` - `#0B2A3A`
* `ui.onAccent` - `#FFFFFF`

* `ui.link` - `#5B7CFA`
* `ui.linkHover` - `#4A6BE0`
* `ui.ring` - `rgba(14, 165, 233, 0.45)`

#### Overlays

* `ui.overlayBg` - `rgba(11, 15, 20, 0.75)`
* `ui.overlaySurface` - `#141B24`
* `ui.overlayInk` - `#F7F8FA`
* `ui.overlayMuted` - `#C9D2DE`

#### Loading / placeholders

* `ui.placeholder` - `#2A3440`
* `ui.skeleton` - `#2A3440`

#### Semantic (base + derives)

* `ui.success` - `#34D399`
* `ui.successBg` - `rgba(52, 211, 153, 0.18)`
* `ui.successBorder` - `rgba(52, 211, 153, 0.40)`
* `ui.onSuccess` - `#F7F8FA`

* `ui.warning` - `#FBBF24`
* `ui.warningBg` - `rgba(251, 191, 36, 0.18)`
* `ui.warningBorder` - `rgba(251, 191, 36, 0.40)`
* `ui.onWarning` - `#F7F8FA`

* `ui.error` - `#F87171`
* `ui.errorBg` - `rgba(248, 113, 113, 0.18)`
* `ui.errorBorder` - `rgba(248, 113, 113, 0.40)`
* `ui.onError` - `#F7F8FA`

* `ui.info` - `#60A5FA`
* `ui.infoBg` - `rgba(96, 165, 250, 0.18)`
* `ui.infoBorder` - `rgba(96, 165, 250, 0.40)`
* `ui.onInfo` - `#F7F8FA`

#### Shadows

* `ui.shadowCard` - `0 1px 2px rgba(0,0,0,.35), 0 10px 24px rgba(0,0,0,.30)`
* `ui.shadowFloat` - `0 14px 40px rgba(0,0,0,.45)`

---

## 3) Proposition de mapping (pratique) : UI tokens -> palette

L'idee : les tokens `ui.*` sont **semantiques**, et ils pointent vers des couleurs `color.*`.

### Convention de naming (surface2)

* Figma : `ui.surface2` (camelCase)
* CSS vars runtime : `--surface-2` (kebab-case, deja utilise en code)
* Tailwind : key cible `surface-2` (ex: `bg-surface-2`) ou fallback temporaire `bg-[var(--surface-2)]`.

### Light (suggestion de base)

Surfaces

* `ui.bg` -> `color.light.neutral.50`
* `ui.surface` -> `color.light.neutral.0`
* `ui.surface2` -> `color.light.neutral.50` (ou une variante tres legere)
* `ui.surface3` -> `color.light.neutral.100`
* `ui.surfaceHover` -> `color.light.neutral.100`
* `ui.surfaceDisabled` -> `color.light.neutral.100`

Borders

* `ui.border` -> `color.light.neutral.300`
* `ui.hairline` -> `color.light.neutral.100`
* `ui.borderHover` -> `color.light.neutralExt.borderHover`
* `ui.borderDisabled` -> `color.light.neutralExt.borderDisabled`

Text

* `ui.textPrimary` / `ui.onSurface` -> `color.light.neutral.900`
* `ui.textSecondary` / `ui.onSurfaceMuted` -> `color.light.neutral.600`
* `ui.textMuted` -> `color.light.neutralExt.textMuted`
* `ui.textDisabled` -> `color.light.neutralExt.textDisabled`

Interactive

* `ui.brand` -> `color.light.brand.primary`
* `ui.brandHover` -> `color.light.brand.primaryHover`
* `ui.brandActive` -> `color.light.brand.primaryActive`
* `ui.onBrand` -> `color.light.brand.onPrimary`

* `ui.accent` -> `color.light.accent.accent`
* `ui.accentHover` -> `color.light.accent.accentHover`
* `ui.accentActive` -> `color.light.accent.accentActive`
* `ui.accentSubtle` -> `color.light.accent.accentSubtle`
* `ui.onAccent` -> `color.light.accent.onAccent`

* `ui.link` -> `color.light.brand.primary` (ou `ui.accent` si on migre l'accent)
* `ui.linkHover` -> `color.light.brand.primaryHover`
* `ui.ring` -> `rgba(14, 165, 233, 0.35)` (teinte accent)

Overlays / loading (notation)

* `ui.overlayBg` -> `color.light.neutral.900 @ 70%` (alpha)
* `ui.overlaySurface` -> `ui.surface`
* `ui.overlayInk` -> `ui.onSurface`
* `ui.overlayMuted` -> `ui.onSurfaceMuted`
* `ui.placeholder` -> `color.light.neutral.100`
* `ui.skeleton` -> `color.light.neutral.100`

Semantic (base + derives)

* `ui.success` -> `color.light.semantic.success.600`
* `ui.successBg` -> `color.light.semantic.success.600 @ 12%`
* `ui.successBorder` -> `color.light.semantic.success.600 @ 35%`
* `ui.onSuccess` -> `ui.onSurface`

* `ui.warning` -> `color.light.semantic.warning.600`
* `ui.warningBg` -> `color.light.semantic.warning.600 @ 12%`
* `ui.warningBorder` -> `color.light.semantic.warning.600 @ 35%`
* `ui.onWarning` -> `ui.onSurface`

* `ui.error` -> `color.light.semantic.error.600`
* `ui.errorBg` -> `color.light.semantic.error.600 @ 12%`
* `ui.errorBorder` -> `color.light.semantic.error.600 @ 35%`
* `ui.onError` -> `ui.onSurface`

* `ui.info` -> `color.light.semantic.info.600`
* `ui.infoBg` -> `color.light.semantic.info.600 @ 12%`
* `ui.infoBorder` -> `color.light.semantic.info.600 @ 35%`
* `ui.onInfo` -> `ui.onSurface`

Shadows

* `ui.shadowCard` -> `shadow.card` (a definir / peut differer en dark)
* `ui.shadowFloat` -> `shadow.float` (a definir / peut differer en dark)

### Dark (suggestion de base)

Surfaces

* `ui.bg` -> `color.dark.neutral.900`
* `ui.surface` -> `color.dark.neutralExt.surface`
* `ui.surface2` -> `color.dark.neutralExt.surface2`
* `ui.surface3` -> `color.dark.neutralExt.surface3`
* `ui.surfaceHover` -> `color.dark.neutralExt.surface2`
* `ui.surfaceDisabled` -> `color.dark.neutral.900` (ou `ui.bg`)

Borders

* `ui.border` -> `color.dark.neutralExt.border`
* `ui.hairline` -> `color.dark.neutralExt.hairline`
* `ui.borderHover` -> `color.dark.neutralExt.borderHover`
* `ui.borderDisabled` -> `color.dark.neutralExt.hairline`

Text

* `ui.textPrimary` / `ui.onSurface` -> `color.dark.neutral.0`
* `ui.textSecondary` / `ui.onSurfaceMuted` -> `color.dark.neutral.100`
* `ui.textMuted` -> `color.dark.neutral.300`
* `ui.textDisabled` -> `color.dark.neutral.300`

Interactive

* `ui.brand` -> `color.dark.brand.primary`
* `ui.brandHover` -> `color.dark.brand.primaryHover`
* `ui.brandActive` -> `color.dark.brand.primaryActive`
* `ui.onBrand` -> `color.dark.brand.onPrimary`

* `ui.accent` -> `color.dark.accent.accent`
* `ui.accentHover` -> `color.dark.accent.accentHover`
* `ui.accentActive` -> `color.dark.accent.accentActive`
* `ui.accentSubtle` -> `color.dark.accent.accentSubtle`
* `ui.onAccent` -> `color.dark.accent.onAccent`

* `ui.link` -> `color.dark.brand.primary`
* `ui.linkHover` -> `color.dark.brand.primaryHover`
* `ui.ring` -> `rgba(14, 165, 233, 0.45)` (teinte accent)

Overlays / loading (notation)

* `ui.overlayBg` -> `color.dark.neutral.900 @ 75%`
* `ui.overlaySurface` -> `ui.surface`
* `ui.overlayInk` -> `ui.onSurface`
* `ui.overlayMuted` -> `ui.onSurfaceMuted`
* `ui.placeholder` -> `color.dark.neutral.600`
* `ui.skeleton` -> `color.dark.neutral.600`

Semantic (base + derives)

* `ui.success` -> `color.dark.semantic.success.600`
* `ui.successBg` -> `color.dark.semantic.success.600 @ 18%`
* `ui.successBorder` -> `color.dark.semantic.success.600 @ 40%`
* `ui.onSuccess` -> `ui.onSurface`

* `ui.warning` -> `color.dark.semantic.warning.600`
* `ui.warningBg` -> `color.dark.semantic.warning.600 @ 18%`
* `ui.warningBorder` -> `color.dark.semantic.warning.600 @ 40%`
* `ui.onWarning` -> `ui.onSurface`

* `ui.error` -> `color.dark.semantic.error.600`
* `ui.errorBg` -> `color.dark.semantic.error.600 @ 18%`
* `ui.errorBorder` -> `color.dark.semantic.error.600 @ 40%`
* `ui.onError` -> `ui.onSurface`

* `ui.info` -> `color.dark.semantic.info.600`
* `ui.infoBg` -> `color.dark.semantic.info.600 @ 18%`
* `ui.infoBorder` -> `color.dark.semantic.info.600 @ 40%`
* `ui.onInfo` -> `ui.onSurface`

Shadows

* `ui.shadowCard` -> `shadow.card` (a definir / peut differer en dark)
* `ui.shadowFloat` -> `shadow.float` (a definir / peut differer en dark)

---

## 4) "Swatches" a placer sur une page (check visuel)

Creer une frame "Swatches" avec 2 colonnes (Light / Dark), et pour chaque colonne :

* Brand (primary, hover, active, secondary, subtle, onSubtle, onPrimary)
* Accent (accent, hover, subtle, onAccent)
* Neutral (0, 50, 100, 300, 600, 900)
* Semantic (success/warning/error/info)

Puis une section "UI theme tokens" (Light / Dark) montrant :

* bg / surface / surface2 / surface3
* border / hairline
* textPrimary / textSecondary / textMuted
* accent / ring
* overlayBg / overlaySurface

---

## 5) Notes importantes

* Ne pas ajouter de nouvelles couleurs UI hardcodees dans les prochains composants/pages.
* Exceptions hardcodees autorisees : engine branding + marketing art gradients (voir section ci-dessous).
* Les tokens `ui.*` sont la couche "semantique" : ils doivent etre utilises par l'UI (marketing + app). Les `color.*` sont la palette.

---

## 5.1) Mapping implementation (Figma -> CSS vars -> Tailwind)

Objectif : rendre explicite le chemin de verite, pour eviter les divergences (ex: **accent en code = `#4F5D75` aujourd'hui**, alors que la palette cible propose `#0EA5E9`).

### A) Figma variables (source design)

* Palette : `color.light.*` / `color.dark.*`
* Tokens UI semantiques : `ui.*` (ex: `ui.surface2`, `ui.overlayBg`, `ui.linkHover`)

### B) CSS variables (source runtime / theming)

* `tokens.css`

  * `:root` = light
  * `[data-theme="dark"]` = dark
* Convention recommandee :

  * CSS vars UI : `--bg`, `--surface`, `--surface-2`, `--border`, `--hairline`, `--text-primary`, ...
  * Overlays : `--overlay-bg`, `--overlay-ink`, `--overlay-muted`, `--overlay-surface`
  * Loading : `--skeleton`, `--placeholder`
  * Shadows : `--shadow-card`, `--shadow-float`

### C) Tailwind keys (consommation dans les composants)

* `tailwind.config.ts` expose des keys semantiques : `bg`, `surface`, `hairline`, `text-primary`, `accent`, `ring`, `overlay-bg`, etc.
* Ideal long terme (Option 1) : ces keys pointent vers les CSS vars, ex:

  * `colors: { bg: 'var(--bg)', surface: 'var(--surface)', accent: 'var(--accent)' }`

### D) Mini table de naming (Figma -> CSS var -> Tailwind key)

| Figma token | CSS variable | Tailwind key / usage |
| --- | --- | --- |
| `ui.textPrimary` | `--text-primary` | `text-text-primary` |
| `ui.textSecondary` | `--text-secondary` | `text-text-secondary` |
| `ui.textMuted` | `--text-muted` | `text-text-muted` |
| `ui.surface2` | `--surface-2` | `bg-[var(--surface-2)]` (temp) / `bg-surface-2` (cible) |
| `ui.border` | `--border` | `border-border` |
| `ui.hairline` | `--hairline` | `border-hairline` |
| `ui.accent` | `--accent` | `text-accent` / `bg-accent` selon usage |
| `ui.onAccent` | `--on-accent` (ou computed) | `text-on-accent` (cible) |

Note: cote CSS vars on peut garder `--text-primary` etc. et, cote Figma, `ui.textPrimary` (camelCase). Les deux coexistent tant que le mapping est explicite.

### E) Palette actuelle vs palette cible (accent)

* Palette actuelle (code) : `accent = #4F5D75` (accent neutre/bleute, deja present)
* Palette cible (Figma/doc) : `accent = #0EA5E9` (cyan premium)

Decision (ce doc) : la palette cible est la reference design. La migration se fait **progressivement** (primitives UI d'abord) pour eviter toute regression visuelle.

Regle de migration (anti-flou) :

1. On ne "cyanifie" pas tout d'un coup : on migre d'abord `Button(primary)`, `Link`, `Focus ring`, `Chip accent`.
2. Les surfaces/neutrals restent stables (elles changent seulement si on le decide explicitement).
3. Branding engines + marketing art restent des exceptions.

---

## 6) Exceptions autorisees (placeholders)

But : autoriser quelques hardcodes uniquement quand c'est volontaire (branding / art), et garder l'UI 100% tokenisee.

### 6.1. Engine branding (OK hardcode)

* `frontend/src/**/engine-branding.ts`
* Toute logique "brand par engine" (badges/couleurs d'identification de modeles)

### 6.2. Marketing art / gradients (OK hardcode)

* `frontend/components/marketing/examples-orbit.module.css`
* Autres fichiers marketing qui contiennent des gradients decoratifs (hero/orbit/portal)

### 6.3. UI (NO hardcode)

* Surfaces, borders, text, hover/focus, overlays, shadows UI -> tokens uniquement (`ui.*` / CSS vars / Tailwind keys semantiques)

### 6.4. Legacy exceptions (tolerees temporairement)

Objectif : garder une porte tres etroite pour l'existant, sans refactor massif.

Tolere temporairement (a reduire avec le temps) :

* `frontend/components/**/GalleryRail.tsx`
* `frontend/components/**/CompositePreviewDock.tsx`
* `frontend/components/**/QuadPreviewPanel.tsx`
* `frontend/components/**/MediaLightbox.tsx`
* `frontend/components/**/PriceEstimator.tsx`

Regle : toute nouvelle UI ou nouvelle page ne doit pas ajouter de nouveaux hex dans ces fichiers non plus.

---

## 7) Regle simple "no new UI hex" (a afficher dans le repo)

* Interdit dans les composants/pages UI : `bg-[#...]`, `text-[#...]`, `border-[#...]`, `shadow-[...]`, gradients UI en dur.
* Autorise uniquement dans les chemins listes en 6.1 / 6.2.

---

## 8) Autres tokens CSS (spacing, radius, layout, motion)

Cette section liste ce qui existe deja en tokens/vars (valeurs connues) et ce qui pourrait etre tokenise.

### Deja en place (valeurs connues)

* Radius
  * `tokens.css`
    * `--radius-card` = `12px`
    * `--radius-input` = `10px`
  * `tailwind.config.ts`
    * `theme.extend.borderRadius.card` = `12px`
    * `theme.extend.borderRadius.input` = `10px`
    * `theme.extend.borderRadius.pill` = `9999px`

* Shadows
  * `tokens.css`
    * `--shadow-card` = `0 1px 2px rgba(16,24,40,.06), 0 6px 16px rgba(16,24,40,.06)`
    * `--shadow-float` = `0 6px 16px rgba(16,24,40,.08)` *(a ajouter)*
  * `tailwind.config.ts`
    * `theme.extend.boxShadow.card` = `0 1px 2px rgba(16,24,40,.06), 0 6px 16px rgba(16,24,40,.06)`
    * `theme.extend.boxShadow.float` = `0 6px 16px rgba(16,24,40,.08)`
  * `globals.css`
    * `.shadow-card` / `.shadow-float` (aliases utilitaires)

* Fonts (tailwind.config.ts)
  * `font-sans` / `font-display` = `"Geist", "Inter", system-ui, sans-serif`
* Letter spacing (tailwind.config.ts)
  * `letterSpacing.micro` = `0.08em`
  * `letterSpacing.tiny` = `0.02em`
* Legacy text vars (tokens.css)
  * `--text` = `#111111`
  * `--muted` = `#6B7280`
* Layout
  * `--header-height` = `72px` (globals.css)
* Motion (tailwind.config.ts)
  * `animation.button-pop` = `button-pop 180ms ease-out`
* Component-scoped vars
  * `--examples-grid-row-gap` = `12px` (examples-masonry.module.css)
  * `--orbit-*` (examples-orbit.module.css)
  * `--overlay-*` (ProcessingOverlay.tsx)


### A tokeniser (propositions prioritaires)

> Objectif : ajouter des tokens **non-couleur** de façon *additive* (zéro régression). On ne remplace pas l’existant tout de suite :
> - On ajoute d’abord les variables dans `tokens.css` + un mapping Tailwind (quand on le décide).
> - On les utilise sur les **nouvelles pages / nouveaux composants**.
> - On migre progressivement les anciens one-offs ensuite.

#### Phase 1 — layout/spacing (le plus rentable)

- Spacing scale (subset "design")
  - `--space-1` = `4px`
  - `--space-2` = `8px`
  - `--space-3` = `12px`
  - `--space-4` = `16px`
  - `--space-5` = `24px`
  - `--space-6` = `32px`
  - `--space-7` = `48px`
  - `--space-8` = `64px`

- Layout sizing
  - `--container-max` = `1280px`
  - `--content-max` = `1120px`
  - `--page-padding-x` = `16px` *(mobile baseline; on peut augmenter via breakpoints Tailwind)*
  - `--section-padding-y` = `64px` *(cible douce; actuel frequent = 80-96px)*
  - `--stack-gap` = `16px`
  - `--stack-gap-sm` = `12px`
  - `--stack-gap-lg` = `24px`
  - `--grid-gap` = `24px`
  - `--grid-gap-sm` = `16px`
  - `--grid-gap-lg` = `32px`
  - `--card-pad` = `16px`

> Notes :
> - On garde la scale Tailwind par défaut, mais ce subset sert de **référence design** (anti-drift).
> - `--page-padding-x` peut être surchargé via `md:`/`lg:` côté Tailwind au lieu de variables responsives.
> - Spacing doux (migration) : viser `py-16`/`py-20` au lieu de `py-24` pour les sections standard, sans toucher aux heroes.

#### Phase 2 — sizing UI (cohérence composants)

- Form sizing
  - `--input-height` = `40px`
  - `--button-height` = `40px`
  - `--chip-height` = `28px`
  - `--badge-height` = `24px`
  - `--icon-size` = `20px`

#### Phase 3 — borders & focus (cohérence accessibilité)

- Border widths
  - `--border-width` = `1px`
  - `--border-strong` = `2px`
  - `--ring-width` = `2px`
  - `--ring-offset` = `2px`

#### Phase 4 — radius extensions (si besoin)

- Radius extensions
  - `--radius-sm` = `8px`
  - `--radius-md` = `10px` *(alias of `--radius-input`)*
  - `--radius-lg` = `12px` *(alias of `--radius-card`)*
  - `--radius-xl` = `16px` *(recommended for modals/popovers)*
  - `--radius-panel` = `12px` *(alias possible de `--radius-card`)*

> Hard rule: `rounded-full`/`pill` uniquement pour micro-UI (chips/badges). Jamais pour gros CTA ou grands conteneurs. Preferer `input/card/xl` pour boutons, panneaux et overlays.
> Note: des `rounded-[16px]` existent deja en code; si on veut les normaliser, utiliser `--radius-xl = 16px`.

#### Phase 5 — motion (design system, pas par fichier)

- Motion
  - `--duration-fast` = `160ms`
  - `--duration-base` = `200ms`
  - `--duration-slow` = `280ms`
  - `--ease-standard` = `cubic-bezier(0.2, 0, 0, 1)`
  - `--ease-enter` = `cubic-bezier(0.16, 1, 0.3, 1)`
  - `--ease-exit` = `cubic-bezier(0.7, 0, 0.84, 0)`
  - `--blur-overlay` = `12px`

#### Phase 5b — typography scale (eviter les tailles ad-hoc)

- Font sizes + line heights (proposition)
  - `--text-xs` = `12px` / `--leading-xs` = `16px`
  - `--text-sm` = `14px` / `--leading-sm` = `20px`
  - `--text-base` = `16px` / `--leading-base` = `24px`
  - `--text-lg` = `18px` / `--leading-lg` = `26px`
  - `--text-xl` = `20px` / `--leading-xl` = `28px`

#### Phase 5c — opacity tokens (coherence UI)

- Opacity (proposition)
  - `--opacity-muted` = `0.7`
  - `--opacity-disabled` = `0.5`

#### Phase 6 — z-index layers (éviter les magic numbers)

- Z-index layers
  - `--z-header` = `50`
  - `--z-popover` = `60`
  - `--z-modal` = `70`
  - `--z-toast` = `80`

---

## 9) Implementation notes (non-couleurs)

### Où stocker la vérité ?
- **Tailwind dominant** pour l’UI (classes utilitaires).
- **CSS vars** (`tokens.css`) pour :
  - tokens globaux utilisés par plusieurs patterns (layout sizing, z-index, motion),
  - et futurs thèmes (light/dark).

### Comment éviter la régression ?
- Ajouter les variables d’abord (additive), ne pas remplacer les valeurs existantes.
- Appliquer uniquement sur **nouveaux composants/pages**.
- Migrer ensuite les composants legacy (PR dédiées).
- When upgrading the look to “premium”, **do not** switch everything to `rounded-pill`: constrain pill usage to micro-UI and keep CTAs/panels consistent.

### Mapping vers Tailwind (quand on décide de le faire)
- Spacing : soit on garde Tailwind default et on documente le subset, soit on mappe `theme.spacing` sur les vars `--space-*`.
- Layout : créer des utilities `.container-page` / `.section` en `@layer components` qui utilisent `--container-max` et `--section-padding-y`.
- Motion : exposer `transitionDuration`/`transitionTimingFunction` alignées sur `--duration-*` / `--ease-*`.
- Z-index : étendre `theme.zIndex` avec `header/popover/modal/toast`.

---

## 10) Mobile-first layout rules

Objectif : ajouter des standards simples, applicables sans casser l'existant. On les applique aux nouvelles pages, puis on migre progressivement.

### Grids (mobile d'abord)
- Base : `grid grid-cols-1 gap-4`
- `md` : `md:grid-cols-2 md:gap-6`
- `lg` : `lg:grid-cols-3 lg:gap-6` (ou `lg:gap-8` si besoin)
- Regle : pas de layout "desktop d'abord" qui se compresse ensuite.

### Containers (largeur fluide + padding constant)
- Standard : `px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto`
- Regle : sur mobile, le padding fait le "premium".

### Section spacing (doux)
- Standard cible : `py-16` (mobile) / `py-20` (desktop)
- Eviter `py-24` sauf sections hero ou blocks "feature" majeurs
- Sections compactes (strips / bandeaux) : utiliser `.section-compact` (≈ `py-8`)

### Typo (mobile lisible)
- H1 : mobile `text-3xl`, desktop `text-5xl`
- H2 : mobile `text-2xl`, desktop `text-3xl`
- Paragraphes : `max-w-[62ch]` sur desktop uniquement
- Mobile : preferer `leading-relaxed`

### Buttons / hit area
- Mobile : `min-h-[44px]` partout (guideline Apple)
- Sizes recommandees :
  - `btn-sm` = `36-40px` (desktop only)
  - `btn-md` = `44px` (mobile default)
  - `btn-lg` = `48-52px` (CTA)

### Navigation mobile
- 1 CTA visible, le reste dans un menu
- Header mobile : `56-64px` max

### Cards / examples grids
- Mobile : stack vertical, pas de masonry
- Ratio image : `16:9` ou `4:3`
- Titre : max 2 lignes + ellipsis

### Tables / specs
- Pas de table brute en mobile
- Alternatives : cards key/value, accordion, ou 2 colonnes max

### Modals / overlays
- Mobile : full-screen ou bottom sheet
- Close button visible
- Scroll interne gere

### Sticky
- Desktop OK
- Mobile : eviter (pas de sticky agressif)

### Performance mobile
- `loading=\"lazy\"` sur les listes
- Thumbnails optimisees
- Eviter les gros elements animes au-dessus du fold (LCP)

---

## 11) Refonte - plan d'action (additive, sans tout casser)

Objectif : corriger la derive visuelle avec des changements progressifs. Cette section est la reference pour toutes les PR UI.

### Principes
- Source de verite : `tokens.css` (runtime + theming) et `tailwind.config.ts` (consommation).
- Aucun nouveau hex UI (voir regle section 7).
- Migration progressive : nouvelles pages d'abord, legacy ensuite.

### Phase 1 - Standardiser les tokens (fondations)
- Ajouter/valider les tokens non-couleur (spacing, radius, shadows, motion, states).
- Completer les tokens manquants (`--shadow-float`, `ui.*Hover`, `ui.*Disabled`, `ui.ring`).
- Documenter chaque token dans ce guide.

### Phase 2 - Primitives UI (source unique)
- Creer des composants de base : `Button`, `Input`, `Card`, `Badge`, `Link`, `Overlay`.
- Chaque primitive consomme uniquement les tokens `ui.*`.
- Interdire les variantes ad-hoc dans les nouvelles features.

### Phase 3 - Layout & spacing standard
- Ajouter des utilities : `.container-page`, `.section`, `.stack-gap`, `.grid-gap` (via `@layer components`).
- Appliquer aux nouvelles pages et sections principales.
- Adopter la cible "spacing doux" : `py-16`/`py-20` pour sections standard.

### Phase 4 - Migration par zones (priorite)
- Zone 1 : homepage marketing, pricing, docs (fort impact visuel).
- Zone 2 : composants partages (cards, nav, badges, tables).
- Zone 3 : pages secondaires.

### Phase 5 - Qualite + garde-fous
- Checklist PR : pas de `bg-[#...]`, `text-[#...]`, `border-[#...]` dans l'UI.
- Exceptions limitees (branding + marketing art).
- Audit trimestriel : top 10 fichiers UI avec le plus d'hex.

### Definition of Done (UI refonte)
- Tokens `ui.*` utilises partout dans l'UI standard.
- Aucune nouvelle couleur hardcodee hors exceptions.
- Spacing, radius, shadows, motion sont centralises.

---

## 11.1) Plan detaille (rollout safe)

Objectif : appliquer la refonte sans big-bang. Chaque etape est additive et verifiee avant la suivante.

### Etape 0 - Baseline + guardrails
- Scope : documentation + regles d'equipe.
- Actions :
  - Garder la regle "no new UI hex".
  - Lister les pages "golden" pour QA visuel (homepage, pricing, models, app).
- Checks :
  - Screenshots avant (desktop + mobile).
  - Liste des exceptions (branding + marketing art).
- Exit criteria :
  - Baseline validee et partagee.

### Etape 1 - Tokens non-couleur (additifs)
- Scope : `tokens.css` + `tailwind.config.ts`.
- Actions :
  - Ajouter `--shadow-float`, spacing subset, motion vars, z-index vars.
  - Exposer des keys Tailwind pour consommation progressive.
- Checks :
  - Aucun changement visuel (additif).
- Exit criteria :
  - Tokens disponibles + doc mise a jour.

### Etape 2 - Primitives UI (source unique)
- Scope : components UI (Button/Input/Card/Badge/Link/Overlay).
- Actions :
  - Creer primitives avec variantes (default/outline/ghost).
  - Focus/disabled standardises via tokens.
- Checks :
  - Snapshots des primitives (light/dark si dispo).
- Exit criteria :
  - Primitives utilisees sur nouvelles features.

### Etape 3 - Layout standard (container/section/spacing)
- Scope : utilities `container-page`, `section`, `stack-gap`.
- Actions :
  - Ajouter utilities via `@layer components`.
  - Appliquer sur 1-2 pages marketing "pilotes".
- Checks :
  - Pas de regression d'alignement / overlap.
- Exit criteria :
  - Pages pilotes valident le standard.

### Etape 4 - Migration zones a fort impact
- Scope : homepage marketing, pricing, docs.
- Actions :
  - Remplacer spacing ad-hoc par tokens/utilities.
  - Remplacer boutons/links par primitives.
- Checks :
  - Comparatif avant/apres sur mobile + desktop.
- Exit criteria :
  - Regression visuelle < seuil accepte.

### Etape 5 - Reste de l'UI
- Scope : composants partages + pages secondaires.
- Actions :
  - Migrer par lots (cards, nav, tables, modals).
  - Supprimer exceptions legacy au fur et a mesure.
- Checks :
  - QA visuel par lot.
- Exit criteria :
  - Exceptions reduites a branding/marketing art.

### Etape 6 - Stabilisation + governance
- Scope : process.
- Actions :
  - Checklist PR obligatoire.
  - Audit trimestriel des usages `bg-[#...]`.
- Exit criteria :
  - Pas de drift sur 2 sprints.

---

## 12) Refonte - sujets restants a couvrir

Cette section sert de checklist pour fermer la refonte.

### Accessibilite
- Contrastes min (texte normal et petit).
- Focus visible coherent (ring + offset).
- Hit area 44px sur mobile (boutons, toggles, liens critiques).

### Dark mode
- Strategie d'activation (opt-in, auto, ou toggle).
- Couverture des primitives UI avant les pages secondaires.
- Tests visuels light/dark sur pages marketing + app.

### Iconography
- Tailles standard (ex: 16/20/24).
- Regles de couleur (inherit vs token explicite).
- Stroke width coherent.

### Imagery / Media
- Ratios standard par type de card/hero.
- Fallback visuel + skeleton.
- Lazy loading par defaut en liste.

### Data density
- Tables -> cards en mobile.
- Pagination/virtualisation pour listes denses.

### Content / microcopy
- Usage des caps (labels/eyebrows).
- Longueur max de titres/cta.

### QA visuel
- Pages "golden" (homepage, pricing, models, app).
- Comparatif before/after sur spacing + buttons + focus.

---

## 13) Visual system & art direction

Cette section complete la bible UI pour la coherence visuelle (branding, art, hierarchie).

### Brand identity
- Usage logo (light/dark), clear space, tailles min.
- Regles d'alignement des wordmarks partenaires.
- Interdits (stretch, recolor, drop shadow gratuit).

### Illustration / art direction
- Style d'illustration (si applicable) : flat vs 3D vs photo.
- Gradients hero : intensite limitee, pas sur tous les blocs.
- Background patterns : subtils, jamais en concurrence avec le texte.

### Iconography
- Set officiel (nom + source).
- Tailles standard : 16 / 20 / 24 / 32.
- Stroke width coherent (ex: 1.5px ou 2px).
- Couleur par defaut : `currentColor` + tokens pour highlights.

### Motion design
- Principes : sobriete, utilite, reduire le bruit.
- Page load : reveal doux (stagger leger).
- Hover : max 1-2 proprietes (shadow + translate).
- Eviter les loops visuelles fortes sur mobile.

### Visual hierarchy
- Regle d'accent : 1 element primaire par section.
- Accent budget (hard rule) : 1 element accent max par section (hors focus). Pas d'accent sur 3 composants adjacents.
- Tonalites : neutrals pour base, brand/accent pour actions.
- CTA primaire unique par bloc.

### Density modes
- Default = comfortable.
- Compact = admin/dashboards (si besoin).
- Spacing ajustes via tokens (pas de hacks locaux).

### Content & microcopy
- Labels en caps : pour badges/eyebrows uniquement.
- Titres courts (ideal < 60 caracteres).
- CTA clairs, verbes d'action.

### Responsive typography
- Scale responsive par breakpoints (ex: H1 3xl -> 5xl).
- Longueur de ligne marketing : 60-70ch desktop, libre mobile.

### Media usage
- Ratios standard par type (cards, hero, gallery).
- Pas d'images trop lourdes au-dessus du fold.
