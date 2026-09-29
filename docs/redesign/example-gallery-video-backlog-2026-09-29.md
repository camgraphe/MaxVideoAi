# Vidéos manquantes pour les ouvertures des galeries

Inventaire du 29 septembre 2026, établi depuis les galeries publiques de la branche locale (`/api/examples`, tri `playlist`, pagination de 24). L'ouverture validée demande **trois vidéos horizontales et une verticale**, dans cet ordre : 16:9, 9:16, 16:9, 16:9. Les quatre vidéos doivent être accessibles dans la première page ou choisies explicitement dans l'atelier des galeries. Les autres pages continuent à afficher le reste du catalogue.

## Priorités de production

| Galerie | État constaté | Action minimale pour obtenir le héros | Version éditoriale conseillée |
| --- | --- | --- | --- |
| LTX | 41 vidéos, dont 38 horizontales et 3 verticales. La première page contient 24 horizontales ; les verticales LTX 2.3 arrivent aux positions 34, 36 et 41. | **Aucune génération nécessaire.** Choisir une verticale LTX 2.3 existante pour la deuxième place du héros dans l'atelier, avec trois horizontales déjà publiées. | Produire **1 verticale LTX 2.5 Pro** (6 à 10 s), puis remplacer la verticale historique du héros. Montrer un sujet en mouvement et un déplacement de caméra lisible. |
| Happy Horse | 9 vidéos horizontales, aucune verticale. Seules 2 horizontales utilisent Happy Horse 1.1 ; les 7 autres utilisent 1.0. | Produire **1 verticale Happy Horse 1.1** (10 s). Les trois horizontales existent déjà. | Ajouter **1 horizontale Happy Horse 1.1** (10 s) pour que les quatre premières vidéos puissent privilégier la version récente. Varier le cadrage et le sujet avec la verticale. |
| Grok Imagine Video | 2 vidéos horizontales Grok Imagine Video 1.5, aucune verticale. | Produire **1 verticale et 1 horizontale Grok Imagine Video 1.5** (5 s chacune). | Choisir deux scènes distinctes : une action cadrée pour mobile et une scène large avec mouvement visible. |
| FLUX | 4 vidéos horizontales FLUX 3 / FLUX 3 Draft, aucune verticale. Les fichiers mesurent 1280 × 704 malgré le format déclaré 16:9 ; l'ancienne tolérance les écartait du héros. | Produire **1 verticale FLUX 3** (5 s) et utiliser trois horizontales existantes. Le correctif de reconnaissance des dimensions doit être présent. | Privilégier FLUX 3 plutôt que Draft pour la verticale, avec une scène conçue pour le cadrage portrait et du mouvement perceptible. |

**Minimum : quatre nouvelles vidéos** (Happy Horse ×1, Grok ×2, FLUX ×1), plus le choix d'une verticale existante pour LTX. **Sélection recommandée : six nouvelles vidéos**, en ajoutant LTX 2.5 Pro ×1 et une deuxième horizontale Happy Horse 1.1 ×1.

Les [six prompts originaux proposés](example-gallery-social-prompts-2026-09-29.md) distinguent les quatre clips nécessaires des deux améliorations facultatives. Ils excluent les concepts déjà publiés ou montés ; une dernière vérification des brouillons privés de Studio RS reste à faire avant génération.

Pour LTX, trois verticales existantes sont disponibles dans le catalogue public : `job_cfcdb24a-b404-47b1-8e43-1eb45ee4daf9` (LTX 2.3 Pro, 6 s), `job_d2e0b731-ba85-498b-bf45-a1b17b468963` (LTX 2.3 Pro, 10 s) et `job_a757f656-43b8-47bc-83d2-0bd6728b320b` (LTX 2.3 Fast, 10 s). Choisir celle dont le cadrage et la qualité conviennent ; la placer dans l'ouverture sans dupliquer sa carte dans la suite de la galerie.

## Validation avant publication

1. Vérifier le ratio **mesuré** du fichier livré, ainsi que sa vignette et sa lecture ; une demande 9:16 seule ne garantit pas un fichier vertical.
2. Renseigner le modèle exact, la durée, les réglages, le prompt, la visibilité publique et le coût enregistré. Le lecteur et la page vidéo doivent présenter le même exemple et le relier à l'application.
3. Dans l'atelier des galeries, choisir les quatre emplacements et contrôler l'aperçu de la première page, la suite paginée et l'absence de doublon. Garder les vidéos historiques publiées dans le catalogue.
4. Vérifier l'affichage sur ordinateur et mobile et ouvrir chaque vidéo depuis la galerie. Les pages vidéo publiques et leurs URL restent les points d'entrée SEO.

Les huit autres galeries de familles examinées (Sora, Kling, Veo, Luma, Wan, Seedance, Pika et Hailuo/MiniMax) disposent déjà d'au moins trois horizontales et une verticale sur leur première page. Refaire l'inventaire avant toute commande de génération si la curation ou la visibilité publique change.
