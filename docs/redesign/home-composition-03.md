# Accueil — proposition 03, repartir du produit

10 septembre 2026. **Proposition locale à examiner ; aucune intégration ni publication.** Le retour sur la proposition 02 est acté : ses effets paraissaient peu liés au produit et sa finition ne justifiait pas le remplacement de l’accueil.

Ouvrir [l’accueil FR](review/home.html), [EN 03](review/home-en-v3.html) ou [es LATAM](review/home-es.html).

## Ce qu’il faut regarder

1. **L’accueil et les cinq films.** Le fond clair et la logique de choix du site existant sont conservés. Le texte laisse la place aux rendus. Cliquer sur un modèle ouvre son panneau ; son film, sa durée, son mode, ses liens et son coût indicatif restent associés.
2. **Les intentions.** Quatre entrées visuelles reprennent les guides actuels. Les comparatifs viennent ensuite, sans notes de performance inventées ni faux test de plusieurs moteurs sur un même prompt.
3. **Angle.** Une vraie scène du site est présentée sous quatre cadrages générés. Sur ordinateur, le scroll fait passer de l’un à l’autre, dans les deux sens. Les boutons permettent de choisir librement. Sur petit écran, le bloc conserve une hauteur naturelle et se manipule par boutons. Ce sont quatre images, pas une caméra 3D continue.
4. **Le MCP.** La proposition emploie une capture publique existante de Claude affichant une vidéo MaxVideoAI. Elle présente le parcours contexte → proposition et prix → création, avec liens Codex/Claude/ChatGPT. La capture s’agrandit. Aucune création MCP exécutée pour cette revue n’est revendiquée.
5. **Le reste de l’accueil.** Création d’images, outils, tarifs, huit questions de l’accueil, liens de découverte et pied de page restent présents. Les longs arguments répétés deviennent des textes plus courts, des exemples et des liens utiles.

Les fenêtres d’agrandissement ont un fond atténué, une fermeture native par Échap et un retour du focus. Le lecteur se met en pause quand une fenêtre s’ouvre ou quand son film sort de la zone visible.

## Ce qui revient de l’accueil existant

| Source actuelle | Nouvelle place |
|---|---|
| Promesse de choix du modèle, exemples réels, prix avant génération | Titre, introduction, cinq films et informations de la sélection |
| MiniMax H3 Max, Seedance 2.5, Wan 3 Prime, Kling 3 Pro, LTX 2.5 Pro | Même ordre et mêmes sources que le propriétaire de l’accueil |
| Quatre guides par usage | Quatre grandes images sans cartes imbriquées |
| Comparatifs et familles d’exemples | Liens explicites, comparatifs secondaires dans un accordéon HTML |
| Références et outils de préparation | Démonstration Angle, image de départ Disco Motel, outils et modèles image |
| Assistant MCP | Explication courte et capture réelle de l’intégration Claude |
| Crédits, tarif préalable et remboursement des échecs | Bloc prix et historique |
| Huit questions de recherche de l’accueil | Questions issues des dictionnaires actuels ; réponses raccourcies et localisées |

Les cinq **coûts indicatifs** viennent des valeurs éditoriales de l’accueil : 1,19 / 1,46 / 0,70 / 2,63 / 0,72 USD. Ils ne sont ni recalculés dans le navigateur, ni présentés comme des devis actualisés ou des reçus de paiement. Le bouton d’information explique cette limite.

## Mobile et mouvement

Le poster principal est disponible dans le HTML et utilise les copies préparées existantes, dont la version mobile. La lecture automatique est réservée au desktop autorisé ; la lecture mobile demande une action. Une seule vidéo d’ambiance est montée à la fois. La vue mobile de la revue ne lance aucune lecture automatique.

Le bloc Angle ne monopolise pas plusieurs écrans sur mobile, tablette, fenêtre très basse ou préférence de mouvement réduit. Les vues supplémentaires se préparent à l’approche de la section ; avec Save-Data, une vue est demandée au moment de la sélection.

La page est une proposition de composition. **Aucun gain Core Web Vitals ni gain de conversion n’a été mesuré.** Les contrôles de largeur en iframe ne remplacent pas une recette sur téléphone.

## Référencement et intégration

L’inventaire des 40 destinations de départ a été actualisé : toutes restent accessibles, certaines dans le pied de page. Les liens ne suffisent pas à démontrer une équivalence SEO. Les huit questions reprennent les intentions de recherche existantes ; les réponses raccourcies restent à valider avec les données et le contexte des pages.

Les pages de revue sont noindex. Les routes de production, metadata, hreflang, JSON-LD, sitemaps, consentement, Clarity, GA4, GSC et Zoho n’ont pas été modifiés. L’ES éditorial est LATAM ; les routes existantes restent en /es.

**Prochaine décision :** juger cette composition dans le contexte de l’accueil, surtout l’ouverture, la sélection et l’usage d’Angle. Ensuite seulement, intégrer le lot retenu dans les propriétaires Next.js existants et mesurer les médias, les parcours et le référencement avant mise en ligne.

[Recette et limites](home-composition-03-validation.md) · [Exécution et sources](review/home/README.md) · [Brief de remplacement](home-replacement-brief.md) · [Notes historiques de la proposition 02](home-composition-02.md)
