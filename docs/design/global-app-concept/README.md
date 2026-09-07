# Prototype global MaxVideoAI

Prototype interactif, non intégré à la production. L’utilisateur a retenu la direction visuelle le 7 septembre 2026, avec le choix du modèle, le prix avant génération et la conservation des fonctions existantes comme exigences centrales. Source conservée sur la branche isolée ; fichiers servis et captures restent dans `.superpowers/sdd/global-app-concept/`.

```sh
python3 docs/design/global-app-concept/preview.py --port 3025
```

Ouvrir `http://localhost:3025/`. `--prepare-only` prépare les fichiers sans lancer de serveur. La préparation remplace les modules générés du prototype : modifier les sources de ce dossier, puis préparer à nouveau. Les dépendances du dépôt doivent être installées : le script exécute `tsx` avec le tsconfig frontend pour produire le catalogue de revue.

Le script copie uniquement une liste explicite d’assets existants dans la zone locale de revue ; il ne sert jamais la racine du dépôt. La police Geist conserve sa licence OFL. Le poster vidéo provient d’une image du clip de démonstration du dépôt. Les pictos sont des SVG originaux décrits dans `data.js`, sans import de bibliothèque.

Parcours :

- Créer → Récents → ajouter une image, une vidéo ou un audio en référence ; dépôt direct depuis la colonne desktop, choix du rôle si nécessaire, remplacement confirmé et Annuler.
- Créer → Ajouter → choisir/importer/créer une référence image, vidéo ou audio.
- Vidéo → Comparer → examiner un modèle à réglages identiques, ou prévisualiser ses adaptations → Utiliser ce modèle. Fermer annule le changement proposé.
- Options → durée/résolution/format/son → estimation catalogue actualisée et visible près de Simuler.
- Créer une référence → résultat illustratif → Utiliser et revenir au brouillon.
- Gérer → aperçu, rôle, remplacement, retrait/annulation, ordre.
- Changer de profil → conserver les médias et résoudre les incompatibilités.
- Médias → recherche/filtre → aperçu/écoute → réutiliser dans un créateur compatible.
- Wallet visible → état non connecté et lien vers la facturation réelle.
- Menu MaxVideoAI → modèles, comparatifs détaillés, exemples, tarifs, outils et guides dans un autre onglet.
- Compte → apparence, mouvement, profil local, présentation des connexions.

La variante `?volume=50` ajoute des copies identifiées comme médias de test pour éprouver la densité, sans modifier les capacités des profils. Les plafonds de références restent des fixtures UI indépendantes des modèles réels. Aucun rendu, devis personnalisé, paiement, upload serveur, changement de compte réel ou projet Studio n’est produit. Les brouillons vivent en mémoire ; seule l’apparence persiste sous une clé propre à cette maquette.

`export-catalog.ts` projette six modèles disponibles et 152 scénarios texte-vers-vidéo avec les propriétaires du catalogue, des options et de la tarification publique déjà utilisés par MaxVideoAI. Le navigateur choisit un scénario complet, sans formule de prix supplémentaire. Les montants sont des **estimations catalogue Member en USD**, sans ajustements en base ni compte connecté ; la date de préparation est visible dans Détails. Toute référence ajoutée, source requise manquante ou combinaison non couverte retire le montant. Les devis image/audio et ceux avec références restent à raccorder. Les six modèles sont le périmètre de cette revue, pas une réduction du catalogue de l’app.

Le lecteur audio est réel ; la forme d’onde est un motif décoratif, pas une analyse du fichier. Les médias copiés n’ont pas été optimisés pour mesurer une performance de production. La refonte réelle devra réutiliser ses contrats de médias, de génération, de références et de pagination.

Voir `experience-map.md`, `visual-rules.md`, `review.md`, `integration-contract.md` et le plan `docs/superpowers/plans/2026-09-07-model-choice-price-concept.md`.

Le créateur défile entre son en-tête et son pied d’action. Sur desktop, les récents défilent indépendamment ; sur mobile et paysage court, le bouton nommé Récents ouvre le même choix de médias. Le solde reste explicitement non connecté. La présentation commune des récents accepte une action destinataire pour le futur Studio, mais aucune insertion dans un projet/canevas n’est encore persistée. Plan du lot : `docs/superpowers/plans/2026-09-07-recent-media-workspace.md`.
