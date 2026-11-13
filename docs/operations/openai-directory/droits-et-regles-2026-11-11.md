# Conditions utiles à la candidature — 11 novembre 2026

## Décision de travail

Nous préparons le service complet, sur les conditions standard applicables à chaque route. L'absence de PDF signé ou d'autorisation commerciale sur mesure n'est pas, à elle seule, une absence de contrat. En revanche, l'ouverture d'un compte ne supprime pas une restriction expressément écrite.

Fal via Vercel est confirmé par le propriétaire le 11 novembre. Les [conditions Marketplace Vercel](https://vercel.com/legal/integrations-marketplace-service-terms), §§3 et 5, distinguent le rôle de facturation de Vercel et le contrat avec le fournisseur, accepté lors de l'installation/activation/commande. Nous ne reclassons donc plus ce canal comme « fournisseur inconnu faute de contrat signé ».

## Ce que les concurrents montrent

[Krea documente son plugin ChatGPT et son MCP](https://www.krea.ai/plugins/chatgpt), et dispose d'une [fiche officielle OpenAI](https://openai.com/business/plugins/krea/). [Higgsfield documente une connexion ChatGPT/MCP utilisant les crédits du workspace](https://higgsfield.ai/enterprise-help-center/platform/integrations). Cela conforte le parcours compte existant + outils de création. Cela ne permet pas de connaître leurs accords privés, ni de transposer automatiquement chaque modèle de leur site à leur plugin.

## Routes du code actuel

Le registre contient 54 modèles publiés dans l'app, contre 49 dans la base de travail d'octobre. Cinq identités supplémentaires : Kling V4, Nano Banana 2.1, Kling V4 Flash et les deux GPT Image 2.6. Les politiques d'exécution/qualification restent indépendantes de ce statut.

Le champ de marque n'est pas le fournisseur contractuel : Kling/Luma/Google peuvent passer par Fal ou par une route directe. Les propriétaires techniques à consulter sont `frontend/src/server/video-providers/router.ts`, `frontend/src/server/agent-runtime/model-executability.ts`, les politiques image/audio et les conditions du compte effectivement raccordé. Aucun secret ni paramètre de production n'a été lu pour déduire une route active.

| Canal | Conclusion utilisable | Point précis avant diffusion |
| --- | --- | --- |
| **Fal via Vercel** | Les [conditions API Fal](https://fal.ai/legal/api-services) permettent une application cliente pour des utilisateurs finaux. Notre orchestration métier n'est pas automatiquement une revente de l'API brute. | Respecter les termes des modèles partenaires et les exceptions de traitement de données. Les [CGU Fal §2 et §4(b)](https://fal.ai/legal/terms-of-service) imposent 18 ans/majorité aux utilisateurs finaux et interdisent l'exposition directe des API du fournisseur. |
| **Google Vertex direct** | L'accord Cloud applicable au compte et ses annexes sont la base ; pas de contrat spécial « MCP » identifié. | Les [Service Specific Terms, Generative AI §20(d)](https://cloud.google.com/terms/service-terms) interdisent un service dirigé vers les moins de 18 ans ou susceptible d'être utilisé par eux. Il faut traiter l'éligibilité réelle, pas seulement changer une phrase. Le §17 encadre aussi les usages concurrents et le développement de modèles ; en préciser la portée pour la route utilisée. |
| **OpenAI API direct — ajouté à cet inventaire** | Les [Services Agreement §2.2](https://openai.com/policies/services-agreement/) permettent d'intégrer l'API dans une application pour ses clients ; le [DPA](https://openai.com/policies/data-processing-addendum/) est incorporé à l'accord. Le code prévoit déjà GPT Image 2.6 via `OPENAI_API_KEY`, en plus de l'assistance existante. | Actualiser le registre des traitements et utiliser le projet API adapté à l'essai. Les droits API et l'acceptation du plugin dans l'annuaire restent deux sujets distincts. |
| **BytePlus direct** | Les textes reconnaissent expressément les clients qui exploitent une plateforme. | Les [conditions spécifiques](https://docs.byteplus.com/en/docs/legal/docs-service-specific-terms), Model Services §2(1), excluent les États-Unis. Les [règles Platform Customers §§1–2](https://docs.byteplus.com/en/docs/ModelArk/2353368) encadrent les utilisateurs, l'authentification, les droits des références et la redistribution vers d'autres plateformes. Vérifier les conditions déjà acceptées et la portée de notre orchestration ; ne pas conclure automatiquement « tout MCP interdit » ou « tout autorisé ». |
| **Luma Agents direct** | La [FAQ officielle](https://docs.agents.lumalabs.ai/guides/faq/) décrit l'API PAYG et renvoie aux conditions API ; une négociation préalable n'est pas la voie d'accès ordinaire. | Les [conditions API §5](https://lumalabs.ai/legal/api-terms-of-use) visent notamment les benchmarks publics, la revente autonome et les produits concurrents. Ces clauses doivent être appliquées au service réellement offert, sans assimiler toute intégration à une API autonome revendue. |
| **Alibaba Model Studio direct** | L'usage accepte les [Product Terms §1.2](https://www.alibabacloud.com/help/en/legal/latest/product-terms). | Le §4.48.1(d)(v) encadre la revente et les produits concurrents ; une autorisation n'est requise que dans le cas couvert. Ne pas inventer une autorisation particulière pour chaque fonctionnalité, ni déclarer cette clause inapplicable sans analyser la route. |
| **Kling direct** | Conserver la distinction avec les modèles Kling servis par Fal. | L'[entrée officielle des conditions API](https://kling.ai/document-api/guides/protocols/paid-service) est accessible, mais son texte n'a pas été restitué par le lecteur web le 11 novembre. Les éléments archivés du 24 octobre ne sont donc pas présentés comme une relecture actuelle. Raccorder les termes du compte direct si cette route est utilisée pour l'essai. |

**Conclusion contractuelle :** Fal et OpenAI autorisent explicitement l'intégration cliente. Les autres routes ne sont ni retirées, ni déclarées autorisées sans réserve. Les questions restantes portent sur des clauses identifiées et leur application, pas sur six signatures à obtenir. Aucun fournisseur n'a été contacté.

Les accords de traitement des données restent utiles pour les références, images de personnes, prompts et résultats. Un DPA incorporé en ligne peut constituer la pièce contractuelle ; un formulaire spécifique n'est pas systématiquement nécessaire. Ne pas promettre une absence d'entraînement ou une suppression chez tous les partenaires si le texte applicable au modèle ne le prévoit pas. Le registre de traitement doit décrire les routes et les transferts effectifs.

## Règles OpenAI relues

Sources : [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines), [dépôt](https://developers.openai.com/plugins/deploy/submission), [revue et résidence du projet](https://developers.openai.com/plugins/deploy/app-review#metadata-stored-during-tool-scanning).

- Les droits déjà disponibles sur un compte payant peuvent être utilisés. Le canal ne doit pas vendre de crédits/abonnements numériques ni initier leur achat, y compris par redirection de paiement.
- Une page informative de prix/droits reste permise : le lien vers la page de prix de MaxVideoAI a été conservé. Il n'y a pas de supplément ChatGPT.
- Pas de réduction générale des fonctions de création : modèles, devis, génération, médias privés, Studio, exports, audio et personnages restent présents selon les capacités du serveur.
- Un serveur MCP fonctionnel ne vaut pas acceptation dans l'annuaire. L'identité de l'éditeur, les droits nécessaires, la confidentialité, OAuth et les accès de revue doivent correspondre au service réel.
- Le dépôt prévoit un ZIP, des cas de test, un compte utilisable par le reviewer et une démonstration. Aucune preuve d'exécution réelle n'est inventée.
- Le projet OpenAI doit actuellement être global ; cette condition concerne le projet de dépôt, pas la localisation de Neon/Supabase.

Les anciennes formulations qui faisaient d'une interprétation préalable du prépaiement ou de contrats personnalisés un verrou général ne gouvernent plus cette reprise. L'examen OpenAI reste souverain ; nous préparons un fonctionnement conforme aux règles publiques plutôt que de lui attribuer une acceptation anticipée.
