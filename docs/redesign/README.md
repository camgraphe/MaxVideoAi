# MaxVideoAI — plan directeur de refonte du site

Mise à jour : 9 septembre 2026. Responsable de décision : Adrien. Statut : conception, avant implémentation.

## Objectif

Repenser l'expérience du site public : davantage de créations et de démonstrations, des compositions ouvertes, du mouvement utile et une identité originale liée à MaxVideoAI. La réussite ne se mesure pas au nombre de couleurs, de cartes ou d'animations ajoutées.

## Exigences acquises dans la conversation

- Supprimer la logique de boîtes décoratives imbriquées.
- Réduire le texte répétitif et montrer les capacités du produit.
- Proposer une expérience plus ambitieuse, originale, technologique et animée.
- Préserver les acquis SEO/GEO et améliorer les contenus et langues.
- EN, FR et espagnol LATAM ; conserver `es-419` comme référence éditoriale, sans changer automatiquement les URLs `/es/` ou le hreflang `es`.
- Avancer de façon autonome sur les travaux réversibles et demander une validation sur les choix importants.
- Travailler dans une branche et un dossier isolés.
- Concevoir pour le mobile dès le départ et faire de la performance une condition de validation, y compris pour les effets ambitieux.

Les anciennes maquettes ne sont pas validées. La palette charbon/ivoire/laiton n'est pas acquise. Les documents historiques de l'app et son rendu observé diffèrent sur certains accents : la nouvelle app est une référence de continuité, pas une prescription de palette pour le site.

## Documents de travail

| Document | Contenu | Statut |
|---|---|---|
| [Inventaire](inventory.md) | Gabarits publics et priorités initiales | Inventorié depuis le code ; trafic à mesurer |
| [Scénario du pilote](home-pilot.md) | Proposition de parcours complet et mouvement | À valider au jalon V1 |
| [Effet signature](motion-signature.md) | Construction/déconstruction au scroll, références et options techniques | Proposition ambitieuse à qualifier |
| [Mobile et performance](mobile-performance.md) | Parcours tactiles, chargement, animation et matrice de mesure | Exigences prioritaires |
| [Contenus et langues](content-locales.md) | Conservation, réécriture, vocabulaire et localisation | Proposition préparée |
| [Migration et recette](migration.md) | Architecture, SEO/GEO, performance, lots et contrôles | Proposition préparée |
| [Décisions et avancement](decisions.md) | Statuts, validations et prochaines actions | Source de vérité des décisions |

## Première proposition à juger

**« Une idée, plusieurs façons de la créer. »** Une démonstration suivie relie référence, travail de l'image et animation ; un second moment montre comment choisir un modèle. On passe de l'inspiration à une décision de création. Voir le [scénario complet](home-pilot.md).

Commencer par un prototype de l'accueil entier, desktop et mobile, puis éprouver le langage retenu sur le catalogue et une fiche. Le prototype est distinct de la production. Aucune image illustrative ne devient une preuve de sortie d'un modèle sans vérification de provenance.

## Points de validation

| Jalon | Ce qui est présenté | Ce que décide Adrien |
|---|---|---|
| V1 | Scénario complet, valeur produit, emplacement des deux effets principaux | Valider le récit ou réorienter son sujet |
| V2 | Direction artistique appliquée aux vrais contenus, états clés des animations | Valider le langage visuel ; ne pas choisir sur une simple palette |
| V3 | Prototype animé navigable, desktop/mobile et lecture sans mouvement | Valider le rythme, l'information et la généralisation |
| V4 | Lot intégré avec comparaison visuelle, SEO et performances | Autoriser sa livraison quand elle est proposée |

V1 est la prochaine décision. V2/V3 ne sont pas validés par défaut parce que le cadrage existe.

## Ce que l'agent peut avancer sans nouvelle question

Inventaire en lecture seule, relevés de contenu et de liens, investigation des sources des traductions, classement des assets, rédaction des scénarios, préparation de la matrice de recette, corrections documentaires et tests locaux ciblés. Tout constat doit indiquer sa source et distinguer observation, hypothèse et proposition.

Les suppressions/fusions de pages, changements d'URL, nouvelles promesses commerciales, nouvelles dépenses médias et le déploiement doivent être proposés avec leur impact concret. Ne pas multiplier les demandes sur les détails de composition relevant de la direction déjà validée.

## État technique initial

- `git fetch origin` réussi le 9 septembre ; base `bdd544e9f` (fusion #284).
- Worktree : `.worktrees/site-redesign` ; branche `codex/site-redesign`.
- Le checkout principal et ses documents modifiés sont conservés.
- 13 tests ciblés accueil/catalogue/hreflang passent avec le tsconfig frontend. Ce n'est pas une validation complète de l'application.
- Aucune dépendance ajoutée, aucune page applicative modifiée, aucun déploiement.
- Le premier audit de la conversation a couvert 14 états visuels. Ses artefacts restent dans `output/audits/2026-09-09-site-visual/` du checkout principal ; ce dossier local n'est pas un livrable versionné ni une preuve disponible automatiquement dans ce worktree.

## Règle d'entretien

À chaque lot, mettre à jour les décisions, le statut, les sources examinées, les contrôles exécutés et la prochaine validation. Ne jamais transformer une proposition en décision validée sans réponse explicite ou instruction correspondante. Les documents métier existants restent propriétaires des règles techniques ; ce dossier ne les remplace pas.
