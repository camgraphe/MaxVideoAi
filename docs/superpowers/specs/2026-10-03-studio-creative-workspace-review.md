# Studio — version à relire avant production

La direction produit est un espace où l’on peut réfléchir, prompter, créer et éditer. Un prompt ou une seule image peut être le résultat final. L’anglais est la langue de conception principale ; les interactions françaises sont conservées.

## Ce qui est livré

- Une entrée Studio depuis les projets, un accueil léger et des propositions facultatives qui préservent le brouillon.
- Un chat central, une typographie légère avec un accent italique, les thèmes Charcoal et Olive, une aide liée aux commandes réelles et la suppression du pictogramme devant les réponses.
- Une composition de références légèrement inclinées autour du chat, avec agrandissement au survol/sélection et commandes contextuelles. Une pile dépliable et une collection horizontale prennent le relais sur mobile. Les fichiers déposés dans le chat utilisent les imports existants. Les médias restent accessibles après l’envoi, peuvent être prévisualisés, agrandis ou cités dans le message.
- Des mentions telles que « Image 1 » liées à l’identifiant exact du média joint. Le glisser-déposer possède une alternative clavier/tactile ; les correspondances survivent aux reprises et aux renouvellements de devis.
- Une timeline partagée entre les modifications manuelles et celles de l’assistant, repliable sans perdre le montage. L’export conserve son devis et sa confirmation explicite.
- Une politique éditoriale commune à Studio et au MCP : modèles de référence, alternatives pertinentes et modèles sur demande. Seedance, Wan et Kling ont un poids important parmi les choix exécutables ; Pika reste disponible sur demande. Les contraintes et choix explicites du client restent prioritaires.
- Des estimations image/vidéo issues du moteur de prix MaxVideoAI actuel, pour un scénario précis, sans remplacer le devis en cours ni déclencher un achat. Le montant final doit toujours être confirmé sur un devis frais.

## Ce que la comparaison a apporté

La [skill publique Higgsfield, version 0.13.0](https://raw.githubusercontent.com/higgsfield-ai/skills/main/higgsfield-generate/SKILL.md), consultée le 3 octobre 2026, fournit un précédent concret : elle privilégie une courte sélection et réserve beaucoup de modèles aux demandes explicites ou à des besoins particuliers. Cela justifie une sélection éditoriale assumée, pas une note de qualité calculée à partir du nombre de fonctionnalités. Cette politique concurrente ne constitue pas un benchmark indépendant.

La [skill publique Runway](https://raw.githubusercontent.com/runwayml/runway-mcp-plugin/main/skills/runway-media/SKILL.md) favorise le choix d’outils selon la tâche et l’utilisation des valeurs réellement exposées. La même séparation est conservée ici : le modèle mène la création, les outils donnent les capacités et les prix fiables.

La force à développer est la continuité entre conversation, références privées, montage modifiable et coût explicite dans un même projet. La timeline apporte un état concret que l’utilisateur et l’assistant peuvent modifier et vérifier ensemble. Elle doit apparaître quand le travail en a besoin, sans transformer chaque idée en film.

## Évolutivité

La sélection éditoriale est un fichier versionné distinct du registre des modèles. Chaque version exacte porte un niveau, une justification, une provenance et une date de revue. Une nouvelle version ne récupère pas automatiquement une certification de qualité. Après 90 jours, la préférence n’augmente plus son rang sans nouvelle revue. Les capacités exécutables et les prix continuent à venir des outils actuels.

Il n’y a ni nouveau tarif commercial, ni activation de modèle, ni ouverture de fonctionnalité publique dans ce changement. Les instructions MCP abandonnent le favori permanent au profit de cette politique partagée.

## Vérification et limites

La suite éditeur finale a exécuté 802 tests : 801 passent, un test existant est ignoré, aucun échec. TypeScript et lint passent ; les avertissements lint concernent des images natives, notamment les aperçus privés. Les parcours navigateur ont été exécutés avec des projets réels dans une base locale jetable : Chromium, Firefox et WebKit, mobile et desktop, thèmes, références, montage, reprise et création de projet. Le parcours navigateur de confirmation/reprise des exports passe également. Le registre des modèles et les contrôles d’exposition restent valides.

Les revues indépendantes ont conduit à corriger la perte de brouillon sur les raccourcis, les collisions de labels, la restauration d’une mention enregistrée, les références indisponibles lors d’un changement de fonctionnalités et le retour du focus dans Safari.

Après l’alignement final des instructions MCP, les 19 tests ciblés passent ainsi que les 70 scénarios hors ligne et leurs 39 contrôles de politique. Ces scénarios ne constituent pas une vérification d’un hôte MCP réel. La reprise visuelle demandée par Adrien remplace le panneau rigide et les grandes cartes d’accueil par une composition ouverte. Quatre références réelles au maximum restent visibles, sans recouvrir le chat ; les autres sont accessibles dans un sélecteur. Le montage forme une bande centrée et ses réglages détaillés apparaissent après sélection explicite d’un plan.

Ces vérifications ne mesurent pas le jugement artistique d’un modèle en conditions réelles. Aucun média payant ni rendu de production n’a été lancé. L’assistant voit les images jointes ; il reçoit les identités et métadonnées des vidéos et audios, sans analyse sémantique de leur contenu. Les estimations conversationnelles ne couvrent pas encore l’audio ou les sorties non enregistrées comme références. Aucun partage public ou bouton social fictif n’est ajouté.

Avant production : revue de cette version, qualification du dialogue avec la connexion modèle réelle et validation des fonctionnalités à activer. La mise en production attend le feu vert demandé par Adrien. La branche de travail est `codex/studio-creative-workspace`, isolée du dossier initial contenant ses modifications en cours.

## Reprise artistique après revue visuelle

La référence retenue est l’étude antérieure `experiments/studio-conversation/design/constellation-precedente.png`, et non un tableau de bord générique. Les photos de démonstration viennent des fichiers parfum déjà présents dans le dépôt ; aucun résultat de modèle n’est inventé. Le projet vide reste sobre. Les rotations sont fixes et légères ; les transitions répondent au survol, au focus et à la sélection, sans mouvement perpétuel. La préférence de réduction des animations est respectée.

La suite éditeur a été rejouée : 801 tests réussis, un test existant ignoré. Le premier lancement trop parallèle a dépassé la limite locale de mémoire partagée PostgreSQL ; une concurrence bornée à deux fichiers de test a permis la vérification complète, sans modifier les assertions. TypeScript, lint et le parcours navigateur complet passent. Lint conserve six avertissements sur des images natives. La vérification visuelle couvre les deux thèmes, 320/390/768/1440 pixels, la pile mobile, le glisser-déposer, les aperçus, le focus et l’espace protégé autour du chat.
