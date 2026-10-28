# Guidelines — composer et aide Milo

Proposition du 28/10/2026. À appliquer lors de l'intégration après validation de la [conception](../../superpowers/specs/2026-10-28-prompt-director-design.md). Le [prototype](prototype.html) est autonome et simulé ; il n'est pas un composant de production.

## Direction actuelle

La [révision 2](REFINEMENT-2.md) intègre les retours d'Adrien : interface et exemples en anglais, références compactes sans nom de fichier, libellés Start image / End image / Image 1 / Audio 1, conversation distincte du champ Message Milo. Elle remplace les choix visuels initiaux ci-dessous en cas de différence.

## Repères d'interface

- **Un endroit pour répondre.** La conversation est au-dessus ; le champ Message Milo est dans sa propre surface de saisie en dessous. Suggested prompt est un détail à ouvrir, jamais le champ de réponse. Les onglets sont Prompt / With Milo.
- **Un + prévisible.** En bas à gauche, nom accessible « Ajouter une référence ». Ouvre les rôles compatibles et les importateurs existants. Les références requises restent signalées hors du menu.
- **Des pièces jointes explicites.** Montrer une vignette de 44 px et un identifiant court : Start image, End image, Image 1, Audio 1. Masquer les noms de fichiers ; pas de seconde ligne systématique ni de carte englobante. Une rangée défilante conserve une hauteur constante. Les états de chargement/erreur, suppression et extraits restent disponibles. Une vignette ne prouve pas que Milo a analysé son contenu.
- **Deux actions distinctes.** Flèche = envoyer à Milo. Générer + devis = produire un média. Rien ne se génère par l'envoi, l'application ou Entrée.
- **Le manuel reste complet.** Collage depuis un autre LLM sans transformation ; mêmes paramètres, références, sorties et modes. Pas d'appel d'assistance en arrière-plan.
- **Un original préservé.** Proposition éditable, application explicite, garde de révision, retour arrière sûr. Un changement de contexte invalide l'application, pas la possibilité de lire/copier la réponse.
- **Des réglages compréhensibles.** Courants visibles ; avancés accessibles. Les modifications proposées sont affichées avant/après. Un champ fixe reste informatif ; un champ non supporté n'est pas inventé.
- **Une identité cohérente.** Nom Milo, couleurs et iconographie MaxVideoAI. Ne pas imposer « agent », « orchestration », « tool call » ou des noms de modèles de dialogue au premier usage.

## Apparence et accessibilité

Palette issue du produit : canvas ivoire `#eeeee7`, panneau `#fafaf4`, texte olive `#20271f`, secondaire `#57634f`, accent `#765020`. Les valeurs exactes de bordure s'ajustent au contraste et au rendu réel ; les champs interactifs doivent rester perceptibles. Mode sombre cohérent avec les tokens existants.

Surface proposée : rayon 15 px, ligne fine, ombre de faible amplitude, pas de carte dans une carte pour chaque option. Corps 14–16 px, interligne confortable, texte secondaire courant à 12 px, métadonnées discrètes au moins 11 px. Éviter les lettres espacées et les capitales qui donnent une apparence de formulaire technique.

Actions principales avec cibles tactiles de 44 px, suppression compacte à 27 × 44 px, focus clavier visible, noms accessibles, états sélectionnés annoncés, suppression et retour de focus gérés. Pas de barre latérale au focus, de variation de marge ou de cadre ajouté au clic. Le menu + reste utilisable au clavier, se ferme avec Échap et rend le focus à son bouton. Pas d'action sur un simple survol. Réponses avec annonce discrète ; ne pas annoncer l'intégralité du chat à chaque frappe. Contrôler 320, 390, 768 et 1440 px, zoom 200 %, EN/FR/ES, textes longs, sombre et mouvement réduit.

## Inspirations inspectées et limites

Inspection ciblée ; ces dépôts ne prouvent ni adoption commerciale ni performance de conversion. Les licences mentionnées sont celles des fichiers/dépôts consultés, pas un audit de toutes leurs dépendances. La maquette est écrite pour cette étude ; elle ne contient aucune copie substantielle des sources ci-dessous.

| Source figée | Retenir | Ne pas importer automatiquement |
| --- | --- | --- |
| [assistant-ui composer](https://github.com/assistant-ui/assistant-ui/blob/b6b10672ef896e2deaf1603e7414ef0142943e9e/apps/docs/components/demo/elements/composer.tsx), [MIT](https://github.com/assistant-ui/assistant-ui/blob/b6b10672ef896e2deaf1603e7414ef0142943e9e/LICENSE) | Composition input / attachments / toolbar ; ajouter à gauche, envoyer à droite ; contrôles nommés et pièces jointes séparées. | Dépendance complète, exemples de modèles, dictée et commandes inutiles à notre besoin. Le demo n'est pas une preuve d'accessibilité exhaustive. |
| [Krea, fiche Seedance](https://github.com/krea-ai/skills/blob/9239bb449a8acefd5effef73a548b7322b5d1f10/krea-generate/references/models/seedance-2.md), MIT | Charger le guide du moteur et les exemples utiles après le choix du modèle. | Capacités, préférences ou affirmations qualitatives propres à Krea. |
| [Higgsfield generation](https://github.com/higgsfield-ai/skills/blob/4d0757471a704dac8729ea3c2ef0f3f330e0d9b6/higgsfield-generate/SKILL.md), MIT | Schéma réel avant appel, respect du modèle demandé et rôle des références. | Installateurs, budget implicite, préférence de fournisseur ou limite universelle de longueur. |
| [Runway polling](https://github.com/runwayml/sdk-node/blob/d21a613791516edfd734914fc3e638e3f54f9f0c/src/lib/polling.ts), Apache-2.0 | États et attente bornée, signal d'arrêt ; distinguer arrêt d'attente et annulation réelle. | Couche Runway entière, hypothèse de remboursement automatique. |
| [Vercel use-chat](https://github.com/vercel/ai/blob/3216f06d0d892b03ad607b4716bbf04056cbfe3d/packages/react/src/use-chat.ts), Apache-2.0 | Cycle conversation/envoi/arrêt/reprise et séparation transport/UI. | Migration de framework pour cette fonctionnalité ou boucle d'agent de vingt étapes. |

Si du code substantiel est repris ensuite : conserver le commit, le fichier source et la notice applicable, et inscrire les adaptations dans le changement. Les noms, marques, captures et assets des concurrents ne sont pas des composants à recopier. Ne pas annoncer que le code interne de Krea Agent ou d'un Director concurrent est disponible sur la base de simples skills publiques.

## Appels et coûts

Le SDK natif déjà utilisé suffit pour un appel Responses contextualisé. Garder le catalogue réel du produit comme autorité ; les guides fournissent une manière de formuler, pas des paramètres supplémentaires. Envoi explicite, réservation de crédits avant appel, réponse sauvegardée avant règlement idempotent, reprise sans double dépense. Le prix média vient toujours du moteur de devis existant.

Sol/Luna et crédits Milo actuels sont confirmés par Adrien. Terra : candidat à une évaluation séparée sur briefs identiques, sans introduction de tarif dans cette branche. Comparer coût complet, latence, fidélité et validité des paramètres ; ne pas déduire la qualité du seul prix au token.

## À conserver pour Studio

1. Une base commune de guides spécialisés, avec sources/version et exemples relus.
2. Un journal de retakes rattaché à un plan, gardant intention, variante, coût et choix humain.
3. Les décisions créatives importantes visibles et révisables.
4. Des évaluations métier : fidélité au brief, continuité, validité, coût par résultat utile.
5. Une étude Terra par rôle, sans remplacement global de Sol non mesuré.

Studio possède déjà mémoire, analyse et reprise technique. Ne pas dupliquer ces fonctions, activer une critique automatique ou multiplier les générations sans un projet distinct. Réserve détaillée : `/Users/adrienmillot/Documents/ChatGPT/OUTREACH/sources/2026-10-28/prompt-director-study/STUDIO-RESERVE.md`.

## Essayer le prototype

Depuis ce dossier : `python3 -m http.server 8768 --bind 127.0.0.1`, puis ouvrir `http://127.0.0.1:8768/review.html`. Le cadre de revue propose Bureau, 768, 390 et 320 px ; `prototype.html` ouvre la maquette seule.

Essayer les onglets vidéo/image/audio, Prompt/With Milo, le +, une source obligatoire en mode Modifier, envoyer un message, modifier une proposition, appliquer puis annuler. Changer un réglage après une proposition la rend périmée. Le bouton Générer rappelle le caractère simulé ; aucun média ni coût réel. Le prototype sert à relire la disposition et les interactions, pas à valider un moteur ou le ledger.
