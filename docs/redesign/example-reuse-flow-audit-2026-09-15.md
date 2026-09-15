# Parcours de réutilisation d'un exemple — 15 septembre 2026

Périmètre : lecture du parcours `/video/...` ou galerie → `/app?from=<job-id>` → brouillon invité → connexion → devis. Audit du code et tests locaux avec réponses simulées ; aucune base de production, aucun compte et aucune génération utilisés.

## Ce que reprend réellement le visiteur

`GET /api/videos/:id` lit `getVideoById`, dont `BASE_SELECT` ne sélectionne pas `settings_snapshot`. Le hook `useWorkspaceVideoSettings` construit donc un snapshot dérivé avec le prompt, le modèle, la durée et le ratio disponibles. Ces valeurs passent ensuite par les capacités et valeurs supportées du modèle courant.

- Le builder dérivé utilise `inputMode: 't2v'`, une résolution et un réglage audio non renseignés ; le modèle applique ses choix par défaut. Il ne reproduit donc pas nécessairement le mode, la résolution ou l'audio du rendu d'origine.
- Les références du snapshot dérivé sont vides. Les images privées ou pièces jointes originales ne sont pas transmises au visiteur.
- Le rappel complémentaire `/api/jobs/:id` permet au propriétaire connecté de retrouver son snapshot exact. Les exemples visiteurs autorisés par cette API omettent explicitement `settingsSnapshot` ; les autres jobs exigent le propriétaire.
- Les seules capacités actuelles du modèle ne permettent pas de déduire les réglages historiques : ne pas inventer ces valeurs ni promettre une reproduction exacte. Le libellé marketing doit présenter un point de départ avec les réglages disponibles.

## Continuité et prix

`listenForGuestCreationLogin` sauvegarde le setup modifié de l'invité dans `sessionStorage` au clic de connexion vers la même surface. Le jeton de continuation est à usage unique et expire après 30 minutes. Le retour retire `from`, `job` et les autres paramètres de reprise qui pourraient écraser les modifications déjà sauvegardées. Cela dépend de la disponibilité du stockage navigateur ; en cas d'indisponibilité, le lien initial reste utilisable mais la conservation de toutes les modifications n'est pas garantie.

`useWorkspacePreflightQuote` n'installe un devis que lorsque l'authentification et son token sont disponibles. Une modification de la requête ou du compte masque immédiatement le devis précédent ; les réponses obsolètes ne peuvent pas réinstaller ce devis. Le prix de la vidéo d'origine ne sert donc pas de devis pour une nouvelle création.

## Correctifs réalisés

1. Un échec HTTP, réseau ou une réponse inutilisable sur `from` était silencieux. Une notice EN/FR/ES explique maintenant l'échec et propose de recharger ou choisir un autre exemple. Le brouillon et le paramètre de reprise restent intacts. Une réponse tardive ne crée pas de notice après un changement de brouillon ou de compte.
2. Le GET vidéo renvoyait auparavant aussi les vidéos privées à toute personne connaissant leur identifiant. La visibilité est désormais contrôlée avant la réponse : public accessible ; privé accessible uniquement au propriétaire ; absent et privé non autorisé renvoient le même 404. Le contrat existant distingue `public` et `private`, pas un troisième état `unlisted`. `indexable: false` ne retire pas l'accès à une vidéo publique, ce qui préserve les partages exclus de la recherche. Les réponses GET portent `Cache-Control: private, no-store`. Aucun champ de réglages supplémentaires n'a été exposé ; PATCH reste inchangé.

## Vérification

- 24 tests ciblés réussis : continuation invité, devis et changements de compte, hydratation existante, erreurs de reprise dans les trois langues et réponses tardives.
- 5 tests de route réussis avec données et authentification simulées : public indexable ou non, invité refusé sur privé, autre compte refusé, propriétaire autorisé, propriétaire absent, base indisponible et cache.
- Aucun test n'a lancé de paiement, génération, appel fournisseur ou accès à la base.

Reste à vérifier avant publication : parcours complet avec authentification réelle sur un environnement de préproduction et exemple public effectivement accessible. Le preview local sans base renvoie volontairement 503 pour ce GET ; la notice est couverte, mais ce mode ne prouve pas une reprise réussie de bout en bout.
