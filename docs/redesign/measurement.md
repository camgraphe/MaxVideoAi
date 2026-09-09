# Mesure et décision — Clarity, GSC, GA4

9 septembre 2026. Inspection de code, Vercel, GSC Web/IA, comparaison Web, pays LATAM, GA4 acquisition et Clarity agrégé consultés. Les funnels, sessions détaillées et la réconciliation de couverture restent à faire. La présence d'une intégration dans le code ne prouve ni son activation en production ni la qualité de ses données.

## Première lecture des onglets Chrome

À la demande d'Adrien, onglets existants repérés : GSC MaxVideoAI, Vercel Analytics et projet Semrush. Aucun onglet Clarity ou GA4 n'était initialement ouvert. La navigation ultérieure dans Chrome a confirmé l'accès aux deux comptes ; relevés ci-dessous.

Vercel, environnement Production, sélection « Last 24 Hours », période affichée du 8 septembre 22:00 au 9 septembre 21:59 : 287 visiteurs, 997 pages vues, 63 % de rebond. Valeurs ponctuelles relevées dans l'interface, fuseau non confirmé. Elles ne constituent pas une baseline de conversion. Le tableau de pages mêle site public et app ; les référents visibles comprennent Google, accounts.google.com, checkout.stripe.com et chatgpt.com.

Conséquence méthodologique : segmenter marketing et app, contrôler le traitement des retours auth/paiement dans chaque outil et distinguer référent de navigation et attribution d'acquisition. La présence de ces domaines dans Vercel ne prouve pas un défaut GA4. Ne pas comparer directement ses visiteurs ou son rebond avec GA4 sans réconcilier leurs définitions.

Première tentative GSC : seule l'en-tête était disponible. La reprise après rechargement a permis les relevés ci-dessous. Semrush : onglet repéré, rapport non consulté. Aucun réglage de collecte des comptes modifié ; seuls les rapports et filtres de consultation ont été utilisés.

## Relevé GSC Web — 28 jours

Source : interface Search Console de `maxvideoai.com`, Chrome, consultée le 9 septembre 2026. Période indiquée par le graphique initial : **10 août au 6 septembre 2026** ; recherche Web, tous pays et appareils, sans filtre de page. Interface indiquant dernière mise à jour il y a 9 heures. Valeurs arrondies du bandeau : 1,78 K clics, 97,2 K impressions, CTR 1,8 %, position moyenne 13,9. La comparaison ultérieure est détaillée ci-dessous.

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

Premiers pays affichés : États-Unis 253 clics, Inde 146, Royaume-Uni 98, France 79, Espagne 78, Allemagne 72, Pakistan 60, Canada 47, Indonésie 41, Italie 37. Premier extrait de dix lignes sur 208, complété ensuite par le tableau de comparaison de 220 pays/territoires (union des deux périodes).

## Complément du cycle V1 — comparaison et LATAM

Sélecteur GSC « Compare last 28 days to previous period ». Valeurs exactes lues dans les libellés du DOM du bandeau : **1 775 contre 1 875 clics** (−5,3 %) ; **97 220 contre 115 448 impressions** (−15,8 %). CTR affiché : 1,8 % contre 1,6 % ; position moyenne : 13,9 contre 11,1. La plage actuelle avait été confirmée avant comparaison. Le libellé accessible du graphique de comparaison affiche une date invalide : les dates de la période précédente ne sont donc pas considérées comme relues dans ce graphique.

| URL | Clics actuels | Précédents | Impressions actuelles | Précédentes |
|---|---:|---:|---:|---:|
| `/` | 637 | 642 | 11 232 | 9 873 |
| `/examples/ltx` | 285 | 386 | 6 136 | 12 795 |
| `/examples/seedance` | 69 | 36 | 2 829 | 1 211 |
| `/examples/kling` | 45 | 67 | 1 522 | 2 477 |
| `/models/veo-3-1` | 31 | 66 | 1 458 | 10 372 |
| `/models/minimax-h3` | 29 | 0 | 1 287 | 23 |
| `/models/seedance-2-5` | 28 | 1 | 904 | 50 |
| `/es/herramientas/angle` | 25 | 41 | 459 | 646 |

Cela justifie une investigation des requêtes, lancements/retraits de modèles, positions et URLs avant de supprimer du texte. Une baisse simultanée du trafic n'établit aucune causalité avec le design. Les nouvelles pages rendent le mix de requêtes différent.

Table pays affichée en entier (500 lignes demandées, 220 présentes en comparaison). Sélection géographique hispanophone LATAM, incluant Puerto Rico, tous chemins et toutes langues du site :

| Pays / territoire | Clics actuels | Précédents | Impressions actuelles |
|---|---:|---:|---:|
| Mexique | 30 | 37 | 1 613 |
| Pérou | 29 | 19 | 584 |
| Argentine | 17 | 23 | 924 |
| Chili | 10 | 4 | 426 |
| Équateur | 8 | 8 | 226 |
| Colombie | 5 | 18 | 583 |
| République dominicaine | 5 | 3 | 149 |
| Venezuela | 4 | 7 | 213 |
| Puerto Rico | 3 | 0 | 62 |
| Guatemala | 2 | 4 | 126 |
| Bolivie | 2 | 3 | 109 |
| Uruguay | 1 | 0 | 69 |
| Paraguay | 1 | 2 | 66 |
| Salvador | 1 | 1 | 57 |
| Panama | 1 | 2 | 56 |
| Cuba | 1 | 0 | 17 |
| Costa Rica | 0 | 2 | 104 |
| Honduras | 0 | 0 | 34 |
| Nicaragua | 0 | 3 | 20 |

Somme de cette sélection : **120 clics contre 136**, soit 6,8 % des clics actuels du site. Ce n'est pas une mesure du trafic en langue espagnole. Brésil, suivi séparément : 33 clics contre 48, 1 675 impressions contre 2 171 ; ne pas l'assimiler à l'espagnol LATAM. Espagne : hors sélection LATAM. Prochaine coupe : pays × pages `/es/` × appareil, puis requêtes ; ne pas déduire la qualité des traductions à partir du seul pays.

## GA4 — acquisition, période alignée

Source : compte **MaxVideoAI GA4**, rapport « Traffic acquisition: Session primary channel group (Default Channel Group) », Chrome, 9 septembre. Plage personnalisée **10 août–6 septembre 2026**, All Users, aucun filtre ; interface indiquant 100 % des données disponibles. Cette indication n'établit pas une couverture de tous les visiteurs : consentement, bloqueurs, exclusions et instrumentation restent à réconcilier.

| Canal affiché | Sessions | Sessions engagées | Engagement | Événements clés | Revenu total |
|---|---:|---:|---:|---:|---:|
| Total | 1 146 | 756 | 65,97 % | 70 | 654,98 € |
| Organic Search | 514 | 368 | 71,6 % | 2 | 17,24 € |
| Referral | 257 | 178 | 69,26 % | 1 | 0 € |
| Direct | 217 | 150 | 69,12 % | 3 | 21,58 € |
| AI Assistant | 84 | 29 | 34,52 % | 0 | 0 € |
| Unassigned | 62 | 22 | 35,48 % | 64 | 616,16 € |
| Organic Social | 7 | 7 | 100 % | 0 | 0 € |
| Organic Video | 1 | 1 | 100 % | 0 | 0 € |

17 218 événements au total ; taux de sessions avec événement clé : 0,79 %. Les 70 événements clés ne sont pas 70 utilisateurs acheteurs et leur définition n'a pas été inspectée. Le revenu GA4 n'est pas un rapprochement comptable Stripe.

**Priorité de mesure :** Unassigned concentre 94,07 % du revenu et 91,43 % des événements clés pour 5,41 % des sessions. Contrôler les noms et paramètres d'événements, l'attribution des achats/recharges, identifiants de session, envois serveur éventuels et retours auth/paiement. Ceci est un signal d'attribution à expliquer, pas la preuve d'un bug particulier.

**GEO / MCP :** le canal AI Assistant représente 7,33 % des sessions observées. Son engagement affiché est plus bas que celui d'Organic Search, mais seulement 84 sessions et aucun événement clé observé : examiner landing pages et attentes avant de conclure. Ce canal ne mesure pas l'usage du MCP ni l'ensemble des citations IA. Les sessions GA4 et les clics GSC ne sont pas directement comparables.

## Clarity — état agrégé, période distincte

Source : projet `maxvideoai.com`, Chrome, le 9 septembre, filtre **Derniers 28 jours**, sans autre filtre. Cette fenêtre inclut des jours plus récents que GSC/GA4 ; ne pas présenter ces trois sources comme un funnel aligné. La première tentative de plage personnalisée n'avait pas changé les dates ; seuls les chiffres chargés après application du filtre Derniers 28 jours sont retenus ici.

| Indicateur affiché | Valeur |
|---|---:|
| Sessions (hors 14 sessions bot exclues) | 848 |
| Utilisateurs uniques | 506 |
| Pages / session | 3,32 |
| Profondeur de scroll moyenne | 56 % |
| Temps d'activité / durée totale | 2,6 min / 6,7 min |
| Clics de colère | 3 sessions · 0,35 % |
| Clics sans effet (« non valides ») | 210 sessions · 24,76 % |
| Retours rapides | 291 sessions · 34,32 % |
| Défilement excessif | 0 session |

Carte performance : score 74/100 sur 634 consultations de page ; LCP 3,5 s, INP 260 ms, CLS 0,13, tous affichés « nécessite une amélioration ». Agrégats du tableau Clarity : ni mesure spécifique de l'accueil, ni test Lighthouse, ni remplacement du rapport CrUX/GSC. Le percentile et la segmentation mobile n'ont pas été vérifiés.

Carte erreurs : 0,12 % des sessions avec erreurs JavaScript, 4 erreurs au total ; message visible `e.requestfullscreen is not a function`. Identifier la page, le navigateur et la source avant correction. Ne pas conclure que tous les lecteurs sont défectueux ou attribuer l'erreur à Safari sans preuve.

La carte Entonnoirs invite à les configurer. Les événements intelligents visibles (connexion, inscription, chargement, etc.) ne prouvent pas une définition du funnel métier. **Aucune session individuelle n'a été visionnée dans ce cycle** : « clic sans effet » et « retour rapide » restent des signaux de tri, pas un diagnostic de friction par composant. Prochaine observation : sessions mobiles publiques du catalogue/exemples/MCP, puis lecteurs présentant une erreur, avec journal anonymisé du problème et de sa reproductibilité.

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
