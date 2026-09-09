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

**Dernier retour :** la composition 01 paraît trop légère, générique et insuffisante pour remplacer l'accueil actuel. Adrien confirme qu'on peut améliorer le SEO, réécrire et fusionner ; il faut conserver la logique produit. Benchmark demandé : Higgsfield et InVideo, complétés par les acteurs stock devenus créatifs IA.

**Référence actuelle : [le brief de remplacement corrigé](home-replacement-brief.md).** Comparaison directe avec la production, rôles des sections, [40 destinations documentées](home-replacement-links.json), nouvelle composition en six moments et observations sur Higgsfield, InVideo et Freepik/Magnific. La [composition 01](review/home.html) reste consultable comme version à reprendre ; elle n'est pas un candidat prêt à remplacer l'accueil.

## Documents de travail

**Méthode actualisée :** l’essai est terminé et une première composition complète est disponible. Composer les pages avec leurs contenus et des images d’attente pertinentes. Définir et valider les emplacements avant de produire les effets. Voir [la méthode et la carte initiale des emplacements](page-first-workflow.md). La fabrication d'autres démonstrations isolées n'est plus la prochaine étape.

| Document | Contenu | Statut |
|---|---|---|
| [Brief de remplacement](home-replacement-brief.md) | Diagnostic, recomposition, benchmark et contrat de conservation/amélioration | Base de reprise après retour utilisateur |
| [Accueil — composition 01](review/home.html) | Première page complète, trois langues et mobile | À reprendre : richesse et couverture insuffisantes |
| [Choix de composition](home-composition.md) | Récit, provenance, contenu et points de migration | Proposition documentée |
| [Pages avant effets](page-first-workflow.md) | Ordre de conception et emplacements proposés dans l'accueil | Méthode demandée par Adrien |
| [Essai animé 3D](review/motion.html) | Ordinateur articulé, objet, assemblage, rotation et vue mobile | Étude locale ; sujet et usage non validés |
| [Revue visuelle V1](review/index.html) | Storyboard complet, étude de mouvement, états MCP, six références et interactions manipulables | À examiner ; support local distinct du produit |
| [Hypothèses et conseil](conseil-strategique.md) | Recommandations par métier et rôle de chaque famille de pages | Cadrage provisoire, audit incomplet |
| [MCP, Studio et logos](product-narrative.md) | Deux voies de création, scénario MCP, disponibilité et crédibilité | Fil de création accepté ; placement proposé |
| [Qualité des interactions](interaction-details.md) | Lecteurs, modales, filtres, menus, états et fermeture | Contrat proposé pour la revue de détails |
| [Recherche créative et assets](creative-research.md) | Références, effets, ImageGen, vidéo et pictogrammes | Recherche sourcée ; effets à éprouver |
| [Mesure et conversion](measurement.md) | Clarity, GSC, GA4, baseline et hypothèses | GSC Web/IA, comparaison Web/LATAM, GA4 acquisition et Clarity agrégé relevés ; funnels/sessions à approfondir |
| [Inventaire](inventory.md) | Gabarits publics et priorités initiales | Inventorié depuis le code ; trafic à mesurer |
| [Scénario du pilote](home-pilot.md) | Proposition de parcours complet et mouvement | À valider au jalon V1 |
| [Effet signature](motion-signature.md) | Construction/déconstruction au scroll, références et options techniques | Proposition ambitieuse à qualifier |
| [Mobile et performance](mobile-performance.md) | Parcours tactiles, chargement, animation et matrice de mesure | Exigences prioritaires |
| [Contenus et langues](content-locales.md) | Conservation, réécriture, vocabulaire et localisation | Proposition préparée |
| [Migration et recette](migration.md) | Architecture, SEO/GEO, performance, lots et contrôles | Proposition préparée |
| [Décisions et avancement](decisions.md) | Statuts, validations et prochaines actions | Source de vérité des décisions |

## Première proposition à juger

**« Une idée, plusieurs façons de la créer. »** Une démonstration suivie relie référence, travail de l'image et animation ; un second moment montre comment choisir un modèle. On passe de l'inspiration à une décision de création. Voir le [scénario complet](home-pilot.md).

Commencer par un prototype de l'accueil entier, desktop et mobile, puis éprouver le langage retenu sur le catalogue, une fiche et une page d'exemples. Le prototype est distinct de la production. Aucune image illustrative ne devient une preuve de sortie d'un modèle sans vérification de provenance.

## Points de validation

| Jalon | Ce qui est présenté | Ce que décide Adrien |
|---|---|---|
| V1 | Scénario complet, valeur produit, emplacement des deux effets principaux | Valider le récit ou réorienter son sujet |
| V2 | Direction artistique appliquée aux vrais contenus, états clés des animations | Valider le langage visuel ; ne pas choisir sur une simple palette |
| V3 | Prototype animé navigable, desktop/mobile et lecture sans mouvement | Valider le rythme, l'information et la généralisation |
| V4 | Lot intégré avec comparaison visuelle, SEO et performances | Autoriser sa livraison quand elle est proposée |

Le fil de création suivie a reçu un accord de direction. La hiérarchie complète, la place du MCP et les médias restent à préciser avant de clôturer V1. V2/V3 ne sont pas validés par défaut parce que le cadrage existe.

La [composition 01](review/home.html) est à reprendre selon le [brief corrigé](home-replacement-brief.md). La [revue V1](review/index.html), la [planche de direction](review/direction.html) et l’essai 3D restent des explorations historiques. Leur existence ne valide pas le prototype intégré V3.

## Approfondissement avant implémentation

1. **Données et vérité produit :** compléter comparaison de périodes GSC, pays LATAM, GA4/Clarity et état des intégrations. Sortie : pages à protéger et hypothèses étayées, limites explicites.
2. **Références qualifiées :** retenir six interactions/compositions précises parmi la recherche élargie ; examiner rendu, source et adaptation mobile. Sortie : planche commentée, pas une nouvelle liste de liens seule.
3. **Storyboard du site :** déroulé complet avec MCP, preuves, contenus et place conditionnelle du Studio. Sortie : décision de hiérarchie et brief des médias.
4. **Direction et détails :** desktop/mobile, logos, planche des six interactions prioritaires et états d'erreur. Sortie : V2 avant prototype d'intégration.

Les recherches réversibles avancent sans nouvelle autorisation. La qualité se juge aux preuves et livrables de chaque cycle ; aucun délai artificiel ne remplace ces critères. Les collectes manquantes et démos non testées gardent leur statut explicite.

## Ce que l'agent peut avancer sans nouvelle question

Inventaire en lecture seule, relevés de contenu et de liens, investigation des sources des traductions, classement des assets, rédaction des scénarios, préparation de la matrice de recette, corrections documentaires et tests locaux ciblés. Tout constat doit indiquer sa source et distinguer observation, hypothèse et proposition.

Les suppressions/fusions de pages, changements d'URL, nouvelles promesses commerciales, nouvelles dépenses médias et le déploiement doivent être proposés avec leur impact concret. Ne pas multiplier les demandes sur les détails de composition relevant de la direction déjà validée.

## État technique initial

- `git fetch origin` réussi le 9 septembre ; base `bdd544e9f` (fusion #284).
- Worktree : `.worktrees/site-redesign` ; branche `codex/site-redesign`.
- Le checkout principal et ses documents modifiés sont conservés.
- 13 tests ciblés accueil/catalogue/hreflang passent avec le tsconfig frontend. Ce n'est pas une validation complète de l'application.
- Aucune dépendance ajoutée, aucune page applicative modifiée, aucun déploiement.
- Conseil global, workflow créatif et plan de mesure ajoutés ; onglets Chrome GSC/Vercel/Semrush repérés, première lecture Vercel réalisée. Aucun audit complet des comptes à ce stade.
- Le premier audit de la conversation a couvert 14 états visuels. Ses artefacts restent dans `output/audits/2026-09-09-site-visual/` du checkout principal ; ce dossier local n'est pas un livrable versionné ni une preuve disponible automatiquement dans ce worktree.
- Cycle V1 approfondi : revue HTML/CSS/JS locale, relevés GSC comparés et pays LATAM, GA4 et Clarity accessibles. Les données n'établissent pas encore un funnel complet ; voir measurement.md. La recherche bornée dans le frontend ne trouve pas de mention Zoho ; cela ne prouve pas l'absence d'une intégration externe.

## Règle d'entretien

À chaque lot, mettre à jour les décisions, le statut, les sources examinées, les contrôles exécutés et la prochaine validation. Ne jamais transformer une proposition en décision validée sans réponse explicite ou instruction correspondante. Les documents métier existants restent propriétaires des règles techniques ; ce dossier ne les remplace pas.
