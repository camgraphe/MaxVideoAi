# Mesure et décision — Clarity, GSC, GA4

9 septembre 2026. Inspection de code, première lecture Vercel et relevés GSC Web/IA réalisés ; baseline complète à acquérir. La présence d'une intégration dans le code ne prouve ni son activation en production ni la qualité de ses données.

## Première lecture des onglets Chrome

À la demande d'Adrien, onglets existants repérés : GSC MaxVideoAI, Vercel Analytics et projet Semrush. Aucun onglet Clarity ou GA4 repéré dans la liste de cette session. Cela ne prouve pas une absence de compte ou d'accès.

Vercel, environnement Production, sélection « Last 24 Hours », période affichée du 8 septembre 22:00 au 9 septembre 21:59 : 287 visiteurs, 997 pages vues, 63 % de rebond. Valeurs ponctuelles relevées dans l'interface, fuseau non confirmé. Elles ne constituent pas une baseline de conversion. Le tableau de pages mêle site public et app ; les référents visibles comprennent Google, accounts.google.com, checkout.stripe.com et chatgpt.com.

Conséquence méthodologique : segmenter marketing et app, contrôler le traitement des retours auth/paiement dans chaque outil et distinguer référent de navigation et attribution d'acquisition. La présence de ces domaines dans Vercel ne prouve pas un défaut GA4. Ne pas comparer directement ses visiteurs ou son rebond avec GA4 sans réconcilier leurs définitions.

Première tentative GSC : seule l'en-tête était disponible. La reprise après rechargement a permis les relevés ci-dessous. Semrush : onglet repéré, rapport non consulté. Aucun réglage de collecte des comptes modifié ; seuls les filtres de consultation GSC ont été utilisés.

## Relevé GSC Web — 28 jours

Source : interface Search Console de `maxvideoai.com`, Chrome, consultée le 9 septembre 2026. Période indiquée par le graphique : **10 août au 6 septembre 2026** ; recherche Web, tous pays et appareils, sans filtre de page. Interface indiquant dernière mise à jour il y a 9 heures. Valeurs arrondies du bandeau : 1,78 K clics, 97,2 K impressions, CTR 1,8 %, position moyenne 13,9. Aucune comparaison à la période précédente effectuée ici.

| Appareil | Clics | Impressions |
|---|---:|---:|
| Desktop | 1 046 | 70 872 |
| Mobile | 695 | 25 726 |
| Tablette | 34 | 622 |

Somme des trois lignes : 1 775 clics ; mobile ≈ 39,2 % de ce total. Ces clics de recherche ne sont ni des sessions GA4 ni des utilisateurs convertis.

| Premières pages affichées | Clics | Impressions |
|---|---:|---:|
| `/` | 637 | 11 232 |
| `/examples/ltx` | 285 | 6 136 |
| `/examples/seedance` | 69 | 2 829 |
| `/examples/kling` | 45 | 1 522 |
| `/fr` | 39 | 632 |
| `/tools/angle` | 32 | 753 |
| `/models/veo-3-1` | 31 | 1 458 |
| `/models/minimax-h3` | 29 | 1 287 |
| `/models/seedance-2-5` | 28 | 904 |
| `/es/herramientas/angle` | 25 | 459 |

Premières requêtes affichées : marque et variantes, `seedance 2.5` (22 clics), `pay as you go ai video generator` (16), `ltx 2.3 prompt examples` (15). Le tableau de requêtes annonce 1 000 lignes ; seules les dix premières ont été lues. Les totaux de requêtes et de pages ne doivent pas être supposés exhaustifs ni interchangeables.

Premiers pays affichés : États-Unis 253 clics, Inde 146, Royaume-Uni 98, France 79, Espagne 78, Allemagne 72, Pakistan 60, Canada 47, Indonésie 41, Italie 37. Dix lignes sur 208 : absence de pays LATAM dans cet extrait ne permet pas de conclure sur leur poids. L'espagnol LATAM reste l'orientation éditoriale demandée ; approfondir les pays cibles sans assimiler Espagne et LATAM.

**Recommandations issues de ces relevés :** inclure les exemples dans la validation des gabarits ; préserver le contenu unique et les chemins des pages LTX/Seedance/Kling ; conserver une explication visible du paiement à l'usage ; traiter les parcours mobiles comme une part importante de l'acquisition. Ce sont des priorités de protection et d'investigation, pas une attribution causale au design actuel.

## Relevé GSC — fonctionnalités IA

L'interface du compte expose un rapport **« Generative AI features » en bêta**, ouvert depuis le lien de la page Performance. Sur la sélection 28 jours, le graphique indique également **10 août–6 septembre 2026**, avec **6,86 K impressions** (arrondi affiché).

Parmi les premières pages : accueil 1 626 impressions ; comparaison `gemini-omni-flash-vs-veo-3-1` 646 ; `seedance-2-0-vs-seedance-2-0-fast` 582 ; `veo-3-1-fast-vs-veo-3-1-lite` 341 ; exemples LTX 216 ; tarifs 197. Ces impressions ne mesurent pas des clics, une conversion ou des citations dans tous les assistants.

**Correction du premier cadrage :** ne pas affirmer qu'aucun rapport IA distinct n'est accessible. Ce compte en expose un. Vérifier sa définition, son périmètre bêta, les limites d'export et la comparaison de périodes avant de construire un indicateur stable. Ne pas additionner ces impressions au total Web sans vérifier leur relation. L'outil GSC interne inspecté reste une projection Web ; sa couverture de ce nouveau rapport n'a pas été établie.

Les comparaisons apparaissent dans ce premier extrait IA : elles doivent faire partie de la revue de conservation du contenu, même si on simplifie visuellement le catalogue. Pas de refonte qui efface les distinctions factuelles entre modèles.

## Existant identifié

- Clarity : `frontend/components/analytics/Clarity.tsx` et `frontend/src/lib/clarity-client.ts` ; mécanismes de consentement, activation et restrictions d'hôtes.
- GA4 : `frontend/components/analytics/GA4RouteTracker.tsx`, `frontend/lib/analytics/ga-events.ts`, `journey.ts` et `journey-contract.ts` ; routes, attribution et événements du parcours. Les événements source `sign_up_started`, `sign_up_completed`, `generation_started/completed/failed` et `topup_*` existent ; des noms sont projetés avant transport. Vérifier les noms reçus dans GA4 avant toute requête de funnel.
- GSC : tableau admin existant et `frontend/server/seo/gsc/dashboard-builders.ts`, avec requête/page/pays/appareil, comparaison de périodes et dates incomplètes. Sa projection expose notamment 500 lignes de détail au maximum : ne pas traiter un export du tableau comme un inventaire exhaustif.

## Collecte de départ

| Source | Échantillon proposé | Décisions alimentées |
|---|---|---|
| GSC | 28 jours complets contre période précédente ; 3 mois pour contextualiser, année précédente si disponible | URLs à protéger, intentions, CTR, opportunités et différences FR/LATAM/mobile |
| GA4 | Périodes comparables, landing page, canal, appareil, langue ; parcours vers inscription, première génération réussie et recharge | Frictions, contribution des pages, qualité de l'acquisition |
| Clarity | Échantillon raisonné initial d'environ 20 sessions mobiles par parcours prioritaire, succès et abandons, selon disponibilité | Filtres pénibles, clics sans résultat, médias ignorés, hésitations ; observations qualitatives |
| Mesures techniques | Même appareil/profil réseau/cache pour baseline et prototype ; données terrain si disponibles | Régressions chargement, interaction et stabilité |
| Crawl + produit | URLs, statuts, canonicals, hreflang, titres, JSON-LD, liens et actions | Régressions SEO et promesses devenues incohérentes |

Les volumes ci-dessus sont une méthode proposée, pas des données déjà acquises. Conserver les dates, filtres, limites de rétention, couverture du consentement et éventuels seuils de confidentialité. Distinguer pays et langue ; une visite en espagnol n'est pas automatiquement une visite LATAM.

## Scorecard proposée

**Indicateur principal du site :** part des visiteurs éligibles observés qui atteignent leur première génération réussie, dans une fenêtre d'attribution fixée avant comparaison. Distinguer nouveaux utilisateurs et utilisateurs récurrents ; confirmer que l'instrumentation permet ce calcul sans double compte.

**Indicateurs intermédiaires :** passage landing → app, inscription terminée, génération démarrée puis terminée, première recharge. Toujours indiquer numérateur, dénominateur, fenêtre et segment ; les clics CTA seuls ne constituent pas une conversion produit.

**Garde-fous :** erreurs de génération/auth/paiement, LCP/INP/CLS, pages indexables, clics organiques par famille et pays, rebonds de parcours observés. Temps passé et profondeur de scroll sont diagnostiques : une animation peut les augmenter sans aider l'utilisateur.

**GEO :** rapport IA bêta disponible dans ce compte, complété par un panel fixe de questions par langue et intention, dates et environnement d'observation, mentions/citations et exactitude des réponses ; trafic référent IA lorsqu'identifiable. Ces observations ne sont pas une mesure exhaustive de visibilité. Distinguer impressions du rapport GSC, visites référentes et citations observées dans les autres assistants. Les recommandations de contenu continuent de s'appuyer sur les fondamentaux de [Google](https://developers.google.com/search/docs/appearance/ai-features).

## Hypothèses à tester en premier

| Hypothèse de design | Vérification | Décision possible |
|---|---|---|
| Les filtres repoussent trop les modèles sur mobile | Sessions Clarity et accès effectif aux résultats | Réduire la hauteur et conserver les filtres avancés à la demande |
| La démonstration suivie explique mieux l'offre | Essai de compréhension + première création réussie | Garder le récit, ajuster sa durée ou rapprocher l'action |
| Les répétitions retardent la décision | Cartographie des blocs et observation des hésitations | Remplacer les répétitions par une preuve et conserver les réponses uniques |
| Un choix par intention facilite le catalogue | Usage de la sélection et suite du parcours | Étendre aux gabarits utiles sans supprimer l'accès expert |

## Instrumentation et livraison

Réutiliser les événements existants ; établir d'abord la table source → transport → GA4. Vérifier consentement accordé/refusé, navigation cliente, retour arrière, déduplication, échecs et succès. Ne pas ajouter de second chargeur de tags. Garder les protections contre l'envoi de prompts, emails et URLs sensibles. Toute nouvelle mesure passe par les contrats existants.

Annoter chaque livraison, version de gabarit, changements média/contenu et campagnes concurrentes. Les variantes et identifiants de sections ne seront ajoutés que si nécessaires et compatibles avec les payloads autorisés.

Après livraison : contrôler immédiatement erreurs et tracking ; relire les parcours à J+7 ; comparer à J+28 et au-delà selon volume et délai SEO. Ces jalons sont des contrôles, pas des promesses de significativité. Un avant/après confond saisonnalité et changements externes : utiliser un test contrôlé seulement si le volume permet un résultat utile. Ne pas multiplier les variantes sur un trafic trop faible.

En cas de données indisponibles, garder explicitement les priorités business au statut d'hypothèse. Continuer le cadrage et les prototypes ; acquérir les exports ou un accès autorisé avant de conclure sur la performance commerciale.
