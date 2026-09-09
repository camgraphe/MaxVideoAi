# MaxVideoAI — direction de refonte de l’application

## Résultat attendu

Une interface de création redessinée comme un produit neuf, raccordée aux moteurs, médias, comptes et connexions existants. Le changement doit se voir immédiatement sur une capture entière. Une accumulation de corrections de dimensions ne constitue pas cette refonte.

Demandes explicites : excellente typo et iconographie, moins de texte inutile, fin des boîtes dans les boîtes, menus compréhensibles, fonctions importantes visibles sur mobile, initiative dans une branche isolée. Le montage assistant reste borné à la préparation des plans pour une timeline ; il ne monopolise pas ce chantier.

## Direction retenue : atelier de création

- Composition ouverte : navigation, plan de travail et résultats constituent les trois zones. La séparation vient de l’espace, du contraste des surfaces et de lignes fines.
- Palette : graphite pour la navigation, blanc cassé pour le plan de travail, violet précis pour les actions principales et la sélection. Le mode sombre conserve la même hiérarchie.
- Typographie : une vraie police sans serif chargée, hiérarchie 30/22/15/12 px, interlignage lisible, chiffres tabulaires pour prix/statuts. Limiter les libellés en capitales.
- Iconographie : une famille cohérente de pictos Lucide, trait 1,75–2, formes reconnaissables de 20–24 px. Icône et libellé pour les actions essentielles ; pas de pictogramme abstrait sans nom.
- Panneaux : aucune carte globale autour d’une autre carte globale. Un champ peut avoir une bordure. Un média peut avoir un cadre. Les sections utilisent un titre, de l’espace et un séparateur.
- Mouvement : retour bref au survol, sélection et ouverture ; 140–180 ms. Pas d’animation d’entrée du contenu initial. Respecter reduced motion.

## Structure des écrans

### Navigation

Barre latérale plus lisible, organisée en Créer / Organiser / Compte, libellés courts sans troncature. Les liens Claude, ChatGPT et Codex restent des connexions réelles. L’en-tête de l’application devient une barre utilitaire ; les liens marketing restent disponibles dans le menu. Sur mobile : Vidéo, Image, Bibliothèque, Menu, tous nommés.

### Création vidéo et image

Titre affirmé, choix du modèle dans une bande ouverte, brief dans un seul espace de saisie, réglages regroupés, bouton principal avec prix. Les références et réglages avancés restent accessibles sans nouvelle étape obligatoire. Le lecteur n’occupe de place qu’avec un rendu ou un chargement réel. Résultats à droite sur grand écran, après la création sur mobile.

### Bibliothèque et résultat

En-tête éditorial, vues et types visuellement distincts, recherche évidente. La grille donne la priorité aux médias. Métadonnées et actions occupent une seule bande sobre. Le résultat utilise un lecteur et une zone d’actions ouvertes ; aucune pile de cartes décoratives. Télécharger, réutiliser et enregistrer restent nommés.

### Paramètres

Navigation de section lisible, formulaire de compte à plat, réglages en lignes, trois choix d’apparence illustrés. Nom, langue et thème ont un effet réel ; les capacités non disponibles conservent un statut honnête.

## Contrats techniques conservés

Next.js, React, SWR et les hooks actuels. Aucun changement aux prix, modèles, générations, paiements ou URLs publiques. Les médias originaux restent les sources des actions et téléchargements. CSS de l’expérience applicative isolé des pages marketing et administratives. Aucune dépendance d’état supplémentaire.

La nouvelle interface reste sur `codex/app-experience-first-lot`. Aucun déploiement, fusion ni modification du checkout Studio existant. Les fonctionnalités de montage persisté nécessitent une intégration distincte : le code `prepare_montage` présent est un plan en lecture seule, désactivé par défaut, pas un montage déjà enregistré dans Studio.

## Validation du résultat

1. Captures comparables du générateur, bibliothèque, résultat et paramètres à 1440 px et 390 px ; petit écran 320 px sans commande coupée.
2. La composition entière, la navigation et la hiérarchie typographique diffèrent nettement de l’ancienne interface.
3. Aucun nouveau bouton sans comportement réel. Aucun prix ou statut inventé. États vide, chargement et erreur préservés.
4. Modèles/modes/références, pagination au-delà de 100 médias, recherche et anciennes générations restent accessibles.
5. Clavier, fermeture et retour du focus, thèmes, reduced motion, EN/FR/ES.
6. Contrats, tests comportementaux, lint, exposition publique, TypeScript, i18n et build. Comparaison Lighthouse locale selon le protocole de référence, avec limites explicites.
