# Prototype global MaxVideoAI

Proposition interactive, non intégrée à la production. Le style n’est pas encore validé par l’utilisateur. Source conservée sur la branche isolée ; fichiers servis et captures restent dans `.superpowers/sdd/global-app-concept/`.

```sh
python3 docs/design/global-app-concept/preview.py --port 3025
```

Ouvrir `http://localhost:3025/`. `--prepare-only` prépare les fichiers sans lancer de serveur. La préparation remplace les quatre fichiers générés du prototype : modifier les sources de ce dossier, puis préparer à nouveau.

Le script copie uniquement une liste explicite d’assets existants dans la zone locale de revue ; il ne sert jamais la racine du dépôt. La police Geist conserve sa licence OFL. Le poster vidéo provient d’une image du clip de démonstration du dépôt. Les pictos sont des SVG originaux décrits dans `data.js`, sans import de bibliothèque.

Parcours :

- Créer → Ajouter → choisir/importer/créer une référence image, vidéo ou audio.
- Créer une référence → résultat illustratif → Utiliser et revenir au brouillon.
- Gérer → aperçu, rôle, remplacement, retrait/annulation, ordre.
- Changer de profil → conserver les médias et résoudre les incompatibilités.
- Médias → recherche/filtre → aperçu/écoute → réutiliser dans un créateur compatible.
- Compte → apparence, mouvement, profil local, présentation des connexions.

La variante `?volume=50` ajoute des copies identifiées comme médias de test pour éprouver la densité, sans modifier les capacités des profils. Les plafonds de profils sont des fixtures UI, pas les valeurs de modèles réels. Aucun rendu, devis, paiement, upload serveur, changement de compte réel ou projet Studio n’est produit. Les brouillons vivent en mémoire ; seule l’apparence persiste sous une clé propre à cette maquette.

Le lecteur audio est réel ; la forme d’onde est un motif décoratif, pas une analyse du fichier. Les médias copiés n’ont pas été optimisés pour mesurer une performance de production. La refonte réelle devra réutiliser ses contrats de médias, de génération, de références et de pagination.

Voir `experience-map.md`, `visual-rules.md`, `review.md` et le plan `docs/superpowers/plans/2026-09-07-global-app-concept.md`.
