# Pack créatif — Claude Desktop, brief → clip

Le pack local est produit et exporté : **deux ouvertures × deux formats × deux durées**, soit huit MP4, seize fichiers de sous-titres SRT/VTT, quatre posters et deux vignettes SVG/PNG. Il réutilise le rendu réel de la montre déjà présent dans le dépôt. Les fichiers portent **REVIEW CUT** ; ils sont prêts à examiner et modifier, pas autorisés à diffuser.

## Une seule hypothèse

Public : utilisateurs anglophones de **Claude Desktop** qui préparent un produit, un projet ou une campagne et ont besoin d'un clip. Promesse à examiner : partir du brief du projet, connecter et autoriser le compte MaxVideoAI, choisir les réglages, examiner le devis exact, l'approuver puis récupérer le média terminé. La connexion peut intervenir avant la planification détaillée ; le montage montre l'autorisation avant tout devis protégé.

Destination et action uniques : [page Claude Desktop](https://maxvideoai.com/integrations/claude) → **See the Claude Desktop setup**. La page officielle relue le 05/10 décrit le connecteur, l'autorisation du compte, le devis et la récupération. Sa preuve de compatibilité reste un test staging daté d'août ; cette lecture n'est pas un nouveau test connecté. Le [hub MCP](https://maxvideoai.com/mcp) confirme la séparation entre autorisation du compte et approbation du devis. Aucun gain de conversion, canal gagnant, ROI ou coût d'acquisition n'est établi.

## Textes anglais exacts

| Élément | Texte |
| --- | --- |
| Promesse de travail | Turn your project brief into a quoted clip with Claude Desktop and MaxVideoAI. |
| Ouverture A — résultat | Your project needs a clip. |
| Ouverture B — contrôle | The quote first. Your approval next. |
| Ligne de contexte commune | For the project you develop in Claude Desktop. |
| Description | Turn a project brief into a clip with Claude Desktop and MaxVideoAI. Connect your account, review the exact quote and approve before generation. Account, connector and credits required; assistant requirements vary. |
| Description courte | Brief. Connect. Review the quote. Approve. Retrieve the clip. See the Claude Desktop setup. |
| CTA | See the Claude Desktop setup |

Le corps et le CTA sont communs. A fait regarder le résultat existant ; B rend le contrôle du devis plus saillant. Ce sont deux directions à comparer qualitativement, pas deux performances prévues. Aucun prix chiffré, essai gratuit, vitesse de génération, résultat client, affiliation Anthropic ou disponibilité universelle Claude n'est ajouté.

## Fichiers pour revue

| Direction | 24 s · horizontale | 24 s · verticale | 48 s · horizontale | 48 s · verticale |
| --- | --- | --- | --- | --- |
| A · résultat | [MP4](pack/exports/claude-clip-a-horizontal-short24-review.mp4) | [MP4](pack/exports/claude-clip-a-vertical-short24-review.mp4) | [MP4](pack/exports/claude-clip-a-horizontal-review.mp4) | [MP4](pack/exports/claude-clip-a-vertical-review.mp4) |
| B · devis | [MP4](pack/exports/claude-clip-b-horizontal-short24-review.mp4) | [MP4](pack/exports/claude-clip-b-vertical-short24-review.mp4) | [MP4](pack/exports/claude-clip-b-horizontal-review.mp4) | [MP4](pack/exports/claude-clip-b-vertical-review.mp4) |

Chaque MP4 possède des sidecars `.srt` et `.vtt` de même nom. Les vidéos sont silencieuses ; les sous-titres décrivent le montage et les mentions de preuve, sans fabriquer de voix. Les textes principaux sont intégrés dans l'image pour que le parcours reste compréhensible sans piste audio.

- Vignettes : [A PNG](pack/exports/thumbnail-a.png), [A SVG](pack/exports/thumbnail-a.svg), [B PNG](pack/exports/thumbnail-b.png), [B SVG](pack/exports/thumbnail-b.svg).
- Posters : [A horizontal](pack/exports/opening-a-horizontal-poster.png), [A vertical](pack/exports/opening-a-vertical-poster.png), [B horizontal](pack/exports/opening-b-horizontal-poster.png), [B vertical](pack/exports/opening-b-vertical-poster.png).
- Sources modifiables : [copy.json](pack/source/copy.json), [compositeur](pack/source/build.mjs), scènes SVG sous `pack/source/scenes/`.
- Handoff : [README](pack/README.md), [storyboard et liste de captures](pack/storyboard.md), [manifeste de provenance et droits](pack/manifest.json).

Les MP4 font environ 1,9–2,8 Mo chacun et existent dans ce worktree. Ils sont ignorés par Git, ainsi que les frames de contrôle et segments intermédiaires, pour éviter des duplications lourdes. Les sources, petits assets, vignettes, posters, sous-titres et rapports sont versionnables. Aucun original distant n'a été téléchargé ; le MP4 source déjà versionné est utilisé en place. Pour reproduire :

```sh
node docs/marketing/ads-readiness-20261005/pack/source/build.mjs
node docs/marketing/ads-readiness-20261005/pack/source/verify.mjs
```

Le compositeur n'appelle aucun fournisseur, outil de génération, compte ou service externe. L'option `--stills-only` facilite la revue du texte. Les SVG restent éditables et lient les assets conservés ; garder le dossier `assets/` lors du transfert. `--standalone-svg` permet des scènes SVG autonomes si nécessaire. Le board Creative Production direct n'était pas accessible dans cet environnement ; le coordinateur fournit la page de revue locale.

## Ce que les images prouvent

Le rendu montre est le [Wan 3 Prime documenté](../2026-09-05-mcp-project-demo.md), accepté par le propriétaire en septembre, 6 s, 1080p, 16:9, sans audio. Le checksum du fichier correspond exactement au document. Son devis historique de 2,08 USD reste dans le manifeste à titre de provenance et n'est jamais affiché comme prix actuel. Les variantes montrent le clip à vitesse normale dès la première image, avec **EXISTING PRODUCT SAMPLE** et la précision « This sample is not from a new Claude session. »

Les étapes brief, connexion, devis, accord et attente sont des diagrammes éditoriaux, étiquetés **WORKFLOW ILLUSTRATION**. Elles ne reproduisent pas un chat ni des captures de devis. Aucun montant courant, statut live ou bouton d'approbation factice n'a été ajouté. La scène d'attente dit « Generation takes time » et « This montage omits the wait ».

La version 48 s ajoute une [capture Claude historique](../mcp-demo-evidence.md), avec ses bytes exacts, datée du 26 août 2026, en staging contrôlé, Claude Desktop 1.37937.1. Elle montre le lecteur et le lien vers la bibliothèque ; elle représente **un autre résultat que la montre**. Le montant de 0,95 USD visible est qualifié à l'écran comme historique. Elle n'établit ni une nouvelle génération, ni la compatibilité de toute version Claude, ni un parcours de production actuel. La coupe 24 s omet cette capture.

Le logo MaxVideoAI est copié à l'identique. Les frames de montre sont ajustées proportionnellement sans changer le produit ni couper ses détails. Aucune musique, voix, marque d'assistant autonome, témoignage ou résultat commercial n'a été inventé.

## Validation locale terminée

Le [rapport de construction](pack/verification.json) décrit les propriétés et checksums des huit MP4. Le [rapport QA](pack/qa.json) contient **15 contrôles réussis** : cinq sources intactes, huit vidéos et deux tailles de vignette. Les huit MP4 ont été entièrement décodés par FFmpeg, sans erreur ; FFprobe confirme H.264, `yuv420p`, 30 fps, 1920 × 1080 ou 1080 × 1920, durée exacte 48,000 ou 24,000 s et absence d'audio. L'atome `moov` précède `mdat` dans chaque export : faststart confirmé. Les captions couvrent la durée complète.

Contrôles exécutés :

```text
node .../pack/source/build.mjs
Built 8 MP4s; Stills, editable SVGs and captions complete.

node .../pack/source/verify.mjs
PASS: 15 artifact/source checks; 8 MP4s fully decoded, faststart,
dimensions, fps, duration and captions verified.

git diff --check
exit 0
```

Revue visuelle effectuée sur les posters A/B, les vignettes, les scènes de devis/connexion, les frames MP4 d'ouverture, d'attente et de CTA en horizontal/vertical. Les qualifications et le rendu source sont visibles, sans texte coupé dans les vues inspectées. Cela vérifie les exports ; pas la compréhension de l'annonce par un panel, une spécification publicitaire ou un nouveau parcours connecté.

## Travail restant avant une diffusion

Les droits d'usage publicitaire ne sont pas établis par les autorisations historiques de marketing du site. Le manifeste garde le statut **unknown_not_cleared** pour le rendu, la photographie source et la capture Claude ; la revue de marque reste à faire pour l'usage payé. Il manque un enregistrement actuel du parcours Claude Desktop, avec une chaîne continue ou correctement documentée brief → connexion → devis → accord → même résultat → récupération. La [liste de captures](pack/storyboard.md) détaille ce qui remplacera chaque illustration. Ce manque n'a pas empêché de produire le pack local.

Les formats sont des adaptations éditoriales 16:9 et 9:16 ; la régie et ses zones réservées ne sont pas choisies. La coupe 24 s est volontairement plus dense : faire vérifier sa compréhension sur téléphone. Aucun compte n'a été créé, aucun host connecté, aucun devis approuvé, aucun crédit dépensé, aucune campagne ni publication lancée.

## Tags de mesure proposés, sans activation

Un seul `utm_campaign` de travail : `claude_desktop_clip_20261005`. Source et medium restent à définir selon le canal ; aucune URL payante n'est activée.

| Export | `utm_content` |
| --- | --- |
| A horizontal 24 s | `result_horizontal24` |
| A vertical 24 s | `result_vertical24` |
| B horizontal 24 s | `quote_horizontal24` |
| B vertical 24 s | `quote_vertical24` |
| A horizontal 48 s | `result_horizontal48` |
| A vertical 48 s | `result_vertical48` |
| B horizontal 48 s | `quote_horizontal48` |
| B vertical 48 s | `quote_vertical48` |

Sources de cadrage : KIT-OUTREACH du 02/10, ACTIFS-EXISTANTS et VISUELS-OUTREACH ouverts le 25/09, PERFORMANCE-INTERNE et AUDIT-PRIX-MOTEURS du 25/09, TRAVAUX-AVANT-PUBLICITE, REVISION-STUDIO-MCP et ETUDE du 05/10. Les chemins et dates sont conservés dans le manifeste. Les agrégats de transactions, vues et marges n'ont pas été transformés en claims publicitaires.
