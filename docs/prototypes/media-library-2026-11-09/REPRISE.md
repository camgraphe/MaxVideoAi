# Reprise — itération compacte en cours

Cette PR reste une **proposition interactive en brouillon**, pas une intégration applicative. L’utilisateur reprend la même tâche Codex après changement de compte.

Le dossier local de reprise détaillé (non publié, avec les preuves privées de production) est :

`/Users/adrienmillot/Documents/MaxVideoAI-investigations/2026-11-09-media-library-design/REPRISE.md`

## État du travail

- Checkout isolé : `/Users/adrienmillot/.codex/worktrees/media-library-design/MaxVideoAi V2`.
- Branche : `codex/media-library-design`, PR https://github.com/camgraphe/MaxVideoAi/pull/639.
- Base main contrôlée : `b08af8a3f59a6a4e9378088ebcceb8e56fe59f0c`.
- Dernière V1 intégralement vérifiée : `70463ad1072e6d09a7ea01e8cc4e04c29cc76ee9`, workflow https://github.com/camgraphe/MaxVideoAi/actions/runs/42711815139.
- Le commit WIP de reprise conserve la V2 : mosaïque native virtualisée, grille conservée, liste compacte, cases visuellement plus petites avec cibles 44 px, barres resserrées, noms techniques volontairement faibles, libellés factuels modèle/provenance/date, recherche dans des prompts fictifs, filtres modèle/période et repère personnel simulé.
- La mosaïque et la première liste ont été inspectées nativement. Les derniers changements de contexte et de filtres ne sont pas encore validés de bout en bout. Les tests de capture ont reçu seulement une adaptation minimale aux noms faibles ; compléter la QA V2 avant toute annonce de maturité.

## Priorités

1. Lire la fiche locale détaillée, les guides du dépôt et le diff. Conserver la V2 en cours.
2. Vérifier le boot et les interactions après redémarrage du serveur local (compilation au démarrage, pas de hot reload).
3. Ne pas fonder l’UX sur de beaux noms fictifs : les libellés de générations peuvent être absents en production. Utiliser des faits disponibles, le visuel et le prompt, sans inventer de titre.
4. Tester les modes, la sélection et les références sur desktop/mobile et 10 000 éléments. Les noms ne sont jamais des identités.
5. Distinguer simulation et capacités serveur : contexte modèle/prompt, recherche de collections, modèle/période et repères personnels demandent leurs contrats d’intégration. Ne pas brancher directement les nouveaux filtres mock sur les APIs existantes.
6. Préserver toutes les actions produit, y compris celles encore non simulées (Sous-titres, partage, actions vidéo).
7. **Aucune intégration produit avant vérification de la fusion de 638 et fetch du dernier main.** Le chat d’origine garde seul la responsabilité de la fusion et du déploiement de 638. Son checkout de livraison et le Desktop restent intacts.

Chrome reste réservé à l’utilisateur. Seulement IAB Codex et CI navigateur hébergée, sans lancement de Playwright local. Aucune génération payante, aucun média/collection de client modifié, aucun secret/flag/protection changé. Les preuves de prod restent privées hors du dépôt.
