# Mise en place des corrections SEO / GEO — 5 septembre 2026

Les corrections de contenu et de métadonnées sont préparées dans la branche `codex/maxvideoai-next-exploration`. Elles ne sont pas encore déployées. La demande d’indexation décrite ci-dessous a été effectuée dans Search Console sur une page déjà publique.

## Base vérifiée avant modification

La branche a été mise à jour sur `157f4635916d7129dba408794b4888528feeb454`, également identifié comme le commit du dernier déploiement Vercel de production prêt le 5 septembre. Cette base inclut les correctifs récents ; les observations antérieures à leur déploiement ne servent pas à conclure à leur échec.

| Sujet | Travail déjà présent | Traitement dans cette intervention |
|---|---|---|
| Indexation et découverte | Graphe de liens, publication, sitemaps et garde-fous SEO du 2 septembre ; vidéos des modèles P1 du 3 septembre. | Vérification des sitemaps et de quelques URL importantes, puis demande ciblée pour H3 Max. Aucune réécriture globale des règles d’indexation. |
| Chargement | Affiche mobile et cache marketing du 31 août ; réduction des affiches dupliquées et des chargements de galerie le 4 septembre ; travail sur les aperçus jusqu’au 5 septembre. | Conservation de ces changements, tests de régression et contrôle réseau mobile à froid. |
| Attribution | Correction GA4 du 4 septembre (`fa7c341da`) : récupération du client et de la session au checkout, propagation serveur, traitement des retours Stripe/Google. | Lecture du correctif et tests du parcours. Aucun événement d’achat artificiel envoyé en production. |

## Corrections ajoutées

1. **LTX, en anglais, français et espagnol.** Les descriptions SEO, introductions et conseils présentent les modèles 2.5 actuels. Les exemples 2.3 et 2 gardent leur contexte historique. Le lien tarifaire vise désormais l’ancre 2.5 existante. Cela supprime la contradiction entre le texte et les modèles présentés.
2. **Comparatifs et preuves.** Les temps affichés proviennent désormais de la même source publique que `/benchmarks` : médiane et P90 sur 30 jours, avec date de la dernière observation. Une mesure indisponible reste absente ; les anciennes moyennes internes ne la remplacent plus. La période, la définition du P90 et les limites des comparaisons entre réglages sont indiquées à côté du tableau. Le verdict Seedance standard/Fast ne promet plus une attente systématiquement plus courte avec Fast. Les scores éditoriaux existants restent distincts des temps observés.
3. **Légende H3 Max.** La légende et le contexte alternatif décrivent la danse montrée dans le média principal, dans les trois langues. L’exemple de lampe distinct conserve son propre contenu.
4. **Titres complets.** Suppression de la troncature automatique à 60 caractères qui introduisait des points de suspension dans le HTML. La marque optionnelle n’est ajoutée que si elle tient ; les titres déjà rédigés restent entiers. Le titre de la page tarifs est raccourci manuellement dans les trois langues. Google conserve sa propre présentation des résultats.

Le dépôt protège volontairement les volumes de production et les nombres d’utilisateurs dans les données publiques des benchmarks (`tests/benchmark-lab-route.test.ts`). Cette règle est conservée : les comparatifs exposent les mesures, dates, période et limites, sans publier les effectifs internes. Le calcul et les critères d’éligibilité de la source publique ne changent pas.

## Indexation : observations fraîches

Lecture Search Console du 5 septembre : le rapport global « Page indexing » reste daté du **28 août**. Ses 960 pages indexées et 826 pages explorées non indexées ne permettent donc pas de mesurer l’effet des changements de septembre.

- `/examples/ltx` : Google confirme l’indexation ; dernier crawl affiché le **3 septembre à 22:30:55**, Googlebot smartphone, récupération réussie et canonique sélectionnée identique à l’URL inspectée.
- `/models/minimax-h3-max` : URL encore inconnue de l’index lors de l’inspection. Le test en direct du **5 septembre à 12:27** confirme « URL is available to Google » et « Page can be indexed ». Search Console a ensuite confirmé **« Indexing requested »**. Cela confirme la mise en file d’exploration, pas l’indexation effective.
- Les trois versions linguistiques H3 Max répondent HTTP 200 en production, avec `index, follow` et une canonique propre.
- Le sitemap index et ses six fichiers enfants sont accessibles. H3 Max figure dans le sitemap modèles ; la famille LTX figure dans les sitemaps localisés.

Les heures ci-dessus sont celles affichées dans l’interface Search Console. Ce contrôle ciblé ne vaut pas validation de toutes les URL du domaine.

## Performance : ce que le contrôle permet de dire

Sur l’accueil en production, Chrome à 390 × 844, cache navigateur désactivé, sans bridage CPU/réseau : seule l’affiche mobile H3 Max est téléchargée pour ce média (**12 940 octets transférés**, en-têtes inclus). L’affiche desktop n’apparaît pas dans les ressources de ce chargement à froid. Le LCP mesuré dans cet essai est de 448 ms.

Ce relevé de laboratoire confirme le choix du média dans ces conditions. Il ne remplace pas le p75 mobile Vercel, ni les Core Web Vitals terrain. La fenêtre Vercel antérieure, du 28 août au 4 septembre, mélange plusieurs versions ; le p75 LCP de 2,82 s de l’audit ne prouve pas un défaut encore présent après les derniers correctifs.

L’attribution GA4 doit également être évaluée sur des achats postérieurs au correctif du 4 septembre. Les revenus « Unassigned » d’une fenêtre couvrant essentiellement la période précédente ne valident ni n’invalident ce correctif.

## Validation et limites

- Compilation de production Next.js, vérification du registre et génération des sitemaps.
- Lint frontend, garde de l’exposition publique, contrôles SEO et parité des traductions.
- **149 tests ciblés réussis** (96 + 35 + 18) sur les titres, les comparatifs, les mesures publiques, les canoniques, hreflang, sitemaps, chargements et attribution. Les contrats éditoriaux des comparatifs et de l’ancre tarifaire LTX ont été actualisés pour les textes corrigés.
- Neuf pages locales (famille LTX, tarifs et comparatif Seedance, chacune en EN/FR/ES) : HTTP 200, titre complet, une canonique attendue, quatre alternates, un H1 et JSON-LD lisible. Les trois liens vers l’ancre tarifaire LTX 2.5 résolvent une ancre existante.
- Comparatif français contrôlé dans Chrome au format mobile : contenu corrigé visible et aucun débordement horizontal.
- Le rendu local complet des pages H3 Max reste limité par l’absence de `DATABASE_URL` dans ce worktree. Les réponses en production sont correctes ; la nouvelle légende devra aussi être contrôlée après déploiement. Les endpoints locaux de politique cookies et les scripts Vercel signalent également l’absence de leur configuration de production.

Après déploiement des nouvelles corrections : contrôler le HTML public modifié, vérifier le rendu des médianes lorsque des données sont disponibles, puis comparer des fenêtres exclusivement postérieures aux changements avec un volume de données suffisant. Ne pas attribuer une variation de CTR, de trafic, de citations ou de revenu à ces corrections sans recul comparable.
