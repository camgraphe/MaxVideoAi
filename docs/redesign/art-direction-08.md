# Planche 08 — consolidation du choix 1 + 3

10 septembre 2026. Une planche ImageGen intégrée obtenue dès le premier appel avec références, affichée une fois dans la conversation et copiée dans le worktree.

[Ouvrir la revue locale](review/art-direction-08/index.html) · [Plan complet et correspondance pages/intents](home-direction-08.md).

## Ce qui a été demandé

Le contenu et les usages de Frame Shift, le fond et les tons chauds de From the Source, en raccord avec l'app. Paiement à l'usage, comparaison, références et création avec un assistant sont les piliers. Cette orientation provient du retour d'Adrien ; la nouvelle planche n'est pas encore validée.

Trois références effectivement jointes :
- [Frame Shift](review/art-direction-07/frame-shift.png), première option affichée.
- [From the Source](review/art-direction-07/from-the-source.png), troisième option affichée.
- [Sources de marque et palette](review/art-direction-08/brand-reference.png), capturées depuis une planche HTML locale utilisant les assets du dépôt et les couleurs observées dans /app. Aucun écran de compte privé envoyé à ImageGen.

## Résultat examiné

Le H1 remet le paiement à l'usage au premier plan. Le cuivre photographique, le fond clair chaud et l'action bronze créent un raccord avec l'app. Cinéma, social et produit sont visibles sur desktop. Les modèles ont des identités reconnaissables, et Compare et Connect occupent une place significative après la preuve initiale.

Le tableau conserve les six notes éditoriales demandées pour Kling 3 Pro / Seedance 2.5 : 8.6 / 9.1, 8.4 / 9.2, 8.4 / 9.2. Il indique trois critères sur onze. Le mobile conserve actions puis poster, avant les marques et le comparatif. Les trois images clés suivent le casque de la référence au plan et au résultat.

## Écarts à corriger avant fabrication

1. **La planche compresse deux chapitres dans une seule ligne desktop.** Compare et Connect doivent être détaillés chacun à une échelle utile dans la page ; cette mise côte à côte sert à la revue, pas de décision de layout final. Le vide sous le petit tableau ne doit pas devenir une section vide dans le site.
2. **Le comparatif mobile est trop petit.** Les valeurs sont présentes, mais les libellés et barres doivent être repris au format de lecture réel. Le dessin raster n'assure pas l'exactitude de l'échelle des barres.
3. **Connect réintroduit du manuscrit et un mini-site approximatif.** Supprimer les notes décoratives ; deux polices maximum. Le casque et sa marque fictive sont illustratifs. Le nom Kling dessiné dans le mini-site ne doit pas être repris comme identité d'un client ou d'une marque de casque.
4. **Le mobile surreprésente le produit.** Garder une grande preuve immédiate, puis proposer une sélection explicite des univers film/social/produit. Ne pas croire qu'une seule image de casque raconte les trois à elle seule.
5. **Les logos restent des rendus raster.** Les assets originaux ont servi de référence ; le résultat ne les remplace pas. Le symbole ajouté près de MCP et les inscriptions sur le casque ne deviennent pas des marques approuvées.
6. **Le plan et l'animation restent des illustrations.** Aucun test de compatibilité d'assistant, aucune garantie de fidélité du modèle, aucun fonctionnement d'interface ne découle du storyboard. Le point “Review price” est à conserver ; les générations de différents formats ne sont pas une publication automatique de campagne.
7. **Les détails d'interface sont hors champ.** Le menu, les états des boutons, le lecteur et les modales ont encore besoin de leurs vues dédiées.

Ces écarts ne demandent pas de changer les piliers retenus. Le lot suivant doit passer de la composition d'ensemble aux états lisibles et maîtrisés, puis au prototype.

## Provenance

- Outil : image_gen__imagegen intégré, avec referenced_image_paths ; aucune API/CLI de secours.
- Prompt exact : [prompt.txt](review/art-direction-08/prompt.txt).
- Métadonnées, références, dimensions et empreintes : [provenance.json](review/art-direction-08/provenance.json).
- Résultat : [consolidated.png](review/art-direction-08/consolidated.png).
- Demande : 2400 × 1800 ; sortie réelle : 1448 × 1086, conservée sans redimensionnement.
- Original : /Users/adrienmillot/.codex/generated_images/01a086ef-68a2-7dd1-9a3e-fc5c425137e6/exec-6c4a8a14-15da-4a44-a506-52425c0dadde.png.
- Le rappel historique de la troisième planche 07 a été supprimé à la demande d'Adrien. Aucune relance programmée ne reste active pour cette étude.

La page de revue explique la proposition en français ; les textes du concept de homepage restent en anglais. Elle est un document de conception local avec noindex/nofollow, pas une route de production. Les médias d'exemples finaux devront suivre leur propre contrat de provenance et de diffusion.

## Vérification

La validation documentaire et la recette de la page de revue sont consignées dans [validation.json](review/art-direction-08/validation.json). Aucun changement applicatif, génération vidéo, devis payé ou déploiement dans ce lot.
