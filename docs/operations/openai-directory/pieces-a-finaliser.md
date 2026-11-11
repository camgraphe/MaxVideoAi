# Pièces et essai : préparation locale

État au 11 novembre 2026. Cette page sert de feuille de travail ; aucun texte ci-dessous n'est publié.

## Pièces minimales

| Pièce | Déjà préparé ou disponible | À compléter |
| --- | --- | --- |
| Paquet plugin | ZIP 0.3.13 reproductible téléversé en brouillon ; métadonnées sans anomalie ; description EN/FR/ES, capacités, logo, skills et endpoint MCP dédié | URL réelle de démonstration après essai ; reconstruire l'archive |
| Éditeur | Liens de site et support ; organisation MaxVideoAI accessible ; démarche Individual effectuée par le propriétaire, statut « Verified » confirmé dans Chrome à 14 h 40 Europe/Madrid | Compléter les vérifications de domaine demandées par le portail |
| Conditions et confidentialité | Registre du site, audit des conditions standard, ajout local d'OpenAI pour la génération d'images | 18 ans alignés localement ; qualifier le parcours d'effacement, les routes réellement raccordées et les clauses de compte identifiées |
| Accès reviewer | Scénarios cinq positifs / trois négatifs rédigés dans `plugins/maxvideoai/openai-directory.json` ; compte Auth fictif créé sur le projet dédié, mot de passe testé et session fermée | Héberger le site dédié, préparer les droits/solde et médias de test, qualifier OAuth et les scénarios ; ne jamais mettre les secrets dans le ZIP |
| Démonstration | Déroulé ci-dessous | Enregistrement issu du vrai essai, sans données privées de clients |
| OAuth/hébergement | Adaptateurs, domaine final configuré dans le code, canevas sans secrets, tests en mémoire | HTTPS, DNS/callback réel, PKCE/resource/refresh/révocation, ressources et workers dédiés ; chiffrage avant activation |

## Éligibilité : 18 ans préparés sur la branche

Décision du propriétaire du 11 novembre : service réservé aux adultes de 18 ans ou ayant atteint l'âge de la majorité dans leur pays si elle est supérieure.

- CGU et confidentialité EN/FR/ES alignées ; version documentaire candidate `2026-11-11`.
- Une seule constante pour le formulaire et la preuve serveur `min_age:18`, sans possibilité de conserver accidentellement l'ancien seuil par variable d'environnement.
- Les comptes qui n'ont que `min_age:15` doivent cocher une nouvelle confirmation. Le booléen historique `age_verified` ne prouve pas la majorité et n'est pas utilisé à cette fin.
- Les écritures de consentement utilisent l'identité authentifiée. Les inscriptions avec email à confirmer terminent le consentement après connexion. Le choix d'emails facultatifs est conservé comme brouillon dans le même navigateur et peut être corrigé avant sauvegarde ; ce brouillon ne vaut jamais preuve d'âge.
- Le formulaire OAuth demande la majorité avant d'accorder une nouvelle connexion ; le refus de connexion reste possible sans cocher la case. Une indisponibilité de l'enregistrement empêche l'émission du grant.
- Migration Neon `99_legal_adult_eligibility.sql` testée sur PostgreSQL 17 jetable ; jamais appliquée aux bases habituelles. Elle ne réécrit aucun consentement historique.

Il s'agit d'une attestation explicite, pas d'un contrôle de pièce d'identité ni d'une preuve qu'aucun mineur ne peut mentir. Aucun contrôle d'identité généralisé n'est ajouté par défaut. Les obligations particulières du compte BytePlus restent distinctes.

## Démonstration à enregistrer dans l'environnement dédié

1. Connecter le compte MaxVideoAI dédié depuis ChatGPT. Montrer la connexion et l'accès au compte, sans afficher les secrets.
2. Planifier un film produit ; comparer deux options à paramètres comparables, distinguer estimation et devis.
3. Choisir un personnage/look enregistré ou une référence privée. Présenter le devis exact ; interrompre la séquence pour obtenir l'accord ; confirmer une seule tentative ; récupérer le même résultat.
4. Réouvrir un résultat et son téléchargement ; montrer qu'une reconnexion ne recrée rien.
5. Construire/modifier le montage Studio avec ses révisions, montrer le devis d'export, confirmer puis récupérer le film.
6. Tester l'audio et les sous-titres avec les prix réellement retournés ; modifier une légende, exporter VTT, chiffrer le burn-in sans promettre la gratuité.
7. Vérifier les refus ciblés : achat de crédits dans ChatGPT, média d'un autre compte, accord ambigu, rejeu après remboursement et modification sur révision périmée.

Les scénarios du manifeste sont la référence précise. Les tests locaux ont utilisé des fixtures ; ni la vidéo ni ces résultats hôte ne sont encore enregistrés. Pour respecter le budget, relever les devis de test et choisir les médias déjà disponibles avant d'autoriser les essais payants.

## Essai dédié en cours

L'Auth dédié est restauré et le projet Vercel daté existe sans déploiement. Le [journal de qualification](qualification-2026-11-11/etat-essai.md) distingue ces actions des éléments encore manquants. Ne pas recopier un `.env` ou les ressources du checkout Desktop. Le fichier `environment.template` est un canevas, pas un mécanisme d'isolation effectif. Le dossier doit identifier exactement les projets, bases, stockage, workers, clés et coûts dédiés avant activation.

Aucun changement des bases habituelles ni de leur région n'est requis. Le domaine de qualification `openai-review.maxvideoai.com` et le domaine final `openai-mcp.maxvideoai.com` sont distincts : le ZIP final ne certifie pas le fonctionnement du domaine final avant ses vérifications réelles.
