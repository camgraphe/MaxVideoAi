# Composition locale de l'accueil

Support de conception, sans API de génération ni route applicative modifiée. Entrée : [FR](../home.html), [EN](../home-en.html), [es LATAM](../home-es.html). Les actions produit ouvrent les destinations réelles dans un nouvel onglet.

Depuis la racine du worktree :

```bash
node docs/redesign/review/home/build.mjs
python3 -m http.server 8775 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8775/docs/redesign/review/home.html`. Réutiliser le serveur existant si le port est déjà occupé. La structure du dépôt est nécessaire pour les images et la police ; servir uniquement sur l'interface locale.

## Propriétaires

- `content.mjs` : textes FR/EN/es-419, sources visuelles, intentions des effets. Les annotations de revue restent en français pour Adrien.
- `build.mjs` : génération des trois pages HTML et destinations localisées. Modifier le générateur ou les contenus, puis régénérer ; ne pas modifier les pages générées séparément.
- `home.css` : composition responsive et états de focus/mouvement réduit.
- `home.mjs` : sélection du modèle, annotations, langue, menu et aperçu mobile. Aucun framework ni dépendance ajoutée.

Les FAQ et le premier exemple sont présents dans le HTML. Les images ont une géométrie déclarée ; seul le poster principal est prioritaire. Les autres couvertures sont différées. Aucun élément vidéo, canvas 3D ou téléchargement de l'ancien essai de mouvement n'est présent dans cette page.

## Provenance

| Visuel | Source de vérité consultée | Usage dans la revue |
|---|---|---|
| Astronaute / Kling 3 Pro | `frontend/components/marketing/home/home-redesign-visuals.ts`, `KLING_3_PRO_HERO_RENDER` | Poster public exact, 12 s, image vers vidéo. Ouverture et choix Kling |
| Ballons / Seedance 2.5 | Même fichier, `HERO_ENGINE_MEDIA` | Poster public exact, 10 s, texte vers vidéo. Choix Seedance |
| Scène narrative / MiniMax H3 Max | Même fichier, affiche `showcase-minimax-h3-max-12s.webp` et sa projection dans `frontend/config/home-posters.generated.json` | Copie d'affichage préparée déjà existante, 12 s, texte vers vidéo. Choix MiniMax ; galerie famille `hailuo` |
| Acid portrait, Disco motel, Night shift | `frontend/lib/starter-media.ts`, fichiers `frontend/public/assets/app-starters` | Images initiales de l'app, sans attribution à un moteur. Disco Motel est aussi la référence illustrative du MCP |
| Marques des modèles | `frontend/src/lib/brand-partners.ts`, marques compactes de `frontend/public/brand/partners` | Identification des familles, pas endorsement ni partenariat revendiqué |
| Claude et OpenAI avec Codex | Marques existantes du dépôt et convention du site | Identification des assistants. Une marque propre à Codex reste à vérifier avant publication |
| MaxVideoAI | `frontend/public/assets/branding/logo-mark.svg` | Signe officiel existant associé au nom en texte |
| Typographie | `frontend/app/(core)/_fonts/GeistLatin.woff2`, Georgia système | Aucun appel à un fournisseur externe de polices |

Le catalogue, les slugs et la publication des modèles ont été vérifiés dans `frontend/config/model-registry.json`. Les destinations localisées suivent `frontend/i18n/routing.ts`. Le prix avant génération, le paiement à l'usage et les crédits rendus en cas d'échec reprennent les conditions affichées dans `frontend/messages/fr.json`. La disponibilité MCP/Studio reprend `frontend/config/mcp-publication.json` et [l'analyse produit](../../product-narrative.md).

Aucune nouvelle génération d'image ou vidéo, dépense ou copie de média distant dans le dépôt. La préparation et l'activation de nouveaux médias de production restent régies par [le guide médias](../../../engineering/media-delivery.md).

L'aperçu en iframe teste une largeur de composition. Il ne simule ni un téléphone physique, ni Safari, ni un réseau lent. Les pages sont `noindex,nofollow` et n'ont pas de canonical, hreflang ou schéma de production. Voir [la recette](../../home-composition-validation.md).
