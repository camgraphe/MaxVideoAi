# D89 — Exemples, création et contrôle avant publication

15 septembre 2026. Branche `codex/site-redesign`, dans le worktree existant. Aucun merge, push, déploiement, accès DB ni génération payante.

## Direction et résultat

Adrien autorise le lot recommandé après D88 : galeries prioritaires, parcours de réutilisation, contrôle mobile et améliorations éditoriales ciblées. Il précise pendant le travail de ne pas empiler de sections ou dégrader le visuel : simplifier et améliorer simultanément composition et navigation.

- Une seule introduction visible au lieu de deux paragraphes répétitifs. Le texte complet reste dans « Notes sur la famille ». H1 conservant l’intention exemples/prompts/réglages, typographie et marges plus compactes.
- La preuve vidéo remonte, sans modifier source, poster, chargement ou commandes du lecteur.
- Deux actions sous le héros : **partir de cet exemple** et **voir réglages et prix**. Le bouton modèle doublon disparaît ; le nom du modèle reste un lien. Les cartes de galerie gardent leur lien vers la fiche vidéo.
- Le titre de la vidéo identifie le modèle exact, sans répéter l’introduction de la famille. Le prompt source devient consultable en FR/ES via le composant de disclosure existant, sans traduction fictive du prompt.
- Contraste du libellé superposé corrigé : l’ancienne classe `bg-white/92` ne produisait pas de fond ; fond blanc explicite.
- Sur les fiches vidéo, un bouton de création doublon retiré et formulation « Start from this example », avec distinction entre coût enregistré et prochain devis.

## Éditorial et maillage

LTX, Kling, Seedance, Wan, Veo, MiniMax/Hailuo et Luma relus EN/FR/ES. Introductions cumulées environ 32–34 % plus courtes. FR naturel et espagnol LATAM ; accents, formulations « sorties/workflows », jargon de routage/fournisseur dans Luma corrigés. Wan ne prétend plus que ses exemples sont majoritairement multi-plans sans preuve. FAQ centrée sur choix du modèle, réutilisation, références et prix.

LTX 2.5, Seedance 2.5, MiniMax H3, Kling 3, Wan 3/Prime et Veo 3.1 sont proposés dans les comparatifs de suite de parcours. Une sélection d’anciennes comparaisons reste disponible, notamment LTX 2.3 et Seedance 2.0/Fast. Aucune URL historique supprimée, aucun changement de publication du registre ou de sitemap.

Sur les titres EN, LTX devient « LTX Video Examples, Prompts & Settings | MaxVideoAI ». Les titres Kling, Seedance, Veo, Wan, MiniMax et Luma conservent leurs intentions et formulations existantes. La passe n’est pas un remplacement global des titres à partir du seul CTR. Les relevés GSC D85/D88 restent les données de priorité ; aucune nouvelle mesure de clics ni prévision de hausse.

## Parcours réel et mesure

Le CTA utilise le contrat existant `/app?from=<id>`. L’audit distingue les réglages disponibles d’un snapshot complet : le public permet de reprendre prompt, modèle, durée et ratio disponibles ; mode, résolution, audio et références ne sont pas tous présents. Les modèles courants ne permettent pas de reconstruire avec certitude ces réglages historiques. Le prix de l’exemple est distinct de celui calculé avant une nouvelle génération.

La continuation de connexion conserve la cible et le brouillon invité modifié par le mécanisme existant (token à usage unique, 30 minutes). Le code de devis conserve ses gardes de connexion et renouvelle le calcul avec les réglages. Pas de modification du tarif ni d’exécution automatique.

Deux corrections fonctionnelles issues du contrôle :

1. Le chargement échoué d’un exemple ne reste plus silencieux. Une notice EN/FR/ES explique que les réglages actuels sont conservés ; `from` reste disponible pour réessayer. Réponses obsolètes et changements de compte restent gardés.
2. Le GET vidéo pouvait retourner un média privé à partir de son identifiant. La réponse privée est désormais limitée au propriétaire, avec 404 identique pour une vidéo absente/non autorisée et `private, no-store`. Un partage public hors indexation reste lisible. Aucun snapshot privé supplémentaire exposé, PATCH inchangé. Ce défaut était aussi présent dans `origin/main` consulté.

Les CTA héros, galerie et fiche utilisent le pont analytics existant, avec libellés bornés `reuse_example`/`view_example_details` et emplacements dédiés. Tests de projection : pas de prompt, URL média ou identifiant d’exemple dans ces événements. Aucun nouveau tracker. La collecte reste soumise au consentement existant ; une hausse de conversion n’est pas encore mesurée.

Voir [l’audit détaillé de réutilisation](example-reuse-flow-audit-2026-09-15.md).

## Vérifications

- **115 tests ciblés passent** : routes/SEO galeries, médias, parcours analytics, continuation, hydratation, erreurs UI et contrôle d’accès vidéo.
- **21 routes de galeries EN/FR/ES** : HTTP 200, un H1, JSON-LD parseable, canonical/hreflang/robots identiques à la baseline de ce lot.
- **90 destinations de comparatifs** extraites de ces pages : HTTP 200 après suivi des redirections existantes.
- ESLint global, lint exposition et `git diff --check` passent ; build isolé baseline et candidat avec les contrôles prébuild.
- Tests d’accès/connexion sur fixtures locales : ils ne constituent pas une connexion réelle en préproduction.

Artefacts locaux ignorés : `qa/acquisition-d89/seo-routes.json`, `comparison-links.json`, `qa/performance-d89/` (rapports, logs et captures).

## Visuel et performances : ce qui est établi

| Galerie mobile, 390 × 844 | Début du visuel avant | Après | Écart |
| --- | ---: | ---: | ---: |
| LTX EN | 658 px | 375 px | −283 px |
| Kling EN | 707 px | 437 px | −270 px |

Même source/poster et lecteur. Aucun débordement sur les contrôles mobiles et desktop. Contrôles finaux FR LTX / ES Kling : contraste corrigé et deux CTA. Aucun nouveau script de page dans l’inventaire du build candidat ; variation gzip de l’ordre de 0,1 KB pour la galerie dans la comparaison intermédiaire.

Ces résultats montrent une meilleure composition et un budget de scripts stable, **pas une amélioration prouvée du LCP/INP/CLS**. Le snapshot public est volontairement limité au développement. Le build production isolé sans DB rend les galeries sans vidéos ; une mesure Lighthouse sur ces galeries vides serait trompeuse. Le navigateur de contrôle ne fournit pas ici le protocole cache/throttling nécessaire pour certifier une comparaison CWV.

## Avant publication

- Intégrer les changements récents de main dans une étape dédiée puis refaire le build de préproduction et la recette.
- Vérifier la réutilisation avec connexion réelle, références requises et devis sur une préproduction autorisée ; aucune génération payante nécessaire pour vérifier le devis et l’état prêt à générer.
- Vérifier sitemaps index/vidéo avec leur source DB : ils retournent normalement 503 dans l’environnement isolé actuel. Les quatre sitemaps sources EN/FR/ES/modèles répondent 200.
- Mesurer les mêmes vraies pages/médias sur deux builds, mobile/desktop, cache froid/chaud ; Safari/iOS reste à contrôler.
- Après publication, suivre premières générations réussies, inscription et recharge par page d’entrée/langue ; comparer GSC par requête et position avant d’attribuer un changement de CTR aux titres.

La preuve réelle de connexion MCP et la relecture exhaustive de toutes les familles restent des lots distincts. Aucune promesse de classement, de conversion ou de validation globale de tout le site.
