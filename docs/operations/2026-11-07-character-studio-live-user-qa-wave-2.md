# Character Studio — deuxième salve utilisateur

Branche `codex/character-studio-v2`, base de départ `c2de20049`. Campagne commencée le 6 novembre et terminée après minuit le 7 novembre 2026, Europe/Madrid. Application locale sur 3016, stockage sur 19016, base `character_studio_test`, tarification sandbox. Aucun rendu fournisseur, paiement, changement de production ou déploiement.

## Résultat

**20 scénarios ont été joués dans le navigateur**, dont sept parcours avec amélioration ou correction revérifiée. Ils ciblent le visiteur sans idée, l'utilisateur hésitant, les mauvais fichiers, le réseau lent ou coupé, les changements de qualité, les interruptions et les remises à zéro. Ils s'ajoutent à la première salve documentée le 6 novembre, sans devenir une mesure statistique de fiabilité.

Huit défauts techniques ont été corrigés, ainsi que trois points de compréhension. La dernière passe automatisée ciblée et la revue indépendante ne laissent aucun défaut confirmé ouvert dans ce patch. Cela ne prouve pas l'absence exhaustive de bugs ni 95 % de couverture de l'application.

## Corrections

1. **Import perdu pendant la navigation.** Un clic sur le mode déjà actif, ou un aller-retour Character/Recast, invalidait l'import et pouvait laisser son message d'attente. Ces déplacements conservent maintenant le brouillon et ses uploads. Nouveau, inspiration et remplacement du brouillon gardent leur invalidation explicite.
2. **Deux modifications qui s'écrasent.** Les réponses d'un renommage et d'une modification de fiche pouvaient rétablir l'ancien contenu de l'autre champ. Chaque réponse n'applique que le champ modifié.
3. **Erreur affichée sur le mauvais personnage.** Une erreur tardive de mutation est désormais limitée au détail qui l'a initiée.
4. **Réessayer au mauvais endroit.** La bibliothèque reprend le même personnage ou la même page après échec, y compris les pages de looks, en gardant les éléments déjà chargés.
5. **Préparation impossible à interrompre proprement.** Une action Annuler la préparation conserve la scène, arrête ses requêtes et autorise une nouvelle tentative sans laisser l'ancienne réponse intervenir.
6. **Fichier illisible présenté comme une erreur temporaire.** Les erreurs d'upload sous forme de chaîne ou d'objet sont comprises ; le message demande maintenant de remplacer le média lorsqu'il est invalide.
7. **Perte de récupération d'une confirmation incertaine.** Un transfert de personnage depuis Character ne peut plus remplacer le composant qui permet de retrouver la génération en cours. Le transfert refusé n'est pas appliqué automatiquement après déverrouillage. Ce cas est testé avec des réponses simulées, sans achat.
8. **Upload parallèle bloquant les tentatives suivantes.** Si un transfert échoue, les autres transferts encore en attente de la même préparation sont annulés et retirés du cache. Les uploads terminés restent réutilisables et le nettoyage multipart conserve une requête indépendante.

Pour les débutants, le lien « Voir des inspirations » est visible sous la photo sur petit écran. Le choix annonce le nom de l'inspiration et les rubriques à personnaliser. Dans l'historique, « Enregistrer dans Mes médias », « Garder ce personnage » et « Enregistrer le look » distinguent les destinations.

La revue a détecté une régression StrictMode dans la première correction du transfert Recast : elle a été reproduite, corrigée et couverte avant clôture. Les preuves rouges et vertes sont conservées.

## Parcours live

| Cas | Situation | Résultat observé |
|---|---|---|
| W01 | Arriver sans idée à 831 px | Lien d'inspiration visible après correction |
| W02 | Choisir Noor sans comprendre ce qui a changé | Confirmation explicite après correction |
| W03 | Importer du texte ou un MP4 corrompu puis corriger | Refus utile, MP4 valide accepté |
| W04 | Annuler le premier choix du passage vidéo | Fichier conservé, prix absent expliqué, action pour reprendre |
| W05 | Saisir des bornes négatives, inversées ou trop longues | Validation bloquée, correction 3,25–10,75 s acceptée |
| W06 | Import lent puis clic actif et aller-retour de mode | Image conservée après correction |
| W07 | Changer rapidement résolution et durée | Dernier choix 1080p / 15 s : 12,60 $US |
| W08 | Préparer avec un PNG corrompu | Message de remplacement spécifique après correction |
| W09 | Annuler une préparation ralentie | Réglages conservés, bouton récupéré après correction |
| W10 | WAV illisible puis WAV valide de 20 s | Refus puis ouverture du découpage |
| W11 | Annuler l'audio puis suivre le raccourci de blocage | Le bon découpage audio se rouvre ; 4,5–13,25 s validé |
| W12 | Reprendre après annulation et corriger le portrait | Préparation gratuite réelle : prix vérifié 4,90 $US |
| W13 | Changer de résolution après ce prix vérifié | Ancien devis retiré ; 480p donne 2,38 $US |
| W14 | Trouver un point de départ sur écran de 390 px | Sora, confirmation, sortie et prix lisibles ; retry du prix réussi |
| W15 | Distinguer les sauvegardes dans Mes images | Médias, personnage et look nommés séparément |
| W16 | Couper le réseau pendant l'ouverture de Vesper | Réessayer ouvre Vesper et ses looks après correction |
| W17 | Revenir dans Recast depuis Mes personnages | Portrait appliqué, vidéo/audio/réglages conservés |
| W18 | Nouvelle scène puis rechargement | Médias, passages, textes et ancien devis effacés |
| W19 | Cliquer Nouvelle scène par erreur | Annulation de la confirmation native conserve la consigne |
| W20 | Nouveau après type, tenue et décor personnels | Trois champs rouverts et vides, anciens traits effacés |

Les changements de code ont parfois rechargé la page de développement pendant un clic ; ces tentatives ont été rejouées sur des sources stables. Une compilation locale lente a temporairement rendu le prix indisponible. L'interface a conservé les choix et proposé de réessayer ; le prix est revenu après la reprise du serveur. Ces incidents de développement ne sont pas présentés comme des défauts de production.

## Prix et absence de dépense

Le test physique gratuit utilise vidéo **3,25–10,75 s**, soit **7,5 s**, et audio **4,5–13,25 s**, soit **8,75 s**. En 720p, sortie 10 s, format 9:16, l'estimation et le tarif public vérifié valent **4,90 $US**. Le détail affiche séparément les deux durées. Aucun bouton de confirmation payante n'a été utilisé ; le mode local indique que le rendu réel est reporté. La sortie 1080p / 15 s estimée auparavant à 12,60 $US est une autre combinaison.

Le registre local lu en transaction READ ONLY après ces préparations reste identique au départ : **19 jobs, 14 reçus, 97 cents de charges historiques, 100 cents de crédit local, zéro remboursement, zéro devis durable**, soit **0,03 $US**. Le dernier reçu date du 4 novembre. La base de test hébergée et la production n'ont pas été interrogées pour cette salve.

## Validation et limites

- Character : **80/80** contrôles ciblés, dont un dernier lot bibliothèque de 13 cas adverses sans nouveau défaut.
- Recast : **61/61** contrôles ciblés, incluant les passages FFmpeg, la récupération de confirmation simulée et les uploads multipart ; **6/6** essais de décodage réel sans réseau.
- Revue indépendante : **7/7** probes de régression passent, aucun constat actionnable restant dans le diff ciblé.
- TypeScript, lint frontend et exposition publique passent. Le lint complet compte zéro erreur et sept avertissements préexistants hors périmètre. Les suites se recouvrent ; leurs comptes ne sont pas additionnés en un nombre de fonctionnalités.

Les réponses réseau et délais des tests DOM sont simulés, contrairement aux observations navigateur et à la préparation gratuite des extraits. Aucun test de cette salve ne certifie un paiement ou un rendu fournisseur réel. Les limites de la première salve restent à lever sur la preview HTTPS : téléchargement et transfert vers Studio, hôte MCP connecté, parcours complets d'authentification/changement de compte et canaris payants avec devis séparément approuvés. Les contrôles de livraison et d'alignement sur main restent nécessaires avant production.

## Preuves et état laissé

Artefacts locaux : `output/character-studio-v2/live-user-wave-2-2026-11-06/`. Les fichiers principaux sont `live-cases.json`, `character-wave-2.md`, `recast-integrations.md`, `flow-review.md`, `finance-baseline.json`, `finance-final.json`, les TAP et les captures `02-inspiration-confirmation.png`, `04-exact-price-selected-passages.png`, `05-mobile-inspiration.png`.

Les brouillons de test ont été effacés via les actions de l'interface. Le réseau et la taille du navigateur ont été restaurés. Character Studio est laissé ouvert sur un personnage neuf. Les médias de test importés restent uniquement dans le stockage local ; aucun personnage existant n'a été renommé ni modifié dans cette passe navigateur.
