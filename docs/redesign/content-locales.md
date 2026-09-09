# Contenus, SEO éditorial et langues

Statut : plan initial. Pas de réécriture publiée.

## Traitement de chaque contenu

Attribuer un identifiant à chaque bloc existant et noter : URL/locale, source, objectif utilisateur, éventuelle requête d'entrée, décision, nouveau texte/destination, justification et validation. Valeurs de décision : conserver, condenser, convertir en démonstration, déplacer, enrichir, supprimer après revue.

La longueur seule ne justifie pas une suppression. Préserver les limites, conditions, réponses précises et preuves originales ; réduire les slogans répétés, inventaires de fonctionnalités et paraphrases. Une vidéo ne remplace pas les informations que les utilisateurs et moteurs doivent pouvoir lire.

## Registre initial

| ID | Constat/source | Proposition | Validation attendue |
|---|---|---|---|
| C01 | `frontend/messages/fr.json`, models decision : accents manquants | Corriger à la source et relire tout le bloc | FR visible + métadonnées/FAQ cohérentes |
| C02 | `models/_lib/models-catalog-cards.ts`, DECISION_DESCRIPTION_OVERRIDES anglais prioritaire | Rendre la sélection de description sensible à la locale via le propriétaire éditorial approprié | Régression sur modèles touchés en FR et ES |
| C03 | Catalogue : « route qualité », « flagship », « engines » | Vocabulaire compréhensible centré sur les résultats | Glossaire EN/FR/ES-LATAM |
| C04 | Deux niveaux de recommandations dans le catalogue | Une seule sélection courte, catalogue plus haut | Tous les liens utiles conservés ou relocalisés |
| C05 | Exemples : prompts tronqués utilisés comme titres | Titre descriptif court ; prompt original dans le détail | Le prompt reste exact et réutilisable |
| C06 | Labels accessibles anglais observés sur mobile FR | Audit navigation et contrôles dans chaque langue | Relecture de l'arbre accessible, clavier |
| C07 | Accueil : plusieurs sections expliquent les workflows/outils | Une démonstration suivie et des liens explicites | Vérifier chaque réponse et destination transférée |

Sources C01–C06 : audit en ligne de cette conversation du 9 septembre, puis vérification de C01/C02 dans la base `bdd544e9f`. C07 est une proposition issue de la composition actuelle de HomePage, pas un résultat de test utilisateur.

## Cible linguistique

EN : anglais direct. FR : français naturel, accents et apostrophes, terminologie stable. ES : espagnol LATAM neutre (`es-419` pour la référence éditoriale), éviter vosotros et les régionalismes espagnols. Garder `video`, `imágenes`, `generar`, `precio` cohérents avec le contexte. Noms propres et versions des modèles inchangés.

Conserver les chemins `/fr/modeles`, `/es/modelos`, etc. L'étiquette linguistique de rédaction ne modifie pas automatiquement le hreflang générique `es`, couvert par des tests existants. Les prix USD restent USD ; les conventions d'affichage doivent distinguer format local et conversion monétaire.

| Intention | FR proposé | ES-LATAM proposé |
|---|---|---|
| Choisir | Choisir un modèle | Elige un modelo |
| Réutiliser un rendu | Voir le prompt et les réglages | Ver el prompt y los ajustes |
| Contrôle du prix | Prix affiché avant génération | Consulta el precio antes de generar |
| Préparer un premier essai | Faire un premier essai | Haz tu primera prueba |

Relire les phrases dans leurs composants réels, y compris mobile. Inclure navigation, boutons, labels accessibles, textes alternatifs, filtres, vide/erreur/chargement, FAQ, title et description. La parité de clés n'est pas une validation linguistique.

## SEO / GEO

Rendre explicites modèle/version, objectif, conditions, limites, provenance des exemples et date de vérification si réellement tenue à jour. Les affirmations de comparaison doivent avoir un fondement accessible. Maintenir le texte essentiel en HTML rendu serveur et les liens explorables, même quand une animation le met en scène.

Pas de FAQ artificielle ni de promesse d'être cité par les assistants. Suivre séparément trafic organique, conversions et référents IA identifiables, avec leurs limites d'attribution. Un échantillon de questions peut suivre la présence dans les assistants, sans être traité comme un classement stable.

## Données encore nécessaires

Le crawl complet et les données Search Console/analytics n'ont pas encore été acquis pour ce chantier. Priorités actuelles fondées sur rôle du gabarit et problèmes observés, pas sur une estimation inventée de trafic. Rechercher d'abord les intégrations disponibles en lecture seule ; demander seulement les accès ou exports manquants.
