# Récit produit — création directe, MCP, Studio et marques

9 septembre 2026. Le fil idée → référence → image → vidéo a reçu un accord de direction. Les propositions de placement ci-dessous restent à juger sur storyboard. Sources produit inspectées sur la base `bdd544e9f` ; aucun changement de publication effectué.

## Une promesse, deux voies de création

L'utilisateur peut travailler directement dans MaxVideoAI ou poursuivre son projet avec son assistant connecté. L'animation montre une même intention arriver à un résultat par ces deux voies, sans obliger à comprendre le terme MCP avant de saisir le bénéfice.

**Promesse éditoriale proposée : « Votre projet devient une vidéo. »** Sous-texte de travail : « Préparez votre création dans MaxVideoAI ou avec votre assistant connecté. Choisissez votre modèle, validez le prix, puis retrouvez le résultat dans votre bibliothèque. » À adapter au parcours effectivement démontré et aux possibilités de chaque hôte.

Ne pas représenter un champ URL fonctionnel sur le site si ce champ n'existe pas. Une démonstration avec URL doit être clairement une démonstration. Le site fourni sert de contexte à l'assistant ; le MCP n'est pas supposé aspirer automatiquement tous les médias d'un site ou garantir une vidéo finale montée.

## Scène MCP proposée : « Votre site. Votre assistant. Votre vidéo. »

| État | Visuel | Information à faire comprendre |
|---|---|---|
| 1 — Le projet | Aperçu d'un vrai site de démonstration, titre et image produit | Le point de départ existe déjà |
| 2 — La demande | Une phrase courte adressée à Codex ou Claude : « Prépare une vidéo de lancement à partir de ce site » | L'assistant utilise le contexte qu'il peut consulter ou que l'utilisateur lui partage |
| 3 — La proposition | Deux intentions visuelles ou deux moteurs adaptés, avec un résultat attendu | L'assistant conseille et prépare ; l'utilisateur garde le choix |
| 4 — La validation | Proposition retenue et prix visible | La génération payante se lance après validation, pas à l'insu du visiteur |
| 5 — Le résultat | La création prend la place de l'aperçu initial ; nom du moteur réellement utilisé | MaxVideoAI génère le média et le conserve dans la bibliothèque |

Mouvement : conserver le même sujet et des repères visuels d'un état à l'autre. Un seul trajet lumineux peut expliquer la liaison assistant → MaxVideoAI → résultat ; éviter une constellation de logos qui ne raconte pas l'action. Le prix reste lisible, pas une étape escamotée en quelques images.

Sur mobile, trois moments visibles suffisent : contexte partagé → proposition et validation → résultat. Les détails d'installation de chaque assistant restent sur sa page dédiée. L'animation ne doit pas rendre la génération artificiellement instantanée : indiquer que la démonstration condense le parcours si elle accélère une attente réelle.

## Placement recommandé

1. Conserver résultat, création directe et exemples au début de l'accueil, avec l'ordre mobile déjà contractuel.
2. Montrer la transformation suivie.
3. Introduire le MCP comme seconde voie de création, avant l'accumulation catalogue/galerie/tarifs. L'ordre exact avec les comparaisons sera jugé sur la page complète.
4. Donner un lien direct « Créer avec votre assistant » dans une navigation appropriée ; nommer MCP dans le libellé secondaire, le contenu indexable et les pages d'intégration.

Le MCP quitte ainsi la simple fin de page. Il reste visible même pour un visiteur qui ne termine pas toute la narration, sans passer devant la preuve principale sur mobile.

## Ce que les sources existantes établissent

| Source | Constat | Portée |
|---|---|---|
| `frontend/config/mcp-publication.json` | Marketing, indexation, transport, OAuth, génération et références activés ; trial, montagePreparation, audioGeneration, studioMontageCreation désactivés | Configuration authored de cette base ; ne prouve pas un essai récent dans chaque hôte |
| `docs/marketing/mcp-launch-evidence.md` | Lancement production et génération via connexion Codex documentés au 28 août ; limites de captures exactes par hôte précisées | Preuves historiques à rafraîchir pour les nouvelles captures |
| `frontend/components/marketing/home/HomeAssistantWorkflow.tsx` | Parcours projet/site/campagne déjà expliqué pour Claude, ChatGPT et Codex | Contenu à recomposer visuellement ; pas une nouvelle capacité à inventer |
| `docs/marketing/2026-09-05-mcp-project-demo.md` | Démo montre existante, image ImageGen et vidéo sélectionnée, provenance et encodage documentés | Candidat à réévaluer ; pas une validation de notre nouvelle direction |
| `docs/marketing/mcp-public-claims-matrix.md` | Plusieurs lignes indiquent encore MCP désactivé | Incohérence documentaire à réconcilier avec configuration, lancement et états actuels avant nouvelles affirmations publiques |

## Place du Studio

`frontend/content/feature-flags.ts` indique `studio.maxVideoAiEditor=true` et `studio.adminOnly=true`. `frontend/src/server/studio/access.ts` applique une politique d'accès administrateur. Le plan de release du 8 septembre prévoit explicitement cette validation privée. Nous ne changeons pas ces règles dans une refonte visuelle.

| Disponibilité confirmée au moment de publier | Place conseillée | Action honnête |
|---|---|---|
| Validation privée/admin | Hors promesse principale et hors CTA public de création | Éventuel aperçu éditorial identifié comme aperçu, seulement s'il a une utilité |
| Bêta sur invitation avec parcours d'accès opérationnel | Bloc secondaire sur le hub outils ou page dédiée | Demander l'accès si cette demande est réellement traitée |
| Bêta publique testée | Démonstration dans le parcours, état bêta visible | Essayer le Studio avec explication des limites |
| Disponibilité stabilisée | Évaluer son entrée dans le récit principal selon usages et conversion | Ouvrir le Studio |

Recommandation actuelle : construire une narration qui fonctionne avec la génération et le MCP disponibles ; prévoir un emplacement extensible pour le Studio. Ne pas attendre son lancement pour améliorer le site, ni vendre prématurément un montage/export complet.

## Logos : reconnaissance avec une fonction précise

- **Codex / Claude :** près du choix de l'assistant et de la démonstration MCP, liés à leurs pages d'intégration.
- **Kling / Seedance et autres moteurs retenus :** à côté du résultat qu'ils ont effectivement produit, puis dans le catalogue/comparatif. Montrer le nom de modèle et sa version utiles à la décision.
- **MaxVideoAI :** repère stable entre entrée, validation et bibliothèque ; ne pas laisser les logos tiers porter seuls la marque du site.

Une ligne statique bien composée est préférable à un bandeau de logos qui défile sans fin. Tailles corrigées optiquement, versions clair/sombre, marges et rendu net aux petites tailles ; nom accessible lorsque le logo est une action. Pas de duplication sonore logo + nom pour un lecteur d'écran.

Le dépôt contient déjà des assets Claude, OpenAI, Kling et ByteDance, ainsi que `frontend/src/lib/brand-partners.ts` et `engine-branding.ts`. Les politiques incluent des cas avec texte seul : les respecter. `HomeAssistantWorkflow` réutilise actuellement le même signe OpenAI pour ChatGPT et Codex : ne pas appeler cet asset « logo Codex officiel » sans vérification. Inventorier le signe exact et sa source officielle avant substitution ; ne pas générer de logos de marques avec ImageGen.

Les intitulés doivent décrire la relation exacte : « Créer depuis… », « Modèles disponibles… », « Généré avec… ». Ne pas transformer une intégration ou disponibilité en affirmation de partenariat ou d'approbation commerciale.

## Prochaine preuve attendue

Une fiche de démonstration site → assistant → vidéo, avec site de départ maîtrisé, hôte/version, parcours d'installation, contexte réellement utilisé, médias source, validation, résultat et limites. D'abord réutiliser les preuves et assets autorisés existants. Toute nouvelle génération sera proposée avec son devis, distinctement du travail de recherche.
