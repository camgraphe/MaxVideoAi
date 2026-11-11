# Pièces et essai : préparation locale

État au 11 novembre 2026. Cette page sert de feuille de travail ; aucun texte ci-dessous n'est publié.

## Pièces minimales

| Pièce | Déjà préparé ou disponible | À compléter |
| --- | --- | --- |
| Paquet plugin | ZIP 0.3.13 reproductible, description EN/FR/ES, capacités, logo, skills et endpoint MCP dédié | URL réelle de démonstration après essai ; reconstruire l'archive |
| Éditeur | Liens de site, support et identité du manifeste existant | Vérification de l'organisation dans le portail et challenge du domaine avec les pièces société existantes |
| Conditions et confidentialité | Registre du site, audit des conditions standard, ajout local d'OpenAI pour la génération d'images | Âge d'accès cohérent, routes effectivement utilisées, durées/effacement vérifiés, documents du compte quand une clause précise l'exige |
| Accès reviewer | Scénarios cinq positifs / trois négatifs rédigés dans `plugins/maxvideoai/openai-directory.json` | Compte dédié avec solde et médias, accès sans obstacle propre au reviewer ; ne jamais mettre les secrets dans le ZIP |
| Démonstration | Déroulé ci-dessous | Enregistrement issu du vrai essai, sans données privées de clients |
| OAuth/hébergement | Adaptateurs, domaine final configuré dans le code, canevas sans secrets, tests en mémoire | HTTPS, DNS/callback réel, PKCE/resource/refresh/révocation, ressources et workers dédiés ; chiffrage avant activation |

## Éligibilité : correction précise à finaliser

Le main indique encore 15 ans dans les CGU EN/FR/ES et 15/16 ans dans la confidentialité. Ce point entre en conflit avec les exigences explicites de Fal et Google. Il concerne déjà le service sous-jacent ; il n'est pas une règle ajoutée par peur de la marketplace.

Proposition de clause, à aligner avec le parcours d'inscription et les comptes existants avant publication :

- **FR :** « Vous devez avoir au moins 18 ans, ou l'âge de la majorité dans votre pays s'il est plus élevé, pour utiliser les fonctions de génération. »
- **EN :** “You must be at least 18 years old, or the age of legal majority in your country if higher, to use generation features.”
- **ES :** « Debes tener al menos 18 años, o la mayoría de edad en tu país si es superior, para utilizar las funciones de generación. »

Un changement de texte seul ne prouve pas le respect de la condition Google. La décision sur les comptes existants et le contrôle d'éligibilité doit être explicite. Cela n'impose pas par défaut de collecter des pièces d'identité pour tous les fournisseurs. Les exigences distinctes de BytePlus doivent être rattachées à sa route et à l'accord applicable.

## Démonstration à enregistrer dans l'environnement dédié

1. Connecter le compte MaxVideoAI dédié depuis ChatGPT. Montrer la connexion et l'accès au compte, sans afficher les secrets.
2. Planifier un film produit ; comparer deux options à paramètres comparables, distinguer estimation et devis.
3. Choisir un personnage/look enregistré ou une référence privée. Présenter le devis exact ; interrompre la séquence pour obtenir l'accord ; confirmer une seule tentative ; récupérer le même résultat.
4. Réouvrir un résultat et son téléchargement ; montrer qu'une reconnexion ne recrée rien.
5. Construire/modifier le montage Studio avec ses révisions, montrer le devis d'export, confirmer puis récupérer le film.
6. Tester l'audio et les sous-titres avec les prix réellement retournés ; modifier une légende, exporter VTT, chiffrer le burn-in sans promettre la gratuité.
7. Vérifier les refus ciblés : achat de crédits dans ChatGPT, média d'un autre compte, accord ambigu, rejeu après remboursement et modification sur révision périmée.

Les scénarios du manifeste sont la référence précise. Les tests locaux ont utilisé des fixtures ; ni la vidéo ni ces résultats hôte ne sont encore enregistrés. Pour respecter le budget, relever les devis de test et choisir les médias déjà disponibles avant d'autoriser les essais payants.

## Frontière externe

L'étape suivante consiste à raccorder l'essai dédié. Ne pas recopier un `.env` ou les ressources du checkout Desktop. Le fichier `environment.template` est un canevas, pas un mécanisme d'isolation effectif. Le dossier doit identifier exactement les projets, bases, stockage, workers, clés et coûts dédiés avant activation.

Aucun changement des bases habituelles ni de leur région n'est requis. Le domaine de qualification `openai-review.maxvideoai.com` et le domaine final `openai-mcp.maxvideoai.com` sont distincts : le ZIP final ne certifie pas le fonctionnement du domaine final avant ses vérifications réelles.
