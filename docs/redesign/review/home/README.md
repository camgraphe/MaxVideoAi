# Revue locale de l’accueil — master anglais 04

Entrée de référence : [English master](../home-en.html?v=4). [Angle](../angle-en.html) conserve l’étude de cadrages pour la future page outil. [EN 03](../home-en-v3.html), [FR 03](../home.html) et [ES LATAM 03](../home-es.html) sont historiques.

Ces pages sont noindex et locales. Elles ne génèrent pas de média, ne facturent rien et n’envoient pas d’événement analytics.

## Construire et servir

Depuis la racine du worktree :

```bash
node docs/redesign/review/home/build.mjs
python3 -m http.server 8775 --bind 127.0.0.1
```

Réutiliser le serveur déjà présent. Le générateur écrit uniquement home-en.html et angle-en.html. Il ne retraduit pas FR/ES.

## Propriétaires

- build.mjs → master.mjs : assemble le master à partir du rendu de base, remplace les chapitres, projette seulement les données nécessaires au navigateur et conserve Angle séparément.
- rebuild.mjs : rend la composition 03 à la demande, sans écriture automatique. Conserve les contrats des cinq films, posters préparés, prix indicatifs, FAQ et liens. Échoue si l’ordre ou les sources attendues changent.
- master-data.mjs : lit les modèles actuels publiés et le catalogue généré, puis les notes et capacités. Vérifie la publication des trois comparaisons et la plage des notes.
- master-sections.mjs : HTML du catalogue, de Compare et de Connect. Le contenu principal, les notes initiales et les liens du catalogue existent avant JavaScript.
- rebuild.css + master.css : base claire conservée, chapitres Compare/Connect, fenêtres, responsive et mouvement réduit.
- master.client.mjs : lecteur, modales natives, aperçu mobile et préférences.
- master-interactions.mjs : recherche/filtres, défilement des familles, données du scorecard et étapes Connect.
- playback.mjs : unique lecteur d’ambiance, visibilité, pause explicite, déplacement entre modèles et fallback original ; cinq tests existants.
- angle.client.mjs : étude séparée des quatre cadrages. Aucun chargement de ces images dans le master 04.

rebuild-copy.mjs et content.mjs gardent les contenus de base. rebuild.client.mjs reste utilisé par les pages 03. render.mjs, editorial.mjs, home.css et home.mjs sont historiques ; ne pas exécuter les anciens générateurs sur les pages courantes.

## Sources

| Donnée | Source |
|---|---|
| Publication, identité et famille | frontend/config/model-registry.json |
| Nom de présentation | frontend/config/engine-catalog.json, lecture seule |
| Six critères éditoriaux | data/benchmarks/engine-scores.v1.json |
| Capacités | data/benchmarks/engine-key-specs.v1.json |
| Méthode et nature des notes | /benchmarks, page publique consultée le 10 septembre 2026 |
| Cinq films, ordre, durée, poster et coûts indicatifs | frontend/components/marketing/home/home-redesign-visuals.ts |
| Poster prioritaire mobile/desktop | frontend/config/home-posters.generated.json, lecture seule |
| Vidéos préparées | frontend/config/public-video-renditions.generated.json, lecture seule |
| Huit questions de départ | frontend/messages/en.json, home.redesign.faq |
| Preuve Claude | frontend/public/media/mcp/claude-inline-video-proof.jpg |
| Angle | Images publiques angle-orbit-hero-dialogue-{source,field,reverse,elevated}.webp |
| Disco Motel | Starter existant de l’app, sans attribution à un modèle |
| Marques et police | Assets locaux existants ; FLUX a un repère typographique, sans logo inventé |

Les scores sont éditoriaux. Les prix des exemples restent indicatifs ; aucun calcul de tarif n’a été ajouté au navigateur. La capture Claude garde son propre contexte et n’est pas rattachée au brief illustratif de Connect. Aucun modèle, score, catalogue généré ou média de production n’est modifié.

## Contrôles

```bash
node docs/redesign/review/home/build.mjs
node --check docs/redesign/review/home/master.mjs
node --check docs/redesign/review/home/master.client.mjs
node --check docs/redesign/review/home/master-interactions.mjs
node --check docs/redesign/review/home/angle.client.mjs
node --test docs/redesign/review/home/playback.test.mjs
npm run lint:exposure
git diff --check
```

L’aperçu local propose 320, 390 et 768 px. Le sélecteur « Connect step » de la revue permet d’examiner chaque état dans l’iframe. Il ne fait pas partie du site proposé. Cet aperçu ne remplace pas les essais sur iOS/Android, réseau lent et technologies d’assistance.

Pour l’intégration, reprendre les propriétaires React existants, les contrats média et les chargements responsive ; ces scripts de revue ne sont pas destinés à être copiés tels quels dans le site.

[Présentation](../../home-composition.md) · [Recette](../../home-composition-04-validation.md) · [Destinations](../../home-replacement-links.json)
