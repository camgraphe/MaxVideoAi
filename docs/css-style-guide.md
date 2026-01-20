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
- `bg`: `#F7F8FA`
- `surface`: `#FFFFFF`
- `surface-2`: `#F7F8FA`
- `surface-3`: `#EEF1F5`
- `border`: `#C2CAD6`
- `hairline`: `#EEF1F5`
- `text-primary`: `#131A22`
- `text-secondary`: `#5D6B7A`
- `text-muted`: `#7A8797`
- `brand`: `#426AAE`
- `accent`: `#0EA5E9`
- `accent-subtle`: `#E0F2FE`
- `ring`: `rgba(14, 165, 233, 0.35)`

Notes:
- Global body background uses `var(--bg)` -> `var(--surface-3)` in `frontend/app/globals.css`.
- Scrollbar track uses `hairline`; thumb is a semi-transparent slate in `frontend/app/globals.css`.

### Engine pictogram colors (light / dark)
Defined in `frontend/src/styles/tokens.css` and consumed by `frontend/src/lib/engine-branding.ts` + `frontend/components/ui/EngineIcon.tsx`.

Light tokens:
- `--engine-google-veo-bg`: `#CDE7FF` / `--engine-google-veo-ink`: `#1F2633`
- `--engine-openai-bg`: `#E4D7FF` / `--engine-openai-ink`: `#1F2633`
- `--engine-pika-bg`: `#FADCE6` / `--engine-pika-ink`: `#1F2633`
- `--engine-minimax-bg`: `#FFE7F0` / `--engine-minimax-ink`: `#1F2633`
- `--engine-kling-bg`: `#E6F5EB` / `--engine-kling-ink`: `#1F2633`
- `--engine-wan-bg`: `#E2F7F4` / `--engine-wan-ink`: `#1F2633`
- `--engine-luma-bg`: `#FFF2DC` / `--engine-luma-ink`: `#1F2633`
- `--engine-runway-bg`: `#E9EEF5` / `--engine-runway-ink`: `#1F2633`
- `--engine-lightricks-bg`: `#F2E9FF` / `--engine-lightricks-ink`: `#1F2633`
- `--engine-google-bg`: `#DCE9FF` / `--engine-google-ink`: `#1F2633`

Dark tokens:
- `--engine-google-veo-bg`: `#1F3B5C` / `--engine-google-veo-ink`: `#EAF2FF`
- `--engine-openai-bg`: `#332546` / `--engine-openai-ink`: `#F1E9FF`
- `--engine-pika-bg`: `#4A2A37` / `--engine-pika-ink`: `#FFE6F1`
- `--engine-minimax-bg`: `#4A2734` / `--engine-minimax-ink`: `#FFE6F1`
- `--engine-kling-bg`: `#203B2F` / `--engine-kling-ink`: `#E4F5EA`
- `--engine-wan-bg`: `#1E3D38` / `--engine-wan-ink`: `#E0FBF7`
- `--engine-luma-bg`: `#3F2F1F` / `--engine-luma-ink`: `#FFE9C7`
- `--engine-runway-bg`: `#27313D` / `--engine-runway-ink`: `#E7EDF5`
- `--engine-lightricks-bg`: `#36284D` / `--engine-lightricks-ink`: `#EFE5FF`
- `--engine-google-bg`: `#243B5A` / `--engine-google-ink`: `#EAF2FF`

Notes:
- These tokens are the source of truth for engine colors in dark mode (no pastel light values in dark).
- If a brandId is missing, add tokens + mapping in `frontend/src/lib/engine-branding.ts`.

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

> Note (accent)
>
> * Palette actuelle (code) : `accent = #0EA5E9` (cyan premium)
> * Regle d'usage : **CTA = brand** (primary blue), **accent = focus / petits highlights**.

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
* `color.dark.neutral.600` - `#24303B`
* `color.dark.neutral.900` - `#0E1218`

Neutral extensions (dark) - valeurs UI utiles hors 6-step

* `color.dark.neutralExt.surface` - `#16202B`
* `color.dark.neutralExt.surface2` - `#1C2734`
* `color.dark.neutralExt.surface3` - `#121821`
* `color.dark.neutralExt.border` - `#1F2A36`
* `color.dark.neutralExt.hairline` - `#1A232E`
* `color.dark.neutralExt.borderHover` - `#2D3A4C`

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

#### Glass / translucent surfaces

* `ui.surfaceGlass95` - `rgba(255, 255, 255, 0.95)`
* `ui.surfaceGlass90` - `rgba(255, 255, 255, 0.90)`
* `ui.surfaceGlass85` - `rgba(255, 255, 255, 0.85)`
* `ui.surfaceGlass80` - `rgba(255, 255, 255, 0.80)`
* `ui.surfaceGlass75` - `rgba(255, 255, 255, 0.75)`
* `ui.surfaceGlass70` - `rgba(255, 255, 255, 0.70)`
* `ui.surfaceGlass60` - `rgba(255, 255, 255, 0.60)`

Note: usage UI = panels/modals sur fond visible + `backdrop-blur`. Eviter `bg-white/xx` en nouvelles pages; preferer `bg-surface-glass-*` (Tailwind).

#### On-media / FX tints

* `ui.surfaceOnMedia5` - `rgba(255, 255, 255, 0.05)`
* `ui.surfaceOnMedia10` - `rgba(255, 255, 255, 0.10)`
* `ui.surfaceOnMedia15` - `rgba(255, 255, 255, 0.15)`
* `ui.surfaceOnMedia20` - `rgba(255, 255, 255, 0.20)`
* `ui.surfaceOnMedia25` - `rgba(255, 255, 255, 0.25)`
* `ui.surfaceOnMedia30` - `rgba(255, 255, 255, 0.30)`
* `ui.surfaceOnMedia40` - `rgba(255, 255, 255, 0.40)`
* `ui.surfaceOnMedia50` - `rgba(255, 255, 255, 0.50)`
* `ui.surfaceOnMedia60` - `rgba(255, 255, 255, 0.60)`
* `ui.surfaceOnMedia70` - `rgba(255, 255, 255, 0.70)`

Note: tokens invariants (white tints) pour chips/FX sur images ou videos et pour borders "glass". Usage Tailwind = `bg-surface-on-media-*` / `border-surface-on-media-*`.

#### On-media / text

* `ui.textOnMedia95` - `rgba(255, 255, 255, 0.95)`
* `ui.textOnMedia90` - `rgba(255, 255, 255, 0.90)`
* `ui.textOnMedia85` - `rgba(255, 255, 255, 0.85)`
* `ui.textOnMedia80` - `rgba(255, 255, 255, 0.80)`
* `ui.textOnMedia70` - `rgba(255, 255, 255, 0.70)`

Note: textes sur media = `text-on-media-*`.

#### On-media / dark scrims

* `ui.surfaceOnMediaDark5` - `rgba(0, 0, 0, 0.05)`
* `ui.surfaceOnMediaDark10` - `rgba(0, 0, 0, 0.10)`
* `ui.surfaceOnMediaDark40` - `rgba(0, 0, 0, 0.40)`
* `ui.surfaceOnMediaDark45` - `rgba(0, 0, 0, 0.45)`
* `ui.surfaceOnMediaDark50` - `rgba(0, 0, 0, 0.50)`
* `ui.surfaceOnMediaDark55` - `rgba(0, 0, 0, 0.55)`
* `ui.surfaceOnMediaDark60` - `rgba(0, 0, 0, 0.60)`
* `ui.surfaceOnMediaDark65` - `rgba(0, 0, 0, 0.65)`
* `ui.surfaceOnMediaDark70` - `rgba(0, 0, 0, 0.70)`
* `ui.surfaceOnMediaDark80` - `rgba(0, 0, 0, 0.80)`

Note: scrims fonces pour lisibilite sur media. Usage Tailwind = `bg-surface-on-media-dark-*`.

#### Preview outline (composite preview)

* `ui.previewOutlineIdle` - `rgba(0, 0, 0, 0.10)` (meme base que `ui.surfaceOnMediaDark10`)
* `ui.previewOutlineHover` - `rgba(14, 165, 233, 0.35)`
* `ui.previewOutlineActive` - `rgba(14, 165, 233, 0.60)`

Note: idle discret, accent reserve au hover/active.

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
* `ui.onInverse` - `#FFFFFF` (texte sur fonds tres sombres)

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

Note: `bg-placeholder` pour surfaces vides, `bg-skeleton` pour barres/shimmer.

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

Note: usage UI = `text-success`, `bg-success-bg`, `border-success-border` (idem warning/error/info).

#### Charts (admin)

* `ui.chartActive` - `#7C3AED`
* `ui.chartCharges` - `#F97316`

Note: utiliser `var(--chart-active)` / `var(--chart-charges)` dans les composants de chart (MiniBarChart).

#### Shadows

* `ui.shadowCard` - `0 1px 2px rgba(16,24,40,.06), 0 6px 16px rgba(16,24,40,.06)`
* `ui.shadowFloat` - `0 6px 16px rgba(16,24,40,.08)`

---

### UI tokens - Dark

#### Surfaces & layout

* `ui.bg` - `#0E1218`
* `ui.surface` - `#16202B`
* `ui.surface2` - `#1C2734`
* `ui.surface3` - `#121821`
* `ui.surfaceHover` - `#1F2A38`
* `ui.surfaceDisabled` - `#0E1218`

#### Glass / translucent surfaces

* `ui.surfaceGlass95` - `rgba(22, 32, 43, 0.95)`
* `ui.surfaceGlass90` - `rgba(22, 32, 43, 0.90)`
* `ui.surfaceGlass85` - `rgba(22, 32, 43, 0.85)`
* `ui.surfaceGlass80` - `rgba(22, 32, 43, 0.80)`
* `ui.surfaceGlass75` - `rgba(22, 32, 43, 0.75)`
* `ui.surfaceGlass70` - `rgba(22, 32, 43, 0.70)`
* `ui.surfaceGlass60` - `rgba(22, 32, 43, 0.60)`

Note: les chips "on-media" peuvent rester en `bg-white/xx` (art/brand), mais l'UI standard doit utiliser ces tokens.

#### On-media / FX tints

* `ui.surfaceOnMedia5` - `rgba(255, 255, 255, 0.05)`
* `ui.surfaceOnMedia10` - `rgba(255, 255, 255, 0.10)`
* `ui.surfaceOnMedia15` - `rgba(255, 255, 255, 0.15)`
* `ui.surfaceOnMedia20` - `rgba(255, 255, 255, 0.20)`
* `ui.surfaceOnMedia25` - `rgba(255, 255, 255, 0.25)`
* `ui.surfaceOnMedia30` - `rgba(255, 255, 255, 0.30)`
* `ui.surfaceOnMedia40` - `rgba(255, 255, 255, 0.40)`
* `ui.surfaceOnMedia50` - `rgba(255, 255, 255, 0.50)`
* `ui.surfaceOnMedia60` - `rgba(255, 255, 255, 0.60)`
* `ui.surfaceOnMedia70` - `rgba(255, 255, 255, 0.70)`

Note: tokens invariants (white tints) pour chips/FX sur images ou videos et pour borders "glass". Usage Tailwind = `bg-surface-on-media-*` / `border-surface-on-media-*`.

#### On-media / text

* `ui.textOnMedia95` - `rgba(255, 255, 255, 0.95)`
* `ui.textOnMedia90` - `rgba(255, 255, 255, 0.90)`
* `ui.textOnMedia85` - `rgba(255, 255, 255, 0.85)`
* `ui.textOnMedia80` - `rgba(255, 255, 255, 0.80)`
* `ui.textOnMedia70` - `rgba(255, 255, 255, 0.70)`

Note: textes sur media = `text-on-media-*`.

#### On-media / dark scrims

* `ui.surfaceOnMediaDark5` - `rgba(0, 0, 0, 0.05)`
* `ui.surfaceOnMediaDark10` - `rgba(0, 0, 0, 0.10)`
* `ui.surfaceOnMediaDark40` - `rgba(0, 0, 0, 0.40)`
* `ui.surfaceOnMediaDark45` - `rgba(0, 0, 0, 0.45)`
* `ui.surfaceOnMediaDark50` - `rgba(0, 0, 0, 0.50)`
* `ui.surfaceOnMediaDark55` - `rgba(0, 0, 0, 0.55)`
* `ui.surfaceOnMediaDark60` - `rgba(0, 0, 0, 0.60)`
* `ui.surfaceOnMediaDark65` - `rgba(0, 0, 0, 0.65)`
* `ui.surfaceOnMediaDark70` - `rgba(0, 0, 0, 0.70)`
* `ui.surfaceOnMediaDark80` - `rgba(0, 0, 0, 0.80)`

Note: scrims fonces pour lisibilite sur media. Usage Tailwind = `bg-surface-on-media-dark-*`.

#### Preview outline (composite preview)

* `ui.previewOutlineIdle` - `rgba(0, 0, 0, 0.00)`
* `ui.previewOutlineHover` - `rgba(14, 165, 233, 0.35)`
* `ui.previewOutlineActive` - `rgba(14, 165, 233, 0.55)`

Note: idle invisible, accent reserve au hover/active.

#### Borders

* `ui.border` - `#1F2A36`
* `ui.hairline` - `#1A232E`
* `ui.borderHover` - `#2D3A4C`
* `ui.borderDisabled` - `#1A232E`

#### Text

* `ui.textPrimary` - `#F7F8FA`
* `ui.textSecondary` - `#C9D2DE`
* `ui.textMuted` - `#6B778A`
* `ui.onSurface` - `#F7F8FA`
* `ui.onSurfaceMuted` - `#C9D2DE`
* `ui.textDisabled` - `#6B778A`
* `ui.onInverse` - `#FFFFFF` (texte sur fonds tres sombres)

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

* `ui.placeholder` - `#24303B`
* `ui.skeleton` - `#24303B`

Note: `bg-placeholder` pour surfaces vides, `bg-skeleton` pour barres/shimmer.

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

Note: usage UI = `text-success`, `bg-success-bg`, `border-success-border` (idem warning/error/info).

#### Charts (admin)

* `ui.chartActive` - `#7C3AED`
* `ui.chartCharges` - `#F97316`

Note: utiliser `var(--chart-active)` / `var(--chart-charges)` dans les composants de chart (MiniBarChart).

#### Shadows

* `ui.shadowCard` - `0 1px 2px rgba(0,0,0,.28), 0 8px 20px rgba(0,0,0,.22)`
* `ui.shadowFloat` - `0 12px 32px rgba(0,0,0,.32)`

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
* `ui.overlaySurface` -> token dedie (`#141B24`)
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

Objectif : rendre explicite le chemin de verite, pour eviter les divergences entre Figma, tokens CSS et Tailwind.

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
| `ui.surfaceGlass90` | `--surface-glass-90` | `bg-surface-glass-90` |
| `ui.surfaceOnMedia20` | `--surface-on-media-20` | `bg-surface-on-media-20` |
| `ui.surfaceOnMediaDark60` | `--surface-on-media-dark-60` | `bg-surface-on-media-dark-60` |
| `ui.textOnMedia80` | `--text-on-media-80` | `text-on-media-80` |
| `ui.onInverse` | `--on-inverse` | `text-on-inverse` |
| `ui.placeholder` | `--placeholder` | `bg-placeholder` |
| `ui.skeleton` | `--skeleton` | `bg-skeleton` |
| `ui.success` | `--success` | `text-success` |
| `ui.successBg` | `--success-bg` | `bg-success-bg` |
| `ui.successBorder` | `--success-border` | `border-success-border` |
| `ui.border` | `--border` | `border-border` |
| `ui.hairline` | `--hairline` | `border-hairline` |
| `ui.accent` | `--accent` | `text-accent` / `bg-accent` selon usage |
| `ui.onAccent` | `--on-accent` (ou computed) | `text-on-accent` (cible) |

Note: cote CSS vars on peut garder `--text-primary` etc. et, cote Figma, `ui.textPrimary` (camelCase). Les deux coexistent tant que le mapping est explicite.

### E) Accent (etat actuel + regle d'usage)

* Palette actuelle (code + doc) : `accent = #0EA5E9`
* Regle d'usage : **CTA = brand**, **accent = focus / petits highlights**.

---

## 6) Exceptions autorisees (placeholders)

But : autoriser quelques hardcodes uniquement quand c'est volontaire (branding / art), et garder l'UI 100% tokenisee.

### 6.1. Engine branding (OK hardcode)

* `frontend/src/**/engine-branding.ts`
* Toute logique "brand par engine" (badges/couleurs d'identification de modeles)
* `frontend/app/(localized)/[locale]/(marketing)/examples/page.tsx` (palette engine)

### 6.2. Marketing art / gradients (OK hardcode)

* `frontend/components/marketing/examples-orbit.module.css`
* Autres fichiers marketing qui contiennent des gradients decoratifs (hero/orbit/portal)
* `frontend/components/marketing/PriceEstimator.tsx` (glow decoratif)

### 6.3. Marques tierces / assets (OK hardcode)

* Logos / icones officiels (ex: Google sign-in SVG dans `frontend/app/(core)/login/page.tsx`)

### 6.4. Meta / platform colors (OK hardcode)

* `themeColor` / `mask-icon` (ex: `frontend/app/(core)/layout.tsx`, `frontend/app/(localized)/[locale]/layout.tsx`)

### 6.5. UI (NO hardcode)

* Surfaces, borders, text, hover/focus, overlays, shadows UI -> tokens uniquement (`ui.*` / CSS vars / Tailwind keys semantiques)

### 6.6. Legacy exceptions (tolerees temporairement)

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
* Eviter `bg-white/xx` pour les surfaces UI : utiliser `bg-surface-glass-*` (panels) ou `bg-surface-on-media-*` (chips/FX sur media).
* Autorise uniquement dans les chemins listes en 6.1 / 6.2.

---

## 8) Autres tokens CSS (spacing, radius, layout, motion)

Cette section liste les tokens non-couleurs deja presents dans `tokens.css` et leur usage recommande.

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
    * `--shadow-float` = `0 6px 16px rgba(16,24,40,.08)`
    * Dark overrides:
      * `--shadow-card` = `0 1px 2px rgba(0,0,0,.28), 0 8px 20px rgba(0,0,0,.22)`
      * `--shadow-float` = `0 12px 32px rgba(0,0,0,.32)`
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
  * `--text` = `var(--text-primary)`
  * `--muted` = `var(--text-muted)`
* Layout
  * `--header-height` = `72px` (globals.css)
* Motion (tailwind.config.ts)
  * `animation.button-pop` = `button-pop 180ms ease-out`
* Component-scoped vars
  * `--examples-grid-row-gap` = `12px` (examples-masonry.module.css)
  * `--orbit-*` (examples-orbit.module.css)
  * `--overlay-*` (ProcessingOverlay.tsx)


### Standards d'usage (non-couleurs)

> Ces tokens existent deja dans `tokens.css`. Ils sont la reference pour les nouvelles pages/composants.

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
  - `--page-padding-x` = `16px` (mobile baseline)
  - `--section-padding-y` = `72px` (mobile) / `88px` (desktop)
  - `--stack-gap` = `20px`
  - `--stack-gap-sm` = `12px`
  - `--stack-gap-lg` = `32px`
  - `--stack-gap-xl` = `40px`
  - `--grid-gap` = `28px`
  - `--grid-gap-sm` = `20px`
  - `--grid-gap-lg` = `36px`
  - `--grid-gap-xl` = `48px`
  - `--card-pad` = `16px`

- Sizing UI
  - `--input-height` = `40px`
  - `--button-height` = `40px`
  - `--chip-height` = `28px`
  - `--badge-height` = `24px`
  - `--icon-size` = `20px`

- Borders & focus
  - `--border-width` = `1px`
  - `--border-strong` = `2px`
  - `--ring-width` = `2px`
  - `--ring-offset` = `2px`

- Radius extensions
  - `--radius-sm` = `8px`
  - `--radius-md` = `10px` (alias `--radius-input`)
  - `--radius-lg` = `12px` (alias `--radius-card`)
  - `--radius-xl` = `16px`
  - `--radius-panel` = `12px`

> Hard rule: `rounded-full`/`pill` uniquement pour micro-UI (chips/badges). Jamais pour gros CTA ou grands conteneurs.

- Motion
  - `--duration-fast` = `160ms`
  - `--duration-base` = `200ms`
  - `--duration-slow` = `280ms`
  - `--ease-standard` = `cubic-bezier(0.2, 0, 0, 1)`
  - `--ease-enter` = `cubic-bezier(0.16, 1, 0.3, 1)`
  - `--ease-exit` = `cubic-bezier(0.7, 0, 0.84, 0)`
  - `--blur-overlay` = `12px`

- Typography scale
  - `--text-xs` = `12px` / `--leading-xs` = `16px`
  - `--text-sm` = `14px` / `--leading-sm` = `20px`
  - `--text-base` = `16px` / `--leading-base` = `24px`
  - `--text-lg` = `18px` / `--leading-lg` = `26px`
  - `--text-xl` = `20px` / `--leading-xl` = `28px`

- Opacity
  - `--opacity-muted` = `0.7`
  - `--opacity-disabled` = `0.5`

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
- Standard cible : `--section-padding-y` (mobile `72px` / desktop `88px`)
- Eviter les one-offs (`py-24`) sauf hero ou feature blocks majeurs
- Sections compactes (strips / bandeaux) : utiliser `.section-compact` (≈ `py-8`)
- Gaps XXL (hero, split layouts) : utiliser `stack-gap-xl` / `grid-gap-xl`

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

## 11) Accessibilite, theming, QA

Cette section fixe les regles transverses (a11y, structure, dark) a respecter pendant la refonte.

### Contraste & lisibilite
- Texte normal >= 4.5:1 ; texte large (>= 24px ou 18.66px bold) >= 3:1.
- Elements non-textes (icones, borders, focus ring) >= 3:1.
- Sur media/gradients, utiliser `text-on-media-*` + `surface-on-media-*` pour garantir la lisibilite.

### Focus, clavier, hit areas
- Focus visible obligatoire (utiliser `.focus-ring` + `ring-offset`).
- `outline-none` uniquement si un ring equivalant est applique.
- Hit area mobile min 44px pour boutons, toggles, liens critiques.
- `:focus-visible` prioritaire pour eviter le bruit au clic.

### Structure semantique (SEO-safe)
- 1 seul `h1` par page ; pas de saut de niveaux (h1 -> h2 -> h3).
- Ne pas changer le niveau de titre pour la taille : utiliser `text-*` et `leading-*`.
- Boutons / liens avec labels clairs ; pas d'icones seules sans `aria-label`.

### Dark mode (ready by design)
- Le theming passe par `tokens.css` (`:root` + `[data-theme="dark"]`).
- Pas de `bg-white` / `text-black` dans l'UI : toujours tokens `ui.*`.
- Elements "on-media" restent invariants (white tints + scrims).
- Valider contrastes en light/dark sur les pages "golden".

### Etats UI
- Hover/active/disabled doivent consommer `ui.*Hover` / `ui.*Disabled`.
- Disabled = pas d'effet hover, pas de focus ring visuel.
- Erreurs/alerts/form states utilisent `ui.error*` / `ui.warning*` etc.

### QA visuel (garde-fous)
- Pages "golden" : homepage, pricing, models, app (login + dashboard inclus).
- Verifier : spacing, boutons (text on brand), focus ring, contrastes.
- Comparatif avant/apres sur mobile + desktop (screenshots).

---

## 12) Visual system & art direction

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
- Tailles standard : 16 / 20 / 24 / 32 (20 par defaut dans l'app).
- Preferer `UIIcon` (Lucide) avec `strokeWidth` cohérent (1.5-1.75).
- Couleur par defaut : `currentColor` + tokens pour highlights.
- Icones decoratives : `aria-hidden` ; icones informatives : label explicite.

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
- `bg-placeholder` / `bg-skeleton` pour les chargements.
- `loading="lazy"` en liste ; `priority` reserve aux heros.
- Pas d'images trop lourdes au-dessus du fold.
