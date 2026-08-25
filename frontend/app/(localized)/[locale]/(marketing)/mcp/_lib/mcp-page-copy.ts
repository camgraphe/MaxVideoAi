import { localePathnames, type AppLocale } from '@/i18n/locales';
import { localizedSlugs } from '@/lib/i18nSlugs';
import type { McpClientActionCopy, McpPageCopy } from './mcp-page-types';

function localizedPath(locale: AppLocale, ...segments: string[]): string {
  const prefix = localePathnames[locale];
  return `/${[prefix, ...segments].filter(Boolean).join('/')}`;
}

function clientActions(
  locale: AppLocale,
  labels: { claude: string; codex: string; supporting: string },
): McpClientActionCopy[] {
  const integrations = localizedSlugs[locale].integrations;
  return [
    {
      client: 'claude',
      href: localizedPath(locale, integrations, 'claude'),
      label: labels.claude,
      supportingLabel: labels.supporting,
    },
    {
      client: 'codex',
      href: localizedPath(locale, integrations, 'codex'),
      label: labels.codex,
      supportingLabel: labels.supporting,
    },
  ];
}

const COPY: Record<AppLocale, McpPageCopy> = {
  en: {
    meta: {
      title: 'MaxVideoAI MCP for Claude, ChatGPT & Codex',
      description:
        'Model advice, budgets, private references, and tools to prepare and generate through the integration. Preview — host validation in progress; local implementation verified.',
    },
    breadcrumb: { home: 'Home', current: 'MaxVideoAI MCP' },
    hero: {
      eyebrows: {
        trial: 'FIRST VIDEO INCLUDED',
        budget: 'LOW-COST MODELS FIRST',
        price: 'PRICE BEFORE YOU GENERATE',
      },
      title: 'From brief to rendered video, inside your AI assistant.',
      intro:
        'MaxVideoAI helps Claude and Codex choose the right video model, prepare prompts and references, quote the exact cost, and generate only after you approve. Preview — host validation in progress; local implementation verified.',
      previewIntro:
        'MaxVideoAI helps Claude and Codex choose the right video model, prepare prompts and references, quote the exact cost, and generate only after you approve. Preview — host validation in progress; local implementation verified.',
      trialDisclosure:
        'One video is included for an eligible verified account: Seedance 2 Mini, 5 seconds, 480p. This promotion is separate from wallet funds and the regular balance.',
      actions: clientActions('en', {
        claude: 'Preview Claude setup',
        codex: 'Preview Codex setup',
        supporting: 'Review unverified setup',
      }),
      connectActions: {
        endpointLabel: 'Connection endpoint',
        copyEndpoint: 'Copy endpoint',
        copied: 'Endpoint copied. Continue with the setup guide for this client.',
        copyError: 'Unable to copy. Select the endpoint above and copy it manually.',
      },
    },
    workflow: {
      ariaLabel: 'AI video planning workflow',
      steps: [
        'Describe your video',
        'Compare the best low-cost routes',
        'Review budget and next steps',
      ],
    },
    budget: {
      eyebrow: 'Budget-first shortlist',
      title: 'Start with the lowest-cost model that fits the brief',
      intro:
        'These text-to-video scenarios use the current public model catalog and currently calculated price. Duration, resolution and audio behavior stay visible because they affect the choice.',
      slotLabels: {
        included_trial: 'Included trial',
        lowest_paid: 'Lowest paid route',
        affordable_upgrade: 'Affordable upgrade',
      },
      modelLinkLabel: 'Review model details',
      emptyTitle: 'Connected pricing is not published',
      emptyBody:
        'Use the MaxVideoAI web app to compare current public models and review the displayed price before generation.',
    },
    evidence: {
      eyebrow: 'Verified evidence',
      title: 'A result with settings, price and provenance',
      verifiedLabel: 'Last verified',
    },
    references: {
      eyebrow: 'Reference-aware planning',
      title: 'Carry the visual direction into a supported model',
      intro:
        'Reference images can anchor a character, product or composition when the chosen MaxVideoAI model accepts them.',
      planningBody:
        'The locally verified contract can help you plan prompts and visual references for a compatible client. Preview — host validation in progress; no Claude or Codex file behavior is verified.',
      liveBody:
        'When reference access is enabled, choose an account-owned image, an allowed web image, or a secure MaxVideoAI upload handoff, then review the selected asset before confirmation.',
      gatedBody:
        'Connected reference transfer is not publicly available. In the MaxVideoAI web app, add a reference image only when the selected model supports it.',
      steps: [
        { title: 'Define the visual anchor', body: 'Describe the subject, composition and details that should stay consistent.' },
        { title: 'Check model support', body: 'Compare only models whose current public facts support the required reference mode.' },
        { title: 'Review before generation', body: 'Confirm the chosen image, prompt, model settings and displayed price together.' },
      ],
    },
    answers: {
      eyebrow: 'Direct answers',
      title: 'What the local MCP preview verifies',
      updatedLabel: 'Local evidence checkpoint',
      items: {
        integration: {
          title: 'What does the MaxVideoAI integration do?',
          liveBody:
            'After separate host validation and publication, the MaxVideoAI MCP design could let a compatible client clarify an AI video brief, formulate the prompt and compare public models. This is intended behavior, not current Claude or Codex evidence.',
          gatedBody:
            'MaxVideoAI MCP is a local preview of planning, model comparison, budget, private-reference and quote contracts. It is designed for compatible AI clients, including Claude and Codex after host validation. Host connection and generation remain unverified, and the MaxVideoAI web product remains the place to review prices and generate.',
        },
        price: {
          title: 'How is the generation price calculated?',
          liveBody:
            'MaxVideoAI calculates a short-lived exact quote from the selected model, mode, duration, resolution, audio choice and supported reference inputs, using the current public pricing rules. The quote shows the settings and total before generation. A recommendation only compares model fit; it is not an exact quote and cannot spend the wallet.',
          gatedBody:
            'The MaxVideoAI web product calculates the displayed price from the selected model, mode, duration, resolution, audio choice and supported inputs before generation. The controlled MCP preview does not expose an exact quote or generation tool. A model recommendation is not an exact quote, so the current price must be reviewed in the web product.',
        },
        references: {
          title: 'Which reference images work?',
          liveBody:
            'After separate host validation and publication, a reference could come from an account-owned MaxVideoAI asset, an allowed HTTPS image or a secure upload handoff. No Claude or Codex file behavior is currently verified.',
          gatedBody:
            'Connected reference transfer is not publicly enabled. The local contract covers subject, composition and consistency planning, but no Claude or Codex creation or transfer behavior is verified. Use the MaxVideoAI web product for supported references.',
        },
        confirmation: {
          title: 'Why is confirmation a separate step?',
          liveBody:
            'A separate confirmation keeps model selection and spending distinct. MaxVideoAI first returns the exact settings, total and projected account effect; only a later confirmation may accept the generation. The server still applies ownership, spending-limit and idempotency checks, so reviewing a recommendation or quote cannot start a paid job by itself.',
          gatedBody:
            'Separate confirmation is the approved safety design for future paid MCP generation: first review the model, settings and exact price, then explicitly approve the spend. Paid MCP generation is not publicly enabled today. In the current web product, the displayed price is reviewed before the person submits the generation.',
        },
        disconnect: {
          title: 'How do I disconnect MaxVideoAI?',
          liveBody:
            'Remove MaxVideoAI from the client, then open MaxVideoAI account connections and revoke that client authorization. Revocation ends the saved grant; a later protected action must start a new browser approval. Removing the client entry and revoking the account grant are separate actions, so complete both steps.',
          gatedBody:
            'For a future controlled test connection, the documented procedure is to remove MaxVideoAI from the client and revoke its authorization from MaxVideoAI account connections. A later protected action should then require a new approval. Actual host behavior remains unverified; this local procedure is not a claim that public connection is available in any client.',
        },
      },
    },
    trust: {
      definition: {
        eyebrow: 'What it is',
        title: 'The conversational continuation of MaxVideoAI',
        body:
          'Continue from MaxVideoAI comparison pages, examples, live pricing and pay-as-you-go credits into an assistant conversation. The assistant carries the brief; MaxVideoAI remains responsible for executable model facts, prices, validation, generation and results.',
      },
      availability: {
        title: 'Availability',
        liveBody:
          'The public workflow is enabled for the capabilities shown on this page. Client-specific limitations still apply.',
        gatedBody:
          'The public connection is disabled while generation, trial and reference flows complete their release checks. The setup guides document controlled evidence, not general availability.',
      },
      compatibility: {
        title: 'Client compatibility checkpoint',
        body:
          'Local package and protocol checks are recorded. Hosted installation, OAuth, rendering, refresh and tool selection remain unverified for every listed client.',
        checkpointLabel: 'Local evidence checkpoint',
        sourceLabel: 'Compatibility evidence',
        statuses: {
          claudeDesktop: 'Hosted compatibility is unverified. Only local package structure and protocol contracts are recorded.',
          claudeCode: 'Hosted compatibility is unverified. Only local adapter structure and protocol contracts are recorded.',
          codexCli: 'Hosted compatibility is unverified. Only local package structure and protocol contracts are recorded.',
        },
      },
      confirmation: {
        title: 'Price review and explicit confirmation',
        liveBody:
          'MaxVideoAI prepares an exact, short-lived quote for the chosen prompt, model, settings and references. Generation starts only after a separate confirmation, then the accepted job and result remain available in MaxVideoAI.',
        gatedBody:
          'The web product already shows the price before generation. Connected quote and confirmation are not publicly enabled, so this page does not present them as available actions.',
        steps: ['Compare model trade-offs', 'Review the exact price and settings', 'Confirm once, then follow the result in MaxVideoAI'],
      },
      controls: {
        title: 'Permissions, privacy and spending control',
        body:
          'A connection should expose only the account access needed for the selected workflow. MaxVideoAI enforces ownership and account rules on every request.',
        items: [
          'Private prompts and reference URLs stay out of acquisition analytics.',
          'A separate confirmation protects each paid generation; account spending limits remain an additional safeguard.',
          'Connections can be removed from MaxVideoAI account settings after public access is enabled.',
        ],
      },
      capabilities: {
        title: 'Four safeguards from decision to result',
        body: 'MCP installation, discovery, recommendations and estimates are free. Generation uses your existing MaxVideoAI credits at pay-as-you-go prices, with no separate MCP subscription. Preview — host validation in progress.',
        items: [
          'Choose the best executable model for each shot from current model facts.',
          'See the exact price before any credit is spent.',
          'Validate parameters and private references before submission.',
          'Require explicit confirmation, then track job status and recovery; credits for definitive failed jobs are refunded automatically.',
        ],
      },
      setup: {
        title: 'Review a client-specific setup preview',
        body:
          'The Claude and Codex guides document intended setup procedures only. No hosted-client evidence for browser authorization, refresh, rendering, revocation or generation is claimed before Task 10 validation.',
      },
      faq: {
        title: 'Questions before you connect',
        items: [
          {
            question: 'Does the assistant choose the model automatically?',
            answer: 'It can help compare a shortlist, but the recommendation must use current MaxVideoAI facts and you can choose a different compatible model.',
          },
          {
            question: 'Will I see the price first?',
            answer: 'The MaxVideoAI web product shows the displayed price before generation. The connected flow will offer the same review-and-confirm pattern only after it is publicly available.',
          },
          {
            question: 'Can every model use reference images or audio?',
            answer: 'No. Reference and audio support depend on the selected model and scenario, and the visible settings should state what is included.',
          },
        ],
      },
      support: { label: 'Contact MaxVideoAI support', href: '/contact' },
    },
  },
  fr: {
    meta: {
      title: 'MCP MaxVideoAI pour Claude, ChatGPT et Codex',
      description:
        'Conseils sur les modèles, budgets et références privées pour préparer et générer via l’intégration. Préversion — validation des hôtes en cours ; implémentation locale vérifiée.',
    },
    breadcrumb: { home: 'Accueil', current: 'MCP MaxVideoAI' },
    hero: {
      eyebrows: {
        trial: 'PREMIÈRE VIDÉO INCLUSE',
        budget: 'MODÈLES ÉCONOMIQUES EN PREMIER',
        price: 'PRIX AVANT DE GÉNÉRER',
      },
      title: 'Du brief à la vidéo rendue, directement dans votre assistant IA.',
      intro:
        'MaxVideoAI aide Claude et Codex à choisir le bon modèle vidéo, préparer les prompts et les références, calculer le prix exact et générer uniquement après votre approbation. Préversion — validation des hôtes en cours ; implémentation locale vérifiée.',
      previewIntro:
        'MaxVideoAI aide Claude et Codex à choisir le bon modèle vidéo, préparer les prompts et les références, calculer le prix exact et générer uniquement après votre approbation. Préversion — validation des hôtes en cours ; implémentation locale vérifiée.',
      trialDisclosure:
        'Une vidéo est incluse pour un compte admissible et vérifié : Seedance 2 Mini, 5 secondes, 480p. Cette offre promotionnelle est distincte des fonds du portefeuille et du solde habituel.',
      actions: clientActions('fr', {
        claude: 'Voir la configuration Claude',
        codex: 'Voir la configuration Codex',
        supporting: 'Consulter la configuration non vérifiée',
      }),
      connectActions: {
        endpointLabel: 'Adresse de connexion',
        copyEndpoint: 'Copier l’adresse',
        copied: 'Adresse copiée. Poursuivez avec le guide de configuration de ce client.',
        copyError: 'Copie impossible. Sélectionnez l’adresse ci-dessus et copiez-la manuellement.',
      },
    },
    workflow: {
      ariaLabel: 'Parcours de préparation d’une vidéo IA',
      steps: [
        'Décrivez votre vidéo',
        'Comparez les meilleures options économiques',
        'Vérifiez le budget et les étapes suivantes',
      ],
    },
    budget: {
      eyebrow: 'Sélection axée sur le budget',
      title: 'Commencez par le modèle le moins cher adapté au brief',
      intro:
        'Ces scénarios texte-vers-vidéo utilisent le catalogue public actuel et le prix actuellement calculé. La durée, la résolution et le comportement audio restent visibles pour éclairer le choix.',
      slotLabels: {
        included_trial: 'Essai inclus',
        lowest_paid: 'Option payante la moins chère',
        affordable_upgrade: 'Alternative accessible',
      },
      modelLinkLabel: 'Voir les détails du modèle',
      emptyTitle: 'Les tarifs connectés ne sont pas publiés',
      emptyBody:
        'Utilisez l’application web MaxVideoAI pour comparer les modèles publics actuels et vérifier le prix affiché avant la génération.',
    },
    evidence: {
      eyebrow: 'Preuve vérifiée',
      title: 'Un résultat accompagné de ses réglages, de son prix et de sa provenance',
      verifiedLabel: 'Dernière vérification',
    },
    references: {
      eyebrow: 'Préparation avec références',
      title: 'Conservez la direction visuelle avec un modèle compatible',
      intro:
        'Les images de référence peuvent ancrer un personnage, un produit ou une composition lorsque le modèle MaxVideoAI choisi les accepte.',
      planningBody:
        'Le contrat vérifié localement définit la planification du prompt et des références visuelles pour un client compatible après validation des hôtes. Aucun comportement de fichier Claude ou Codex n’est vérifié.',
      liveBody:
        'Lorsque l’accès aux références est activé, choisissez une image liée à votre compte, une image web autorisée ou un transfert sécurisé MaxVideoAI, puis vérifiez la ressource avant confirmation.',
      gatedBody:
        'Le transfert connecté de références n’est pas disponible publiquement. Dans l’application web MaxVideoAI, ajoutez une image de référence uniquement si le modèle choisi la prend en charge.',
      steps: [
        { title: 'Définissez le repère visuel', body: 'Décrivez le sujet, la composition et les détails qui doivent rester cohérents.' },
        { title: 'Vérifiez la compatibilité', body: 'Comparez uniquement les modèles dont les données publiques prennent en charge le mode de référence requis.' },
        { title: 'Relisez avant de générer', body: 'Confirmez ensemble l’image, le prompt, les réglages du modèle et le prix affiché.' },
      ],
    },
    answers: {
      eyebrow: 'Réponses directes',
      title: 'Ce que vérifie la préversion MCP locale',
      updatedLabel: 'Point de contrôle local',
      items: {
        integration: {
          title: 'Que fait l’intégration MaxVideoAI ?',
          liveBody:
            'Après validation des hôtes et publication distinctes, le MCP MaxVideoAI pourrait permettre à un client compatible de clarifier un brief, de formuler le prompt et de comparer les modèles publics. Il s’agit d’un comportement prévu, pas d’une preuve Claude ou Codex actuelle.',
          gatedBody:
            'Le MCP MaxVideoAI est une préversion locale des contrats de planification, de comparaison des modèles, de budget, de références privées et de devis. Il est conçu pour des clients IA compatibles, dont Claude et Codex après validation des hôtes. La connexion aux hôtes et la génération restent non vérifiées ; le produit web MaxVideoAI reste l’endroit où vérifier les prix et générer.',
        },
        price: {
          title: 'Comment le prix de génération est-il calculé ?',
          liveBody:
            'MaxVideoAI calcule un devis exact et temporaire à partir du modèle, du mode, de la durée, de la résolution, du choix audio et des références compatibles, selon les règles tarifaires publiques actuelles. Le devis affiche les réglages et le total avant la génération. Une recommandation compare seulement l’adéquation des modèles ; ce n’est pas un devis exact et elle ne peut pas débiter le portefeuille.',
          gatedBody:
            'Le produit web MaxVideoAI calcule le prix affiché à partir du modèle, du mode, de la durée, de la résolution, du choix audio et des entrées compatibles avant la génération. L’aperçu MCP contrôlé ne fournit ni devis exact ni outil de génération. Une recommandation de modèle n’est pas un devis exact ; le prix actuel doit donc être vérifié dans le produit web.',
        },
        references: {
          title: 'Quelles images de référence sont acceptées ?',
          liveBody:
            'Après validation des hôtes et publication distinctes, une référence pourrait provenir d’une ressource MaxVideoAI liée au compte, d’une image HTTPS autorisée ou d’un transfert sécurisé. Aucun comportement de fichier Claude ou Codex n’est actuellement vérifié.',
          gatedBody:
            'Le transfert connecté de références n’est pas activé publiquement. Le contrat local couvre la planification du sujet, de la composition et de la cohérence, mais aucun comportement de création ou de transfert Claude ou Codex n’est vérifié. Utilisez le produit web MaxVideoAI.',
        },
        confirmation: {
          title: 'Pourquoi la confirmation est-elle séparée ?',
          liveBody:
            'Une confirmation séparée distingue le choix du modèle de la dépense. MaxVideoAI présente d’abord les réglages exacts, le total et l’effet prévu sur le compte ; seule une confirmation ultérieure peut accepter la génération. Le serveur applique encore les contrôles de propriété, de limite de dépenses et d’idempotence, donc consulter un devis ne peut pas lancer seul un job payant.',
          gatedBody:
            'La confirmation séparée est la règle de sécurité prévue pour une future génération MCP payante : vérifiez d’abord le modèle, les réglages et le prix exact, puis approuvez explicitement la dépense. La génération MCP payante n’est pas activée publiquement. Dans le produit web actuel, le prix affiché est vérifié avant l’envoi de la génération.',
        },
        disconnect: {
          title: 'Comment déconnecter MaxVideoAI ?',
          liveBody:
            'Supprimez MaxVideoAI du client, puis ouvrez les connexions du compte MaxVideoAI et révoquez l’autorisation du client. La révocation ferme l’accès enregistré ; une future action protégée doit ouvrir une nouvelle approbation dans le navigateur. La suppression côté client et la révocation côté compte sont deux actions distinctes, à effectuer toutes les deux.',
          gatedBody:
            'Pour une future connexion de test contrôlée, la procédure documentée consiste à supprimer MaxVideoAI du client puis à révoquer son autorisation depuis les connexions du compte MaxVideoAI. Une future action protégée doit ensuite demander une nouvelle approbation. Le comportement réel des hôtes reste non vérifié ; cette procédure locale ne signifie pas que la connexion publique est disponible dans un client.',
        },
      },
    },
    trust: {
      definition: {
        eyebrow: 'Définition',
        title: 'La continuité conversationnelle de MaxVideoAI',
        body:
          'Passez des comparatifs, exemples, tarifs en direct et crédits à l’usage de MaxVideoAI à une conversation dans votre assistant. L’assistant poursuit le brief ; MaxVideoAI reste responsable des modèles exécutables, des prix, de la validation, de la génération et des résultats.',
      },
      availability: {
        title: 'Disponibilité',
        liveBody: 'Le parcours public est activé pour les fonctions présentées sur cette page. Des limites propres à chaque client subsistent.',
        gatedBody:
          'La connexion publique reste désactivée pendant la validation des parcours de génération, d’essai et de références. Les guides décrivent des preuves contrôlées, pas une disponibilité générale.',
      },
      compatibility: {
        title: 'Point de contrôle de compatibilité client',
        body:
          'Les contrôles locaux du paquet et du protocole sont documentés. L’installation hébergée, OAuth, le rendu, l’actualisation et la sélection des outils restent non vérifiés pour chaque client affiché.',
        checkpointLabel: 'Point de contrôle local',
        sourceLabel: 'Preuve de compatibilité',
        statuses: {
          claudeDesktop: 'La compatibilité hébergée reste non vérifiée. Seuls la structure locale du paquet et les contrats de protocole sont documentés.',
          claudeCode: 'La compatibilité hébergée reste non vérifiée. Seuls la structure locale de l’adaptateur et les contrats de protocole sont documentés.',
          codexCli: 'La compatibilité hébergée reste non vérifiée. Seuls la structure locale du paquet et les contrats de protocole sont documentés.',
        },
      },
      confirmation: {
        title: 'Vérification du prix et confirmation explicite',
        liveBody:
          'MaxVideoAI prépare un devis exact et temporaire pour le prompt, le modèle, les réglages et les références choisis. La génération commence après une confirmation séparée, puis la tâche et le résultat restent accessibles dans MaxVideoAI.',
        gatedBody:
          'Le produit web affiche déjà le prix avant la génération. Le devis et la confirmation connectés ne sont pas activés publiquement et ne sont donc pas présentés comme des actions disponibles.',
        steps: ['Comparez les compromis entre modèles', 'Vérifiez le prix exact et les réglages', 'Confirmez une fois, puis suivez le résultat dans MaxVideoAI'],
      },
      controls: {
        title: 'Autorisations, confidentialité et contrôle des dépenses',
        body:
          'Une connexion ne doit donner accès qu’aux éléments nécessaires au parcours choisi. MaxVideoAI applique les règles de propriété et de compte à chaque requête.',
        items: [
          'Les prompts privés et les URL de références restent exclus des mesures d’acquisition.',
          'Une confirmation séparée protège chaque génération payante ; les limites de dépenses du compte ajoutent une protection.',
          'Les connexions pourront être supprimées dans les réglages du compte MaxVideoAI après l’ouverture publique.',
        ],
      },
      capabilities: {
        title: 'Quatre garanties, de la décision au résultat',
        body: 'L’installation MCP, la découverte, les recommandations et les estimations sont gratuites. La génération utilise vos crédits MaxVideoAI existants avec une tarification à l’usage, sans aucun abonnement MCP distinct. Préversion — validation des hôtes en cours.',
        items: [
          'Choisir le meilleur modèle exécutable pour chaque plan à partir des données actuelles.',
          'Voir le prix exact avant de dépenser le moindre crédit.',
          'Valider les paramètres et les références privées avant l’envoi.',
          'Exiger une confirmation explicite, puis suivre l’état et la récupération ; les crédits des échecs définitifs sont remboursés automatiquement.',
        ],
      },
      setup: {
        title: 'Consultez un aperçu de configuration par client',
        body:
          'Les guides Claude et Codex décrivent uniquement des procédures prévues. Aucune preuve en client hébergé pour l’autorisation, l’actualisation, le rendu, la révocation ou la génération n’est revendiquée avant la validation Task 10.',
      },
      faq: {
        title: 'Questions avant la connexion',
        items: [
          { question: 'L’assistant choisit-il automatiquement le modèle ?', answer: 'Il peut aider à comparer une sélection, mais la recommandation doit reposer sur les données actuelles de MaxVideoAI et vous pouvez choisir un autre modèle compatible.' },
          { question: 'Vais-je voir le prix avant ?', answer: 'Le produit web MaxVideoAI affiche le prix avant la génération. Le parcours connecté reprendra cette vérification et cette confirmation uniquement après validation de sa mise en ligne.' },
          { question: 'Tous les modèles acceptent-ils les références ou l’audio ?', answer: 'Non. La prise en charge des références et de l’audio dépend du modèle et du scénario, et les réglages visibles doivent préciser ce qui est inclus.' },
        ],
      },
      support: { label: 'Contacter l’assistance MaxVideoAI', href: '/fr/contact' },
    },
  },
  es: {
    meta: {
      title: 'MCP de MaxVideoAI para Claude, ChatGPT y Codex',
      description:
        'Asesoramiento sobre modelos, presupuestos, referencias privadas y herramientas para preparar y generar mediante la integración. Vista previa — validación de clientes en curso; implementación local verificada.',
    },
    breadcrumb: { home: 'Inicio', current: 'MCP de MaxVideoAI' },
    hero: {
      eyebrows: {
        trial: 'PRIMER VIDEO INCLUIDO',
        budget: 'MODELOS DE BAJO COSTO PRIMERO',
        price: 'PRECIO ANTES DE GENERAR',
      },
      title: 'Del brief al video renderizado, directamente en tu asistente de IA.',
      intro:
        'MaxVideoAI ayuda a Claude y Codex a elegir el modelo de video adecuado, preparar prompts y referencias, calcular el precio exacto y generar solo después de tu aprobación. Vista previa — validación de clientes en curso; implementación local verificada.',
      previewIntro:
        'MaxVideoAI ayuda a Claude y Codex a elegir el modelo de video adecuado, preparar prompts y referencias, calcular el precio exacto y generar solo después de tu aprobación. Vista previa — validación de clientes en curso; implementación local verificada.',
      trialDisclosure:
        'Se incluye un video para una cuenta apta y verificada: Seedance 2 Mini, 5 segundos, 480p. Esta promoción es independiente de los fondos de la cartera y del saldo habitual.',
      actions: clientActions('es', {
        claude: 'Ver configuración de Claude',
        codex: 'Ver configuración de Codex',
        supporting: 'Revisar configuración sin verificar',
      }),
      connectActions: {
        endpointLabel: 'Dirección de conexión',
        copyEndpoint: 'Copiar dirección',
        copied: 'Dirección copiada. Continúa con la guía de configuración de este cliente.',
        copyError: 'No se pudo copiar. Selecciona la dirección anterior y cópiala manualmente.',
      },
    },
    workflow: {
      ariaLabel: 'Flujo de preparación de video con IA',
      steps: [
        'Describe tu video',
        'Compara las mejores opciones de bajo costo',
        'Revisa el presupuesto y los siguientes pasos',
      ],
    },
    budget: {
      eyebrow: 'Selección centrada en el presupuesto',
      title: 'Empieza con el modelo de menor costo que se ajuste a la idea',
      intro:
        'Estos escenarios de texto a video usan el catálogo público actual y el precio calculado actualmente. La duración, la resolución y el comportamiento del audio siguen visibles porque influyen en la decisión.',
      slotLabels: {
        included_trial: 'Prueba incluida',
        lowest_paid: 'Ruta pagada de menor costo',
        affordable_upgrade: 'Mejora accesible',
      },
      modelLinkLabel: 'Revisar detalles del modelo',
      emptyTitle: 'Los precios conectados no están publicados',
      emptyBody:
        'Usa la aplicación web de MaxVideoAI para comparar los modelos públicos actuales y revisar el precio mostrado antes de generar.',
    },
    evidence: {
      eyebrow: 'Evidencia verificada',
      title: 'Un resultado con ajustes, precio y procedencia',
      verifiedLabel: 'Última verificación',
    },
    references: {
      eyebrow: 'Planificación con referencias',
      title: 'Lleva la dirección visual a un modelo compatible',
      intro:
        'Las imágenes de referencia pueden fijar un personaje, producto o composición cuando el modelo elegido de MaxVideoAI las admite.',
      planningBody:
        'El contrato verificado localmente define la planificación del prompt y las referencias visuales para un cliente compatible después de validar los hosts. No se ha verificado ningún comportamiento de archivos de Claude o Codex.',
      liveBody:
        'Cuando el acceso a referencias esté habilitado, elige una imagen de tu cuenta, una imagen web permitida o una transferencia segura de MaxVideoAI y revísala antes de confirmar.',
      gatedBody:
        'La transferencia conectada de referencias no está disponible públicamente. En la aplicación web de MaxVideoAI, agrega una imagen de referencia solo cuando el modelo elegido la admita.',
      steps: [
        { title: 'Define el ancla visual', body: 'Describe el sujeto, la composición y los detalles que deben mantenerse consistentes.' },
        { title: 'Comprueba la compatibilidad', body: 'Compara solo modelos cuyos datos públicos admitan el modo de referencia requerido.' },
        { title: 'Revisa antes de generar', body: 'Confirma en conjunto la imagen, el prompt, los ajustes del modelo y el precio mostrado.' },
      ],
    },
    answers: {
      eyebrow: 'Respuestas directas',
      title: 'Qué verifica la vista previa MCP local',
      updatedLabel: 'Control local de evidencia',
      items: {
        integration: {
          title: '¿Qué hace la integración de MaxVideoAI?',
          liveBody:
            'Después de validar los hosts y publicar por separado, el diseño MCP de MaxVideoAI podría permitir que un cliente compatible aclare una idea, formule el prompt y compare modelos públicos. Es un comportamiento previsto, no evidencia actual de Claude o Codex.',
          gatedBody:
            'El MCP de MaxVideoAI es una vista previa local de los contratos de planificación, comparación de modelos, presupuesto, referencias privadas y cotizaciones. Está diseñado para clientes de IA compatibles, incluidos Claude y Codex cuando termine la validación de los hosts. La conexión con hosts y la generación siguen sin verificar; el producto web de MaxVideoAI sigue siendo el lugar para revisar precios y generar.',
        },
        price: {
          title: '¿Cómo se calcula el precio de generación?',
          liveBody:
            'MaxVideoAI calcula una cotización exacta y temporal a partir del modelo, modo, duración, resolución, opción de audio y referencias compatibles, según las reglas públicas de precios vigentes. La cotización muestra los ajustes y el total antes de generar. Una recomendación solo compara la adecuación de modelos; no es una cotización exacta y no puede gastar fondos de la billetera.',
          gatedBody:
            'El producto web de MaxVideoAI calcula el precio mostrado a partir del modelo, modo, duración, resolución, opción de audio y entradas compatibles antes de generar. La vista previa controlada del MCP no ofrece una cotización exacta ni una herramienta de generación. Una recomendación de modelo no es una cotización exacta, así que el precio actual debe revisarse en el producto web.',
        },
        references: {
          title: '¿Qué imágenes de referencia funcionan?',
          liveBody:
            'Después de validar los hosts y publicar por separado, una referencia podría proceder de un recurso de MaxVideoAI asociado a la cuenta, una imagen HTTPS permitida o una transferencia segura. No se ha verificado ningún comportamiento de archivos de Claude o Codex.',
          gatedBody:
            'La transferencia conectada de referencias no está habilitada públicamente. El contrato local cubre la planificación del sujeto, la composición y la consistencia, pero no se ha verificado ningún comportamiento de creación o transferencia de Claude o Codex. Usa el producto web de MaxVideoAI.',
        },
        confirmation: {
          title: '¿Por qué la confirmación es un paso separado?',
          liveBody:
            'Una confirmación separada distingue la elección del modelo del gasto. MaxVideoAI muestra primero los ajustes exactos, el total y el efecto previsto en la cuenta; solo una confirmación posterior puede aceptar la generación. El servidor todavía aplica controles de propiedad, límite de gasto e idempotencia, por lo que revisar una cotización no inicia por sí solo un trabajo pagado.',
          gatedBody:
            'La confirmación separada es el diseño de seguridad aprobado para una futura generación MCP pagada: primero revisa el modelo, los ajustes y el precio exacto, y después aprueba el gasto de forma explícita. La generación MCP pagada no está habilitada públicamente. En el producto web actual, el precio mostrado se revisa antes de enviar la generación.',
        },
        disconnect: {
          title: '¿Cómo desconecto MaxVideoAI?',
          liveBody:
            'Elimina MaxVideoAI del cliente y después abre las conexiones de la cuenta de MaxVideoAI para revocar la autorización de ese cliente. La revocación termina el acceso guardado; una acción protegida posterior debe abrir una nueva aprobación en el navegador. Eliminar la entrada del cliente y revocar el acceso en la cuenta son acciones distintas, por lo que debes completar ambas.',
          gatedBody:
            'Para una futura conexión de prueba controlada, el procedimiento documentado consiste en eliminar MaxVideoAI del cliente y revocar su autorización desde las conexiones de la cuenta de MaxVideoAI. Una acción protegida posterior deberá solicitar una aprobación nueva. El comportamiento real de los hosts sigue sin verificar; este procedimiento local no implica que la conexión pública esté disponible en ningún cliente.',
        },
      },
    },
    trust: {
      definition: {
        eyebrow: 'Qué es',
        title: 'La continuación conversacional de MaxVideoAI',
        body:
          'Pasa de las comparativas, ejemplos, precios en vivo y créditos de pago por uso de MaxVideoAI a una conversación en tu asistente. El asistente continúa el brief; MaxVideoAI sigue a cargo de los modelos ejecutables, los precios, la validación, la generación y los resultados.',
      },
      availability: {
        title: 'Disponibilidad',
        liveBody: 'El flujo público está habilitado para las funciones que aparecen en esta página. Todavía pueden aplicarse límites específicos de cada cliente.',
        gatedBody:
          'La conexión pública permanece deshabilitada mientras terminan las revisiones de generación, prueba y referencias. Las guías documentan evidencia controlada, no disponibilidad general.',
      },
      compatibility: {
        title: 'Control de compatibilidad del cliente',
        body:
          'Están documentadas las comprobaciones locales del paquete y del protocolo. La instalación alojada, OAuth, el renderizado, la renovación y la selección de herramientas siguen sin verificar para todos los clientes mostrados.',
        checkpointLabel: 'Control local de evidencia',
        sourceLabel: 'Evidencia de compatibilidad',
        statuses: {
          claudeDesktop: 'La compatibilidad alojada sigue sin verificar. Solo están documentados la estructura local del paquete y los contratos de protocolo.',
          claudeCode: 'La compatibilidad alojada sigue sin verificar. Solo están documentados la estructura local del adaptador y los contratos de protocolo.',
          codexCli: 'La compatibilidad alojada sigue sin verificar. Solo están documentados la estructura local del paquete y los contratos de protocolo.',
        },
      },
      confirmation: {
        title: 'Revisión del precio y confirmación explícita',
        liveBody:
          'MaxVideoAI calcula un precio exacto y temporal para el prompt, el modelo, los ajustes y las referencias elegidos. La generación comienza después de una confirmación separada; el trabajo aceptado y el resultado quedan disponibles en MaxVideoAI.',
        gatedBody:
          'El producto web ya muestra el precio antes de generar. El precio calculado y la confirmación conectada no están habilitados públicamente, por lo que esta página no los presenta como acciones disponibles.',
        steps: ['Compara las ventajas y límites de los modelos', 'Revisa el precio exacto y los ajustes', 'Confirma una vez y sigue el resultado en MaxVideoAI'],
      },
      controls: {
        title: 'Permisos, privacidad y control del gasto',
        body:
          'Una conexión debe exponer solo el acceso necesario para el flujo elegido. MaxVideoAI aplica las reglas de propiedad y de la cuenta en cada solicitud.',
        items: [
          'Los prompts privados y las URL de referencias se excluyen de las métricas de adquisición.',
          'Una confirmación separada protege cada generación pagada; los límites de gasto de la cuenta añaden otra protección.',
          'Las conexiones se podrán eliminar desde la configuración de la cuenta de MaxVideoAI cuando se habilite el acceso público.',
        ],
      },
      capabilities: {
        title: 'Cuatro garantías, de la decisión al resultado',
        body: 'La instalación MCP, el descubrimiento, las recomendaciones y las estimaciones son gratis. La generación usa tus créditos existentes de MaxVideoAI con precios de pago por uso, sin una suscripción MCP independiente. Vista previa — validación de clientes en curso.',
        items: [
          'Elegir el mejor modelo ejecutable para cada toma a partir de datos actuales.',
          'Ver el precio exacto antes de gastar ningún crédito.',
          'Validar los parámetros y las referencias privadas antes del envío.',
          'Exigir una confirmación explícita y después seguir el estado y la recuperación; los créditos de fallos definitivos se reembolsan automáticamente.',
        ],
      },
      setup: {
        title: 'Revisa una vista previa de configuración por cliente',
        body:
          'Las guías de Claude y Codex describen solo procedimientos previstos. No se afirma evidencia en clientes alojados sobre autorización, renovación, renderizado, revocación o generación antes de la validación de Task 10.',
      },
      faq: {
        title: 'Preguntas antes de conectar',
        items: [
          { question: '¿El agente elige el modelo automáticamente?', answer: 'Puede ayudar a comparar una selección, pero la recomendación debe usar datos actuales de MaxVideoAI y puedes elegir otro modelo compatible.' },
          { question: '¿Veré el precio primero?', answer: 'El producto web de MaxVideoAI muestra el precio antes de generar. El flujo conectado ofrecerá la misma revisión y confirmación solo cuando esté disponible públicamente.' },
          { question: '¿Todos los modelos aceptan referencias o audio?', answer: 'No. La compatibilidad con referencias y audio depende del modelo y del escenario, y los ajustes visibles deben indicar qué se incluye.' },
        ],
      },
      support: { label: 'Contactar al soporte de MaxVideoAI', href: '/es/contact' },
    },
  },
};

export function getMcpPageCopy(locale: AppLocale): McpPageCopy {
  return COPY[locale];
}
