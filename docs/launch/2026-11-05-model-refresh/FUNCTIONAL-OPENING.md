# Candidat d'ouverture fonctionnelle — 6 novembre 2026

Ce candidat ouvre uniquement la publication App des trois modèles dans le registre.
Les admissions App, Studio et MCP suivent leurs propriétaires existants. Les pages
modèles, exemples, comparatifs, Pricing public et sitemaps restent fermés jusqu'au
lot marketing. La qualification live obtenue après livraison est consignée ci-dessous.

## Périmètre et conditions de livraison

- Kling 4.0 Flash : T2V, I2V et REF2V en 720p, 3–20 secondes, transport fal comme
  Kling 4 en production. Aucun Modify, Extend, dernier cadre ou multi_prompt structuré.
- GPT Image 2.6 Flare et Sunburst : création et retouche raster par OpenAI direct,
  trois tailles, cinq qualités, complexité et références privées conservées.
- Les 72 tarifs Flash à ×1,30 et les 2 040 tarifs GPT à ×1,50 sont appliqués.
  Les dix lots GPT ont été confirmés dans l’admin natif puis réconciliés, révision
  2187 → 4227 : montants exacts, 2 040 devis public/billing concordants, 17 175 autres
  cellules et 8 279 snapshots de paiement antérieurs préservés. Voir
  `gpt26-tariff-applied.json`. Aucune modification du registre ne crée un prix.
- Aucun nouvel appel fournisseur payant, changement de secret ou route de canary.
  Le Git Preview protégé sert à vérifier les interfaces et devis avant livraison.

## Qualification et corrections

Les dix générations fournisseur déjà obtenues établissent l'accès aux sept couples
modèle/mode ; elles n'établissent pas 21 générations payantes à travers les surfaces.
Le précédent Kling 4 (`../kling-v4/PUBLIC-OPENING-PREPARATION.md`) sépare également
qualification fournisseur, parcours natifs simulés, Preview et découverte live.

La matrice PostgreSQL image exerce Flare/Sunburst en création et retouche, dans
Studio et MCP : prix exact approuvé, références possédées, identité et complexité
persistées, deux confirmations concurrentes pour un seul débit et dispatch, devis
expiré refusé et lecture de statut sans nouvelle soumission. Elle conserve le cas
de non-régression Flare 2.5. Elle a révélé puis vérifié la correction du compteur de
références 2.6 lors de la revalidation tarifaire à la confirmation.

La matrice PostgreSQL vidéo inclut les trois modes Flash, leurs prix natifs à 37¢
pour trois secondes, l'égalité des devis Studio/MCP, l'isolement des comptes/projets
et clients, la confirmation unique et la lecture de statut. Le fournisseur est
simulé ; les preuves d'accès fournisseur restent celles du lot cinéma.

Le sélecteur de l'App image respecte maintenant la publication App. La table des
prix image publics respecte la publication Pricing, même si App ou la page modèle
est déjà ouverte ; elle n'anticipe plus le lot marketing. Les tests de
rollback ferment explicitement les trois identités et restaurent leur état, sans
neutraliser le contrôle de credentials. Les répétitions financières historiques
conservent leur catalogue d'origine ; la couverture actuelle vérifie séparément
l'ajout de 72 + 1 020 + 1 020 scénarios et leurs identités uniques.

Le cron OpenAI de production a été observé en GET 200 chaque minute avec le
user-agent Vercel, sur le commit livré b5f4bdd. Voir
`openai-cron-auth-evidence.json`. Cela prouve l'authentification et l'exécution du
cron, sans prétendre avoir récupéré un job fournisseur réellement interrompu.

## Contrôles avant et après fusion

Tests ciblés, registre et projections, types, lint/exposure puis Quality CI complète
sur le dernier commit ; Git Preview exact et `deployment:check` avant fusion.
Vérifier les deux domaines au commit fusionné, puis découverte, détails et devis
sur App, Studio et MCP. Enregistrer séparément les observations live, les tests
simulés et l'absence de nouvelle génération payante par surface.

Rollback : fermer les trois publications App par livraison Git normale et
régénérer les projections. Conserver tarifs, reçus, jobs acceptés, originaux et
historique. Le polling et la reprise des travaux acceptés restent actifs ; aucune
répétition d'une soumission incertaine.

## Qualification live — 6 novembre 2026

La PR #623 est livrée au commit `ea2dbd30c697dc59e7dcbcf5f9afcb250b7b95ae`,
déploiement Git `dpl_J4VEZPBaWmNL7wi4TDJJ8hk1obbQ`. Les deux domaines publics
servent ce même commit READY. Quality CI `42138365568` est entièrement réussie.

Le MCP connecté découvre les trois modèles disponibles et les sept modes prévus.
Sept devis réels non confirmés passent : Flash T2V/I2V 5 s à 0,62 $, REF2V à
0,83 $ avec la vidéo source réelle de 5,042 s ; Flare/Sunburst high 1024² à 0,10 $
en création et 0,13 $ en retouche avec une référence. Le devis Flare conserve
explicitement `complexity: low`. L'estimation de trois séquences Flash de 15 s
avec une tentative chacune donne 5,52 $. Aucune de ces opérations n'a généré de média.

Dans l'App authentifiée, les trois sélecteurs et tarifs sont visibles ; les
références image/vidéo Flash et les références de retouche image sont accessibles.
La bibliothèque du Studio affiche les quatre images I1–I4 et les six films
B1–B3/V1–V3. Aucun prompt utilisateur n'a été remplacé et aucune assistance
payante ou génération Studio n'a été lancée. La qualification native PostgreSQL
décrite plus haut reste la preuve du parcours de confirmation Studio.

Cette inspection a identifié un raccordement manquant des contrôles avancés dans
l'App image. Le candidat marketing ajoute le bouton Options lorsque seuls fond ou
complexité sont présents, et transmet la complexité au panneau chargé à la demande.
Deux tests DOM reproduisent l'absence du bouton avant correction et vérifient
ensuite l'ouverture, le choix, le changement d'état et la réouverture des contrôles.
La vérification de cette correction déployée reste une étape du lot marketing.

Le journal de 01:29:30 UTC montre aussi un devis image prématuré avec la résolution
historique `1k` pendant l'hydratation du nouveau modèle. L'App obtenait ensuite le
bon tarif, mais le premier appel renvoyait 500. Le candidat attend désormais une
résolution admise par le schéma du modèle avant toute demande de prix. L'API
valide cette résolution avant la normalisation 2.6 et renvoie le 400
`resolution_invalid` prévu. Quatre cas reproduits avant correction couvrent les
deux variantes, l'absence de requête prématurée, le devis valide et l'effacement
du prix précédent lors d'un réglage incompatible. Les 27 tests ciblés passent.
