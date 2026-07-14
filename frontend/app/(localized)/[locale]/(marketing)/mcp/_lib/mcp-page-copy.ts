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
      title: 'MaxVideoAI MCP for Claude and Codex',
      description:
        'Turn an AI video brief into a prompt, compare suitable models and budgets, review the price, and continue the result in MaxVideoAI.',
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
      actions: clientActions('en', {
        claude: 'Start with Claude',
        codex: 'Start with Codex',
        supporting: 'Open setup guide',
      }),
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
        'These text-to-video scenarios come from the current public model catalog and canonical price quote. Duration, resolution and audio support stay visible because they affect the choice.',
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
        'Claude and Codex can help you plan the visual reference and formulate the prompt. That does not mean the host creates an image or that every model accepts the same files.',
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
    trust: {
      definition: {
        eyebrow: 'What it is',
        title: 'A model and execution layer for an agent-assisted brief',
        body:
          'MaxVideoAI MCP is designed to let a compatible host read current model facts, help shortlist a suitable route, prepare a price for review, and return accepted results to MaxVideoAI. The host handles the conversation; MaxVideoAI remains responsible for catalog facts, pricing and generation.',
      },
      availability: {
        title: 'Availability',
        liveBody:
          'The public workflow is enabled for the capabilities shown on this page. Client-specific limitations still apply.',
        gatedBody:
          'The public connection is disabled while generation, trial and reference flows complete their release checks. The setup guides document controlled evidence, not general availability.',
      },
      compatibility: {
        title: 'Recorded host compatibility',
        body:
          'Compatibility evidence is version-specific. A recorded read-only pass does not prove every client flow or public generation capability.',
        lastVerifiedLabel: 'Last verified',
        sourceLabel: 'Compatibility evidence',
        statuses: {
          claude: 'Hosted read-only checks passed; token-expiry refresh remains pending.',
          codex: 'Explicit-scope read-only login passed; the default add flow remains blocked.',
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
        body: 'Capabilities remain narrow and publication-gated so a planning answer cannot be mistaken for a completed generation.',
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
            question: 'Does the host choose the model automatically?',
            answer: 'It can help compare a shortlist, but the recommendation must use current MaxVideoAI facts and you can choose a different compatible model.',
          },
          {
            question: 'Will I see the price first?',
            answer: 'The MaxVideoAI web product shows the displayed price before generation. The connected flow will expose the same review-and-confirm pattern only after its release gate passes.',
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
      title: 'MCP MaxVideoAI pour Claude et Codex',
      description:
        'Transformez un brief vidéo IA en prompt, comparez les modèles et budgets adaptés, vérifiez le prix et retrouvez le résultat dans MaxVideoAI.',
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
      actions: clientActions('fr', {
        claude: 'Commencer avec Claude',
        codex: 'Commencer avec Codex',
        supporting: 'Ouvrir le guide de configuration',
      }),
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
        'Ces scénarios texte-vers-vidéo proviennent du catalogue public actuel et du devis tarifaire de référence. La durée, la résolution et la prise en charge audio restent visibles pour éclairer le choix.',
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
        'Claude et Codex peuvent vous aider à préparer la référence visuelle et à formuler le prompt. Cela ne signifie pas que l’hôte crée une image ni que tous les modèles acceptent les mêmes fichiers.',
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
    trust: {
      definition: {
        eyebrow: 'Définition',
        title: 'Une couche de choix et d’exécution pour un brief assisté par un agent',
        body:
          'Le MCP MaxVideoAI est conçu pour permettre à un hôte compatible de consulter les données actuelles des modèles, de proposer une sélection adaptée, de préparer un prix à vérifier et de renvoyer les résultats acceptés vers MaxVideoAI. L’hôte gère la conversation ; MaxVideoAI reste responsable du catalogue, des prix et de la génération.',
      },
      availability: {
        title: 'Disponibilité',
        liveBody: 'Le parcours public est activé pour les fonctions présentées sur cette page. Des limites propres à chaque client subsistent.',
        gatedBody:
          'La connexion publique reste désactivée pendant la validation des parcours de génération, d’essai et de références. Les guides décrivent des preuves contrôlées, pas une disponibilité générale.',
      },
      compatibility: {
        title: 'Compatibilité hôte enregistrée',
        body:
          'La preuve de compatibilité dépend d’une version précise. Un test en lecture seule ne valide pas tous les parcours du client ni la génération publique.',
        lastVerifiedLabel: 'Dernière vérification',
        sourceLabel: 'Preuve de compatibilité',
        statuses: {
          claude: 'Les contrôles hébergés en lecture seule ont réussi ; l’actualisation après expiration reste à vérifier.',
          codex: 'La connexion en lecture seule avec autorisations explicites a réussi ; le parcours d’ajout par défaut reste bloqué.',
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
        body: 'Les fonctions restent limitées et soumises à publication afin qu’une recommandation ne soit jamais confondue avec une génération terminée.',
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
          { question: 'L’hôte choisit-il automatiquement le modèle ?', answer: 'Il peut aider à comparer une sélection, mais la recommandation doit reposer sur les données actuelles de MaxVideoAI et vous pouvez choisir un autre modèle compatible.' },
          { question: 'Vais-je voir le prix avant ?', answer: 'Le produit web MaxVideoAI affiche le prix avant la génération. Le parcours connecté reprendra cette vérification et cette confirmation uniquement après validation de sa mise en ligne.' },
          { question: 'Tous les modèles acceptent-ils les références ou l’audio ?', answer: 'Non. La prise en charge des références et de l’audio dépend du modèle et du scénario, et les réglages visibles doivent préciser ce qui est inclus.' },
        ],
      },
      support: { label: 'Contacter l’assistance MaxVideoAI', href: '/fr/contact' },
    },
  },
  es: {
    meta: {
      title: 'MCP de MaxVideoAI para Claude y Codex',
      description:
        'Convierte una idea de video con IA en un prompt, compara modelos y presupuestos adecuados, revisa el precio y continúa con el resultado en MaxVideoAI.',
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
      actions: clientActions('es', {
        claude: 'Empezar con Claude',
        codex: 'Empezar con Codex',
        supporting: 'Abrir guía de configuración',
      }),
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
        'Estos escenarios de texto a video provienen del catálogo público actual y de la cotización canónica. La duración, la resolución y el audio compatible siguen visibles porque influyen en la decisión.',
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
        'Claude y Codex pueden ayudarte a planificar la referencia visual y formular el prompt. Eso no significa que el host cree una imagen ni que todos los modelos acepten los mismos archivos.',
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
    trust: {
      definition: {
        eyebrow: 'Qué es',
        title: 'Una capa de decisión y ejecución para una idea asistida por un agente',
        body:
          'El MCP de MaxVideoAI está diseñado para que un host compatible consulte datos actuales de modelos, ayude a seleccionar una ruta adecuada, prepare un precio para revisión y devuelva resultados aceptados a MaxVideoAI. El host lleva la conversación; MaxVideoAI sigue a cargo del catálogo, los precios y la generación.',
      },
      availability: {
        title: 'Disponibilidad',
        liveBody: 'El flujo público está habilitado para las funciones que aparecen en esta página. Todavía pueden aplicarse límites específicos de cada cliente.',
        gatedBody:
          'La conexión pública permanece deshabilitada mientras terminan las revisiones de generación, prueba y referencias. Las guías documentan evidencia controlada, no disponibilidad general.',
      },
      compatibility: {
        title: 'Compatibilidad registrada del host',
        body:
          'La evidencia de compatibilidad corresponde a una versión concreta. Una prueba de solo lectura no demuestra todos los flujos del cliente ni la generación pública.',
        lastVerifiedLabel: 'Última verificación',
        sourceLabel: 'Evidencia de compatibilidad',
        statuses: {
          claude: 'Las pruebas alojadas de solo lectura pasaron; queda pendiente la renovación al vencer el acceso.',
          codex: 'El acceso de solo lectura con permisos explícitos pasó; el flujo predeterminado para agregar la conexión sigue bloqueado.',
        },
      },
      confirmation: {
        title: 'Revisión del precio y confirmación explícita',
        liveBody:
          'MaxVideoAI prepara una cotización exacta y temporal para el prompt, el modelo, los ajustes y las referencias elegidos. La generación comienza después de una confirmación separada; el trabajo aceptado y el resultado quedan disponibles en MaxVideoAI.',
        gatedBody:
          'El producto web ya muestra el precio antes de generar. La cotización y la confirmación conectadas no están habilitadas públicamente, por lo que esta página no las presenta como acciones disponibles.',
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
        body: 'Las funciones se mantienen acotadas y sujetas a publicación para no confundir una recomendación con una generación terminada.',
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
          { question: '¿El host elige el modelo automáticamente?', answer: 'Puede ayudar a comparar una selección, pero la recomendación debe usar datos actuales de MaxVideoAI y puedes elegir otro modelo compatible.' },
          { question: '¿Veré el precio primero?', answer: 'El producto web de MaxVideoAI muestra el precio antes de generar. El flujo conectado ofrecerá la misma revisión y confirmación solo después de superar su revisión de publicación.' },
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
