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
| Parcours administrateur sur base jetable avec migrations et données fictives | 25 réussis, 1 ignoré, 1 échec détaillé ci-dessous |

Les suites PostgreSQL utilisent des bases locales jetables. Les tests navigateur emploient des fixtures contrôlées. Une revue indépendante a couvert les cinq corrections ; les problèmes de renouvellement de jeton et de compatibilité SWR Infinite trouvés pendant cette revue ont été corrigés et couverts par des tests.

## Résultat de la première validation globale et relances

Le premier `pnpm test:validate` a terminé son groupe standard avec **8 710 réussites, 7 échecs et 4 tests ignorés** sur 8 721 tests. Cette première invocation n’est donc pas présentée comme une suite globalement verte.

- Quatre parcours Studio ont dépassé leur délai sous exécution parallèle ; ils passent tous dans la suite navigateur isolée sur le commit corrigé.
- Une vérification de durée d’un média BytePlus a échoué en exécution parallèle, après une attente proche du délai maximal de l’analyseur ; les huit tests du fichier passent en relance isolée. Un effet de charge est plausible mais n’a pas été mesuré séparément.
- Le test de bascule tarifaire a détecté que le commit avait changé pendant son exécution. La suite financière a été relancée avec le commit figé : ses deux tests passent, y compris l’acceptation des 26 818 devis, les rejets de certificats périmés, l’annulation de transaction et le retour arrière conservant l’historique.
- Un contrat Storyboard attendait encore un gestionnaire transmis directement, désormais transmis par l’objet qui protège les actions utilisateur. L’assertion a été adaptée pour vérifier explicitement ce chemin et la transmission au composant. Les 21 tests associés passent.

## Limite du contrôle administrateur

Le scénario `tests/e2e/admin-critical-flows.spec.ts:269` cherche un bouton de famille sans ouvrir la section « Families ». `DestinationPicker.tsx` ne monte ses boutons qu’après ouverture. Le test et ce composant sont identiques entre la base `20f485` et le code corrigé `c746163ca` ; cet échec reste documenté et n’a pas été masqué par une modification hors périmètre. Il n’a pas fait l’objet d’une exécution séparée sur la branche de base.

Le scénario d’annuaire utilisateur est ignoré par son garde existant, car la clé Supabase service role n’est pas fournie à cet environnement local. Les 25 autres scénarios admin passent après préparation des données fictives nécessaires.

## Livraison

Les changements restent locaux sur la branche isolée. Le checkout partagé du Desktop et ses fichiers préexistants sont conservés. La fusion et le déploiement ne font pas partie de cette intervention.
