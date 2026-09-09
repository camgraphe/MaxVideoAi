# Mesure et décision — Clarity, GSC, GA4

9 septembre 2026. Inspection de code et première lecture Vercel réalisées ; baseline complète à acquérir. La présence d'une intégration dans le code ne prouve ni son activation en production ni la qualité de ses données.

## Première lecture des onglets Chrome

À la demande d'Adrien, onglets existants repérés : GSC MaxVideoAI, Vercel Analytics et projet Semrush. Aucun onglet Clarity ou GA4 repéré dans la liste de cette session. Cela ne prouve pas une absence de compte ou d'accès.

Vercel, environnement Production, sélection « Last 24 Hours », période affichée du 8 septembre 22:00 au 9 septembre 21:59 : 287 visiteurs, 997 pages vues, 63 % de rebond. Valeurs ponctuelles relevées dans l'interface, fuseau non confirmé. Elles ne constituent pas une baseline de conversion. Le tableau de pages mêle site public et app ; les référents visibles comprennent Google, accounts.google.com, checkout.stripe.com et chatgpt.com.

Conséquence méthodologique : segmenter marketing et app, contrôler le traitement des retours auth/paiement dans chaque outil et distinguer référent de navigation et attribution d'acquisition. La présence de ces domaines dans Vercel ne prouve pas un défaut GA4. Ne pas comparer directement ses visiteurs ou son rebond avec GA4 sans réconcilier leurs définitions.

GSC : seule l'en-tête de l'interface était disponible dans la lecture AX puis DOM ; aucune métrique extraite. Semrush : onglet repéré, rapport non consulté. Aucun réglage des comptes modifié. Les lectures sur 28 jours complets et par segment restent à effectuer.

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

**GEO :** panel fixe de questions par langue et intention, dates et environnement d'observation, mentions/citations et exactitude des réponses ; trafic référent IA lorsqu'identifiable. Ce panel n'est pas une mesure exhaustive de visibilité. GSC agrège les fonctionnalités IA de Google dans les données Web et ne permet pas d'en déduire ici un compteur distinct de citations. [Google](https://developers.google.com/search/docs/appearance/ai-features).

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
