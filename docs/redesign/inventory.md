# Inventaire initial des gabarits publics

Base : `bdd544e9f`, après fetch du 9 septembre 2026. Inventaire des fichiers du groupe marketing ; pas un crawl des URLs déployées. Les chemins localisés sont définis dans `frontend/i18n/routing.ts`.

37 gabarits marketing repérés. Les paramètres dynamiques multiplient les URLs ; les pages légales et privées sont hors de ce groupe.

| Famille | Nombre de gabarits | Priorité de conception |
|---|---:|---|
| Accueil | 1 | Pilote |
| Assistants et intégrations | 4 | Après pilotes, à pondérer par trafic |
| Comparaisons et usages | 4 | Après pilotes, à pondérer par trafic |
| Exemples et lecteurs | 4 | Après pilotes, à pondérer par trafic |
| Institutionnel et états | 8 | Après pilotes, à pondérer par trafic |
| Modèles | 4 | Pilote |
| Outils | 5 | Après pilotes, à pondérer par trafic |
| Tarifs | 2 | Après pilotes, à pondérer par trafic |
| Éditorial et documentation | 5 | Après pilotes, à pondérer par trafic |

## Liste vérifiable

| Gabarit relatif au groupe marketing | Famille | Source |
|---|---|---|
| `(home)/page.tsx` | Accueil | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx) |
| `404/page.tsx` | Institutionnel et états | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/404/page.tsx) |
| `about/page.tsx` | Institutionnel et états | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/about/page.tsx) |
| `ai-video-engines/[slug]/page.tsx` | Comparaisons et usages | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx) |
| `ai-video-engines/best-for/[usecase]/page.tsx` | Comparaisons et usages | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/page.tsx) |
| `ai-video-engines/best-for/page.tsx` | Comparaisons et usages | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/page.tsx) |
| `ai-video-engines/page.tsx` | Comparaisons et usages | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/page.tsx) |
| `benchmarks/page.tsx` | Institutionnel et états | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/benchmarks/page.tsx) |
| `blog/[slug]/page.tsx` | Éditorial et documentation | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/page.tsx) |
| `blog/page.tsx` | Éditorial et documentation | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/blog/page.tsx) |
| `changelog/page.tsx` | Institutionnel et états | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/changelog/page.tsx) |
| `company/page.tsx` | Institutionnel et états | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/company/page.tsx) |
| `contact/page.tsx` | Institutionnel et états | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/contact/page.tsx) |
| `docs/[slug]/page.tsx` | Éditorial et documentation | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/docs/[slug]/page.tsx) |
| `docs/page.tsx` | Éditorial et documentation | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/docs/page.tsx) |
| `editorial-standards/page.tsx` | Institutionnel et états | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/editorial-standards/page.tsx) |
| `examples/[model]/page.tsx` | Exemples et lecteurs | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/examples/[model]/page.tsx) |
| `examples/page.tsx` | Exemples et lecteurs | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/examples/page.tsx) |
| `integrations/chatgpt/page.tsx` | Assistants et intégrations | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/integrations/chatgpt/page.tsx) |
| `integrations/claude/page.tsx` | Assistants et intégrations | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/integrations/claude/page.tsx) |
| `integrations/codex/page.tsx` | Assistants et intégrations | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/integrations/codex/page.tsx) |
| `mcp/page.tsx` | Assistants et intégrations | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/mcp/page.tsx) |
| `models/[slug]/page.tsx` | Modèles | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx) |
| `models/image/page.tsx` | Modèles | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/models/image/page.tsx) |
| `models/page.tsx` | Modèles | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/models/page.tsx) |
| `models/video/page.tsx` | Modèles | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/models/video/page.tsx) |
| `pay-as-you-go-ai-video-generator/page.tsx` | Tarifs | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx) |
| `pricing/page.tsx` | Tarifs | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx) |
| `status/page.tsx` | Institutionnel et états | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/status/page.tsx) |
| `tools/angle/page.tsx` | Outils | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/tools/angle/page.tsx) |
| `tools/background-removal/page.tsx` | Outils | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/tools/background-removal/page.tsx) |
| `tools/character-builder/page.tsx` | Outils | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/tools/character-builder/page.tsx) |
| `tools/page.tsx` | Outils | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/tools/page.tsx) |
| `tools/upscale/page.tsx` | Outils | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/tools/upscale/page.tsx) |
| `v/[videoId]/page.tsx` | Exemples et lecteurs | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/v/[videoId]/page.tsx) |
| `video/[videoId]/page.tsx` | Exemples et lecteurs | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/video/[videoId]/page.tsx) |
| `workflows/page.tsx` | Éditorial et documentation | [page.tsx](../../frontend/app/(localized)/[locale]/(marketing)/workflows/page.tsx) |

## Variantes obligatoires à échantillonner

- Modèles : vidéo, image, audio si exposé, dernier modèle, ancien/remplacé, présentation sans génération ; démo absente ; nom long.
- Comparaisons : contenu éditorial enrichi et fallback générique, différences de capacités, modèle remplacé.
- Exemples : index, famille, détail, absence de média, ouverture/reprise du prompt.
- Outils : index et chaque outil, avant/après et lecteur manuel.
- Tarifs : vidéo/image/audio/outils, unités de facturation et prix de départ contre devis exact.
- Éditorial : index et article/document long ; contenu localisé ou politique de fallback existante.
- Transversal : EN/FR/ES-LATAM, clair/sombre, 320/390/desktop, clavier, reduced motion.

## Inventaire URL à compléter

Pour chaque URL réellement publiée, collecter : famille, locale, statut HTTP, destination finale, canonical, indexabilité, sitemap, liens entrants internes, trafic/conversion disponibles, propriétaire de contenu et décision de migration. Ne pas estimer le trafic depuis le nombre de fichiers.

Priorités actuelles fondées sur les parcours et constats visuels. Aucun classement par clics ou chiffre d’affaires n’a encore été effectué.
