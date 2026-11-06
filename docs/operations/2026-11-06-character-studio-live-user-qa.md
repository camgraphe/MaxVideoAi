# Character Studio — sessions utilisateur locales du 6 novembre 2026

Branche : `codex/character-studio-v2`. Base locale : `character_studio_test`, application sur le port 3016, stockage sur le port 19016. Aucun déploiement, modification de production, rendu payant ou appel de génération fournisseur. Trois sous-agents ont couvert logique, transactions, intégrations et revue indépendante ; un seul agent a piloté le navigateur.

## Résultat et niveau de confiance

32 scénarios ont été joués dans le navigateur : **27 validés (dont deux corrigés puis retestés en direct), trois partiels et deux bloqués par le stockage local**. Profils simulés : débutant, créateur détaillé, utilisateur hésitant, utilisateur revenant sur un brouillon, utilisateur de bibliothèque, créateur UGC, utilisateur mobile et utilisateur Studio. Ils ne constituent ni 32 personnes indépendantes ni une mesure statistique de fiabilité.

Le résultat ne permet pas de certifier 95 % des fonctionnalités. Les inventaires recensent 92 classes Character et 54 classes Recast/intégrations, avec recouvrements et niveaux de preuve distincts. Une preuve unitaire ou DOM ne devient pas une validation complète du parcours utilisateur. Les paiements et rendus réels restent volontairement hors exécution.

## Parcours et état

| Étape du parcours | État | Preuve et limite |
|---|---|---|
| 1. Comprendre et composer | Bon | Sélections visuelles, descriptions, couleur invalide, annulation, sortie et prix testés. |
| 2. Revenir ou recommencer | Bon, confirmation native partielle | Brouillons restaurés, Nouveau efface les consignes ; annulation native Recast non établie dans le navigateur intégré. |
| 3. Retrouver et réutiliser | Amélioré | Looks, renommage, fiche persistée et duplication testés ; crash de l’aperçu corrigé. |
| 4. Préparer Recast | Bon sur les cas joués | Vidéo et audio indépendants, produit, dialogue et vrais fichiers IndexedDB restaurés. |
| 5. Comprendre le montant | Bon sans débit | Prix selon résolution et durée, préparation gratuite et invalidation du devis observés. |
| 6. Continuer dans Studio / télécharger | Validation incomplète | Stockage HTTP local refusé par les gardes HTTPS ; preview HTTPS nécessaire. |

## Défauts traités

1. Un ancien upload pouvait remplacer le dernier choix ou réapparaître après retrait / sélection dans Médias : révision indépendante par emplacement, avec protections compte et brouillon conservées.
2. Le message d’upload pouvait rester après un retrait : nettoyage du statut de l’opération annulée, sans masquer l’autre emplacement actif.
3. Une image Recast vide pouvait remplacer le portrait ou le produit valide : refus avant création de l’URL et avant remplacement.
4. Ouvrir une image de l’historique pouvait faire planter la page : le payload fournit désormais l’original dans imageUrl et la miniature dans thumbUrl, au lecteur privé existant. Aucun élargissement d’allowlist.
5. La recherche Studio exigeait le nom entier : elle accepte maintenant un fragment littéral insensible à la casse, filtré avant pagination. Le paramètre `name` exact utilisé par MCP reste inchangé. « Dixie » retrouve « Dixie Trouble », vérifié après correction dans le navigateur.

## Argent et devis

Le wallet local contient 0,03 $US : 1,00 $ de crédit local moins 0,97 $ de débits historiques. Les 19 jobs et 14 reçus sont inchangés pendant cette exécution. La base de test hébergée distincte contient toujours 82,35 $US : 100,00 $ de crédit de test − 20,57 $ de charges + 2,92 $ de remboursement. Ce crédit de test n’est pas un paiement Stripe. La production n’a pas été inspectée ou modifiée pour cette réconciliation.

Le Recast préparé gratuitement utilise vidéo 3–11 s et audio 5–13 s. Après choix de sortie 10 s en 720p, l’interface affiche « Tarif public vérifié 5,04 $US », avec vidéo source 8 s et audio 8 s. Le calcul porte sur 8 s de vidéo source + 10 s de sortie ; l’audio ne rajoute pas de secondes vidéo. Aucun rendu n’est soumis. Les clips temporaires sont mesurés puis supprimés ; la preuve conservée est le bloc de résultat observé, pas un fichier média durable.

La fiche JSON téléchargée avant ce devis correspond à un état antérieur : sortie 8 s, 480p, mêmes passages 3–11 et 5–13. Ces deux états ne sont pas présentés comme le même devis. Prix image observés : 0,07 / 0,11 / 0,23 $US pour 1K / 2K / 4K.

## Matrice live

| Cas | Parcours | Résultat |
|---|---|---|
| L01 | Démarrer Recast et comprendre les champs requis | Validé |
| L02 | Type de personnage libre ou prédéfini | Validé |
| L03 | Présentation, âge et carnation personnalisée | Validé |
| L04 | Yeux, visage et signes distinctifs | Validé |
| L05 | Cheveux et annulation du sélecteur de couleur | Validé |
| L06 | Tenue libre, préréglages et accessoires | Validé |
| L07 | Décor, filtres et description seule | Validé |
| L08 | Portrait, planche et prix 1K/2K/4K | Validé |
| L09 | Recharger le brouillon puis Nouveau personnage | Validé |
| L10 | Bibliothèque, fiche annulée et planche | Validé |
| L11 | Préparer un nouveau look avec identité conservée | Validé |
| L12 | Envoyer le bon look dans Recast | Validé |
| L13 | Importer et découper une vidéo ; annuler un changement | Validé |
| L14 | Audio indépendant, produit, dialogue et 1080p | Validé |
| L15 | Restaurer les vrais fichiers après rechargement | Validé |
| L16 | Télécharger et relire la fiche de tournage | Validé |
| L17 | Préparer les extraits et vérifier le devis exact | Validé |
| L18 | Invalider le devis après modification | Validé |
| L19 | Proposer la durée du dialogue et garder le choix manuel | Validé |
| L20 | Parcours Recast sur écran de 390 pixels | Validé |
| L21 | Refuser une image vide puis accepter la correction | Validé |
| L22 | Historique mobile et passage vers Upscale | Validé |
| L23 | Ouvrir la planche historique en grand | Corrigé et retesté |
| L24 | Sauvegarder dans Médias ; annuler le dialogue de look | Partiel |
| L25 | Dupliquer les réglages d’un résultat | Validé |
| L26 | Télécharger un original du stockage local | Bloqué par environnement local |
| L27 | Sauvegarder nom/fiche, recharger puis restaurer | Validé |
| L28 | Importer, choisir dans Médias et retirer les références | Validé |
| L29 | Envoyer une image à Studio | Bloqué par environnement local |
| L30 | Choisir identité ou look depuis Studio | Partiel |
| L31 | Rechercher un personnage par une partie du nom | Corrigé et retesté |
| L32 | Nouvelle scène puis rechargement | Partiel |

## Validation automatisée

- Character : 98/98 tests ciblés, plus 14/14 tests bibliothèque sur PostgreSQL 17 jetable et un contrôle du composant de sortie.
- Recast prix/sélection/paiement/upload : 39/39 ; intégrations Studio/MCP/médias : 38/38 ; aperçu galerie et contrôles associés : 22/22.
- Recherche Studio : 28/28 contrôles DOM, PostgreSQL 17 et contrats associés ; revue indépendante sans constat restant.
- Finance : 62/62 contrôles de tarification, paiement et sandbox. Revue indépendante du patch et réconciliation du registre.
- Les suites se recouvrent : leurs nombres ne sont pas additionnés en un nombre de fonctionnalités. Les fournisseurs sont simulés dans les tests de paiement ; aucune transaction réelle n’est validée par ces seuls tests.
- TypeScript et ESLint ciblés réussis. Lint frontend complet : zéro erreur, sept avertissements préexistants hors corrections. Contrôle d’exposition et diff check réussis.

## Conditions restant avant mise en production

1. Rejouer téléchargement et ajout à Studio avec des médias HTTPS possédés dans la preview ; conserver les protections de transport et de propriété.
2. Valider les parcours connectés / déconnectés, changement de compte et langues dans un navigateur réel ; les protections automatisées ne remplacent pas ce contrôle complet.
3. Vérifier MCP dans un hôte connecté à la preview, au-delà des tests de contrat et SDK.
4. Sur devis et scène approuvés séparément, réaliser les canaris payants image / look / Recast et vérifier sortie, facture, récupération et visibilité dans Mes vidéos.
5. Refaire les contrôles requis Quality CI, alignement main et gates de déploiement sur le candidat final. Cette session ne constitue pas un feu vert de production.

## Preuves locales

Les captures, JSON téléchargé, inventaires, TAP et réconciliations sont conservés dans `output/character-studio-v2/live-user-sessions-2026-11-06/` (artefacts locaux). Points clés : `live-cases.json`, `05-recast-exact-quote.png`, `07-history-preview-crash.png`, `08-history-preview-fixed.png`, `09-studio-search-fixed.png`, `finance.md`, `review-final.md`, `coverage-map.json`.

Le nom et la fiche temporairement modifiés de Dixie ont été restaurés par l’interface. Les brouillons de test ont été effacés via Nouveau personnage / Nouvelle scène. L’enregistrement d’une image existante dans Médias et les fichiers de test importés restent dans la base locale uniquement.
