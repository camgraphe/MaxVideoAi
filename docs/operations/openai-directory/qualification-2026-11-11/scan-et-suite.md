# Scan OpenAI et suite — 11 novembre 2026

OAuth est établi sur le compte fictif du seul environnement dédié. Le portail
reconnaît 42 outils (41 publics, téléchargement privé pour l'interface), affiche
Configured/Authorized et le domaine vérifié. Aucun outil n'a été exécuté pour
produire un média et aucune soumission humaine n'a été lancée.

## Premier scan

| Outil | Constat du portail | Traitement |
| --- | --- | --- |
| `get_model_details` | La description paraît comparer/dénigrer des alternatives ou demander de préférer le plugin. | Une phrase interdisait de substituer une recherche web aux guides retournés. C'est une cause probable, pas une explication détaillée donnée par le scan. Le profil directory explique désormais la provenance et la distinction des sources, sans interdire un autre outil. Correction `95be72898`. |
| `list_audio_capabilities` | La nouvelle définition nécessite un examen supplémentaire avant publication. | Définition conservée ; catalogue en lecture seule, sans devis ni génération. Préparer les preuves d'exécution avant le dépôt. |
| `prepare_audio_generation` | Même demande d'examen supplémentaire. | Définition conservée ; validation d'une demande complète et devis exact, sans débit ni appel fournisseur. |
| `confirm_audio_generation` | Même demande d'examen supplémentaire. | Définition conservée ; accord explicite sur le devis frais, une tentative payante, récupération du job sur livraison répétée. |

Le filtre **Blocking** du panneau MCP n'affichait aucun item. Le formulaire de
revue signale séparément les accès reviewer et la vidéo manquants. Cela ne permet
pas de promettre l'acceptation ni d'interpréter les remarques audio comme une
interdiction de ces fonctions. Aucun contournement ni masquage des outils.

## Notes de revue préparées, non envoyées

- **Catalogue audio** : renvoie les modes réellement publiés, paramètres,
  disponibilité, rôles de références détenues par le compte et contrat de
  confirmation. Annotation `readOnlyHint: true`.
- **Préparation audio** : renvoie un devis court lié à la requête et au compte.
  Les références sont des actifs ou sorties possédés, jamais une URL arbitraire.
  La préparation ne débite pas le solde et ne contacte pas le fournisseur.
- **Confirmation audio** : annonce son effet financier et le recours à des
  fournisseurs externes (`readOnlyHint: false`, `destructiveHint: true`,
  `openWorldHint: true`). L'accord porte sur le prix exact et une seule tentative.
  Une remise/reconnexion ne renouvelle pas cet accord. La récupération évite une
  nouvelle soumission après une réponse ambiguë.

Ces points sont vérifiés dans les descripteurs et tests locaux. Avant de les
présenter comme des preuves de bout en bout, joindre la démonstration sur le
compte reviewer : catalogue, devis sans débit, refus sans accord puis génération
explicitement autorisée et récupération du même job. Aucun essai payant n'est
inclus dans la qualification OAuth actuelle.

## Résultat de la correction

Commit `95be72898e05ed1ec9c5e8d5fef168847c63c741`, uniquement une description du
profil OpenAI ; code des capacités et profil direct préservés. 17 contrats SDK
réussis, 214 tests MCP réussis (un ignoré), 70 scénarios de sélection réussis.
Descripteur maximal 1 939 octets, sous le plafond de 2 000. Build dédié
`dpl_FTEAU3LTzoEvTwuJpycAN5Kez2Ed` READY ; deux alias de test vérifiés. Le projet
habituel a annulé sa tentative sur cette branche.

Après redécouverte effective, OpenAI reçoit le nouveau texte et termine le scan
à **17:29:04 UTC**. `get_model_details` est **complete**, avec **zéro finding**.
Les 42 définitions ont un contrôle terminé ; cinq portent maintenant la demande
générique d'examen supplémentaire : les trois audio, `compare_generation_prices`
et `prepare_generation`. Le retour interne classe les trois audio `fail` et les
deux autres `needs_investigation`, sans evidence ni check précis. On ne peut donc
ni les présenter comme acceptés, ni déduire une interdiction de leur fonction.
Aucun retrait ni nouvelle modification spéculative.

Deux explications supplémentaires sont préparées :

- **Comparaison des prix** : compare les modèles compatibles du catalogue
  MaxVideoAI avec tarifs actuels, réglages divulgués et devises distinctes. Aucun
  devis, accès au portefeuille, débit ou appel de génération. Ne remplace pas
  implicitement le modèle choisi par l'utilisateur.
- **Préparation image/vidéo** : valide la demande sélectionnée et enregistre un
  devis court. Aucun débit ni génération ; le prix exact et les paramètres sont
  présentés avant l'accord explicite. Les références privées nécessaires doivent
  appartenir au compte ; un budget reste une estimation.

Le badge général du portail est **Configuration incomplete**, tandis que l'Auth
reste **Authorized**, le domaine vérifié et le scan terminé sans erreur runtime.
Le filtre Blocking n'affiche aucun item. Cette incohérence de présentation n'est
pas interprétée comme une validation de publication. Les accès reviewer, la vidéo
et les essais fonctionnels restent manquants. Les explications ci-dessus restent
locales : aucune demande de revue/recours envoyée.

Neon dédié est de nouveau **disabled / idle** à 17:30:52 UTC. Réactiver seulement
cet endpoint avant la prochaine session de qualification. Le hook Auth, limité au
client dédié, et le grant OpenAI autorisé restent en place.

## Ce qui reste avant dépôt

1. Compléter les preuves des cinq remarques de revue et qualifier renouvellement/révocation OAuth.
2. Raccorder uniquement les ressources de test pour les générations et exports,
   préparer médias/solde et exécuter les cinq scénarios positifs et trois négatifs.
3. Enregistrer la démonstration, renseigner les accès reviewer et réconcilier le
   nom du brouillon de diagnostic. La vidéo et les accès doivent fonctionner
   avant la soumission.
4. Intégrer le main courant dans un candidat contrôlé avant la livraison finale,
   puis demander l'accord de soumission. Publication seulement après acceptation
   et accord distinct. Les bases normales restent hors de ce chantier.

Preuves : `.local/openai-directory-20261111/evidence/openai-mcp-inspection.json`,
`openai-mcp-findings.json`, `oauth-audience-hook-checks.json`,
`post-oauth-database-counts.json` et journaux de tests. Les secrets sont exclus du
Git et du paquet de publication.

Preuves finales : `openai-final-scan-state.json`, `openai-mcp-inspection-after-description.json`, `openai-mcp-findings-after-description.json` et `openai-authorized-final-scan.jpg`.
