# Candidat d'ouverture fonctionnelle — 6 novembre 2026

Ce candidat ouvre uniquement la publication App des trois modèles dans le registre.
Les admissions App, Studio et MCP suivent leurs propriétaires existants. Les pages
modèles, exemples, comparatifs, Pricing public et sitemaps restent fermés jusqu'au
lot marketing. Il ne constitue pas une preuve de déploiement en production.

## Périmètre et conditions de livraison

- Kling 4.0 Flash : T2V, I2V et REF2V en 720p, 3–20 secondes, transport fal comme
  Kling 4 en production. Aucun Modify, Extend, dernier cadre ou multi_prompt structuré.
- GPT Image 2.6 Flare et Sunburst : création et retouche raster par OpenAI direct,
  trois tailles, cinq qualités, complexité et références privées conservées.
- Les 72 tarifs Flash sont déjà appliqués. Les 2 040 tarifs GPT approuvés à ×1,50
  doivent être appliqués par les dix lots de l'admin natif et relus avant fusion.
  La PR #622 livre leur import exact. Aucune modification du registre ne crée un prix.
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
