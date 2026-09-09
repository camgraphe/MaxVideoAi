# Qualité des détails — contrat de conception proposé

9 septembre 2026. À présenter avec les maquettes puis à éprouver dans le navigateur. Ce document concerne les parcours du site public et leurs points d'entrée dans l'app ; il n'autorise pas une nouvelle refonte de toute l'app.

## Le principe

Chaque interaction doit expliquer ce qui vient de se passer, conserver le contexte et faciliter l'action suivante. La cohérence vient d'une petite famille de comportements travaillés. Concevoir l'ouverture ET la fermeture, la réussite ET l'échec.

| Surface | Présentation proposée | Détails qui décident de sa qualité |
|---|---|---|
| Exemple vidéo agrandi | Le média s'agrandit depuis sa vignette lorsque c'est fluide ; surface sombre calme | Poster conservé jusqu'à l'image décodée, ratio stable, nom du modèle lisible, lecture et son explicites ; fermer arrête la lecture et rend le focus au déclencheur |
| Prompt / paramètres d'un exemple | Volet adjacent au média sur desktop, vue adaptée à la hauteur mobile | Texte sélectionnable, copie confirmée, métadonnées séparées du prompt ; pas une seconde modale imbriquée |
| Filtres catalogue | Petit panneau ancré sur desktop ; feuille mobile si courte, vue haute si beaucoup d'options | Nombre de résultats visible, sélection conservée, réinitialisation claire, retour sans perdre le scroll ; clavier mobile pris en compte |
| Choix d'assistant MCP | Choix court avec logo, nom et étapes utiles | Liens vers le parcours exact, statut réellement connu, erreur récupérable ; pas de faux statut connecté |
| Comparaison | Deux preuves alignées, options contrôlées | Commandes accessibles, choix identifiable, tableau utilisable en tactile ; pas de détails uniquement au hover |
| Navigation mobile | Surface sobre avec peu de groupes clairement titrés | Fermeture évidente, retour cohérent, pas de saut de page ni menu recouvert par le clavier |
| Cookie et préférences | Dialogue intégré à la direction artistique | Même soin pour les choix, focus cohérent, aucun décor qui masque une action ou une explication |
| Confirmation / notification | Retour discret proche de l'action | « Prompt copié » ou « Lien copié » uniquement après réussite ; une erreur persistante ne disparaît pas avant lecture |
| Chargement | Conserver géométrie et information disponible | Pas de faux pourcentage, message d'état compréhensible, repli si média indisponible |
| CTA | Libellé stable, contraste, réponse immédiate au toucher | Aucun effet qui change le texte ou la taille au moment du clic ; éviter animation permanente de l'action principale |

## Trois familles de mouvement proposées

1. **Réponse :** pression, sélection, état d'un filtre, copie. Essayer 120–180 ms ; retour lisible sans temps mort.
2. **Ouverture :** lecteur, panneau, menu. Essayer 200–320 ms, faible translation et opacité, sortie généralement plus courte. L'action reste utilisable pendant la transition.
3. **Narration :** construction/déconstruction du projet. Progression spatiale liée au scroll, indépendante des durées des petits contrôles.

Ces valeurs sont des points de départ artistiques, pas des normes ou résultats de test. Réduire/supprimer le mouvement avec la préférence utilisateur ; même information dans tous les états. Éviter les grands flous animés, zooms répétés et rebonds sur les formulaires et prix.

## Contrat des fenêtres et panneaux

- Un titre accessible, une fermeture clairement nommée, fond inactif lorsque la surface est modale.
- Focus placé à l'ouverture, maintenu dans la modale, puis rendu à un déclencheur encore présent. Escape fonctionne ; un geste de fermeture n'est jamais l'unique solution.
- Pas de scroll de la page derrière ; restaurer la position à la fermeture. Contenu long et zoom texte 200 % n'enferment pas les actions.
- À 320/390 px, respecter hauteur visible, clavier et zones sûres. Les actions critiques restent accessibles sans glissement fin.
- Gérer le double clic, fermer pendant un chargement, rouvrir immédiatement, revenir en arrière, changer d'orientation, perdre le réseau et échouer à lire le média.
- Une fermeture visuelle ne doit pas relancer une génération, une connexion ou un paiement ; reprendre les contrats fonctionnels existants.

`frontend/components/ui/useAccessibleModal.ts` possède déjà des responsabilités de focus et Escape. `frontend/components/media/usePublicVideoControls.ts` et les lecteurs existants possèdent la lecture. La couche visuelle doit s'y intégrer ; une démo copiée ne les remplace pas automatiquement.

## Références et premier essai

[Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) et [React Aria Modal](https://react-aria.adobe.com/Modal) fournissent des références de comportement et d'accessibilité ; aucun remplacement de primitives décidé.

Le 9 septembre, le composant [Hero Video Dialog de Magic UI](https://magicui.design/docs/components/hero-video-dialog) a été ouvert dans Chrome : fond atténué/flouté, média centré et fermeture extérieure visibles. La première vue du lecteur était vide avant chargement de l'iframe YouTube. Une tentative Escape n'a pas fourni de fermeture confirmée dans cet essai. Cela suffit à conserver l'idée de composition tout en refusant une adoption directe sans recette ; ce n'est pas un audit général du composant.

La démo Morphing Dialog de Motion Primitives a rencontré un contrôle de navigateur ; son rendu n'a pas été évalué. Le fichier source a été consulté via GitHub. Ne pas lui attribuer une validation visuelle.

## Livrable de validation

Présenter une planche de détails avec six interactions prioritaires : lecteur, prompt, filtre mobile, sélection d'assistant, navigation et notification. Pour chacune : repos → activation → ouvert/chargement → succès/erreur → fermeture. Ajouter version mobile et sans mouvement. Le prototype devra ensuite montrer ces cycles complets avec les textes et médias MaxVideoAI.

La revue passe à la taille réelle, puis clavier/tactile et réseau dégradé. Une belle capture de la fenêtre ouverte n'est pas une validation de l'interaction.
