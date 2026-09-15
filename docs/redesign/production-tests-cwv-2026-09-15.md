# D94 — Recette production et Core Web Vitals

Mesures du 15 septembre 2026, environ 09:05–09:27 UTC, sur `https://maxvideoai.com`.
Version publiée : `f60aa0c974769eb9df2849daa225a07fb305cd4d`, déploiement
`dpl_8j6ryLom1qXxJ7bWpW2QNqpNBvGk`. Aucun correctif produit ni nouveau
déploiement pendant cette recette.

## Résultat

Le parcours de génération testé fonctionne en production. Les mesures de
laboratoire sont bonnes sur la majorité des pages échantillonnées, mais les
Core Web Vitals mobiles réels ne sont pas encore validés. Character Builder
présente un LCP mobile variable à corriger. Les chiffres historiques ne
permettent pas encore d'attribuer un gain ou une régression à la refonte.

## Recette fonctionnelle

| Contrôle | Résultat et portée |
| --- | --- |
| Session authentifiée | Session existante utilisable dans l'app, accès au solde et aux résultats. Pas de nouvelle connexion complète ni de déconnexion du compte utilisateur. |
| Génération réelle | Une seule génération MiniMax H3 Max, 15 s, 480p, 21:9, un résultat. Devis et débit : **0,98 $**, sous le plafond de 1 $ expressément autorisé. |
| Résultat et lecteur | Résultat présent dans la galerie de l'app ; vidéo de 15,104 s lue, `readyState=4`, sans erreur du lecteur. Lecture mise en pause après contrôle. |
| Historique et solde | Ligne de débit correspondante présente dans Wallet activity ; solde diminué de 0,98 $. Aucune deuxième génération. |
| Recharge | Redirection vers le vrai formulaire Stripe, moyens de paiement et champs de carte visibles. Retour sans paiement ni achat de crédits. Ce contrôle ne valide pas un règlement ni son webhook. |
| Mobile FR, Chrome 390 px | Menu et sous-menu Assistants, fermeture du menu, FAQ ouverte et lisible, accueil sans débordement horizontal. Politique de lecture mobile manuelle conservée. |
| Character Builder FR, Chrome 390 px | Titre, CTA et planche humaine visibles ; pas de débordement horizontal mesuré. |
| Connexion anonyme | Formulaire de connexion accessible ; authentification fraîche non exécutée. |

Le prompt déjà présent décrivait une boule rouge roulant sur une table blanche.
Le résultat de test est conservé dans le compte. Aucun média privé ni URL signée
n'est recopié dans ce document. Les contrôles publics HTTP, SEO, sitemaps et
lecteurs de publication restent documentés dans [D93](production-release-2026-09-15.md).

Défaut confirmé : dans le menu mobile marketing français **connecté**, les
actions du bas affichent « Generate » et « Sign out ». La barre compacte affiche
bien « Générer ». Propriétaires à examiner : `MarketingNav.tsx`,
`MarketingMobileMenu.tsx` et les clés de traduction chargées par le marketing.
Pas de correction publiée pendant le relevé.

Limites : pas de test Safari/iPhone réel, pas de paiement Stripe final, pas de
nouveau raccordement OAuth dans un client MCP externe. Une tentative de largeur
320 px n'a pas produit une largeur mesurée de 320 px : elle n'est pas comptée
comme une validation. Les contrôles visuels décrits ci-dessus sont à 390 px.

## PageSpeed Insights : accueil anglais

[Rapport public](https://pagespeed.web.dev/analysis/https-maxvideoai-com/x56y8x8f2n?form_factor=mobile),
lancé le 15 septembre à 11:13 UTC+2. L'API sans clé retournait un quota 429 ;
les résultats ci-dessous ont été lus dans l'interface publique.

### Visiteurs réels — URL d'accueil, fenêtre glissante de 28 jours

| Indicateur | Mobile | Desktop | Seuil « bon » |
| --- | ---: | ---: | ---: |
| LCP | **2,9 s** | 2,0 s | ≤ 2,5 s |
| INP | **252 ms** | 70 ms | ≤ 200 ms |
| CLS | 0,06 | 0,03 | ≤ 0,1 |
| Bilan CWV | **Non validé** | **Validé** | Les trois critères |

Cette fenêtre couvre surtout l'ancienne version. Ce n'est pas une mesure isolée
du déploiement de ce matin. Les métriques de terrain sont évaluées au 75e
percentile : [méthode Google](https://developers.google.com/speed/docs/insights/v5/about),
[seuils CWV](https://web.dev/articles/defining-core-web-vitals-thresholds).

### Test de laboratoire après publication

| Indicateur | Mobile | Desktop |
| --- | ---: | ---: |
| Performance | **94/100** | **94/100** |
| LCP | 2,3 s | 0,4 s |
| TBT | 180 ms | 180 ms |
| CLS | 0 | 0 |
| Accessibilité | 93/100 | 96/100 |
| Bonnes pratiques | 100/100 | 100/100 |
| SEO technique Lighthouse | 100/100 | 100/100 |

Lighthouse 13.4.1, Chrome 151, infrastructure Google ; mobile Moto G Power et
réseau lent simulés. Le TBT ne remplace pas l'INP. Le score SEO ne garantit ni
positionnement ni absence de problème éditorial. Les alertes d'accessibilité
(contraste, zones tactiles, sous-titres) nécessitent une revue ciblée, pas une
conclusion automatique à partir du seul score.

## Laboratoire local sur la production : six gabarits

24 mesures : trois passages mobiles et un desktop par URL. Lighthouse 12.6.1,
Chromium installé pour les tests, configuration mobile par défaut (412 × 823,
DPR 1,75, réseau/CPU simulés), configuration desktop officielle. Nouveau Chrome
et nouveau profil à **chaque passage**, sans cache navigateur réutilisé.
Le cache CDN de production n'est pas purgé. Les médianes concernent trois
mesures par métrique ; elles ne représentent pas les visiteurs réels.

| Page | Score mobile médian | LCP mobile médian | Plage LCP mobile | TBT médian | LCP desktop |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/fr` | 100 | 1,39 s | 1,39–1,70 s | 42,5 ms | 0,36 s |
| `/examples/ltx` | 100 | 1,40 s | 1,39–1,47 s | 31,5 ms | 0,41 s |
| `/models/minimax-h3` | 99 | 1,71 s | 1,70–1,76 s | 32 ms | 0,41 s |
| `/ai-video-engines/minimax-h3-vs-seedance-2-5` | 99 | 1,40 s | 1,39–1,40 s | 3,5 ms | 0,61 s |
| `/fr/outils/character-builder` | **96** | **2,62 s** | **2,45–4,51 s** | 11 ms | 0,60 s |
| `/fr/mcp` | 100 | 1,39 s | **1,39–2,75 s** | 17 ms | 0,37 s |

CLS mesuré à 0 sur ces 24 essais ; score desktop 100 sur les six pages. Le plus
mauvais passage Character Builder obtient **84/100** : la médiane seule masque
cette variabilité. Le premier passage MCP dépasse également 2,5 s.

Une première série exploratoire partageait un navigateur et réutilisait du
cache CSS/JS malgré le reset Lighthouse : **exclue des conclusions à froid**.
Une erreur de lancement Chrome a interrompu la série corrigée après dix mesures ;
les mesures restantes ont été reprises, sans remplacer les résultats déjà acquis.
Les résultats Google et locaux diffèrent de version, environnement et URL :
aucune comparaison directe de gain entre leurs scores.

Preuves locales ignorées par Git : `docs/redesign/qa/production-d94/lighthouse-cold/`
(24 JSON, captures finales, `summary.json`). Journaux : `lighthouse-cold.log`
et `lighthouse-resume.log`. La série exploratoire reste dans `lighthouse/`.

## GSC et Vercel

Search Console, dernière actualisation **13 septembre**, donc antérieure à la
publication : mobile **139 URL à améliorer**, aucune bonne ou mauvaise ;
desktop **139 bonnes URL**. Le groupe mobile LCP affiche **3,1 s**. Ancienne
validation échouée le 3 août. Aucune nouvelle validation de correction lancée.

Vercel Speed Insights, production, P75, ensemble du site (app incluse) :

| Période et appareil | LCP | INP | CLS | Événements |
| --- | ---: | ---: | ---: | ---: |
| 7 jours, desktop | 2,80 s | 88 ms | 0,02 | 3 867 |
| 7 jours, mobile | 2,56 s | 200 ms | 0,1063 | 1 951 |
| 24 heures, mobile | 2,56 s | 240 ms | 0,1093 | 205 |

Ces fenêtres mélangent les versions ; les événements ne sont pas des visiteurs
uniques et toutes les métriques n'ont pas nécessairement le même échantillon.
Le score d'expérience global supérieur à 90 ne suffit pas à déclarer les CWV
validés. La page Analytics initiale de l'utilisateur a été rétablie après lecture.

## Priorités fondées sur les mesures

1. **Stabiliser le visuel initial Character Builder**, puis MCP. La planche humaine
   est l'élément LCP ; elle est découverte dans le HTML, mais sans priorité haute.
   Délais avant requête de 1,64–1,80 s simulés sur les passages examinés. Vérifier
   priorité, taille responsive et concurrence réseau avec une comparaison
   avant/après identique ; conserver le visuel et sa géométrie.
2. **Réduire le CSS critique superflu**, sans supprimer les styles utilisés après
   défilement. Environ 61 Kio de CSS non utilisé au premier écran signalés sur
   l'accueil ; PageSpeed estime 730 ms pour les ressources bloquantes. Ce sont
   des pistes, pas un gain garanti ni une autorisation de purger les feuilles.
3. **Diagnostiquer l'INP mobile réel** par parcours et interaction. L'INP CrUX de
   252 ms et le TBT Google de 180 ms justifient ce travail ; ils ne désignent
   pas à eux seuls un composant responsable. Isoler marketing et app dans le RUM.
4. **Corriger les deux libellés FR connectés**, puis contrôler l'équivalent ES.
5. Compléter Safari/iPhone et les parcours MCP réels. Relire les mesures terrain
   après accumulation de trafic postpublication avant de conclure au gain CWV.

Pas de modification visuelle ni de nouveau déploiement pour terminer les tests.
