# Studio — complément de revue visuelle du 8 septembre 2026

Ce document complète, sans le remplacer, le manifeste
`studio-connected-editor-final-review.md`. Le point de départ est
`9ea03b66f` sur `codex/studio-connected-editor`. Le travail reste dans la
worktree isolée `dce6`; aucun push, merge, déploiement, appel fournisseur payant
ou écriture distante n'a été effectué.

## Retours transformés en comportements

- La grande barre flottante de sélection simple a disparu. Un bloc sélectionné
  expose deux commandes locales de 44 px, Réglages et Actions. Le menu Actions
  contient seulement les opérations réellement disponibles : remplacer,
  insérer à la tête de lecture, connexions, copier et supprimer selon le type.
  La sélection multiple conserve une petite commande groupée.
- Le dock Canevas fermé tient en cinq intentions : Annuler, Rétablir,
  Sélection, Ajouter et Sauvegarder. Ajouter ouvre une palette groupée
  Image/Vidéo/Audio/Texte, utilisable au clic, clavier, toucher et glisser-déposer.
  Les outils existants, dont Denoise, sont des liens explicites vers leur
  workbench qualifié et ne sont pas présentés comme de faux nœuds Studio.
- Les pistes vidéo et audio ont une hauteur nominale de 64 px. Le verrou reste
  disponible dans le menu de piste sur les largeurs où son bouton est masqué.
  Les menus du dernier rang restent atteignables en paysage court.
- Le guide place sa fiche avant ses repères, puis range les badges autour. Il
  reconnaît le nouveau dock et les commandes locales, respecte les positions
  déplacées par l'utilisateur et reste lisible à 200 % de texte.
- Le mode Simulation ne lance plus le préflight tarifaire facturable. Une
  référence de démonstration locale est bloquée avant le contrat Live, qui reste
  strict sur les URL HTTP(S) persistées. Le média vidéo simulé pointe vers un
  fichier local jouable déjà versionné.
- Le dialogue Médias du projet restaure le focus et se ferme par Échap sur
  mobile. Le calcul de prix est stabilisé sur les faits métier, pas sur les
  mesures React Flow.
- Le Studio produit démarre désormais directement en Live et n'affiche plus de
  bouton Mock. Une simulation locale reste disponible uniquement pour les E2E
  via une requête explicite ignorée en production; elle n'est ni visible ni
  persistée.
- Le logo M ouvre exactement le menu de l'app (destinations, langue, apparence,
  compte). Les navigations internes passent par la même sauvegarde/ACK que la
  sortie Studio, et le bouton Projets reste visible même sans e-mail résolu.
- L'ancienne oscillation des arêtes a été rattachée au cycle devis → hauteur du
  bloc → mesure React Flow. Le correctif `0d88e42ea` garde une signature métier
  stable; le chemin SVG a été observé identique sur vingt mesures successives
  dans la prévisualisation courante.
- Connexions est maintenant un tableau de slots issu de la politique du modèle :
  obligatoire/facultatif, utilisé/maximum, disponible/plein/désactivé et motif
  d'indisponibilité. Une source existante ou un nouveau bloc peut être connecté
  depuis le même panneau; la création et l'arête sont validées et commitées
  ensemble. Le câble direct suit exactement le même validateur et affiche le
  motif métier du refus au lieu d'échouer silencieusement.
- Le Viewer dispose de deux panneaux rétractables indépendants et d'un mode Focus.
  Échap restaure la combinaison exacte qui précédait Focus. Cet état reste une
  préférence de présentation de la session et n'entre pas dans le projet. Les
  tiroirs mobiles restent les propriétaires de Médias du projet et de l'inspecteur.
- Le HUD du programme est ramené aux transports, marques In/Out et Snapshot;
  Clear n'existe que lorsqu'une marque est active. La règle, le zéro, les pistes
  de 64 px et la tête de lecture partagent désormais la même origine géométrique,
  y compris après scroll, resize et sur les breakpoints mobiles.

## Commits à relire

| Commit | Propriétaire et interface |
| --- | --- |
| `b0ab2f930` | Contrat partagé d'accès Studio : une décision unique alimente middleware, routes Studio, Chat et entrée marketing. Le bypass local est refusé en production/Vercel et limité aux chemins protégés. |
| `d523150ba` | Propriétaires locaux Studio : commandes de bloc, dock/palette, guides, timeline, copies EN/FR/ES et tests de géométrie/interaction. |
| `0d88e42ea` | Robustesse locale Studio : dialogue médias, média Mock jouable, préflight Simulation/local et stabilité des devis. |
| `a5c09b4a1` | Garde de présentation intermédiaire : les commandes locales restent visibles sur tout projet sans guide, y compris les anciens projets. |
| `09e79ae05` | Stabilisation des interactions compactes : menu de piste sans scroll de focus, vrai glisser depuis la palette et réglage multi-sorties restauré dans l'inspecteur. |
| `4f7f2ded5` | Contrat E2E du guide : la copie développée peut passer dynamiquement du badge au panneau de surface sans produire un faux échec. |
| `d6f0ed116` | Clavier et guide : navigation des menus sans scroll parasite ; Réglages et Actions restent accessibles sur le seul bloc sélectionné pendant un guide visible. |
| `be1ad24e9` | Contrat partagé app : le contenu exact du menu MaxVideoAI est réutilisable, conserve le focus et laisse les clics modifiés au navigateur. |
| `1c9f3f2e1` | Propriétaire Studio : Live par défaut, test simulation non-production caché, menu M, sortie Projets persistante et navigation app sauvegardée. |
| `3520730f9` | Viewer : HUD compact, panneaux rétractables, Focus et restauration Échap, copies EN/FR/ES et cibles 44 px. |
| `bbcc50fca` | Timeline : règle, zéro, pistes et tête de lecture alignés sur desktop/mobile après scroll et redimensionnement. |
| `a2ee16ddc` | Connexions : slots issus des capacités du modèle, compteurs, motifs de refus et création-connexion atomique. |
| `f2116248b` | Couture UI/métier : le panneau appelle réellement créer-connecter et les câbles directs refusés remontent leur motif canonique. |
| `2b9a821a6` | Correctif de revue : les câbles directs conservent le motif de politique localisé et le panneau projette la capacité réelle des blocs de sortie. |

Le guide traite ce petit portail comme un obstacle de placement afin de préserver
la lisibilité du canevas.

## Prévisualisation de revue

La copie jetable active est servie sur
`http://127.0.0.1:3048/app/studio/projects`, avec auth locale séparée sur 3049.
Le projet inspecté pendant la dernière revue est accessible à
`http://127.0.0.1:3048/app/studio/workspace/project_004fb2e9-cbcd-4ce1-9fe0-ad15958b82c2`.
La copie se trouve dans `/private/tmp/studio-review-3048.u4fsoh` et ne reçoit
aucun fichier d'environnement. DB, paiement, stockage et génération sont absents.
Les projets de cette prévisualisation sont donc des brouillons navigateur; les
preuves PostgreSQL/Auth privées restent celles du manifeste principal.

## Qualification

- 530/530 contrats Studio/éditeur réussis sous Node 22.23.2. Les contrats de
  persistance démarrent PostgreSQL 17 en socket local jetable, vérifient sa
  version et son dossier de données, puis le détruisent.
- TypeScript, lint frontend, contrôle d'exposition, audit d'architecture et
  `git diff --check` réussis.
- Les 96 scénarios Playwright adaptés couvrent le dock, la sélection, les
  connexions, les médias, la timeline, le Viewer et le guide sur desktop,
  mobile et paysage court, clair/sombre, EN/FR/ES, clavier et toucher. Le lot
  monolithique sur le serveur Next dev a fini à 93/95 à cause de deux
  compilations à froid (une navigation de 28,2 s et une création dépassant le
  timeout de 5 s) ; les deux scénarios concernés ont ensuite réussi 3/3 chacun
  sur le même serveur chaud. Le menu de dernière piste et la copie du guide à
  150 % ont en plus réussi 5/5 chacun après stabilisation. Le maintien des
  commandes locales pendant le guide et la navigation clavier du menu de piste
  ont réussi ensemble 3/3.
- Le complément topbar et préférences a réussi 17/17 contrôles Playwright :
  navigation sauvegardée, absence de Mock, focus du menu, desktop, mobile
  320/390 px, paysage court et clair/sombre.
- La passe de feedback a été rejouée dans le navigateur sur la copie jetable :
  panneau Connexions et création-connexion, capacités recalculées, panneaux
  Viewer indépendants, Focus + Échap, HUD, règle et tête de lecture, desktop
  1440×1000, mobile 390×844 et thème sombre. Trois chemins SVG ont été comparés
  avant/après une attente de 900 ms et sont restés strictement identiques.
- La revue indépendante SOL n'a relevé aucun point critique. Ses deux écarts de
  cohérence ont été reproduits par tests puis corrigés : motif métier localisé
  pour un slot désactivé et sortie déjà connectée affichée pleine à 1/1.
- Build Next 15 de production réussi sous Node 22 : registre et projections
  modèles cohérents, contrôles médias réussis, compilation et génération de
  871/871 pages.

La capture visuelle ne sert qu'à confirmer la hiérarchie et les collisions.
Aucun gain de performance n'est revendiqué : ce lot ne modifie pas le contrat de
chargement Activity ni ne remplace les mesures comparables du manifeste principal.

## Limites explicites

- Denoise reste une destination outillée existante, pas un traitement intégré au
  graphe tant qu'aucun contrat de nœud certifié ne l'autorise.
- Le lot ne crée pas de montage audio avancé; les pistes audio restent visibles,
  conservées, verrouillables et manipulables avec les commandes existantes.
- Le bypass local facilite seulement la revue de l'espace Studio. Il n'accorde
  aucun accès de production et ne contourne jamais l'ownership des médias ou des
  montages persistés.
