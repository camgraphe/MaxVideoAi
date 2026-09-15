# Hypothèses et conseil global — refonte MaxVideoAI

9 septembre 2026. Cadrage provisoire, pas une stratégie validée par un audit complet. Première lecture GSC 28 jours ajoutée après rédaction ; GA4 et Clarity restent à analyser. Aucun gain chiffré annoncé. Lire avec le [plan directeur](README.md), la [recherche créative](creative-research.md) et le [plan de mesure](measurement.md).

## Ajustement après le retour d'Adrien

Le fil idée → référence → image → vidéo est retenu comme direction de travail. La hiérarchie de l'accueil et les médias ne sont pas encore validés. La création depuis Codex ou Claude via MCP doit être une proposition visible ; le Studio ne doit pas être présenté comme disponible au public sur la seule base de son existence dans le code. Voir [récit MCP, Studio et logos](product-narrative.md).

Premières conséquences de GSC : protéger les pages d'exemples, notamment `/examples/ltx` (285 clics sur les 28 jours observés), et inclure une page d'exemples dans le pilote de généralisation. Les 695 clics mobiles sur 1 775 clics répartis par appareil rendent le chantier mobile concret. Aucun de ces chiffres ne mesure encore la conversion. Les données et leurs limites sont dans [measurement.md](measurement.md).

## Position recommandée

Faire de MaxVideoAI un studio que l'on comprend en regardant une création se fabriquer. Le site doit donner envie, aider à choisir et conduire à une première création réussie. Une grille de moteurs et une accumulation de promesses ne suffisent pas à expliquer la valeur du produit.

Conserver les familles de pages utiles, mais attribuer une mission à chacune. La cohérence vient de la typographie, des compositions, des médias et des interactions partagés ; elle ne demande pas de répéter le même empilement de cartes partout.

## Recommandations par métier

| Métier | Proposition pour MaxVideoAI | Livrable / preuve attendue |
|---|---|---|
| Positionnement | Montrer le passage idée → référence → image → vidéo, puis expliquer le choix du moteur | Scénario avec actions réellement disponibles ; promesses vérifiées |
| Direction artistique | Compositions ouvertes, grandes créations, typographie expressive, une scène signature qui se construit au scroll | Accueil entier et catalogue avec vrais contenus, desktop et mobile |
| UX et architecture de l'information | Navigation selon intentions et accès direct aux outils ; recommandations courtes et explicables | Parcours créer / explorer / comparer sans étape décorative obligatoire |
| Conversion | Une action principale par séquence ; reprendre l'intention et le modèle choisis à l'entrée dans l'app | Tunnel jusqu'à la première génération réussie, avec erreurs et abandons |
| Contenu | Remplacer les qualificatifs génériques par des résultats, contraintes et exemples | Matrice conserver / réécrire / déplacer / retirer, avec justification |
| SEO | Préserver URLs et intentions utiles ; améliorer titres, liens internes, réponses et duplication | Comparatif de crawl et matrice page–requête avant/après |
| GEO | Donner des faits précis, datés, attribuables et faciles à citer : capacités, limites, tarifs contextualisés, méthode de comparaison | Pages cohérentes avec le registre produit et leurs sources ; suivi exploratoire de citations |
| Localisation | Réécrire EN/FR/es LATAM selon l'intention, corriger accents et jargon | Glossaire, contrôle dans les vrais composants, requêtes segmentées par pays |
| Mobile et accessibilité | Actions visibles, filtres compacts, médias bien cadrés, clavier et lecture sans mouvement | Essais tactiles et clavier, focus, contrastes, 320/390 px et appareils réels |
| Performance et ingénierie | HTML utile dès le serveur, animations localisées, affichage du poster avant lecture | Comparaisons reproductibles LCP/INP/CLS, réseau et fluidité |
| Production créative | Bibliothèque d'assets originaux cohérents, preuves produit traçables, pictos vectoriels | Fiches assets, variantes mobiles, revue qualité et poids |
| Acquisition et pilotage | Croiser GSC, GA4 et Clarity pour fixer les priorités et juger chaque lot | Baseline datée, hypothèses, résultats et décisions documentés |

## Transformer les pages selon leur rôle

**Accueil : donner envie et expliquer.** Premier résultat visible rapidement, action principale, transformation suivie, choix de moteur, preuves réelles, prix et réponses utiles. Deux moments visuels forts proposés, séparés par des séquences calmes. L'accès à la création reste immédiat.

**Catalogue : aider à choisir.** Montrer rapidement les résultats et les différences décisives. Sur mobile, éviter que les filtres et paragraphes repoussent toute la sélection sous le premier écran. Proposer une entrée par intention sans remplacer les liens vers les modèles. Une recommandation doit expliquer son critère et permettre de consulter les alternatives.

**Fiche modèle : rendre la décision fiable.** Résultat représentatif, usages adaptés, limites, modes et formats réellement disponibles, prix contextualisé et action de création. Garder les détails techniques accessibles plus bas et les liens vers comparaisons/exemples pertinents.

**Exemples : permettre de se projeter.** Titres éditoriaux courts, modèle et contexte, accès au détail du prompt et action pour reprendre la création lorsque le produit le permet. Les prompts bruts deviennent une information consultable plutôt que le titre principal.

**Comparaisons : rendre les différences visibles.** Même brief et conditions explicites ; montrer où chaque moteur convient et où il échoue. Ne pas présenter une sélection esthétique comme un classement objectif.

**Tarifs : lever l'incertitude.** Montrer ce que représente un coût dans un scénario réel, puis le détail. Réutiliser la matrice de prix existante ; ne pas inventer des estimations marketing indépendantes du produit.

**Guides : répondre à une question.** Réponse courte initiale, démonstration, méthode et détails utiles. Conserver une vraie profondeur quand l'intention le demande. Éviter de cacher tous les contenus dans des accordéons pour obtenir artificiellement une page vide.

## Règles de contenu et référencement

Ne pas imposer « moins X % de texte » à tout le site. Pour chaque bloc : quelle question résout-il, sa réponse existe-t-elle ailleurs, un visuel peut-il mieux la démontrer, contient-il une information recherchée ? Retirer les répétitions ; préserver les réponses uniques qui aident à choisir.

Créer un contrat par gabarit : intention principale, preuve visuelle, réponse courte, détails nécessaires, CTA, liens internes, metadata et données structurées. Une fusion ou suppression de page exige l'examen du trafic, de l'intention, des liens et du remplacement prévu.

Pour Google, les fondamentaux SEO restent applicables aux fonctionnalités IA ; il n'existe pas de balisage spécial à ajouter pour y apparaître. Les contenus doivent rester accessibles et cohérents avec leurs données structurées. Cela fonde notre approche GEO sans promesse de citation. [Documentation Google](https://developers.google.com/search/docs/appearance/ai-features).

L'espagnol LATAM ne désigne pas un marché unique : comparer les pays pertinents dans GSC/GA4, adapter vocabulaire et exemples sans prétendre localiser les prix ou moyens de paiement si le produit ne le fait pas. Conserver les routes existantes ; voir [contenus et langues](content-locales.md).

## Ordre recommandé

1. **Établir la baseline.** Croiser inventaire, crawl, GSC, analytics, sessions mobiles et qualité des assets. Le scénario créatif peut avancer en parallèle de cette collecte.
2. **Fixer le parcours et la hiérarchie.** Présenter V1 avec les bénéfices, les contenus déplacés et l'effet signature ; les données ajustent les priorités de livraison.
3. **Produire la direction artistique.** Vrais contenus, storyboard animé et états mobiles. Valider V2 avant une production média étendue.
4. **Éprouver un prototype.** Accueil complet, catalogue et fiche représentative. Comparer une version d'effet ambitieuse et une version plus légère si nécessaire ; valider V3 sur usage et mesures.
5. **Intégrer par familles.** Composants partagés, localisation, liens et suivi ; lots reviewables avec retour arrière. V4 porte sur un lot concret prêt à livrer.
6. **Observer puis ajuster.** Anomalies immédiatement ; usage et conversion selon volume ; SEO après recul suffisant. Documenter les facteurs externes.

## Arbitrages que je recommande

- Si un effet cache le premier résultat ou ralentit l'action mobile, modifier sa mise en scène avant de sacrifier le parcours.
- Si une page est dense mais répond à une vraie intention, retravailler sa hiérarchie avant de supprimer ses réponses.
- Si une vidéo est belle mais ne démontre pas le moteur annoncé, l'utiliser uniquement comme création de marque explicitement identifiée.
- Si les données sont insuffisantes, conduire des essais d'usage ciblés et présenter l'incertitude ; ne pas inventer une priorité fondée sur le trafic.
- Conserver les contrats métier et intégrations existants ; inventorier les connexions CRM/Zoho mentionnées avant toute intervention sur formulaires et parcours. Leur couverture effective n'a pas été auditée ici.

## Fiche de recommandation à maintenir

Pour chaque proposition : page et problème → observation/source → hypothèse → changement proposé → bénéfice attendu → coût et dépendances → risque → mesure → décision → résultat. L'objectif est de rendre mes conseils contestables et vérifiables, puis de les réviser avec les résultats.
