# Fiche d'effacement — qualification du compte de test

Cette procédure prépare le traitement par l'exploitant. Elle n'exige pas un robot
d'effacement pour déposer un plugin, mais exige de savoir traiter une vraie demande.
La fonctionnalité actuelle enregistre la demande ; aucune purge générale automatique
n'est attestée. Cette fiche n'autorise aucune opération sur un client réel.

## Informations à renseigner lors de l'essai

- Environnement, compte synthétique exact, date de demande, opérateur.
- Identifiants de ses médias, projets, jobs, grants OAuth et objets de stockage.
- Opérations encore en cours : les terminer/réconcilier avant suppression des
  références nécessaires au suivi ou au remboursement ; éviter la réapparition
  via webhook/polling/retry.
- Liste des fournisseurs réellement appelés pour ce compte, leurs identifiants
  de jobs et les modalités d'effacement applicables. Ne pas déclarer tous les
  fournisseurs destinataires d'une demande qui ne les concerne pas.

## Contrôles et preuves de clôture

| Ensemble | Travail de l'opérateur | Preuve attendue |
| --- | --- | --- |
| Accès | Vérifier le demandeur, enregistrer la demande, retirer les sessions/grants du compte de test avant sa clôture. | Connexion/jetons du seul compte refusés ; les autres comptes ne sont pas affectés. |
| Bibliothèque et stockage | Inventorier les objets possédés, leurs dérivés et les références partagées ; retirer les objets du seul compte, après traitement des jobs en vol. | Liste bornée avant/après ; original et dérivés privés indisponibles ; aucune suppression d'objet d'autrui. |
| Studio et outils | Traiter projets, timelines, conversations, références, tâches, exports, audio et sous-titres du compte. | Relectures impossibles ou données anonymisées selon le traitement retenu. |
| Données de revue interne | Retirer les copies et notes liées au compte lorsque leur conservation n'est plus justifiée. L'expiration des 90 jours n'efface pas l'historique natif. | Compteurs et justificatifs limités à ce compte. |
| Comptabilité / contentieux | Conserver uniquement les pièces légalement nécessaires, avec accès restreint et durée applicable ; séparer ces pièces des médias et conversations. | Catégories, motif et échéance consignés ; ne pas promettre une suppression totale contradictoire. |
| Fournisseurs, caches, sauvegardes | Utiliser les possibilités documentées du service effectivement appelé ; préciser ce qui expire ultérieurement et ce qui doit être demandé. | Confirmation ou échéance documentée ; absence de preuve conservée comme telle. |
| Communication | Préparer la réponse à l'utilisateur avec les données supprimées et les exceptions restantes. | Réponse factuelle. Aucun email envoyé sans instruction explicite. |

## Résultat de cet essai

**Non exécuté à ce stade.** La qualification HTTP locale prouve l'enregistrement
de la demande et l'absence de fausse promesse de purge, pas l'effacement final.
Le test complet nécessite le compte et les ressources dédiées raccordés.
