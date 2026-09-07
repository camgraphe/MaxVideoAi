# Carte d’actions — création interconnectée

La bibliothèque est le point commun des médias ; un brouillon est le contexte de travail. On navigue par activité, on agit sur une sélection. Le prototype démontre les raccords en mémoire locale ; les limites de ses profils sont illustratives.

| Activité / route réelle | Actions à conserver et organiser | Mobile / état initial |
|---|---|---|
| Créer vidéo `/app` | Instruction, modèle/mode, réglages compatibles, références, devis, lancer, suivre, aperçu, télécharger, réutiliser | Vidéo · Image · Audio visibles ; instruction et Ajouter sans emplacements vides ; commande principale nommée |
| Créer image `/app/image` | Texte seul, image source/références/masque selon modèle, variantes, résultat vers référence vidéo ou outil | Même grammaire de références ; paramètres dans un panneau explicitement ouvrable |
| Créer audio `/app/audio` | Musique, voix, sonoriser une vidéo, voix + sonorisation ; script, voix, musique/durée, source vidéo et échantillon vocal selon pack ; écoute et export | Audio reste une activité visible ; lecteur à la demande, pas de vidéo factice pour représenter un son |
| Récents, accès transversal | Derniers médias image/vidéo/audio → aperçu, ajouter comme référence ; futur Studio → projet/canevas selon destination | Colonne indépendante sur desktop ; bouton nommé Récents et panneau sur mobile. Pas de lecteurs au repos ni de cases vides réservées. |
| Médias `/app/library` | Recherche, filtres image/vidéo/audio et provenance, pagination, sélection, aperçu/écoute, original, réutiliser, supprimer | Grille compacte ; barre d’actions de sélection nommée ; recherche conservée au retour |
| Outils `/app/tools/*` | Angle, Character Builder, Storyboard, upscale, détourage : choisir/importer une source compatible, agir, réutiliser le résultat | Catalogue lisible et actions liées au média, accès depuis navigation et sélection |
| Compte `/settings`, `/account/connections`, `/billing` | Profil, apparence, langue, mouvement, connexions et révocation réelle, crédits/factures | Préférences en lignes ; labels persistants ; choix/toggles selon leur fonction |
| Activité `/jobs`, accueil `/dashboard` | Reprendre, consulter état/échec/résultat, rechercher sa production | Accès conservé depuis l’espace personnel ; ne pas effacer ces destinations en simplifiant le menu |
| Studio, branche éditeur séparée | Recevoir une sélection, organiser les plans, inspecter, ordonner une timeline, finaliser | Lot distinct après validation globale ; sa disponibilité effective pilote l’accès |

## Une référence, six opérations précises

| Action | Comportement cible |
|---|---|
| Ajouter | Un contrôle compact ouvre Bibliothèque / Importer / Créer. Le rôle demandé filtre les médias, la quantité et les formats ; erreurs au niveau du fichier. Aucun emplacement pour chaque capacité théorique. |
| Choisir | Sélection multiple si autorisée ; compteur sélectionnés / disponibles ; validation des métadonnées et budget partagé avant insertion. Les IDs canoniques identifient le média, ses miniatures ne deviennent pas ses sources. |
| Créer | Mémoriser origine, rôle, index/remplacement, brouillon et révision ; ouvrir l’activité image/vidéo/audio compatible ; résultat choisi → Utiliser et revenir. Annuler restaure exactement le contexte, les erreurs restent dans le détour. Pas de détour imbriqué dans le premier prototype. |
| Remplacer | Choisir d’abord, valider ensuite, remplacer atomiquement ; annuler/échec conserve l’ancien média et le rôle. Ne pas le retirer préalablement. |
| Retirer | Retirer du brouillon seulement ; proposer Annuler ; conserver le rôle requis sous forme de ligne Ajouter. Supprimer de la bibliothèque est une autre commande et suit ses autorisations. |
| Organiser | N premières vignettes + compteur/« Gérer » ; liste dédiée pour voir/remplacer/retirer/déplacer. Le glisser-déposer a une alternative Monter/Descendre au clavier et au toucher. Ordre sémantique distinct des rôles fixes début/fin. |

Cas 0 → 1 → plusieurs → limite : même composant, densité bornée. Une bibliothèque de 50 éléments ne monte pas 50 lecteurs et ne réserve pas 50 cases. Si le modèle n’accepte que deux références, seuls deux choix peuvent être confirmés. Changer de modèle montre les incompatibilités avant application ; conserver les références mises de côté et revenir au modèle précédent reste possible, jamais de suppression silencieuse. Recalculer le devis réel après changement pertinent.

## Raccords et MCP

Image générée → image de début / référence compatible ; vidéo → vidéo source / sonorisation / Studio ; audio → référence audio compatible / écoute, puis piste Studio quand son contrat existe. Une vidéo avec piste son n’est pas automatiquement un fichier audio : pas d’extraction ou de conversion inventée.

MCP existant : `list_media`, `import_reference_files`, `create_reference_upload_link` acceptent image/vidéo/audio ; `get_model_details` fixe les capacités, `prepare_generation` valide et chiffre image/vidéo, confirmation/génération/suivi restent distincts. La création audio autonome a son API app, mais pas encore une équivalence MCP démontrée. `prepare_montage` est un plan vidéo non persisté et désactivé par défaut ; ce n’est pas un éditeur enregistré. UI et MCP devront invoquer les mêmes commandes métier, avec propriété, validation et idempotence adaptées.

Sources locales vérifiées : AppSidebar, AssetLibraryBrowser, reference-budget.ts, audio-generation.ts (4 packs), useAudioSourceMediaHandlers, mcp/tools/{list-media,prepare-generation,import-reference-files,prepare-montage}, guides mcp-mode-coverage et mcp-reference-imports.

## Navigation pendant la création

L’en-tête garde MaxVideoAI, Assistants et Wallet. Le prix du rendu reste près de Générer, distinct du solde disponible. Comparer propose les modèles et adaptations du brouillon ; les comparatifs détaillés sont accessibles depuis ce choix et le menu MaxVideoAI. Accueil, modèles, exemples, tarifs, outils et guides s’ouvrent dans un autre onglet. Les destinations viennent de `frontend/config/navigation.ts` ; l’intégration réelle conserve leurs locales.

Le créateur réserve une zone défilante à l’aperçu, aux références et au texte, entre la barre de modèle et le pied d’action. Les récents desktop ont leur propre défilement. La navigation reste visible en portrait et paysage court ; le lecteur audio conserve sa hauteur naturelle pour ne pas perdre ses commandes.
