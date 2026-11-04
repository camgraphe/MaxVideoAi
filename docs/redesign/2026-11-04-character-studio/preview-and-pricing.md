# Recast — preview réelle et tarif distinct

Décisions du 4 novembre 2026 : conserver la branche `codex/character-studio-v2`,
qualifier la génération en environnement de test avant production, puis réutiliser
les vidéos retenues pour Explorer et le marketing. La marge Recast doit dépasser
celle de Wan 3 Prime utilisé directement. Son montant reste à choisir.

## Ce qui est possible et ce qui est vérifié

Une preview Vercel peut appeler les vrais fournisseurs. Les environnements
permettent de configurer les paramètres de cette branche séparément
([environnements Vercel](https://vercel.com/docs/deployments/environments),
[variables d'environnement](https://vercel.com/docs/environment-variables)).

Lecture du compte Vercel : projet `maxvideoai` trouvé ; aucun déploiement de cette
branche dans l'historique interrogé. D'autres projets de staging/pilote et des
variables réservées à d'autres branches existent. Cela ne prouve ni l'isolation
ni la disponibilité des clés de ce parcours. La réponse d'inventaire des variables
était tronquée ; aucune valeur secrète n'a été déchiffrée, copiée ou modifiée.

Le local 3016 utilise PostgreSQL/MinIO locaux et le mode répétition sans devis
confirmable. Il reste intact. Aucun déploiement ni rendu payant n'a été lancé
pendant cette vérification.

## Raccordement à qualifier

1. Publier le candidat de cette branche par le chemin Git/preview ; conserver
   une authentification pour les testeurs. Une preview reste accessible aux
   personnes autorisées, avec ses médias privés accessibles au fournisseur via
   les URLs de lecture prévues par le stockage.
2. Raccorder une base de test migrée, avec les propriétaires communs de paiement,
   la grille tarifaire relue et les migrations Character Studio 93, 94 et 95.
   Ne pas hériter silencieusement du `DATABASE_URL` de production.
3. Raccorder un espace de stockage de test HTTPS. Importer une copie des portraits,
   produits et références utiles sous le compte test, en conservant les originaux
   locaux. Vérifier l'encodage FFmpeg des deux passages et leurs URLs fournisseur.
4. Configurer le fournisseur et les accès de ce compte pour les modes utilisés,
   puis qualifier `recastReadiness`. Le nom public demeure MaxVideoAI Recast.
5. Faire fonctionner le suivi Alibaba sur **cette base** : le propriétaire existant
   est `/api/cron/alibaba-model-studio-poll`. Vérifier reprise, copie durable,
   bibliothèque et affichage du reçu. La preview seule ne garantit pas ce suivi.
6. Activer le rendu Recast uniquement sur cet environnement qualifié, puis
   présenter une scène concrète et son devis exact avant chaque rendu réel.
   Le solde de test ne rend pas gratuite la facturation fournisseur.

## Proposition commerciale, non activée

Lecture du tarif public le 4 novembre 2026 : sortie 8 s, passage vidéo 7,5 s,
cadrage 9:16. Les coûts ci-dessous viennent du barème fournisseur configuré dans
`wan-3-prime.ts` et `alibaba-model-studio/cost.ts`, pas d'une facture fournisseur
fraîchement vérifiée. Les options sont des simulations, pas des devis payables.

| Résolution | Coût fournisseur configuré | Wan 3 Prime direct, tarif public lu | Recast : direct +20 % | Recast : fournisseur ×2 |
| --- | ---: | ---: | ---: | ---: |
| 480p | 1,054 $US | 1,37 $US | 1,65 $US | 2,11 $US |
| 720p | 2,17 $US | 2,83 $US | 3,40 $US | 4,34 $US |
| 1080p | 4,34 $US | 5,65 $US | 6,78 $US | 8,68 $US |

Simulations arrondies au centime supérieur. ×2 signifie un supplément de 100 %
sur le coût, soit 50 % du prix avant les autres frais. Ici, cela augmente le prix
client d'environ 53 % par rapport au modèle direct ; ce n'est pas un petit +20 %.
Les outils créateur existants ont une autre règle distincte, fournisseur ×2,2.
Elle n'est pas appliquée automatiquement à Recast.

Pour Recast, créer une politique commerciale propre dans le propriétaire serveur
des tarifs, avec un identifiant/version et une portée Recast. L'estimation,
la préparation, la confirmation et le reçu doivent la partager. Ne pas simplement
multiplier le montant affiché dans le navigateur ni modifier le tarif global du
modèle. Le coût porte sur sortie + **passage vidéo mesuré** ; l'audio de référence
n'ajoute pas de secondes vidéo. Modifier cette règle retire les devis précédents,
sans réécrire les reçus historiques. Aucune de ces options n'est activée ici.

## Du test aux pages publiques

Chaque démo part d'un portrait produit par Character Builder. Conserver le
personnage/look, le brief, les médias source et leurs passages, le devis, le reçu,
le job et l'original rendu. Après revue créative (identité, mouvement, produit,
dialogue), sélectionner les clips puis préparer leur publication par les
propriétaires existants d'Explorer et du registre média marketing. Préparer les
affiches et dérivés, vérifier lecture/Range puis activer les seuls médias retenus.
Ne pas copier la base ou le portefeuille de test en production.

Basil reste le pilote déjà conservé. Les autres concepts nécessitent encore les
prises de mouvement adaptées et leur validation avant devis. Les scénarios de
danse, UGC et produit restent des concepts jusqu'à qualification du rendu réel.
