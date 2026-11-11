# OAuth et essais sans dépense — 11 novembre 2026

## Résultat vérifié

Le compte reviewer se connecte au MCP dédié avec PKCE S256. Le renouvellement
réel renvoie HTTP 200, conserve le client et l'audience MCP et permet de découvrir
42 outils. Un jeton de connexion ordinaire est refusé (401). Après fermeture de
la seule session OAuth de diagnostic, son renouvellement échoue (400) et son
jeton encore non expiré est refusé par le MCP (401).

Le grant OpenAI et ses **deux sessions antérieures** sont conservés : le nombre
et l'empreinte de leurs identifiants sont identiques avant/après. Le test réutilise
le consentement existant, sans nouveau scope ni validation. La connexion de
diagnostic est également fermée. Ce test ne prétend pas exercer le renouvellement
automatique interne à ChatGPT ni la révocation globale du client.

## Appels réels et limite actuelle

| Appel | Résultat sur le test |
| --- | --- |
| Compte | Solde 0 USD, aucun montant en attente, email vérifié. |
| Catalogue image sans filtre de mode | Dix fiches retournées (limite demandée : dix), génération désactivée faute de routes raccordées. |
| Catalogue image filtré `t2i` | Vide : aucun mode exécutable dans cet environnement. |
| Fiche du premier modèle retourné | Données, guides et liens structurés reçus. |
| Catalogue audio | Mode `voice_only` publié, route fournisseur indisponible dans le test. |
| Médias, générations, personnages | Listes vides cohérentes avec le compte neuf. |
| Comparaison image | Erreur métier `PARAMETER_INVALID / no_matching_scenario`, sans devis ni génération. Défaut de transport découvert et corrigé localement ci-dessous. |

Relecture de la configuration du **seul** projet Vercel dédié : 36 variables,
aucune clé fournisseur. Les clés webhook/poll Fal existantes ne sont pas une clé
de génération Fal. Aucune fonctionnalité retirée ou activation artificielle pour
masquer cette configuration incomplète.

## Correction du contrat des erreurs

Le SDK 1.29.0 valide le contenu structuré d'une erreur contre le schéma publié,
même avec `isError: true`. Nos schémas OpenAI ne décrivaient que les réussites.
Une erreur utile devenait donc une erreur de validation après `tools/list`.
Les anciens tests appelaient directement les outils sans remplir le cache des
schémas du client : ils ne reproduisaient pas le parcours hôte.

Le test reproduit désormais la découverte avant les appels. Deux régressions
échouent avant correction. Le schéma JSON du canal OpenAI déclare maintenant
réussite **ou** erreur structurée complète. Le validateur serveur de réussite
reste strict ; contenu, indications de reprise et identifiants de corrélation
restent conservés. Le profil direct reste inchangé. Cette correction ne permet
aucune génération supplémentaire et ne change pas les droits ou les prix.

Validation locale : **27 tests ciblés**, **214 tests MCP / un ignoré** et
**70 scénarios de sélection** passent ; TypeScript et exposition passent.
Lint : zéro erreur, sept avertissements préexistants. Les 42 schémas acceptent
l'erreur complète et refusent une erreur incomplète ; les réussites malformées
restent rejetées. Livraison dédiée et relecture réelle : en cours.

## Suite concrète pour la démonstration

1. Raccorder une **clé fournisseur dédiée** au seul projet Vercel de test.
   Commencer par les routes Fal utilisées par les scénarios, sans recopier les
   secrets de production. Ajouter les routes directes nécessaires aux scénarios
   choisis, selon leurs conditions de compte ; aucun modèle n'est retiré.
2. Relever les modèles réellement exécutables et les devis frais. Préparer les
   droits de démonstration du reviewer et quelques médias détenus par ce compte.
   Aucun achat Stripe réel n'est nécessaire pour représenter un solde de test.
   Les générations payantes demandent encore leur accord sur les devis.
3. Compléter les accès de lancement du worker d'export dédié : cluster,
   définition de tâche, réseau, région et droits IAM limités. Le bucket est déjà
   raccordé ; cela ne qualifie pas les exports ni les outils de traitement.
4. Exécuter les cinq scénarios positifs et trois négatifs dans ChatGPT, enregistrer
   la vidéo, puis renseigner les accès reviewer dans le portail après accord.
   Les cinq remarques génériques du scan restent à documenter, sans leur inventer
   un motif. Réconcilier le nom du brouillon, le main courant et les pièces avant
   toute soumission. La publication demande un accord distinct.

## Ressources et preuves

Au 11 novembre à 17:45:46 UTC : **1 profil, 4 consentements, 0 devis de génération,
0 job, 0 reçu**. Aucun fournisseur appelé, crédit ajouté ou paiement effectué.
Neon dédié remis en pause à 17:46:01 UTC, `disabled: true`, `idle`. Fenêtre
17:38:22–17:46:01 : borne compute indicative 0,00338 USD, pas une facture.

Preuves privées exclues de Git dans `.local/openai-directory-20261111/evidence/` :
`oauth-lifecycle-2026-11-11T17-38-32-031Z.json`,
`oauth-lifecycle-2026-11-11T17-42-52-395Z.json`, `price-response-run.log`,
`provider-bindings-readiness.json`, `post-lifecycle-counts.json`,
`output-error-regression-before.log`, `output-error-focused.log`.
Les jetons de diagnostic sont restés en mémoire et ont été révoqués.
