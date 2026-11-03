# Character Studio — création visuelle, personnages et Recast

3 novembre 2026. Proposition révisée et maquette interactive ; aucune intégration applicative, génération payante ou mise en production réalisée.

## Direction retenue

**Un seul tool Character : créer une identité, lui donner des looks, puis la réutiliser dans une image, une vidéo ou un Recast.** La prévisualisation 3D est abandonnée à la demande explicite d’Adrien. Aucun assemblage de morceaux de photos ne simule le résultat final.

La création reprend l’intention des interfaces Higgsfield et Pollo : menus illustrés, exploration facile, génération explicite, sélection du résultat, bibliothèque persistante et passage immédiat à un usage. Recast fait partie du périmètre initial et démarre avec **Wan 3 Prime**. Le registre local et le catalogue MaxVideoAI connecté confirment cet identifiant, correspondant au « One 3 Prime » évoqué oralement.

Les cartes de choix décrivent une intention. L’image du personnage apparaît après génération. Changer un œil ou une coiffure sélectionne une nouvelle caractéristique ; cela ne déforme pas une photographie existante. Une image déjà générée reste associée aux choix qui l’ont produite.

## Benchmark vérifié

Interfaces publiques inspectées le 3 novembre, sans connexion ni génération. Les observations portent sur l’ergonomie ; elles ne démontrent pas la qualité, le taux de réussite ou l’architecture interne des concurrents.

| Source | Ce qui est observable | Application à Character |
|---|---|---|
| [Higgsfield AI Influencer](https://higgsfield.ai/ai-influencer-studio) | Photo facultative, catégories repliables, choix illustrés, Randomize et Generate ; Explore/History et Recreate. Le panneau Eye shape consulté contient 11 choix. | Réglages dans une colonne stable, une catégorie ouverte, galerie comme point de départ. |
| [Présentation Higgsfield](https://higgsfield.ai/blog/new-ai-influencer) | Portrait et vue en pied après génération ; continuité vers ses outils de mouvement. | Construire des références réutilisables après validation d’une identité. Le nombre de catégories annoncé dans un article ne remplace pas l’écran observé. |
| [Pollo AI Influencer](https://pollo.ai/ai-influencer) | 19 groupes, sélection de caractéristiques récapitulée, photo facultative, Explore/History, Recreate. Hair style présente 35 options. | Réduire l’information visible par regroupement et divulgation progressive ; garder les choix récupérables. |
| [Guide Pollo](https://pollo.ai/hub/how-to-use-pollo-ai-influencer) | Création depuis zéro ou modèle, planche personnage, sauvegarde et looks, passage vers Recast. | Le personnage devient une entité durable plutôt qu’un seul job image. |
| [Pollo Recast](https://pollo.ai/recast) | Vidéo source annoncée 4–30 s ; jusqu’à 10 références ; Lite/Pro ; consigne optionnelle ; quantité, définition ; Advanced contient Public Visibility et Copy Protection. Galerie de templates « Recreate ». Le sélecteur source expose Uploads et Creations. | Reprendre la hiérarchie source → références → direction → génération, et les exemples récupérables. Adapter les options aux capacités de Wan, sans reprendre les limites 4–30 s ou les niveaux Lite/Pro de Pollo. |

Nous conservons nos images, nos libellés et notre dessin d’interface. Aucun asset concurrent, endpoint privé ou code propriétaire n’est réutilisé. La promesse marketing de conservation du mouvement n’est pas considérée comme une mesure indépendante.

## Organisation du tool

Navigation principale en haut de l’atelier : **Personnage / Recast**, avec deux boutons de même importance. **Mes personnages** et **Nouveau personnage** restent accessibles dans cette même rangée, quel que soit l’écran. Les modes commencent immédiatement sous la barre, sans grand bandeau introductif. Les exemples et l’historique vivent dans l’espace de travail concerné. La fiche d’un personnage présente ses looks, ses références et ses créations.

### Créer

Colonne de réglages d’environ 300–340 px, grande zone de contenu à droite. Au premier accès, cette zone montre des inspirations ; après génération, elle affiche les propositions. Six rubriques regroupent les paramètres ; une seule est ouverte à la fois :

1. **Identité** : nom, présentation, âge, caractère des traits, teint.
2. **Visage** : Yeux / Forme / Détails. Gros plans pour les yeux, couleur séparée ; sourcils, nez et lèvres sous « Affiner le visage ».
3. **Cheveux** : six coiffures visibles, six supplémentaires à ouvrir, couleur séparée.
4. **Silhouette** : morphologie et taille ; proportions à la demande.
5. **Style vestimentaire** : huit familles illustrées, puis précision libre, photo de style et accessoires facultatifs.
6. **Décor** : galerie filtrée Studio / Intérieur / Ville / Nature.

Le sélecteur « Photographie / Cinéma / Illustration » est supprimé. Il mélangeait la tenue du personnage et le traitement de l’image. Le présent parcours prépare une identité photographique ; un éventuel changement de médium ne doit pas réapparaître dans les vêtements.

### Couverture du catalogue révisé

| Groupe | Base visible ou disponible | Complément sans multiplier les cartes |
|---|---|---|
| Style vestimentaire | Casual, Streetwear, Sport, Business, Soirée, Rétro, Bohème, Alternatif | Photo de référence et texte pour une pièce, une matière, une couleur, un uniforme ou une époque précise |
| Cheveux | Carré ondulé, longs lisses, boucles souples, attachés, coupe courte, tresses ; puis afro, rasés, chauve, locs, pixie, frange | Six couleurs ; précision libre pour longueur et texture particulières |
| Visage | Six formes d’yeux et six couleurs ; six formes de visage | Sourcils, nez et lèvres : trois directions et choix Libre ; six signes particuliers ; cinq options barbe/moustache |
| Identité et corps | Trois présentations, quatre tranches d’âge adultes, six teints, six silhouettes, trois tailles | Trois directions de proportions et précision libre |
| Accessoires | Lunettes, chapeau, bijoux, sac, casque audio, écharpe | Photo ou précision pour les objets spécifiques |
| Décors | 24 références, six visibles à la fois | Quatre familles et lien de provenance |

Ces familles sont un cadrage éditorial, pas une promesse d’exhaustivité. Une vignette illustre un style sans imposer exactement sa coupe, sa couleur ou sa pièce. La V1 de cette maquette se concentre sur les personnages humains adultes ; les créatures/robots proposés par certains concurrents demandent un catalogue et une validation propres.

Vérification complémentaire des écrans publics : Higgsfield montre **8 styles** (Retro, Sporty, Y2K, Theatre, Goth, Suits, Streetstyle, Casual) et une référence de style facultative. Pollo en montre **18**, dont ces huit familles et des costumes/sous-styles plus spécialisés (Astronaut, Evening gown, Lab, Ladylike, Leather biker, Old money, Pilot, Preppy, Sports jersey, Utility). Notre sélection retient huit familles générales ; les cas spécialisés passent par la référence ou le texte. Les interfaces observées séparent la création de personnage et le mode vidéo dès le haut du panneau, avec une galerie et l’historique à droite.

La photo de référence est facultative. Un récapitulatif compact ouvre tous les choix et permet de revenir à leur catégorie. Annuler, rétablir et proposer une sélection aléatoire restent gratuits. Les traits non renseignés demeurent libres ; aucun paramètre arbitraire n’est imposé par une carte non sélectionnée.

Le bouton principal annonce une génération et son prix exact dans le produit. Aucun appel payant au clic sur une carte. Le nom du modèle image se trouve dans les réglages de génération, sans occuper le premier écran.

### Générer et valider

Le résultat conserve son snapshot de paramètres, ses références et son coût. Il peut être comparé, ajusté, téléchargé ou retenu. Si des choix ont changé pendant ou après le job, afficher « Modifications à générer » ; l’image ne change pas et ne reçoit pas les nouveaux paramètres rétroactivement.

« Choisir ce personnage » crée une version d’identité acceptée. Un portrait et une vue en pied cohérents sont les sorties prioritaires. Les vues complémentaires sont des générations à valider, pas des rotations supposées d’une image. Une planche de présentation n’est pas automatiquement envoyée comme première image vidéo.

### Mes personnages et looks

Le mode look possède un contexte explicite et un bouton **Revenir à [nom]**. « Personnage » dans la navigation ouvre toujours l’atelier complet, avec ses six rubriques ; il quitte le mode look et garde les valeurs du brouillon disponibles. « Nouveau personnage » crée un brouillon neuf sans toucher aux personnages/looks enregistrés. L’état limité du mode look ne doit pas se propager aux autres accès de création ni enfermer l’utilisateur après rechargement.

Une fiche contient : portrait approuvé, version d’identité, looks, vues validées et historique lié. Actions directes : **Créer une image · Créer une vidéo · Recast · Nouveau look**.

Un look conserve la version d’identité qui lui sert de référence. Coiffure, tenue, accessoires et décor peuvent varier ; le visage et la morphologie restent ceux de l’identité acceptée. Le maquillage pourra être ajouté comme variation explicite. Modifier les traits permanents crée une nouvelle version. Les looks précédents ne sont jamais réécrits par ce changement.

Le passage vers Recast transmet **l’image déjà préparée et choisie** dans Personnage. Recast ne propose aucun sélecteur de look ni éditeur de tenue : cette image est une référence de remplacement, comme une image importée. Reprendre un exemple conserve les images ajoutées tant que l’utilisateur ne les retire pas.

## MaxVideoAI Recast — V1

### Écran et parcours

Le fonctionnement reprend celui observé directement chez Pollo Recast et dans l’onglet Motion de Higgsfield AI Influencer : **vidéo source → images de remplacement → consigne facultative → génération**. La droite garde les exemples et l’historique.

- **Vidéo de référence** : un grand emplacement d’import, ou une vidéo reprise depuis Médias/un exemple. Le média sélectionné affiche son aperçu, sa durée et les actions remplacer/retirer.
- **Images de remplacement** : un seul bloc pouvant recevoir personnage, produit ou décor. Import multiple et sélection d’images existantes ; vignettes numérotées `@image1`, `@image2`, etc., retrait individuel, plafond de dix images pour Wan. Une image venant de Personnage est déjà prête : aucun choix de look dans Recast.
- **Consigne facultative** : repliée par défaut, activable pour décrire le remplacement et citer les images. Les images et la vidéo constituent les entrées principales.
- **Sortie** : définition et durée compactes ; format, audio, graine et enrichissement sous Options avancées. Le nom public est **MaxVideoAI Recast**, sans sélecteur de fournisseur dans cette interface.

Aucun catalogue de tenue/décor ni case « conserver les gestes / caméra / rythme » dans Recast. Ces cases ajoutaient une mécanique absente des écrans observés et suggéraient des contrôles indépendants que Wan ne garantit pas. La scène de départ, les références et la consigne portent l’intention.

Observation directe du 3 novembre : **Pollo** présente une vidéo 4–30 s, jusqu’à dix images et un prompt optionnel ; le sélecteur d’images propose Uploads, AI Influencers, Elements et Creations, celui de vidéo Uploads et Creations. **Higgsfield Motion** présente une vidéo 4–30 s, jusqu’à trente images avec Genjutsu, un prompt optionnel et la qualité. Ses modes Motion transfer / Objects swap sont propres à cette offre. On reprend l’enchaînement observé, pas leurs plafonds ni des modes non démontrés sur Wan.

Le CTA affiche le devis puis lance un job récupérable en production. Après succès : lecteur du résultat, source consultable, téléchargement original, reprise des réglages, nouvelle variante, envoi au Studio et sauvegarde comme exemple personnel. Les résultats rejoignent Médias ; un lien au personnage existe seulement si une référence provient de ce personnage.

Supprimer une référence ne doit pas faire désigner silencieusement une autre image à une mention existante. Réindexer les références restantes, signaler une mention retirée, et demander de corriger la consigne avant soumission. Les snapshots précédents gardent leur association originale.

### Capacités vérifiées

Le 3 novembre, `get_model_details(id="wan-3-prime")` confirme `generationEnabled=true`, les modes `i2v`, `ref2v`, `v2v` et `extend`. La V1 Recast propose le chemin **édition d’une vidéo source (`v2v`) avec références image**. Une comparaison avec `ref2v` doit confirmer le meilleur comportement sur notre jeu d’essai avant lancement. L’interface utilisateur n’expose pas ces noms techniques.

| Contrôle | Contrat actuel pour Recast |
|---|---|
| Vidéo source | Une MP4 ou MOV, au maximum 15 s et 100 Mo ; durée réelle issue des métadonnées contrôlées côté serveur |
| Images de référence | Jusqu’à 10 au total, 20 Mo chacune ; formats du catalogue ; le produit compte portrait, look, décor et produit dans le même plafond |
| Durée générée | Entière, 2–30 s, avec **durée source + sortie ≤30 s** ; une source de 8 s limite la sortie à 22 s |
| Définition | 480p, 720p, 1080p |
| Format | Automatique, 16:9, 4:3, 1:1, 3:4, 9:16 |
| Images/seconde | 30, pas de sélecteur à une seule valeur |
| Audio | Génération audio facultative. « Générer l’audio » n’équivaut pas à conserver la bande-son source à l’identique |
| Graine | Entier de 0 à 2 147 483 647, facultatif |
| Enrichissement de consigne | Désactivé par défaut en édition vidéo dans le catalogue actuel |
| Nombre de sorties | Une par job. Une offre de variantes multiples demande plusieurs jobs et leur coût total explicite |

Ces options dérivent du catalogue et de ses validations, jamais d’un second tableau maintenu à la main dans le composant de production. Les références audio supplémentaires sont supportées par le modèle mais ne sont pas nécessaires à l’interface simple de départ ; elles peuvent être proposées sous une section avancée après validation du cas d’usage. Les références document/page web de `ref2v` ne sont pas ajoutées à Recast sans besoin utilisateur.

Sources : [fiche Wan 3 Prime](https://maxvideoai.com/models/wan-3-prime), [API officielle Wan 3](https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference), guide local `docs/engineering/alibaba-model-studio-provider.md`. Alibaba décrit Prime comme une version accélérée aux capacités alignées sur Standard ; cela ne prouve pas une meilleure fidélité de recast.

### Identité produit et surfaces client

Décision d’Adrien : **MaxVideoAI Recast** est le nom du service présenté au client. Ce libellé doit être repris dans le formulaire, le devis, le job, le résultat, Médias, l’historique, les notifications, les briefs récupérables et les transactions/reçus concernés. Pas de badge « Wan 3 Prime » ajouté à ces surfaces.

Le modèle/fournisseur réel reste une donnée interne exacte, avec identifiant de job, coût, version du tarif et routage, pour l’exécution, la réconciliation et le support. L’identité du service n’altère pas l’identité canonique de `wan-3-prime` dans le registre des modèles ni ses autres usages publics. Prévoir une identité d’offre/service distincte, transportée par les mêmes snapshots de devis et de transaction ; ne pas renommer globalement le modèle, ni déduire le libellé client du seul provider ID. Les contrats d’accès aux données et la transparence sur le traitement des médias restent inchangés.

Les historiques et transactions déjà existants ne sont pas réécrits par cette maquette. L’implémentation devra projeter le nom de l’offre à partir de sa provenance, tout en gardant la trace technique et financière exacte.

### Hypothèse tarifaire proposée, non activée

Adrien envisage **prix client = 2 × coût fournisseur du job**. Le multiplicateur reste à valider ; aucun tarif ni débit réel n’a été changé. La base est le coût provider du scénario complet, avec vidéo entrante et sortante et les options facturables, pas seulement les secondes de sortie ni le prix client actuel de Wan déjà majoré.

Le devis et la transaction doivent utiliser une seule politique commerciale versionnée pour l’offre Recast, avec conversion de devise, taxes éventuelles et arrondis traités par les owners existants. Le snapshot accepté conserve base de coût, règle appliquée, total et nom du service. Cette proposition ne justifie aucun calcul de prix indépendant dans un composant client ; suivre `docs/engineering/pricing-engine.md` lors de l’implémentation. Ne pas afficher un faux montant dans la maquette en l’absence de devis.

### Coût, audio et récupération

La facturation Wan comprend les secondes de vidéo entrante et sortante selon le pipeline canonique. Le devis doit donc être recalculé si la source, l’extrait, la durée ou la définition change. Aucun prix concurrent ou tarif fournisseur ne devient le prix client affiché.

L’option de réutiliser la bande-son originale demanderait une étape de composition distincte avec une politique claire de durée et de synchronisation. Elle n’est pas simulée par un simple `audio=true`. Le lancement V1 garde « Sans audio » et « Générer l’audio » ; la conservation exacte vient avec sa propre validation si retenue.

Un identifiant de tâche accepté doit être repris après interruption. On ne resoumet pas automatiquement un rendu payant après un délai ou une erreur réseau. L’application copie le résultat vers son stockage durable avant de déclarer la création disponible.

## Les exemples sont une fonctionnalité complète

### Galerie éditoriale

Les vignettes Recast accueilleront de **vraies vidéos avec les influenceurs/personnages**, à produire. Les portraits actuels ne sont que des illustrations provisoires. Chaque carte vidéo devra proposer un aperçu lisible, une durée/format vérifiés, un accès à la source et « Reprendre ».

Préparer un premier lot de clips courts : marche, demi-tour, geste UGC, regard caméra, mouvement latéral, scène avec changement de décor. Chaque carte permet de voir le clip, comprendre sa durée, inspecter sa recette et cliquer « Reprendre ».

Un exemple publiable contient :

- vidéo source originale, poster et aperçu court préparé ; durée, format, dimensions et contrôle technique ;
- résultat réellement obtenu avec le profil de génération annoncé ; pas de fausse comparaison avant/après ;
- références de démonstration, rôle de chaque image, consigne et options ;
- identifiants de catalogue et versions, profil modèle testé, job de preuve ;
- auteur, licence/droits des médias et autorisation d’usage des personnes représentées ;
- état brouillon / vérifié / publié / retiré et traduction des libellés.

On peut produire nos clips, acquérir des clips avec les droits adaptés ou intégrer une contribution autorisée. Être visible chez un concurrent, dans un dépôt GitHub ou sur un réseau social ne donne pas le droit de republier une vidéo comme template.

### Mes exemples et récupération

Depuis un résultat : « Garder comme exemple » sauvegarde une recette privée. L’utilisateur peut la nommer, la retrouver, consulter sa source et changer uniquement le personnage, le look ou le décor. La reprise crée un nouveau brouillon ; elle ne modifie pas la recette originale et ne lance aucune génération automatiquement.

Depuis Médias : « Utiliser dans Character → Recast » ouvre la bonne source. Depuis l’historique : « Reprendre les réglages » réhydrate la recette exacte. Les originaux téléchargeables restent distincts des posters et aperçus. Une source supprimée ou un asset indisponible donne un message précis et une action pour le remplacer.

### Administration

Un écran d’administration doit pouvoir importer un exemple, associer source/résultat/références, modifier texte et catégories, prévisualiser, vérifier les droits et publier/retirer. Cette publication est séparée de la sauvegarde privée. Aucun caractère privé, visage utilisateur ou média de l’historique ne devient public automatiquement.

L’import par lien public est une extension possible du système d’import existant : récupération côté serveur, URL HTTPS autorisée, protections contre les requêtes internes, vérification des médias et droits. Pas de champ prétendant télécharger arbitrairement TikTok/Instagram dès la V1. Un lien vers une page n’est pas une référence vidéo exploitable par défaut.

## Fondations existantes et audit de réutilisation

### Dans MaxVideoAI

La base Character Builder fournit déjà création depuis zéro/image, références `identity` et `style`, portrait/planche, une ou quatre propositions, snapshots, filiation, épinglage et reprise des résultats. Jobs, portefeuille, stockage et bibliothèque sont partagés.

Les owners consultés :

- `frontend/types/character-builder.ts` et `frontend/src/lib/character-builder.ts` ;
- `frontend/src/components/tools/CharacterBuilderWorkspace.tsx` et `character-builder/_components/`, `character-builder/_hooks/` ;
- `frontend/src/server/tools/character-builder/{prompt,runner,traits,sanitize,snapshot}.ts` ;
- `frontend/app/api/character-references/route.ts` et les références de l’espace image ;
- `tests/character-builder-workspace-architecture.test.ts`, `tests/character-builder-server-architecture.test.ts` ;
- `frontend/src/server/video-providers/alibaba-model-studio/`, routeur partagé et poller Alibaba ;
- `frontend/src/lib/wan3-pricing.ts` et le parcours de génération vidéo partagé.

La forme d’œil doit devenir une valeur métier dédiée, pas seulement une image de bouton. La bibliothèque actuelle reconstruite depuis les jobs ne remplace pas une entité Personnage avec versions et looks. Le mapping image Standard/Pro existant n’est pas confondu avec Wan, qui est le modèle vidéo du Recast.

### Catalogues et dépôts

L’audit antérieur et ses fichiers sont conservés ; sa recommandation 3D est explicitement archivée. Les pistes encore utiles sont :

| Base | Réutilisation retenue | Limite |
|---|---|---|
| [Character Studio Prompt](https://github.com/Perry76/character-studio-prompt) | Vocabulaire et taxonomie. Extraction locale : 37 champs, 770 valeurs brutes, sélection initiale de 66 valeurs. Licence MIT relevée dans l’audit. | Pas un moteur de génération, ni une bibliothèque de vignettes cohérentes. Relire les choix et traductions avant publication. |
| [Poly Haven](https://polyhaven.com/license) | 24 décors sélectionnés avec provenance ; index de 997 HDRI déjà récupéré à la date de l’audit. Assets CC0 selon la licence consultée. | Utiliser les images préparées comme références. Une image panoramique n’est pas automatiquement une scène adaptée à un portrait ; sélectionner son cadrage. |
| [PhotoMaker](https://github.com/TencentARC/PhotoMaker), [PuLID](https://github.com/ToTheBeginning/PuLID) | Recherche comparative sur la continuité d’identité si les modèles existants ne suffisent pas. | Licences des dépendances et poids à contrôler séparément. Aucun besoin de service GPU supplémentaire établi pour la V1. |
| [InstantID](https://github.com/instantX-research/InstantID) | Référence de recherche. | Des composants/checkpoints mentionnés sont réservés à la recherche ; pas de reprise commerciale automatique. |
| Générateurs de personnages de jeux / MakeHuman / MPFB / UMA et autres pistes 3D auditées | Documentation historique uniquement. | Hors de la direction désormais retenue. Aucun runtime, mesh ou éditeur 3D à intégrer. |

Fichiers réutilisables : `output/research/character-studio-foundations-2026-11-03/{traits-source,look-presets,scenes-starter,presets-starter,polyhaven-hdri-index}.json`, provenance et vérifications associées. Les 17 dépôts de l’audit large restent inventoriés dans `output/research/character-studio-3d-audit-2026-11-03/repository-snapshot.json`.

Le principal travail restant est la qualité éditoriale des images et clips, la traduction des choix en références/consignes fiables et la persistance du parcours. Aucun dépôt consulté n’établit une solution complète prête à brancher au niveau souhaité.

## Catalogue visuel de production

Première cible de travail : 12 identités éditoriales, huit familles vestimentaires, 12 coiffures et les séries de traits du tableau ci-dessus, des références de personnages validées, 24 décors, puis 6–12 exemples Recast réellement testés. Ce sont des volumes proposés, pas des contenus déjà produits ni un critère de qualité suffisant.

Vignettes de traits : pose, éclairage, échelle et cadrage comparables ; une différence lisible par série ; validation sur plusieurs présentations, teints et âges. Les coiffures doivent être entièrement visibles. Les yeux utilisent des gros plans propres. Les looks montrent la tenue entière.

Chaque asset porte un identifiant stable, sa valeur métier, une description destinée au modèle, des libellés localisés, son type de cadrage, sa provenance, sa licence et son statut de validation. Les assets de sélection ne remplacent pas silencieusement l’identité choisie.

Suivre `docs/engineering/media-delivery.md` : posters à géométrie fixe, images responsives, chargement différé des catégories fermées, vidéos manuelles avec `preload="none"`. Préserver les originaux pour la génération et le téléchargement. Ne pas envoyer des miniatures signées au pipeline public d’optimisation.

## Contrat de données et responsabilités

Entités proposées : `Character`, `IdentityVersion`, `Look`, `GenerationAttempt`, `RecastRecipe`, `RecastExample`. Un brouillon et un résultat réussi sont toujours deux objets distincts.

```ts
// Contrat produit proposé, non implémenté.
type RecastRecipe = {
  schemaVersion: 1;
  // Provenance facultative : une image peut aussi être importée directement.
  characterId?: string;
  identityVersionId?: string;
  lookId?: string; // image choisie en amont, aucun sélecteur dans Recast
  sourceVideoAssetId: string;
  sourceDurationSec: number; // valeur de confiance du serveur
  sourceTrim?: { startSec: number; endSec: number };
  references: Array<{
    assetId: string;
    mentionId: string; // @image1, @image2…
    purpose?: 'identity' | 'look' | 'scene' | 'product'; // provenance, pas un champ imposé
  }>;
  direction?: string;
  output: {
    engineId: 'wan-3-prime';
    mode: 'v2v';
    durationSec: number;
    resolution: '480p' | '720p' | '1080p';
    aspectRatio: string;
    audio: boolean;
    seed?: number;
    enablePromptExpansion: boolean;
  };
  templateId?: string;
  templateVersion?: number;
  parentAttemptId?: string;
};
```

Les rôles produit se traduisent côté serveur en rôles réellement acceptés (`source`, `reference`) et en consignes avec un ordre de références stable. La génération ne reçoit ni labels d’UI ni index d’une grille d’images. Les choix structurés et la consigne produite restent inspectables dans le snapshot d’essai.

Le composant racine orchestre. Catalogue, brouillon, références, résultats, bibliothèque et Recast ont des composants/hooks dédiés. La validation, le devis, les imports et l’exécution restent côté serveur et réutilisent les pipelines existants. Les migrations applicatives vont dans Neon. Les contrôles d’accès appartiennent aux données, pas à l’état de navigation.

États attendus : vide, brouillon, import en cours, média invalide, devis en cours/expiré, soumission, génération, sauvegarde du résultat, réussite, échec récupérable, résultat ancien face au brouillon courant, référence manquante. Aucun faux pourcentage de génération. Un job tardif ne remplace pas le brouillon courant.

## Plan de réalisation et critères de passage

| Lot | Livrable concret | Validation avant le suivant |
|---|---|---|
| 1. Catalogue et direction visuelle | Taxonomie nettoyée, premières séries de traits, identités et looks, spécification des exemples Recast | Choix lisibles sans explication ; cadrages complets ; provenance documentée |
| 2. Création connectée | Menus illustrés, brouillon, références, devis, génération, variantes et reprise | Choix → snapshot → image ; aucun appel au simple clic ; comportement correct après modification pendant un job |
| 3. Personnages persistants | Identités versionnées, looks, fiche, accès image/vidéo/Recast | Rechargement et autre session retrouvent les mêmes références ; isolation de compte ; anciens looks intacts |
| 4. Recast Wan 3 Prime | Import/Médias, casting, références, réglages compatibles, devis, jobs, lecteur résultat | Source valide, limites et coût exacts, reprise après interruption, résultat durable, fidélité mesurée |
| 5. Exemples et circulation | Galerie éditoriale, exemples privés, favoris, reprise, récupération, administration | Une recette se duplique fidèlement ; aucun média privé publié ; source retirée gérée ; téléchargement original |
| 6. Finition et lancement | Mobile, clavier, erreurs, localisation, chargements, documentation et observabilité | Parcours utilisateur complet sans assistance, qualité visuelle et métriques de livraison examinées |

Les lots sont des incréments d’implémentation, pas une proposition de livrer une façade sans génération. Le périmètre d’ouverture doit inclure création, persistance, Recast et reprise d’exemples. Le planning doit être estimé après le premier lot d’assets et le benchmark ; aucun délai n’est déduit de la seule quantité de composants.

### Essais de rendu à prévoir

Pour l’image : personnages variés, mâchoires carrées/rondes, cheveux courts/longs/bouclés, regards et tenues distincts. Comparer respect des traits, dérive d’identité, qualité visage/mains, cadrage et tenue. Pour Recast : marche, demi-tour, geste, plusieurs personnes, occlusion et mouvement de caméra ; variantes de décor et produit.

Démarrer par six sources contrôlées et deux identités, comparer les chemins Wan `v2v`/`ref2v` sur un sous-ensemble avant d’étendre. Chiffrer les essais avec les sources et durées réelles. Aucun benchmark payant n’a été exécuté dans ce travail ; aucune qualité « égale à Pollo/Higgsfield » n’est démontrée par la maquette.

### Vérification technique de l’implémentation future

Conserver et étendre les contrats Character Builder et workspace pertinents avant de déplacer leurs responsabilités. Tester : traduction des traits, validation des références, source+sortie, devis invalidé après changement, idempotence, jobs récupérés, snapshot immuable, compte A/B, suppression d’asset, reprise d’exemple et profil indisponible.

Smoke tests navigateur : création libre et depuis photo ; modification après rendu ; sauvegarde ; nouveau look ; transfert du look exact vers Recast ; exemple → modification → génération → résultat → reprise ; échec réseau ; connexion conservant le brouillon ; mobile et clavier. Mesures de chargement réelles avant/après sur les lecteurs et les galeries. Les contrôles CI et le chemin GitHub → Quality CI → Vercel du dépôt restent applicables à une livraison.

## Ce que la maquette permet déjà de tester

La version active contient les menus illustrés yeux/cheveux/tenues, 24 décors, six identités originales, sélection explicite, essais d’image préparés, différence brouillon/résultat, validation, looks et préparation vidéo. Recast possède six recettes illustrées, une vidéo source, jusqu’à dix images de remplacement importables ou sélectionnables, une consigne facultative, les options Wan, le contrôle des durées, l’historique, la sauvegarde comme exemple privé, les favoris et la récupération du brief. Aucun sélecteur de look ne s’y trouve.

Les images sont des exemples préparés. Les six recettes Recast n’incluent pas leurs clips sources ou une vidéo finale générée : elles servent à tester le parcours. L’import local est câblé, mais le sélecteur de fichiers de l’environnement d’inspection n’a pas pu être piloté ; le succès réel de cet import n’est donc pas déclaré testé. Les paramètres sont conservés dans l’état local de démonstration ; les fichiers importés restent en mémoire et demandent une réimportation après rechargement. Aucun modèle ni devis réel n’est appelé.

Le détail de provenance et des vérifications se trouve dans `output/research/character-studio-visual-2026-11-03/README.md`. L’ancien prototype 3D et le montage photographique sont des archives, pas les livrables actifs.
