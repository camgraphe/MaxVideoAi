# Alignement du candidat OpenAI — 12 novembre 2026

Intégration sur `codex/openai-directory-20261111`, puis livraison du candidat
`e75f95e7b` au seul environnement Review et essai P1 dans ChatGPT. Aucun merge
en production ni soumission. Les fichiers modifiés avant la réintégration sont
préservés. Voir le [reçu de qualification hébergée](qualification-hebergee-2026-11-12.md)
pour les migrations, les limites de capture et la clôture de la base dédiée.

## Sources intégrées

- `a2d769069f16f9b2934f69df83a6311142cbb407` → `2479c6610` : Audio,
  Character Builder, Milo, outils créatifs et politique sous-titres.
- `c9c0249a48fe3826c07336b34113466dc2d8ac15` → `d37ca4bb9` : tests Product
  de Pika archivé. La matrice historique reste conservée.
- Le main vérifié `371ee9eaf` était déjà intégré. Le merge de l'autre worktree
  `566d430c8` n'a pas été repris.

Suivi réintégré sans conflit après les adaptations marketplace `ab2229111` :

- `f346f175ea14b85d5fdd23cc83b951755b401e5e` → `c59deb481` : identité
  historique explicite dans les audits offline ; l'archivage de Pika ne doit pas
  remplacer ses lignes historiques par Veo. Aucune formule de prix ou gate live
  modifiée.
- `60a1f3a8115cbd1c81fde7886fdbd5a2c88ebf52` → `ba998c2e1` : fixtures
  courantes, récupération historique de paramètres Pika sans génération, garde
  de route/SSR archive sans CTA de génération et contrat d'extraction Builder.
- `f344ca27507209923a68b493bb32db9cc96d0743` → `5c9c9ce66` : dossier final
  du chantier commun, résultats, réserve navigateur et économie des sous-titres.

Ces deux patches sont identiques à leurs sources. Le journal historique déjà
modifié conserve son empreinte ; aucun fichier du paquet directory ou de son
infrastructure de livraison privée n'est changé par ce suivi.

Quatre conflits ont été résolus : guide MCP (conservation des deux historiques),
service creator (origine de livraison privée et URL de découverte), serveur MCP
(profil directory et option Builder), empreinte de politique (recalcul du contenu
combiné, sans modifier les décisions attendues).

## Adaptations marketplace

Les quatre outils `prepare_character_builder`, `confirm_character_builder`,
`get_character_builder_quote` et `get_character_builder_status` ont une projection
success/error complète pour le SDK OpenAI et respectent le profil du canal.
L'erreur de droits insuffisants conserve la limite d'utilisation des crédits
existants du canal directory. Le canal direct garde son comportement.

`MCP_OPENAI_DIRECTORY_CHARACTER_BUILDER_ENABLED` est indépendant. Le serveur et
les services reçoivent la même valeur résolue ; préparation et confirmation
restent conditionnées aux références et à la génération payante. La fermeture de
l'exécution conserve la lecture du devis et la récupération du résultat tant que
Character Studio est exposé. Le modèle d'environnement local laisse ce nouvel
interrupteur fermé jusqu'à la qualification dédiée.

Builder et Recast réutilisent la signature de lecture des médias privés et le
lien first-party `openUrl`. Le helper reçoit un statut déjà lu et vérifié par
l'owner du devis ; il ne relit ni base ni état de trial. `saveSource` conserve
l'original canonique de l'image Builder terminée pour `save_character`, tandis
que les liens de présentation sont temporaires. La validation stricte de
l'original sauvegardé reste intacte.

Les DTO déclarent aussi `needsAttention`, la fin du polling (`retry: null`), les
outils accessibles sur le site (`webTools`) et le passage explicite vers ce site
(`webHandoff`). Ouvrir cette destination ne prétend ni transférer les médias ni
exécuter l'opération.

## Paquet local

Candidat **0.3.21**, avec la référence autonome
`skills/generate/references/extended-workflows.md` incluse et contrôlée par
l'inventaire indépendant. Les paragraphes ajoutés par le builder directory sont
regroupés sans perdre le contrôle des devis, la récupération, les clés exactes de
réessai, les révisions Studio ou la limite du canal sur l'achat de crédits.
Une demande SRT/VTT reste un export texte ; seul un rendu suit son contrat de
devis/confirmation, même lorsque ce rendu est inclus à zéro.

Archive retenue :
`.local/openai-directory-20261111/requalification-20261112/package-0.3.21-reviewed/maxvideoai-openai-directory-0.3.21.zip`.

SHA-256 : `cf032f151e3dcc5cc49312dfb330c4309c23934fbfbcac529ca4db99e2a7576c`.
La première construction intermédiaire est conservée dans un autre dossier.
Aucune archive antérieure n'a été écrasée ni importée dans le portail.

Les scénarios du manifeste restent à synchroniser après validation éditoriale :
P1 laptop/comparaison, P2 deux références, P5 exports inclus et les propositions
négatives simplifiées. Construire ce paquet ne vaut donc pas finalisation du
dossier ou qualification de ses scénarios.

## Preuves locales

- Découverte SDK sans appel métier : **46 outils**, tous avec schéma de sortie
  objet ; **1 997 octets** d'instructions et **1 939 octets** pour le plus grand
  descripteur. Ce sont des métadonnées locales, pas une découverte ChatGPT réelle.
- **57 tests** ciblés de projection/récupération passent, dont les sorties Builder,
  les erreurs après découverte, les références privées et Character Studio.
- **5 tests du paquet** passent : inventaire, archive déterministe, limites de
  financement, secrets, sortie protégée contre l'écrasement.
- Les dix interrupteurs indépendants sont contrôlés sur leurs **1 024 combinaisons**.
- TypeScript passe ; lint frontend : zéro erreur, sept avertissements préexistants.
- Vérification d'exposition publique et `git diff --check` passent.
- Empreinte combinée :
  `fce2c72d8134e2d7f85019f4df615090db8fa99c6e6090aff9dc5741c1201202`.
  Le contrat des 70 scénarios curatés n'a pas changé.

La suite MCP exécutée en série couvre **245 tests réussis et un skip optionnel**,
après contre-vérification du seul échec de lancement. Son évaluation de **70
scénarios** passe. Les reçus locaux conservent le premier passage : refus du socket IPC local
de `tsx` dans un test lançant une sous-commande ; cette limite du sandbox ne doit
pas être transformée en suppression du test. La contre-vérification porte sur
ce test inchangé (réussi) et la commande d'évaluation (réussie).

La tâche commune annonce ses validations Studio et build vertes. Ses dernières
suites navigateur et rapide restent de sa responsabilité. Les vérifications
TypeScript/lint de nos adaptations ont été réalisées en série après accord
sur le créneau et passent. Le build du candidat intégré a ensuite été vérifié
ici ; aucun parcours navigateur nouveau n'a été lancé dans cette branche.
Ne pas confondre les résultats de l'autre worktree avec ceux de la branche
marketplace.

État final annoncé par le chantier commun : Studio 1 601 réussites et un
skip ; build et matrices financières réussis. Le navigateur termine à 328/329 :
l'échec Header/useId a été reproduit sur `main` par l'autre tâche et reste
documenté, sans masquage. Les audits offline annoncés passent à 270 scénarios
(dont 14 Pika), 92 additions et 629 projections publiques ; les fixtures
financières restent inchangées. Les lots ciblés du suivi passent selon le bilan
commun. Sa suite rapide complète sur `60a1f3a81` passe : 1 697 fichiers,
11 226 tests réussis, zéro échec et un skip préexistant. TypeScript, lint
(zéro erreur, sept avertissements préexistants), exposure et diff passent aussi.
Les reçus et identités des logs se trouvent dans le
[dossier commun](../assistant-mcp-alignment-2026-11-12/README.md).
Aucun test lourd n'a été relancé ici pendant son créneau. Les résultats locaux
MCP ci-dessus qualifient `ab2229111` ; le build de notre candidat intégré
`5c9c9ce66` passe ensuite, en 141 secondes : prébuild, compilation, types, lint,
pages et sitemap. Il a tourné sans clés de service ni connexion de base.
Les cinq tests locaux d'isolation Review passent aussi (projet, provenance,
ressources, cookies, paiement réel, Ads et exclusion des autres builds).
Les reçus sont conservés sous `.local/openai-directory-20261111/requalification-20261112/`
dans `integrated-build-receipt.json` et `integrated-environment-guard.log`.
Le canevas rend explicites les deux gates Audio étendues encore fermées,
sans changer les fonctionnalités de l'environnement hébergé.
La qualification hébergée reste distincte.

## Préparation de l'essai dédié — état antérieur à la livraison

Cette liste conserve les conditions préparées avant l'essai. La livraison,
les migrations 99/100/101, la désactivation des 19 crons et P1 ont depuis été
réalisés ; la base dédiée est à nouveau en pause. Worker Audio, activation des
nouvelles capacités et prises suivantes restent à qualifier séparément.

1. Arrêter le périmètre de la prochaine livraison sur le seul projet Review.
   Réintégration, build local, contrôles MCP, TypeScript/lint, isolation et revue
   des adaptations locales sont terminés. Aucun push ou déploiement effectué.
2. Préparer la migration dédiée 100 puis 101 avec le runner numérique ; ne pas
   appliquer ces migrations aux bases normales. Les deux migrations 99 restent
   distinctes, identifiées par leur nom complet.
3. Qualifier un worker Audio dédié (Node 22/FFmpeg), ses accès isolés et ses coûts
   avant activation des deux gates audio. Aucune ressource permanente nouvelle
   n'est créée par ce lot.
4. Sur le seul environnement Review, conserver Ads désactivé, vérifier le nouveau
   cron, puis préparer les interrupteurs des fonctionnalités réellement qualifiées.
5. Refaire la découverte du client, puis P1 selon l'accord déjà donné. Les autres
   prises et leurs coûts suivent la validation convenue avec le propriétaire.

L'habillage est validé ; l'agent réalise le montage. Le dashboard fictif ATELIER
et les huit déclinaisons sont des supports visuels à examiner, pas des captures
d'exécution. Voir le [conducteur](recapture-et-dossier-2026-11-12.md).
