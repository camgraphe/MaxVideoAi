# Revue locale de l’accueil — proposition 03

Entrées : [FR](../home.html), [EN](../home-en.html), [es LATAM](../home-es.html). Les pages sont des supports de conception noindex, sans génération, paiement, événements analytics ou modification des routes de production.

Depuis la racine du worktree :

```bash
node docs/redesign/review/home/build.mjs
python3 -m http.server 8775 --bind 127.0.0.1
```

Réutiliser le serveur déjà présent sur le port 8775. La structure du dépôt est nécessaire aux images et à la police.

## Propriétaires

- `build.mjs` → `rebuild.mjs` : génération des trois pages, lecture des médias de l’accueil actuel, prix indicatifs éditoriaux, questions FAQ des dictionnaires et liens localisés. Le lecteur de sources est volontairement borné et échoue si l’ordre des cinq moteurs change ; réviser les attributions avant d’étendre la liste.
- `rebuild-copy.mjs` : nouvelle rédaction FR/EN/es-419.
- `content.mjs` : labels communs, réponses courtes déjà rédigées et source du starter Disco Motel.
- `rebuild.css` : composition claire, panneaux de films, présentation Angle, responsive, focus et mouvement réduit.
- `rebuild.client.mjs` : sélection, défilement Angle, boutons, fenêtres natives, langue et aperçu mobile.
- `playback.mjs` : un lecteur d’ambiance local, déplacé entre les panneaux ; gestion visibilité, pause explicite, fin de tentative et fallback original.
- `playback.test.mjs` : cinq tests du comportement du lecteur.

`render.mjs`, `editorial.mjs`, `home.css` et `home.mjs` sont les sources historiques de la proposition 02. Le générateur actif ne les charge plus. Ne pas exécuter l’ancien générateur sur les URLs courantes.

## Sources utilisées

| Contenu | Propriétaire consulté |
|---|---|
| Cinq films, posters, durée, ordre et coûts indicatifs | `frontend/components/marketing/home/home-redesign-visuals.ts` |
| Copie prioritaire du poster MiniMax, desktop/mobile | `frontend/config/home-posters.generated.json`, lecture seule |
| Vidéos d’ambiance préparées | `frontend/config/public-video-renditions.generated.json`, lecture seule ; original pour la vue agrandie |
| Questions et intentions SEO de l’accueil | `frontend/messages/{fr,en,es}.json`, `home.redesign.faq` ; les réponses viennent de la rédaction courte locale, alignée sur les mêmes huit questions |
| Quatre cadrages du dialogue | `frontend/src/components/tools/angle/landing/angle-landing-assets.ts`, images `angle-orbit-hero-dialogue-{source,field,reverse,elevated}.webp` |
| Preuve d’intégration Claude | Capture publique existante `frontend/public/media/mcp/claude-inline-video-proof.jpg` ; anglais de l’interface conservé dans la capture |
| Image Disco Motel | Starter existant de l’app ; pas d’attribution à un modèle |
| Marques | Logo MaxVideoAI et marques compactes existantes dans `frontend/public/brand/partners` |
| Police | Geist Latin locale, déjà présente dans le dépôt |
| Publication MCP et absence de promesse Studio | `frontend/config/mcp-publication.json` |
| Destinations | `frontend/i18n/routing.ts` et registre des modèles |

Les prix sont les **valeurs indicatives affichées par l’accueil existant**, pas des reçus vérifiés ni des devis actualisés. Le montant de la capture Claude reste propre à cette capture. Le choix du modèle change simultanément vidéo, libellé, durée, mode, estimation et liens.

Aucune image/vidéo distante n’a été téléchargée dans le dépôt pour contourner l’affichage. Aucune nouvelle génération n’a été nécessaire pour cette itération.

## Média et mouvement

Le poster initial est présent avant JavaScript. Les autres posters sont différés ; les panneaux mobiles masqués ne montent pas leur vidéo. La lecture mobile demande une action et la vue embarquée désactive l’autoplay. Le lecteur se déplace en libérant la source précédente. La sortie du champ, une fenêtre ouverte et l’onglet masqué suspendent la lecture ; une pause explicite reste respectée.

Angle utilise quatre images existantes. Les vues additionnelles se chargent à l’approche de la section, ou sur sélection avec Save-Data. Le scroll est natif, sans détournement de molette. Les boutons prennent temporairement la main sur le scroll. Petit écran, faible hauteur ou mouvement réduit donnent un bloc de hauteur naturelle. Aucune animation d’entrée ne cache le contenu initial.

Pour intégrer au site : réutiliser les propriétaires React de lecture vidéo et les URLs responsive de l’outil Angle. Ce prototype ne remplace ni `usePublicVideoPlayback`, ni `usePublicVideoControls`, ni la préparation des posters/renditions. Voir [le guide média](../../../engineering/media-delivery.md).

## Contrôler

```bash
node docs/redesign/review/home/build.mjs
node --check docs/redesign/review/home/rebuild.mjs
node --check docs/redesign/review/home/rebuild.client.mjs
node --test docs/redesign/review/home/playback.test.mjs
git diff --check
```

L’aperçu en iframe sert à la composition à 320, 390 et 768 px ; il ne simule pas un vrai téléphone, Safari ou un réseau lent. Captures dans le dossier `output/redesign-composition-03-2026-09-10` ignoré du checkout principal.

[Présentation](../../home-composition.md) · [Recette](../../home-composition-03-validation.md) · [Inventaire des destinations](../../home-replacement-links.json)
