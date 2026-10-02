# Proposition de PR — centralisation des tarifs

Préparée localement le 2 octobre 2026 sur `codex/bytedance-pricing-grid`.
Le propriétaire a ensuite autorisé la publication de la branche, une PR en
brouillon et une preview isolée. La [PR #370](https://github.com/camgraphe/MaxVideoAi/pull/370)
est ouverte. La fusion, les migrations et l'activation en production restent
une décision de publication distincte.

## Ce que contient la branche

- Une page admin Pricing avec Vidéo, Image, Audio, Tools et Storyboard : prix
  fournisseur, prix client, prix à l'unité, marge, simulation, aperçu avant
  confirmation, historique et retour arrière.
- Des tarifs clients explicites par modèle et variante, avec les suppléments
  adaptés aux secondes d'entrée, sources d'image et options réellement facturées.
  La règle générale des 30 % sera retirée lors de l'activation du registre complet.
- Le même calcul de prix actuel pour l'app, MCP, Studio, la page Pricing, les
  pages/cartes modèles, comparaisons et exemples publics. Les montants historiques
  des paiements et reçus restent leurs montants d'origine.
- Le routage et les références de coût préparés pour BytePlus et Alibaba, avec
  les références LIST, estimations de contrat et factures observées distinguées.
- La première activation atomique des tarifs, son certificat complet et un retour
  arrière conservant l'historique et refusant les modifications intervenues depuis.
- Le parcours Draft 480p → finalisation 1080p, intégré au modèle Seedance 2.5,
  reste réservé au local en attendant son test opérationnel stockage/Studio.

Les modifications commerciales approuvées sont explicites : les 24 arrondis
GPT Image 2.5 d'un centime et les tarifs Seedance proportionnels à la durée de la
vidéo d'entrée, en conservant la marge positive de chaque variante. Les corrections
des outils restent documentées séparément dans le
[comparatif déployé](../engineering/2026-10-02-pricing-deployed-comparison.md).

## Vérifications réalisées

La [qualification complète](../engineering/2026-10-02-pricing-initial-cutover.md)
porte sur l'implémentation `baffc0731` : 6 738 tests principaux et 11 tests Studio
réussis, zéro échec, trois tests principaux déjà exclus ; build de 920 pages,
lint et contrôle d'exposition réussis. La préparation contient 14 991 tarifs
effectifs et vérifie 26 818 devis réels dans la transaction d'activation.

Contrôles complémentaires exécutés depuis `fb0d66aa0` :

| Contrôle | Résultat |
| --- | --- |
| Git et déploiement, lecture seule | `main` local/distant à `d10ad4587` ; les deux domaines servent le même déploiement Git `dpl_B1xi8TtrQ1viCBJ3XbEjWG6HCS4y`. La branche contient ce main. |
| Traductions | Parité FR/ES réussie. |
| SEO, découverte machine, liens internes et origines des médias | Réussis. |
| Descriptions d'images | Contrôle réussi sur 288 fichiers. |
| Catalogue et roster | Réussis ; un avertissement concerne l'identifiant de compatibilité non publié `seedance-2-0-fast-byteplus`. |
| Données commerciales actuelles, lecture seule à 12:02:25 UTC | 4 règles, 53 configurations, 9 overrides et 16 produits. Seules 36 dates `engine_settings.updated_at` diffèrent ; tous les autres champs commerciaux et tous les produits sont identiques à la capture précédente. |
| Schéma actuel, lecture seule à 12:02:25 UTC | Aucun prérequis obligatoire manquant ; les sept nouvelles tables sont encore absentes. Neuf fichiers de migration exacts sont liés au rapport. |
| Métadonnées de preview | Aucun enregistrement de connexion par défaut commun aux cibles production et preview ; des variables distinctes ne prouvent pas à elles seules que les bases sont distinctes. |

Les contrôles locaux complémentaires utilisent une copie Git sans fichiers
d'environnement privés. Le rapport généré du roster reste dans cette copie.
Les lectures SQL utilisent le lecteur de maintenance existant, TLS vérifié et une
transaction repeatable-read/read-only. L'identité complète de la cible correspond
à la production précédemment enregistrée. Les deux fichiers temporaires de
connexion sont supprimés ; l'environnement original et l'admin local sont conservés.

Les résultats sont conservés dans un paquet privé de 27 artefacts, exclu de Git :
`prepublication-checks-20261002/` dans le dossier de ce plan. Empreinte du manifeste :
`d512aa82a14d75b72fcf5ade682a7ead6bce207c037ef3abcfb7c6f5058937a0`.
Il conserve `activationReady: false` et `productionWriteAuthorized: false`.

## Décisions de cette préparation

1. Exécuter les contrôles complémentaires dans une copie : le contrôle du roster
   génère un rapport. En cas de modification inattendue, elle reste dans cette
   copie et doit être examinée avant qualification.
2. Préparer une connexion directe explicite depuis la configuration locale
   existante, puis exiger l'identité complète de la production enregistrée avant
   toute connexion. Le suffixe du pooler suit la
   [convention documentée par Neon](https://neon.com/blog/postgres-support-case-recap).
   Le lecteur maintient ses refus des URL poolées et des overrides. Une identité
   différente bloque la lecture ; cette configuration mise en cache ne certifie
   pas l'environnement effectif du déploiement.
3. Classer les 36 différences de date comme métadonnées de configuration : les
   autres champs sont identiques et le propriétaire de la bascule exclut ces
   seules dates. Ce contrôle ne renouvelle pas le certificat des devis déployés ;
   leur reproduction reste exigée au moment de la publication.

## Publication et preview isolée

La branche publiée contient `origin/main` à `d10ad4587`. Le contrôle de livraison
répété confirme que les deux domaines de production servent encore le même
déploiement Git de main. Aucun merge ni déploiement de production n'a été effectué.

La première preview a révélé que la variable de connexion par défaut de preview
visait la base de production, malgré la création d'une branche Neon dédiée.
Un override sensible est maintenant réservé à **cette branche Git et à la cible
preview**. Les enregistrements d'environnement de production sont inchangés.
La preview reconstruite depuis le commit publié `350fefa06` est READY :
[Pricing](https://maxvideoai-m48gfs7je-camgraphes-projects.vercel.app/pricing).

La connexion explicite vérifiée par TLS appartient à la branche Neon dédiée.
Les neuf migrations exactes y ont été appliquées dans une transaction, puis leurs
tables, contraintes et définitions vérifiées. Le registre y reste vide et inactif,
révision zéro. Un aller-retour du calcul dans cette seule base confirme l'isolation
effective du serveur : devis 289 → 1290 → 289 centimes, règle et révision du devis
restaurées exactement. Aucun paiement ni appel fournisseur. Les fichiers
temporaires de connexion et de variables privées sont supprimés.

L'accueil, Pricing, le modèle Seedance 2.5 et le devis public répondent HTTP 200 ;
l'admin sans session répond HTTP 401 attendu. Le bypass admin local reste limité
au local. Ces vérifications ne certifient pas une activation des tarifs manuels.

La [première Quality CI](https://github.com/camgraphe/MaxVideoAi/actions/runs/37006585292)
a atteint sa limite de 35 minutes pendant la suite de tests. Aucun test déclaré
en échec ne figure avant l'annulation ; le test complet d'activation est encore
inachevé. Le budget du job passe à 60 minutes, avec les mêmes étapes et assertions.
La [relance](https://github.com/camgraphe/MaxVideoAi/actions/runs/37010986333)
termine en 41 minutes : 6 740 tests réussis, un échec, quatre exclusions existantes.
Le scénario d'activation/retour arrière réutilise sa capture synthétique après
plus de 15 minutes sur le serveur CI. Le refus de fraîcheur attendu bloque donc
sa seconde activation. Les tests Studio séparés et le smoke admin n'ont pas
encore été exécutés dans cette relance.

La correction limite l'horloge simulée à `Date` dans ce scénario de test ; les
délais réels de PostgreSQL restent actifs. Un contrôle ciblé avance l'horloge
de 16 minutes et vérifie que la capture périmée est toujours refusée. Le code
de production et sa limite de 15 minutes sont inchangés. Les cinq contrôles
ciblés passent. Le scénario PostgreSQL 17 complet passe aussi en 11 minutes
25 secondes : 26 818 devis vérifiés, activation réelle du lecteur, annulation
après échec injecté et récupération réussies, zéro échec ou exclusion. Une
nouvelle Quality CI reste à obtenir avant fusion.

Avant fusion/activation, suivre le [runbook](customer-tariff-cutover.md) : preuve
récente des devis et de la configuration déployés, inventaire des paiements,
sauvegarde, review des neuf migrations exactes, manifeste de la cible finale et
décision de publication. L'interrupteur de tarifs en production reste actuellement
désactivé dans le code. Le test réel du Draft nécessite son autorisation distincte.
