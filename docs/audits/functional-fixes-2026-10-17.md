# Corrections de l’audit fonctionnel — 17 octobre 2026

Les cinq problèmes de l’audit sont corrigés dans la branche isolée `codex/functional-audit-fixes`, basée sur `20f485f307c4063fb1e0ba9570ec0d8a95343398`. Le code applicatif vérifié est enregistré dans `c746163ca`. Aucun déploiement, appel fournisseur payant ni changement de données de production n’a été effectué.

## Comportements corrigés

1. **Isolation des comptes dans Character Builder.** Le brouillon, les références, les résultats et les tâches en attente appartiennent au compte confirmé. Changer de compte démonte l’ancien espace et invalide ses requêtes. Les réponses tardives ne peuvent pas réinjecter les données du compte précédent. Un renouvellement du jeton conserve le brouillon courant.
2. **Expiration audio et remboursement.** L’expiration relit et verrouille le véritable job dans une transaction. Un job terminé ou ayant progressé depuis la lecture initiale reste intact. L’échec et le remboursement exact du débit enregistré sont atomiques ; deux expirations simultanées ne produisent pas deux remboursements. Une incohérence comptable annule la transaction.
3. **Sélection d’images.** Une sélection, une modification manuelle ou un changement de compte invalide la précédente récupération de paramètres. Une ancienne réponse ne peut plus écraser les champs courants, y compris si elle arrive après l’analyse du JSON.
4. **Vérifications des fournisseurs.** Les erreurs de lecture chez Luma, Kling, Alibaba et Google font avancer l’ordre de vérification. Un premier lot de jobs en erreur ne monopolise plus chaque passage. Les verrous et les échéances de génération sont conservés.
5. **Retour sur l’onglet.** Une seule logique pilote la resynchronisation partagée. Les appels concurrents du watchdog et de SWR sont supprimés pour les clés concernées. Les listes paginées SWR Infinite conservent leur chargement, leur pagination et leur politique de rafraîchissement.

## Compatibilité à connaître

Les anciens brouillons Character Builder enregistrés sans propriétaire ne sont pas automatiquement attribués à un compte. Les nouveaux brouillons sont persistés séparément par compte ; les créations déjà enregistrées restent accessibles dans l’historique authentifié. Une génération déjà acceptée par le serveur continue pour son propriétaire malgré l’annulation de la requête navigateur.

## Vérifications

| Contrôle | Résultat |
| --- | --- |
| Régressions comportementales des cinq corrections, React/SWR et PostgreSQL 17 | 71 réussis, aucun ignoré |
| Contrats Storyboard, espace image et sélection d’image | 21 réussis |
| Suite navigateur isolée : `pnpm test:validate -- --suite browser` | 42 réussis, aucun ignoré |
| Suite Studio isolée : `pnpm test:validate -- --suite studio` | 4 réussis, aucun ignoré |
| Suite financière exhaustive : `pnpm test:validate -- --suite tariffs` | 2 réussis, aucun ignoré ; 26 818 devis acceptés avec 7 lectures SQL tarifaires |
| Artefacts BytePlus, relance isolée | 8 réussis |
| TypeScript : `pnpm --prefix frontend exec tsc --noEmit` | Réussi |
| Lint frontend | Aucune erreur ; 6 avertissements dans des fichiers Studio/facturation non modifiés |
| Vérification d’exposition publique et `git diff --check` | Réussis |
| Build frontend et ses contrôles préalables | Réussi avec configuration publique Supabase locale fictive |
| Parcours administrateur sur base jetable avec migrations et données fictives, suite complète relancée après correction du test | 26 réussis, aucun échec, 1 ignoré détaillé ci-dessous |
| Tests associés aux galeries admin : architecture, éditeur, interface, ordre, modèles et inspection SEO | 23 réussis, aucun ignoré |

Les suites PostgreSQL utilisent des bases locales jetables. Les tests navigateur emploient des fixtures contrôlées. Une revue indépendante a couvert les cinq corrections ; les problèmes de renouvellement de jeton et de compatibilité SWR Infinite trouvés pendant cette revue ont été corrigés et couverts par des tests.

## Résultat de la première validation globale et relances

Le premier `pnpm test:validate` a terminé son groupe standard avec **8 710 réussites, 7 échecs et 4 tests ignorés** sur 8 721 tests. Cette première invocation n’est donc pas présentée comme une suite globalement verte.

- Quatre parcours Studio ont dépassé leur délai sous exécution parallèle ; ils passent tous dans la suite navigateur isolée sur le commit corrigé.
- Une vérification de durée d’un média BytePlus a échoué en exécution parallèle, après une attente proche du délai maximal de l’analyseur ; les huit tests du fichier passent en relance isolée. Un effet de charge est plausible mais n’a pas été mesuré séparément.
- Le test de bascule tarifaire a détecté que le commit avait changé pendant son exécution. La suite financière a été relancée avec le commit figé : ses deux tests passent, y compris l’acceptation des 26 818 devis, les rejets de certificats périmés, l’annulation de transaction et le retour arrière conservant l’historique.
- Un contrat Storyboard attendait encore un gestionnaire transmis directement, désormais transmis par l’objet qui protège les actions utilisateur. L’assertion a été adaptée pour vérifier explicitement ce chemin et la transmission au composant. Les 21 tests associés passent.

## Suivi du contrôle administrateur

Le premier contrôle du scénario `gallery workbench keeps media visible, navigable and safe across widths` échouait parce qu’il cherchait un bouton de famille sans ouvrir la section « Families ». `DestinationPicker.tsx` ne monte ses boutons qu’après ouverture.

Le test ouvre désormais cette section si elle est fermée, vérifie son état ouvert et la visibilité du choix avant de sélectionner la famille. Les assertions de sélection, navigation, géométrie responsive et édition sont conservées. Aucun code applicatif n’a été modifié pour cette correction de test.

Une relance complète des trois fichiers `admin-*.spec.ts`, sans nouvelle tentative automatique, donne **26 réussites, aucun échec et 1 scénario ignoré**. Elle utilise le schéma et les migrations du projet dans PostgreSQL 17 jetable, avec des acteurs, reçus et playlists fictifs ; la base est nettoyée à la fin. Les 23 tests associés aux galeries admin passent également. Le lint frontend termine sans erreur (les 6 avertissements connus restent inchangés), ainsi que le contrôle d’exposition publique et la vérification de diff.

Le scénario d’annuaire utilisateur reste ignoré par son garde existant, car la clé Supabase service role n’est pas fournie à cet environnement local. Ce parcours n’est donc pas couvert par cette exécution.

## Livraison

Les changements restent locaux sur la branche isolée. Le checkout partagé du Desktop et ses fichiers préexistants sont conservés. La fusion et le déploiement ne font pas partie de cette intervention.
