# Raccord médias Studio, Toolbox et Audio

Contrat additif convenu avec la tâche coordinatrice le 8 septembre 2026. Son implémentation et ses preuves sont le lot 3 du plan Studio ; la présence de ce document ne signifie pas que tous les transports sont déjà raccordés.

## Identité et accès

Réutiliser `ToolAssetRef` de `frontend/src/lib/toolbox/contract.ts`, sans seconde union concurrente :

- Asset : `{ type: 'asset', assetId, kind }`.
- Sortie récente : `{ type: 'job-output', jobId, outputId, kind }` avec l'`outputId` exact de la réponse serveur.

Conserver les champs `id` et `legacyAssetId` actuels, utilisés par les consommateurs historiques. Ajouter l'`assetId` canonique externe et la `ref` seulement lorsque le propriétaire serveur connaît cette identité. « Externe/public » qualifie le format de l'identifiant, **jamais une permission de lecture publique du média**.

Ne pas convertir une URL, un ID de carte, un ID fournisseur ou un index de galerie en `assetId`/`outputId`. Ne pas tronquer un ID interne trop long. Un ancien projet sans référence résolue reste legacy et ouvrable ; il n'acquiert pas une fausse identité pendant le chargement.

## Original et faits média

L'original exact, y compris les paramètres d'une URL signée, demeure séparé de `thumbnailUrl` et d'un éventuel aperçu vidéo. Une miniature ne devient jamais un original de génération, timeline ou export. Un URL temporaire n'est pas une identité durable.

Champ additif de preuve de mesure proposé aux uploads et sorties :

```ts
type MediaFacts = {
  source: 'probe';
  durationSec?: number;
  width?: number;
  height?: number;
  hasAudio?: boolean;
};
```

N'y mettre que les valeurs réellement mesurées par le propriétaire. Une durée demandée provenant de `app_jobs.duration_sec` ne devient pas une mesure. `requestedDurationSec` reste distinct. Inconnu reste absent ; `hasAudio: false` est une mesure négative, pas le remplacement d'une valeur inconnue. Le navigateur peut transporter ces faits, mais un writer connecté ne les considère pas comme autorisés sans revalidation serveur.

Publier la durée déjà sondée par l'upload vidéo et conserver la durée audio. Si dimensions/audio nécessitent une sonde supplémentaire, mesurer son impact ; préférer enrichir la même sonde lorsqu'elle existe. Ne pas réécrire la projection générale de bibliothèque pour ce raccord.

## Résolution et destinations

Le résolveur serveur reçoit le compte **authentifié hors payload** et une référence structurée. Il vérifie propriété, original, état prêt, kind, suppression/masquage et mesure disponible. Il est en lecture seule : aucun `/ensure` implicite, import, copie ou confiance dans une URL client. Un wrapper MCP OAuth et l'adaptateur session Studio partagent ce propriétaire sans inventer un principal OAuth pour l'UI.

Studio utilise explicitement les endpoints Assets et Recent existants ; il ne dépend plus d'un `includeOutputs` ignoré. Compte, kind, source, recherche et curseur font partie du scope de requête. Les résultats tardifs après fermeture, changement de compte/projet/cible ou filtre ne s'appliquent pas à la nouvelle intention.

Destinations locales : ajouter au projet, créer/remplacer une source canevas compatible, insérer au playhead/piste compatible via les règles timeline existantes. Le dépôt, le clavier et le toucher partagent ces commandes. Annuler un choix ne modifie rien ; retirer du projet ne supprime pas l'original distant ni les clips déjà insérés. Les références et faits traversent sauvegarde/rechargement sans perte.

Un handoff Audio/Toolbox vers Studio transmet une référence exacte et une intention, puis ouvre le choix projet/destination réellement implémenté. Tant que ce récepteur n'est pas qualifié, ne pas annoncer un retour Studio exécuté. Les ateliers et outils sans adaptateur Studio continuent d'utiliser leur parcours autonome réel.

## Propriétaires et contrôle

- Studio : adaptateur local, cache par compte, canevas/timeline/bin, résolution/persistance Studio et réception de handoff.
- Toolbox : catalogue/outils, éligibilité, surfaces autonomes et petit correctif partagé de lecteur de miniature de bibliothèque.
- Audio : création autonome et preuve de durée des sorties audio ; Studio conserve ses adaptateurs historiques.
- App : propriétaires généraux bibliothèque/réutilisation et CSS global.

Tout delta partagé indispensable reste dans un commit distinct avec tests de compatibilité. Les tests de propriété/persistance utilisent seulement PostgreSQL local jetable vérifié, jamais une URL distante héritée.

## Livraison Task 3 et limites de provenance

Le raccord transporte les refs/faits disponibles des uploads image/vidéo/audio jusqu'au bin, canevas et timeline Studio. La sonde upload déjà exécutée conserve aussi son `hasAudio` positif ou négatif ; aucune sonde supplémentaire n'est ajoutée. Les uploads multipart n'acquièrent ni durée ni audio inventés.

`ensureReusableAsset` ne fusionne pas génériquement `params.metadata` dans une ligne canonique déjà existante. Un réupload dédupliqué peut donc retourner des faits frais sans réécrire les faits historiques de cette ligne ; Studio revalide la référence et utilise seulement les faits réellement stockés renvoyés par le résolveur. Aucun backfill implicite n'est effectué. Les sorties anciennes sans faits serveur restent inconnues pour les futurs writers connectés, même si le navigateur mesure un original pour l'édition locale.

Le récepteur handoff qualifié expose uniquement `intent: 'project'`, confirmation et bin racine du projet choisi. Les tests DOM couvrent confirmation/annulation et StrictMode ; les E2E bibliothèque/média utilisent des routes interceptées et prouvent les interactions locales, pas la persistance serveur. La résolution SQL réelle est qualifiée séparément sur PostgreSQL jetable. Aucun wrapper MCP Audio ni bouton producteur Audio/Toolbox n'est livré dans ce lot.
