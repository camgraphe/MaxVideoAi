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
      title: 'AI Video Generator for Claude & Codex | MaxVideoAI MCP',
      description:
        'Plan prompts and reference images in Claude or Codex, compare AI video models, see the price before generation, and create through MaxVideoAI.',
    },
    breadcrumb: { home: 'Home', current: 'MaxVideoAI MCP' },
    hero: {
      eyebrows: {
        trial: 'FIRST VIDEO INCLUDED',
        budget: 'LOW-COST MODELS FIRST',
        price: 'PRICE BEFORE YOU GENERATE',
      },
      title: 'Turn your brief into the right model, prompt and budget.',
      intro:
        'Start in Claude or Codex, shape a useful prompt, plan reference images, compare suitable AI video models, and review the price before MaxVideoAI generates.',
      previewIntro:
        'Explore how a brief can become a prompt, model shortlist and budget. Public connection and connected generation are not available yet.',
      trialDisclosure:
        'One video is included for an eligible verified account: Seedance 2 Mini, 5 seconds, 480p. This promotion is separate from wallet funds and the regular balance.',
      actions: clientActions('en', {
        claude: 'Start with Claude',
        codex: 'Start with Codex',
        supporting: 'Open setup guide',
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
        'Confirm price & generate',
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
        'Claude and Codex can help you plan the visual reference and formulate the prompt. That does not mean the client creates an image or that every model accepts the same files.',
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
      title: 'How the Claude and Codex workflow works',
      updatedLabel: 'Evidence last verified',
      items: {
        integration: {
          title: 'What does the MaxVideoAI integration do?',
          liveBody:
            'MaxVideoAI MCP lets Claude or Codex help clarify an AI video brief, formulate the prompt, compare compatible public models and prepare the selected route for MaxVideoAI. The assistant owns the conversation; MaxVideoAI remains the source for model facts, price calculation, account rules, generation and saved results.',
          gatedBody:
            'MaxVideoAI MCP is currently a controlled, read-only integration for Claude and Codex. Recorded tests cover account status, public model facts and factual recommendations; public connection, exact MCP quotes, reference transfer and generation remain disabled. Claude or Codex can still help shape the brief and prompt, while the MaxVideoAI web product remains the place to review prices and generate.',
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
            'A reference can come from an account-owned MaxVideoAI asset, an allowed HTTPS image or a secure MaxVideoAI upload handoff. MaxVideoAI validates ownership and file support, and the chosen model must advertise the required reference mode. Claude or Codex may help plan the image and prompt, but that planning is not proof that a file was created or transferred.',
          gatedBody:
            'Connected reference transfer is not publicly enabled. In the MaxVideoAI web product, a person may add a reference image only when the selected model supports that reference mode. Claude or Codex can help describe the subject, composition and consistency goal, but the assistant must not claim it created or transferred an image without a live, verified file flow.',
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
            'For a controlled test connection, the recorded procedure is to remove MaxVideoAI from the client and revoke its authorization from MaxVideoAI account connections. A later protected action should then require a new approval. This is version-specific compatibility evidence, not a claim that public connection is currently available in every client.',
        },
      },
    },
    trust: {
      definition: {
        eyebrow: 'What it is',
        title: 'A model and execution layer for an agent-assisted brief',
        body:
          'MaxVideoAI MCP is designed to let a compatible assistant read current model facts, help shortlist a suitable route, prepare a price for review, and return accepted results to MaxVideoAI. The assistant handles the conversation; MaxVideoAI remains responsible for catalog facts, pricing and generation.',
      },
      availability: {
        title: 'Availability',
        liveBody:
          'The public workflow is enabled for the capabilities shown on this page. Client-specific limitations still apply.',
        gatedBody:
          'The public connection is disabled while generation, trial and reference flows complete their release checks. The setup guides document controlled evidence, not general availability.',
      },
      compatibility: {
        title: 'Recorded client compatibility',
        body:
          'Compatibility evidence is version-specific. A recorded read-only pass does not prove every client flow or public generation capability.',
        lastVerifiedLabel: 'Last verified',
        sourceLabel: 'Compatibility evidence',
        statuses: {
          claudeDesktop: 'Hosted read-only checks passed; token-expiry refresh remains pending.',
          claudeCode: 'Local OAuth, revocation and reapproval passed; the hosted tool smoke test remains pending.',
          codexCli: 'Explicit-scope read-only login passed; the default add flow remains blocked.',
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
        title: 'What the workflow can help with',
        body: 'Capabilities remain deliberately limited and appear only after their release checks, so a planning answer cannot be mistaken for a completed generation.',
        items: [
          'Compare current public model capabilities and availability.',
          'Shortlist models from structured creative and budget constraints.',
          'Review account-scoped status without exposing credentials or payment details.',
          'Prepare and confirm generation only when those capabilities are live.',
        ],
      },
      setup: {
        title: 'Choose a client-specific setup guide',
        body:
          'Claude and Codex have different connection behavior. Each guide records the tested version, current limitation, browser authorization flow, reference behavior, troubleshooting and disconnect path.',
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
      title: 'Générateur vidéo IA pour Claude et Codex | MCP MaxVideoAI',
      description:
        'Préparez des prompts et des images de référence dans Claude ou Codex, comparez les modèles vidéo IA, vérifiez le prix avant la génération et créez avec MaxVideoAI.',
    },
    breadcrumb: { home: 'Accueil', current: 'MCP MaxVideoAI' },
    hero: {
      eyebrows: {
        trial: 'PREMIÈRE VIDÉO INCLUSE',
        budget: 'MODÈLES ÉCONOMIQUES EN PREMIER',
        price: 'PRIX AVANT DE GÉNÉRER',
      },
      title: 'Transformez votre brief en modèle, prompt et budget adaptés.',
      intro:
        'Commencez dans Claude ou Codex, affinez un prompt utile, préparez vos images de référence, comparez les modèles vidéo IA adaptés et vérifiez le prix avant la génération dans MaxVideoAI.',
      previewIntro:
        'Découvrez comment passer d’un brief à un prompt, une sélection de modèles et un budget. La connexion publique et la génération connectée ne sont pas encore disponibles.',
      trialDisclosure:
        'Une vidéo est incluse pour un compte admissible et vérifié : Seedance 2 Mini, 5 secondes, 480p. Cette offre promotionnelle est distincte des fonds du portefeuille et du solde habituel.',
      actions: clientActions('fr', {
        claude: 'Commencer avec Claude',
        codex: 'Commencer avec Codex',
        supporting: 'Ouvrir le guide de configuration',
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
        'Confirmez le prix et générez',
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
        'Claude et Codex peuvent vous aider à préparer la référence visuelle et à formuler le prompt. Cela ne signifie pas que le client crée une image ni que tous les modèles acceptent les mêmes fichiers.',
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
      title: 'Fonctionnement du parcours avec Claude et Codex',
      updatedLabel: 'Preuves vérifiées le',
      items: {
        integration: {
          title: 'Que fait l’intégration MaxVideoAI ?',
          liveBody:
            'Le MCP MaxVideoAI permet à Claude ou Codex de clarifier un brief vidéo IA, de formuler le prompt, de comparer les modèles publics compatibles et de préparer le parcours retenu dans MaxVideoAI. L’assistant gère la conversation ; MaxVideoAI reste la source des données modèles, du calcul du prix, des règles de compte, de la génération et des résultats enregistrés.',
          gatedBody:
            'Le MCP MaxVideoAI est actuellement une intégration contrôlée en lecture seule pour Claude et Codex. Les tests enregistrés couvrent l’état du compte, les données des modèles publics et les recommandations factuelles ; la connexion publique, les devis MCP exacts, le transfert de références et la génération restent désactivés. Le produit web MaxVideoAI reste l’endroit où vérifier les prix et générer.',
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
            'Une référence peut provenir d’une ressource MaxVideoAI liée au compte, d’une image HTTPS autorisée ou d’un transfert sécurisé MaxVideoAI. MaxVideoAI vérifie la propriété et le format, et le modèle choisi doit prendre en charge le mode de référence demandé. Claude ou Codex peut aider à préparer l’image et le prompt, sans prétendre qu’un fichier a été créé ou transféré sans preuve.',
          gatedBody:
            'Le transfert connecté de références n’est pas activé publiquement. Dans le produit web MaxVideoAI, une image peut être ajoutée uniquement si le modèle choisi prend en charge ce mode de référence. Claude ou Codex peut aider à décrire le sujet, la composition et l’objectif de cohérence, mais ne doit pas prétendre avoir créé ou transféré un fichier sans parcours vérifié.',
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
            'Pour une connexion de test contrôlée, la procédure enregistrée consiste à supprimer MaxVideoAI du client puis à révoquer son autorisation depuis les connexions du compte MaxVideoAI. Une future action protégée doit ensuite demander une nouvelle approbation. Cette preuve dépend de la version testée et ne signifie pas que la connexion publique est disponible dans tous les clients.',
        },
      },
    },
    trust: {
      definition: {
        eyebrow: 'Définition',
        title: 'Une couche de choix et d’exécution pour un brief assisté par un agent',
        body:
          'Le MCP MaxVideoAI est conçu pour permettre à un assistant compatible de consulter les données actuelles des modèles, de proposer une sélection adaptée, de préparer un prix à vérifier et de renvoyer les résultats acceptés vers MaxVideoAI. L’assistant gère la conversation ; MaxVideoAI reste responsable du catalogue, des prix et de la génération.',
      },
      availability: {
        title: 'Disponibilité',
        liveBody: 'Le parcours public est activé pour les fonctions présentées sur cette page. Des limites propres à chaque client subsistent.',
        gatedBody:
          'La connexion publique reste désactivée pendant la validation des parcours de génération, d’essai et de références. Les guides décrivent des preuves contrôlées, pas une disponibilité générale.',
      },
      compatibility: {
        title: 'Compatibilité client enregistrée',
        body:
          'La preuve de compatibilité dépend d’une version précise. Un test en lecture seule ne valide pas tous les parcours du client ni la génération publique.',
        lastVerifiedLabel: 'Dernière vérification',
        sourceLabel: 'Preuve de compatibilité',
        statuses: {
          claudeDesktop: 'Les contrôles hébergés en lecture seule ont réussi ; l’actualisation après expiration reste à vérifier.',
          claudeCode: 'Les tests locaux OAuth, de révocation et de nouvelle approbation ont réussi ; le test hébergé des outils reste à effectuer.',
          codexCli: 'La connexion en lecture seule avec autorisations explicites a réussi ; le parcours d’ajout par défaut reste bloqué.',
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
        title: 'Ce que le parcours peut faciliter',
        body: 'Les fonctions restent volontairement limitées et ne sont affichées qu’après leurs vérifications de mise en ligne, afin de ne jamais confondre une recommandation avec une génération terminée.',
        items: [
          'Comparer les capacités et la disponibilité des modèles publics actuels.',
          'Sélectionner des modèles selon des contraintes créatives et budgétaires structurées.',
          'Consulter un état lié au compte sans exposer d’identifiants ni de données de paiement.',
          'Préparer et confirmer une génération uniquement lorsque ces fonctions sont actives.',
        ],
      },
      setup: {
        title: 'Choisissez le guide adapté à votre client',
        body:
          'Claude et Codex n’ont pas le même comportement de connexion. Chaque guide indique la version testée, la limite actuelle, le parcours d’autorisation dans le navigateur, les références, le dépannage et la déconnexion.',
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
      title: 'Generador de video con IA: Claude y Codex | MCP MaxVideoAI',
      description:
        'Prepara prompts e imágenes de referencia en Claude o Codex, compara modelos de video con IA, revisa el precio antes de generar y crea con MaxVideoAI.',
    },
    breadcrumb: { home: 'Inicio', current: 'MCP de MaxVideoAI' },
    hero: {
      eyebrows: {
        trial: 'PRIMER VIDEO INCLUIDO',
        budget: 'MODELOS DE BAJO COSTO PRIMERO',
        price: 'PRECIO ANTES DE GENERAR',
      },
      title: 'Convierte tu idea en el modelo, el prompt y el presupuesto adecuados.',
      intro:
        'Empieza en Claude o Codex, mejora un prompt útil, prepara imágenes de referencia, compara modelos de video con IA adecuados y revisa el precio antes de generar en MaxVideoAI.',
      previewIntro:
        'Explora cómo convertir una idea en un prompt, una selección de modelos y un presupuesto. La conexión pública y la generación conectada aún no están disponibles.',
      trialDisclosure:
        'Se incluye un video para una cuenta apta y verificada: Seedance 2 Mini, 5 segundos, 480p. Esta promoción es independiente de los fondos de la cartera y del saldo habitual.',
      actions: clientActions('es', {
        claude: 'Empezar con Claude',
        codex: 'Empezar con Codex',
        supporting: 'Abrir guía de configuración',
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
        'Confirma el precio y genera',
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
        'Claude y Codex pueden ayudarte a planificar la referencia visual y formular el prompt. Eso no significa que el cliente cree una imagen ni que todos los modelos acepten los mismos archivos.',
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
      title: 'Cómo funciona el flujo con Claude y Codex',
      updatedLabel: 'Evidencia verificada el',
      items: {
        integration: {
          title: '¿Qué hace la integración de MaxVideoAI?',
          liveBody:
            'El MCP de MaxVideoAI permite que Claude o Codex ayude a aclarar una idea de video con IA, formular el prompt, comparar modelos públicos compatibles y preparar la ruta elegida en MaxVideoAI. El agente lleva la conversación; MaxVideoAI sigue siendo la fuente de los datos de modelos, el cálculo del precio, las reglas de la cuenta, la generación y los resultados guardados.',
          gatedBody:
            'El MCP de MaxVideoAI es actualmente una integración controlada de solo lectura para Claude y Codex. Las pruebas registradas cubren el estado de la cuenta, los datos de modelos públicos y las recomendaciones factuales; la conexión pública, las cotizaciones MCP exactas, la transferencia de referencias y la generación siguen deshabilitadas. El producto web de MaxVideoAI sigue siendo el lugar para revisar precios y generar.',
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
            'Una referencia puede provenir de un recurso de MaxVideoAI asociado a la cuenta, una imagen HTTPS permitida o una transferencia segura de MaxVideoAI. MaxVideoAI valida la propiedad y el archivo, y el modelo elegido debe admitir el modo de referencia necesario. Claude o Codex puede ayudar a planificar la imagen y el prompt, sin afirmar que creó o transfirió un archivo sin evidencia.',
          gatedBody:
            'La transferencia conectada de referencias no está habilitada públicamente. En el producto web de MaxVideoAI, una persona puede agregar una imagen solo cuando el modelo elegido admite ese modo de referencia. Claude o Codex puede ayudar a describir el sujeto, la composición y el objetivo de consistencia, pero no debe afirmar que creó o transfirió un archivo sin un flujo verificado.',
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
            'Para una conexión de prueba controlada, el procedimiento registrado consiste en eliminar MaxVideoAI del cliente y revocar su autorización desde las conexiones de la cuenta de MaxVideoAI. Una acción protegida posterior deberá solicitar una aprobación nueva. Esta evidencia corresponde a versiones concretas y no significa que la conexión pública esté disponible en todos los clientes.',
        },
      },
    },
    trust: {
      definition: {
        eyebrow: 'Qué es',
        title: 'Una capa de decisión y ejecución para una idea asistida por un agente',
        body:
          'El MCP de MaxVideoAI está diseñado para que un agente compatible consulte datos actuales de modelos, ayude a seleccionar una opción adecuada, prepare un precio para revisión y devuelva resultados aceptados a MaxVideoAI. El agente lleva la conversación; MaxVideoAI sigue a cargo del catálogo, los precios y la generación.',
      },
      availability: {
        title: 'Disponibilidad',
        liveBody: 'El flujo público está habilitado para las funciones que aparecen en esta página. Todavía pueden aplicarse límites específicos de cada cliente.',
        gatedBody:
          'La conexión pública permanece deshabilitada mientras terminan las revisiones de generación, prueba y referencias. Las guías documentan evidencia controlada, no disponibilidad general.',
      },
      compatibility: {
        title: 'Compatibilidad registrada del cliente',
        body:
          'La evidencia de compatibilidad corresponde a una versión concreta. Una prueba de solo lectura no demuestra todos los flujos del cliente ni la generación pública.',
        lastVerifiedLabel: 'Última verificación',
        sourceLabel: 'Evidencia de compatibilidad',
        statuses: {
          claudeDesktop: 'Las pruebas alojadas de solo lectura pasaron; queda pendiente la renovación al vencer el acceso.',
          claudeCode: 'Las pruebas locales de OAuth, revocación y nueva aprobación pasaron; queda pendiente probar las herramientas en el entorno alojado.',
          codexCli: 'El acceso de solo lectura con permisos explícitos pasó; el flujo predeterminado para agregar la conexión sigue bloqueado.',
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
        title: 'En qué puede ayudar el flujo',
        body: 'Las funciones se mantienen acotadas y solo aparecen después de sus comprobaciones de lanzamiento, para no confundir una recomendación con una generación terminada.',
        items: [
          'Comparar capacidades y disponibilidad de los modelos públicos actuales.',
          'Seleccionar modelos a partir de restricciones creativas y de presupuesto estructuradas.',
          'Consultar el estado de la cuenta sin exponer credenciales ni datos de pago.',
          'Preparar y confirmar una generación solo cuando esas funciones estén activas.',
        ],
      },
      setup: {
        title: 'Elige la guía específica para tu cliente',
        body:
          'Claude y Codex tienen comportamientos de conexión diferentes. Cada guía registra la versión probada, el límite actual, el flujo de autorización en el navegador, las referencias, la solución de problemas y la desconexión.',
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
