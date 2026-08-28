import { localePathnames, type AppLocale } from '@/i18n/locales';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import type { McpClientId, McpCompatibilityHostId } from '../../mcp/_lib/mcp-page-types';

type IntegrationSetupValue = { label: string; value: string };

type IntegrationStepProof = {
  src: string;
  alt: string;
  caption: string;
};

type IntegrationHostGuide = {
  hostId: McpCompatibilityHostId;
  title: string;
  intro: string;
  installInstruction: string;
  steps: Array<{ title: string; body: string; proof?: IntegrationStepProof }>;
  commandLabel?: string;
  commands: string[];
  setupValues: IntegrationSetupValue[];
  authTrigger?: string;
  limitation: string;
};

export type IntegrationPageCopy = {
  client: McpClientId;
  clientLabel: 'Claude' | 'ChatGPT' | 'Codex';
  meta: { title: string; description: string };
  hero: {
    eyebrow: string;
    title: string;
    intro: string;
    unavailable: string;
    liveStatus: string;
    accountStatus: string;
    setupLabel: string;
    backLabel: string;
    backHref: string;
  };
  compatibility: {
    checkpointLabel: string;
    machineStatusLabel: string;
    statuses: Record<McpCompatibilityHostId, string>;
  };
  setup: {
    eyebrow: string;
    title: string;
    intro: string;
    installAction: {
      eyebrow: string;
      title: string;
      body: string;
      showInstruction: string;
      copyInstruction: string;
      copiedInstruction: string;
      copyEndpoint: string;
      copiedEndpoint: string;
      copyError: string;
      detailEyebrow: string;
      detailTitle: string;
    };
    hostGuides: IntegrationHostGuide[];
    oauthTitle: string;
    oauthBody: string;
    oauthSteps: string[];
  };
  workflow: {
    eyebrow: string;
    title: string;
    intro: string;
    previewSteps: Array<{ title: string; body: string }>;
    liveSteps: Array<{ title: string; body: string }>;
  };
  references: {
    title: string;
    planningBody: string;
    liveBody: string;
    gatedBody: string;
  };
  troubleshooting: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<{ question: string; answer: string }>;
  };
  disconnect: { title: string; body: string; steps: string[] };
  support: { label: string; href: string };
};

function localized(locale: AppLocale, path: string): string {
  const prefix = localePathnames[locale];
  return `/${[prefix, path.replace(/^\/+/, '')].filter(Boolean).join('/')}`;
}

function label(client: McpClientId): IntegrationPageCopy['clientLabel'] {
  if (client === 'chatgpt') return 'ChatGPT';
  return client === 'claude' ? 'Claude' : 'Codex';
}

function installInstruction(locale: AppLocale, hostId: McpCompatibilityHostId): string {
  if (hostId === 'codexCli') {
    if (locale === 'fr') {
      return 'Installe le plugin MaxVideoAI pour moi avec ces commandes, puis guide-moi pour connecter mon compte :\ncodex plugin marketplace add camgraphe/MaxVideoAi --ref maxvideoai-plugin-v0.3.2\ncodex plugin add maxvideoai@maxvideoai';
    }
    if (locale === 'es') {
      return 'Instala el plugin MaxVideoAI por mí con estos comandos y guíame para conectar mi cuenta:\ncodex plugin marketplace add camgraphe/MaxVideoAi --ref maxvideoai-plugin-v0.3.2\ncodex plugin add maxvideoai@maxvideoai';
    }
    return 'Install the MaxVideoAI plugin for me with these commands, then guide me through connecting my account:\ncodex plugin marketplace add camgraphe/MaxVideoAi --ref maxvideoai-plugin-v0.3.2\ncodex plugin add maxvideoai@maxvideoai';
  }

  const host = hostId === 'claudeCode' ? 'Claude Code' : hostId === 'claudeDesktop' ? 'Claude' : 'ChatGPT';
  if (locale === 'fr') {
    return `Connecte MaxVideoAI dans ${host} avec ce serveur MCP et guide-moi jusqu’à la connexion : ${MCP_PRODUCTION_RESOURCE_URL}`;
  }
  if (locale === 'es') {
    return `Conecta MaxVideoAI en ${host} con este servidor MCP y guíame hasta completar la conexión: ${MCP_PRODUCTION_RESOURCE_URL}`;
  }
  return `Connect MaxVideoAI in ${host} with this MCP server and guide me through the connection: ${MCP_PRODUCTION_RESOURCE_URL}`;
}

function installAction(locale: AppLocale, clientLabel: IntegrationPageCopy['clientLabel']): IntegrationPageCopy['setup']['installAction'] {
  if (locale === 'fr') {
    const isCodex = clientLabel === 'Codex';
    return {
      eyebrow: 'INSTALLATION RAPIDE',
      title: isCodex ? 'Copiez, Codex installe le plugin' : `Copiez, ${clientLabel} vous guide`,
      body: isCodex
        ? 'Collez la demande dans Codex : il peut exécuter les commandes après votre autorisation.'
        : `Collez la demande dans ${clientLabel} : il vous indique exactement où ajouter MaxVideoAI et terminer la connexion.`,
      showInstruction: 'Voir ce qui sera copié',
      copyInstruction: isCodex ? 'Copier et installer dans Codex' : `Copier pour être guidé dans ${clientLabel}`,
      copiedInstruction: `Copié — collez maintenant dans ${clientLabel}.`,
      copyEndpoint: 'Copier l’adresse MCP',
      copiedEndpoint: 'Adresse MCP copiée.',
      copyError: 'Copie impossible. Sélectionnez le texte puis copiez-le manuellement.',
      detailEyebrow: 'INSTALLATION DÉTAILLÉE',
      detailTitle: `Les 3 étapes dans ${clientLabel}`,
    };
  }
  if (locale === 'es') {
    const isCodex = clientLabel === 'Codex';
    return {
      eyebrow: 'INSTALACIÓN RÁPIDA',
      title: isCodex ? 'Copia y Codex instala el plugin' : `Copia y ${clientLabel} te guía`,
      body: isCodex
        ? 'Pega la petición en Codex: podrá ejecutar los comandos después de tu autorización.'
        : `Pega la petición en ${clientLabel}: te indicará exactamente dónde añadir MaxVideoAI y completar la conexión.`,
      showInstruction: 'Ver qué se copiará',
      copyInstruction: isCodex ? 'Copiar e instalar en Codex' : `Copiar para recibir ayuda en ${clientLabel}`,
      copiedInstruction: `Copiado — pégalo ahora en ${clientLabel}.`,
      copyEndpoint: 'Copiar dirección MCP',
      copiedEndpoint: 'Dirección MCP copiada.',
      copyError: 'No se pudo copiar. Selecciona el texto y cópialo manualmente.',
      detailEyebrow: 'INSTALACIÓN DETALLADA',
      detailTitle: `Los 3 pasos en ${clientLabel}`,
    };
  }
  const isCodex = clientLabel === 'Codex';
  return {
    eyebrow: 'FAST SETUP',
    title: isCodex ? 'Copy it, and Codex installs the plugin' : `Copy it, and ${clientLabel} guides you`,
    body: isCodex
      ? 'Paste the request into Codex. It can run the commands after you approve them.'
      : `Paste the request into ${clientLabel}. It will show you exactly where to add MaxVideoAI and finish connecting.`,
    showInstruction: 'See what will be copied',
    copyInstruction: isCodex ? 'Copy and install in Codex' : `Copy for guidance in ${clientLabel}`,
    copiedInstruction: `Copied — paste it into ${clientLabel}.`,
    copyEndpoint: 'Copy MCP address',
    copiedEndpoint: 'MCP address copied.',
    copyError: 'Unable to copy. Select the text and copy it manually.',
    detailEyebrow: 'DETAILED SETUP',
    detailTitle: `The 3 steps in ${clientLabel}`,
  };
}

function englishGuides(client: McpClientId): IntegrationHostGuide[] {
  if (client === 'claude') {
    return [
      {
        hostId: 'claudeDesktop',
        title: 'Connect MaxVideoAI to Claude',
        intro: 'Add MaxVideoAI as a custom remote connector, then authorize your account in the browser.',
        installInstruction: installInstruction('en', 'claudeDesktop'),
        steps: [
          { title: 'Open connector settings', body: 'In Claude, add a custom connector using a remote MCP server.' },
          { title: 'Add MaxVideoAI', body: 'Paste the server address below. Never paste an API key or account password.' },
          { title: 'Approve the connection', body: 'Sign in to MaxVideoAI, review access, then return to Claude.' },
        ],
        commands: [],
        setupValues: [{ label: 'MaxVideoAI server', value: MCP_PRODUCTION_RESOURCE_URL }],
        limitation: 'Your credits, private references and completed videos stay attached to the same MaxVideoAI account used on the website.',
      },
      {
        hostId: 'claudeCode',
        title: 'Use the same connector in Claude Code',
        intro: 'Register the remote server, then authenticate from Claude Code’s MCP panel.',
        installInstruction: installInstruction('en', 'claudeCode'),
        steps: [
          { title: 'Add the server', body: 'Run the command below once from the project or user scope you prefer.' },
          { title: 'Open the MCP panel', body: 'Open /mcp and select MaxVideoAI to start browser authorization.' },
          { title: 'Start with discovery', body: 'Ask for account status or current video models before preparing a paid generation.' },
        ],
        commandLabel: 'Claude Code commands',
        commands: [`claude mcp add --transport http maxvideoai ${MCP_PRODUCTION_RESOURCE_URL}`, 'claude mcp get maxvideoai'],
        setupValues: [],
        authTrigger: 'After adding the server, open /mcp in Claude Code to authenticate.',
        limitation: 'Claude Code uses the same MaxVideoAI account, current model catalog, exact quotes and confirmation boundary.',
      },
    ];
  }

  if (client === 'chatgpt') {
    return [
      {
        hostId: 'chatgptWeb',
        title: 'Connect MaxVideoAI through the public listing or developer MCP',
        intro: 'Use the shared public plugin listing as soon as OpenAI approves it for your account, or connect the MaxVideoAI MCP in developer mode now. Both paths lead to OAuth on first use.',
        installInstruction: installInstruction('en', 'chatgptWeb'),
        steps: [
          { title: 'Install from the public listing after approval', body: 'Once OpenAI approves the public listing and it is available for your account or workspace, open the Plugins directory, select MaxVideoAI and install the shared plugin.' },
          { title: 'Connect the developer MCP now', body: 'In developer mode, add a connection named MaxVideoAI with the MCP address below. This direct MCP route is separate from public directory installation.' },
          { title: 'Start a new chat', body: 'Enable MaxVideoAI from the tools menu, then complete OAuth when prompted on first use.' },
        ],
        commands: [],
        setupValues: [{ label: 'Developer-mode MCP fallback', value: MCP_PRODUCTION_RESOURCE_URL }],
        authTrigger: 'OAuth starts when the new ChatGPT conversation first uses MaxVideoAI. Sign in or create the MaxVideoAI account you want to connect.',
        limitation: 'Public directory availability starts after OpenAI approval and remains subject to account or workspace policy. Eligible Business and Enterprise/Edu workspaces can use full MCP, while Pro remains read/fetch-only. Developer mode can connect the MCP address above now.',
      },
    ];
  }

  return [
    {
      hostId: 'codexCli',
      title: 'Install the MaxVideoAI plugin in Codex',
      intro: 'Add the tagged MaxVideoAI marketplace, install the plugin, then authorize your account from a new Codex conversation.',
      installInstruction: installInstruction('en', 'codexCli'),
      steps: [
        { title: 'Add the marketplace', body: 'Register the public MaxVideoAI repository at the reviewed 0.3.2 release tag.' },
        { title: 'Install the plugin', body: 'Install MaxVideoAI once to get the plan and generate skills plus the production MCP connection.' },
        { title: 'Start a new task', body: 'Open a new Codex conversation, use $maxvideoai:plan or $maxvideoai:generate, and complete OAuth when prompted.' },
      ],
      commandLabel: 'Codex plugin commands',
      commands: [
        'codex plugin marketplace add camgraphe/MaxVideoAi --ref maxvideoai-plugin-v0.3.2',
        'codex plugin add maxvideoai@maxvideoai',
      ],
      setupValues: [],
      authTrigger: 'OAuth starts when the new conversation first uses MaxVideoAI. Sign in or create the MaxVideoAI account you want to connect.',
      limitation: 'The tagged GitHub package includes both plan and generate skills and the production MCP connection. Generation still waits for an exact quote and explicit approval.',
    },
  ];
}

function frenchGuides(client: McpClientId): IntegrationHostGuide[] {
  if (client === 'claude') {
    return [
      {
        hostId: 'claudeDesktop',
        title: 'Connecter MaxVideoAI à Claude',
        intro: 'Ajoutez MaxVideoAI comme connecteur distant personnalisé, puis autorisez votre compte dans le navigateur.',
        installInstruction: installInstruction('fr', 'claudeDesktop'),
        steps: [
          { title: 'Ouvrir les réglages', body: 'Dans Claude, ajoutez un connecteur personnalisé utilisant un serveur MCP distant.' },
          { title: 'Ajouter MaxVideoAI', body: 'Collez l’adresse ci-dessous. Ne collez jamais une clé API ou votre mot de passe.' },
          { title: 'Approuver la connexion', body: 'Connectez-vous ou créez votre compte MaxVideoAI, approuvez l’accès, puis revenez dans Claude.' },
        ],
        commands: [],
        setupValues: [{ label: 'Serveur MaxVideoAI', value: MCP_PRODUCTION_RESOURCE_URL }],
        limitation: 'Crédits, références privées et vidéos terminées restent liés au même compte MaxVideoAI que sur le site.',
      },
      {
        hostId: 'claudeCode',
        title: 'Utiliser le même connecteur dans Claude Code',
        intro: 'Enregistrez le serveur distant puis authentifiez-vous depuis le panneau MCP de Claude Code.',
        installInstruction: installInstruction('fr', 'claudeCode'),
        steps: [
          { title: 'Ajouter le serveur', body: 'Exécutez une fois la commande ci-dessous avec la portée projet ou utilisateur.' },
          { title: 'Ouvrir le panneau MCP', body: 'Ouvrez /mcp et sélectionnez MaxVideoAI pour lancer l’autorisation dans le navigateur.' },
          { title: 'Commencer par le catalogue', body: 'Demandez l’état du compte ou les modèles vidéo actuels avant de préparer une génération.' },
        ],
        commandLabel: 'Commandes Claude Code',
        commands: [`claude mcp add --transport http maxvideoai ${MCP_PRODUCTION_RESOURCE_URL}`, 'claude mcp get maxvideoai'],
        setupValues: [],
        authTrigger: 'Après l’ajout du serveur, ouvrez /mcp dans Claude Code pour vous authentifier.',
        limitation: 'Claude Code retrouve le même compte, le catalogue actuel, les devis exacts et la validation avant dépense.',
      },
    ];
  }

  if (client === 'chatgpt') {
    return [
      {
        hostId: 'chatgptWeb',
        title: 'Connecter MaxVideoAI par la fiche publique ou le MCP développeur',
        intro: 'Utilisez la fiche publique du plugin partagé dès son approbation par OpenAI pour votre compte, ou connectez le MCP MaxVideoAI en mode développeur dès maintenant. Les deux parcours mènent à OAuth lors de la première utilisation.',
        installInstruction: installInstruction('fr', 'chatgptWeb'),
        steps: [
          { title: 'Installer la fiche publique après approbation', body: 'Dès que la fiche publique est approuvée par OpenAI et disponible pour votre compte ou espace, ouvrez le répertoire Plugins, choisissez MaxVideoAI et installez le plugin partagé.' },
          { title: 'Connecter le MCP développeur maintenant', body: 'En mode développeur, ajoutez une connexion MaxVideoAI avec l’adresse MCP ci-dessous. Cette voie MCP directe reste distincte de l’installation depuis le répertoire public.' },
          { title: 'Démarrer une nouvelle discussion', body: 'Activez MaxVideoAI dans le menu des outils puis terminez OAuth lors de la première utilisation.' },
        ],
        commands: [],
        setupValues: [{ label: 'Solution MCP en mode développeur', value: MCP_PRODUCTION_RESOURCE_URL }],
        authTrigger: 'OAuth démarre lorsque la nouvelle discussion ChatGPT utilise MaxVideoAI pour la première fois. Connectez-vous ou créez le compte MaxVideoAI à relier.',
        limitation: 'La disponibilité dans le répertoire public commence après l’approbation d’OpenAI et reste soumise à la politique du compte ou de l’espace. Les espaces Business et Enterprise/Edu éligibles peuvent utiliser le MCP complet, tandis que Pro reste limité à la lecture et à la consultation. Le mode développeur peut connecter l’adresse MCP ci-dessus dès maintenant.',
      },
    ];
  }

  return [
    {
      hostId: 'codexCli',
      title: 'Installer le plugin MaxVideoAI dans Codex',
      intro: 'Ajoutez la marketplace MaxVideoAI taguée, installez le plugin puis autorisez votre compte depuis une nouvelle conversation Codex.',
      installInstruction: installInstruction('fr', 'codexCli'),
      steps: [
        { title: 'Ajouter la marketplace', body: 'Enregistrez le dépôt public MaxVideoAI sur le tag de version 0.3.2 contrôlé.' },
        { title: 'Installer le plugin', body: 'Installez MaxVideoAI une fois pour recevoir les skills plan et generate ainsi que la connexion MCP de production.' },
        { title: 'Démarrer une nouvelle tâche', body: 'Ouvrez une nouvelle conversation Codex, utilisez $maxvideoai:plan ou $maxvideoai:generate, puis terminez OAuth à la demande.' },
      ],
      commandLabel: 'Commandes du plugin Codex',
      commands: [
        'codex plugin marketplace add camgraphe/MaxVideoAi --ref maxvideoai-plugin-v0.3.2',
        'codex plugin add maxvideoai@maxvideoai',
      ],
      setupValues: [],
      authTrigger: 'OAuth démarre lorsque la nouvelle conversation utilise MaxVideoAI pour la première fois. Connectez-vous ou créez le compte à relier.',
      limitation: 'Le package GitHub tagué inclut les skills plan et generate et la connexion MCP de production. Toute génération attend toujours un devis exact et votre accord explicite.',
    },
  ];
}

function spanishGuides(client: McpClientId): IntegrationHostGuide[] {
  if (client === 'claude') {
    return [
      {
        hostId: 'claudeDesktop',
        title: 'Conectar MaxVideoAI con Claude',
        intro: 'Añade MaxVideoAI como conector remoto personalizado y autoriza tu cuenta en el navegador.',
        installInstruction: installInstruction('es', 'claudeDesktop'),
        steps: [
          { title: 'Abrir los ajustes', body: 'En Claude, añade un conector personalizado mediante un servidor MCP remoto.' },
          { title: 'Añadir MaxVideoAI', body: 'Pega la dirección siguiente. No pegues nunca una clave API ni tu contraseña.' },
          { title: 'Aprobar la conexión', body: 'Inicia sesión o crea tu cuenta MaxVideoAI, aprueba el acceso y vuelve a Claude.' },
        ],
        commands: [],
        setupValues: [{ label: 'Servidor MaxVideoAI', value: MCP_PRODUCTION_RESOURCE_URL }],
        limitation: 'Los créditos, referencias privadas y vídeos terminados quedan en la misma cuenta MaxVideoAI que usas en la web.',
      },
      {
        hostId: 'claudeCode',
        title: 'Usar el mismo conector en Claude Code',
        intro: 'Registra el servidor remoto y autentícate desde el panel MCP de Claude Code.',
        installInstruction: installInstruction('es', 'claudeCode'),
        steps: [
          { title: 'Añadir el servidor', body: 'Ejecuta una vez el comando siguiente con el alcance de proyecto o usuario que prefieras.' },
          { title: 'Abrir el panel MCP', body: 'Abre /mcp y selecciona MaxVideoAI para iniciar la autorización en el navegador.' },
          { title: 'Empezar por el catálogo', body: 'Consulta el estado de la cuenta o los modelos actuales antes de preparar una generación.' },
        ],
        commandLabel: 'Comandos de Claude Code',
        commands: [`claude mcp add --transport http maxvideoai ${MCP_PRODUCTION_RESOURCE_URL}`, 'claude mcp get maxvideoai'],
        setupValues: [],
        authTrigger: 'Después de añadir el servidor, abre /mcp en Claude Code para autenticarte.',
        limitation: 'Claude Code usa la misma cuenta, catálogo actual, precios exactos y aprobación antes de gastar.',
      },
    ];
  }

  if (client === 'chatgpt') {
    return [
      {
        hostId: 'chatgptWeb',
        title: 'Conectar MaxVideoAI mediante la ficha pública o el MCP para desarrolladores',
        intro: 'Usa la ficha pública del plugin compartido cuando OpenAI la apruebe para tu cuenta, o conecta ahora el MCP de MaxVideoAI en modo desarrollador. Ambos recorridos llevan a OAuth en el primer uso.',
        installInstruction: installInstruction('es', 'chatgptWeb'),
        steps: [
          { title: 'Instalar la ficha pública después de la aprobación', body: 'Cuando OpenAI apruebe la ficha pública y esté disponible para tu cuenta o espacio, abre el directorio Plugins, elige MaxVideoAI e instala el plugin compartido.' },
          { title: 'Conectar ahora el MCP para desarrolladores', body: 'En modo desarrollador, añade una conexión llamada MaxVideoAI con la dirección MCP siguiente. Esta vía MCP directa es independiente de la instalación desde el directorio público.' },
          { title: 'Iniciar un chat nuevo', body: 'Activa MaxVideoAI en el menú de herramientas y completa OAuth en el primer uso.' },
        ],
        commands: [],
        setupValues: [{ label: 'Alternativa MCP para el modo desarrollador', value: MCP_PRODUCTION_RESOURCE_URL }],
        authTrigger: 'OAuth empieza cuando el chat nuevo usa MaxVideoAI por primera vez. Inicia sesión o crea la cuenta MaxVideoAI que quieras conectar.',
        limitation: 'La disponibilidad en el directorio público comienza después de la aprobación de OpenAI y sigue sujeta a la política de la cuenta o del espacio. Los espacios Business y Enterprise/Edu elegibles pueden usar MCP completo, mientras que Pro se limita a lectura y consulta. El modo desarrollador puede conectar ahora la dirección MCP anterior.',
      },
    ];
  }

  return [
    {
      hostId: 'codexCli',
      title: 'Instalar el plugin MaxVideoAI en Codex',
      intro: 'Añade el marketplace etiquetado de MaxVideoAI, instala el plugin y autoriza tu cuenta desde una nueva conversación de Codex.',
      installInstruction: installInstruction('es', 'codexCli'),
      steps: [
        { title: 'Añadir el marketplace', body: 'Registra el repositorio público de MaxVideoAI en la etiqueta revisada de la versión 0.3.2.' },
        { title: 'Instalar el plugin', body: 'Instala MaxVideoAI una vez para obtener los skills plan y generate y la conexión MCP de producción.' },
        { title: 'Iniciar una nueva tarea', body: 'Abre una nueva conversación de Codex, usa $maxvideoai:plan o $maxvideoai:generate y completa OAuth cuando se solicite.' },
      ],
      commandLabel: 'Comandos del plugin de Codex',
      commands: [
        'codex plugin marketplace add camgraphe/MaxVideoAi --ref maxvideoai-plugin-v0.3.2',
        'codex plugin add maxvideoai@maxvideoai',
      ],
      setupValues: [],
      authTrigger: 'OAuth comienza cuando la nueva conversación usa MaxVideoAI por primera vez. Inicia sesión o crea la cuenta que quieras conectar.',
      limitation: 'El paquete etiquetado de GitHub incluye los skills plan y generate y la conexión MCP de producción. La generación siempre espera un precio exacto y tu aprobación explícita.',
    },
  ];
}

function englishCopy(client: McpClientId): IntegrationPageCopy {
  const clientLabel = label(client);
  const productTerm = client === 'chatgpt'
    ? 'MaxVideoAI App'
    : client === 'claude'
      ? 'MaxVideoAI Connector'
      : 'MaxVideoAI Plugin';
  const setupDescription = client === 'chatgpt'
    ? 'After OpenAI approval, install MaxVideoAI from ChatGPT’s shared plugin directory, or connect the same MCP in developer mode now; OAuth starts on first use.'
    : client === 'claude'
      ? 'Set up the remote connector in Claude to plan prompts and references, compare AI video models, review the exact quote, and approve generation with MaxVideoAI.'
      : 'Install the Codex plugin to plan prompts and references, compare current AI video models, review the exact quote, and approve generation with MaxVideoAI.';
  const setupIntro = client === 'chatgpt'
    ? 'ChatGPT and Codex use the same shared plugin directory and MCP connection. Install MaxVideoAI from the public listing after approval, or connect the developer MCP now, then start a new chat and complete OAuth on first use.'
    : client === 'claude'
      ? 'This Claude route covers the remote connector setup and the complete creative handoff: develop the brief, compare current models and budgets, validate references, then approve an exact MaxVideoAI quote when the request is ready.'
      : 'This Codex route covers plugin installation and the complete creative handoff: develop the brief, compare current models and budgets, validate references, then approve an exact MaxVideoAI quote when the request is ready.';
  return {
    client,
    clientLabel,
    meta: {
      title: `${productTerm.replace(/^./, (value) => value.toUpperCase())} for ${clientLabel} | MaxVideoAI`,
      description: setupDescription,
    },
    hero: {
      eyebrow: client === 'chatgpt' ? 'MAXVIDEOAI APP' : client === 'claude' ? 'MAXVIDEOAI CONNECTOR' : 'MAXVIDEOAI PLUGIN',
      title: `Create AI video with MaxVideoAI in ${clientLabel}`,
      intro: setupIntro,
      unavailable: 'Plan prompts and references, compare current models, budget the project and review the exact MaxVideoAI production workflow.',
      liveStatus: client === 'chatgpt'
        ? 'MaxVideoAI is free to connect in ChatGPT, with no separate subscription. Use the public plugin after listing approval or connect the developer MCP now, then sign in or create an account through OAuth on first use; only an approved generation uses pay-as-you-go credits.'
        : 'MaxVideoAI is free to connect, with no separate subscription. Sign in or create an account; advice and project estimates are free, and only an approved generation uses pay-as-you-go credits.',
      accountStatus: 'A MaxVideoAI account is required and free to create. Connect with no separate subscription; only approved generations use pay-as-you-go credits.',
      setupLabel: client === 'chatgpt' ? 'Install MaxVideoAI in ChatGPT' : `Set up MaxVideoAI in ${clientLabel}`,
      backLabel: 'See the complete AI assistant workflow',
      backHref: '/mcp',
    },
    compatibility: {
      checkpointLabel: client === 'chatgpt' ? 'Flow documented' : 'Compatibility checked',
      machineStatusLabel: 'Host evidence state',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 completed OAuth, model discovery, budgeting, exact quote, media, recovery, upload-handoff and top-up-handoff checks on controlled staging.',
        claudeCode: 'The shared connector configuration is ready, but a direct Claude Code production check has not yet been recorded.',
        chatgptWeb: 'ChatGPT and Codex use the same plugin and MCP connection. Install MaxVideoAI, then connect your account through OAuth at first use.',
        codexCli: 'Codex CLI 0.150.0-alpha.8 completed production installation, OAuth, account, catalog, recommendation, budgeting, exact-quote, paid-generation, recovery and inline-player contract checks.',
      },
    },
    setup: {
      eyebrow: 'CONNECT YOUR ACCOUNT',
      title: `Set up MaxVideoAI in ${clientLabel}`,
      intro: 'Sign in or create your MaxVideoAI account during setup. One secure OAuth connection links the assistant to your pay-as-you-go credits, private media and completed generations in MaxVideoAI Library.',
      installAction: installAction('en', clientLabel),
      hostGuides: englishGuides(client),
      oauthTitle: 'What happens when you connect',
      oauthBody: 'The browser opens MaxVideoAI sign-in and consent. Approval identifies the connected account; the assistant never receives your password, payment details or direct database access.',
      oauthSteps: ['Sign in or create the MaxVideoAI account you want to use', 'Confirm your email, then review and approve the connection', `Return to ${clientLabel} and ask for your account status`],
    },
    workflow: {
      eyebrow: 'FROM IDEA TO RESULT',
      title: `Create with ${clientLabel}; generate with MaxVideoAI`,
      intro: 'Keep the creative conversation in your assistant. MaxVideoAI handles the changing product facts and the paid execution boundary.',
      previewSteps: [
        { title: 'Develop the creative brief', body: `${clientLabel} can ask only for the missing decisions, write the shot plan and prepare prompts.` },
        { title: 'Compare real options', body: 'MaxVideoAI returns current capabilities and project estimates so you can choose quality, budget or a deliberate model mix.' },
        { title: 'Review the exact quote', body: 'The selected model, settings, references and price are validated together before any spend.' },
        { title: 'Approve, track and recover', body: 'Generation starts only after clear approval; completed media stays in the connected MaxVideoAI Library.' },
      ],
      liveSteps: [
        { title: 'Develop the creative brief', body: `${clientLabel} asks for the missing creative, format, quality and budget choices.` },
        { title: 'Compare current models', body: 'MaxVideoAI returns a best-fit recommendation plus credible alternatives with concrete trade-offs.' },
        { title: 'Review the exact quote', body: 'Check prompt, settings, references, price and account effect before approving.' },
        { title: 'Generate and follow the job', body: 'Approve once, recover status safely, and find the result in your MaxVideoAI Library.' },
      ],
    },
    references: {
      title: 'Use image, video or audio references when the model supports them',
      planningBody: `${clientLabel} can help create or improve reference ideas and choose the right asset for each shot.`,
      liveBody: 'Select an existing private image, video or audio asset from your MaxVideoAI Library, or open a secure upload handoff. Supported kinds and limits come from the selected model’s live details.',
      gatedBody: 'Plan references in the conversation, then keep private uploads, generation and completed media together in your MaxVideoAI account.',
    },
    troubleshooting: {
      eyebrow: 'HELP',
      title: `${clientLabel} connection help`,
      intro: 'The assistant can explain the next safe step without guessing your balance, job state or account destination.',
      items: [
        { question: 'The assistant asks me to sign in again', answer: 'Complete OAuth in the browser, then return to the conversation. Never paste your MaxVideoAI password or API credentials into chat.' },
        { question: 'My balance is too low', answer: 'Ask for a secure top-up link. Payment stays on MaxVideoAI; after funding, check the balance and prepare a fresh quote before approving.' },
        { question: 'I cannot find a completed result', answer: 'Ask the assistant to list recent generations or open MaxVideoAI Library. Do not submit a duplicate paid job.' },
      ],
    },
    disconnect: {
      title: `Disconnect ${clientLabel}`,
      body: 'Remove the connection in the assistant and revoke the saved grant in MaxVideoAI account settings. Both steps prevent an old client entry from retaining access.',
      steps: [`Remove MaxVideoAI from ${clientLabel}`, 'Open MaxVideoAI account connections and revoke the grant', 'Reconnect later through a new browser approval if needed'],
    },
    support: { label: 'Contact MaxVideoAI support', href: '/contact' },
  };
}

function frenchCopy(client: McpClientId): IntegrationPageCopy {
  const base = englishCopy(client);
  const clientLabel = label(client);
  const term = client === 'chatgpt'
    ? 'App MaxVideoAI'
    : client === 'claude'
      ? 'Connecteur MaxVideoAI'
      : 'Plugin MaxVideoAI';
  const setupDescription = client === 'chatgpt'
    ? 'Après approbation OpenAI, installez MaxVideoAI depuis le répertoire partagé de ChatGPT ou connectez le MCP en mode développeur ; OAuth démarre au premier usage.'
    : client === 'claude'
      ? 'Configurez le connecteur distant dans Claude pour préparer prompts et références, comparer les modèles vidéo IA, vérifier le devis et approuver la génération.'
      : 'Installez le plugin Codex pour préparer prompts et références, comparer les modèles vidéo IA, vérifier le devis exact et approuver la génération.';
  const setupIntro = client === 'chatgpt'
    ? 'ChatGPT et Codex utilisent le même répertoire de plugins partagé et la même connexion MCP. Installez MaxVideoAI depuis la fiche publique après approbation, ou connectez le MCP développeur dès maintenant, puis démarrez une nouvelle discussion et terminez OAuth à la première utilisation.'
    : client === 'claude'
      ? 'Cette page Claude réunit la configuration du connecteur distant et le passage à la production : développez le brief, comparez modèles et budgets actuels, validez les références puis approuvez un devis MaxVideoAI exact lorsque la demande est prête.'
      : 'Cette page Codex réunit l’installation du plugin et le passage à la production : développez le brief, comparez modèles et budgets actuels, validez les références puis approuvez un devis MaxVideoAI exact lorsque la demande est prête.';
  return {
    ...base,
    meta: {
      title: `${term} pour ${clientLabel} | MaxVideoAI`,
      description: setupDescription,
    },
    hero: {
      ...base.hero,
      eyebrow: client === 'chatgpt' ? 'APP MAXVIDEOAI' : client === 'claude' ? 'CONNECTEUR MAXVIDEOAI' : 'PLUGIN MAXVIDEOAI',
      title: `Créez vos vidéos IA avec MaxVideoAI dans ${clientLabel}`,
      intro: setupIntro,
      unavailable: 'Préparez prompts et références, comparez les modèles, budgétez le projet et découvrez le parcours de production MaxVideoAI.',
      liveStatus: client === 'chatgpt'
        ? 'MaxVideoAI se connecte gratuitement dans ChatGPT, sans abonnement supplémentaire. Utilisez le plugin public après approbation de la fiche ou connectez le MCP développeur dès maintenant, puis connectez-vous ou créez un compte par OAuth à la première utilisation ; seuls les rendus approuvés utilisent vos crédits MaxVideoAI.'
        : 'La connexion MaxVideoAI est gratuite, sans abonnement supplémentaire. Connectez-vous ou créez un compte ; seuls les rendus approuvés utilisent vos crédits MaxVideoAI à la consommation.',
      accountStatus: 'Un compte MaxVideoAI est requis et sa création est gratuite. La connexion n’ajoute aucun abonnement ; seuls les rendus approuvés utilisent vos crédits MaxVideoAI.',
      setupLabel: client === 'chatgpt' ? 'Installer MaxVideoAI dans ChatGPT' : `Configurer MaxVideoAI dans ${clientLabel}`,
      backLabel: 'Voir le parcours complet dans votre assistant IA',
      backHref: localized('fr', 'mcp'),
    },
    compatibility: {
      checkpointLabel: client === 'chatgpt' ? 'Parcours documenté le' : 'Compatibilité vérifiée le',
      machineStatusLabel: 'État de preuve hôte',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 a validé sur le staging contrôlé OAuth, catalogue, budgets, devis exact, médias, récupération, envoi et recharge.',
        claudeCode: 'La configuration du connecteur partagé est prête, mais aucun contrôle direct de Claude Code en production n’a encore été enregistré.',
        chatgptWeb: 'ChatGPT et Codex utilisent le même plugin et la même connexion MCP. Installez MaxVideoAI puis connectez votre compte par OAuth lors de la première utilisation.',
        codexCli: 'Codex CLI 0.150.0-alpha.8 a validé en production installation, OAuth, compte, catalogue, recommandations, budgets, devis exact, génération payante, récupération et contrat du lecteur intégré.',
      },
    },
    setup: {
      ...base.setup,
      eyebrow: 'CONNECTEZ VOTRE COMPTE',
      title: `Configurer MaxVideoAI dans ${clientLabel}`,
      intro: 'Connectez-vous ou créez votre compte MaxVideoAI pendant la configuration. OAuth relie ensuite l’assistant à vos crédits, vos médias privés et vos générations dans la bibliothèque MaxVideoAI.',
      installAction: installAction('fr', clientLabel),
      hostGuides: frenchGuides(client),
      oauthTitle: 'Ce qui se passe lors de la connexion',
      oauthBody: 'Le navigateur ouvre la connexion et le consentement MaxVideoAI. L’assistant ne reçoit jamais votre mot de passe, vos données de paiement ni un accès direct à la base.',
      oauthSteps: ['Connectez-vous ou créez le compte MaxVideoAI voulu', 'Confirmez votre e-mail, puis vérifiez et approuvez la connexion', `Revenez dans ${clientLabel} et demandez l’état du compte`],
    },
    workflow: {
      ...base.workflow,
      eyebrow: 'DE L’IDÉE AU RÉSULTAT',
      title: `Créez avec ${clientLabel}, générez avec MaxVideoAI`,
      intro: 'Gardez la discussion créative dans l’assistant. MaxVideoAI apporte les informations à jour et contrôle l’exécution payante.',
      previewSteps: [
        { title: 'Développer le brief', body: `${clientLabel} précise les décisions manquantes, le plan et les prompts.` },
        { title: 'Comparer de vraies options', body: 'MaxVideoAI fournit capacités et budgets actuels : qualité, économie ou mix raisonné.' },
        { title: 'Vérifier le devis exact', body: 'Modèle, réglages, références et prix sont validés ensemble avant toute dépense.' },
        { title: 'Approuver et suivre', body: 'La génération attend votre accord clair ; le résultat reste dans la bibliothèque MaxVideoAI du compte.' },
      ],
      liveSteps: [
        { title: 'Développer le brief', body: `${clientLabel} précise les choix créatifs, le format, la qualité et le budget.` },
        { title: 'Comparer les modèles actuels', body: 'MaxVideoAI propose le meilleur choix et des alternatives crédibles avec leurs compromis.' },
        { title: 'Vérifier le devis exact', body: 'Contrôlez prompt, réglages, références, prix et effet sur le solde.' },
        { title: 'Générer et suivre', body: 'Approuvez une fois, récupérez le statut et retrouvez le résultat dans la bibliothèque MaxVideoAI.' },
      ],
    },
    references: {
      title: 'Utiliser des références image, vidéo ou audio selon le modèle',
      planningBody: `${clientLabel} peut créer ou améliorer les idées de références et choisir le bon média pour chaque plan.`,
      liveBody: 'Sélectionnez un média privé existant dans la bibliothèque MaxVideoAI ou ouvrez un envoi sécurisé. Les types et limites viennent des informations actuelles du modèle choisi.',
      gatedBody: 'Préparez les références dans la conversation puis centralisez envois privés, génération et résultats dans votre compte MaxVideoAI.',
    },
    troubleshooting: {
      eyebrow: 'AIDE',
      title: `Aide à la connexion ${clientLabel}`,
      intro: 'L’assistant peut expliquer la prochaine étape sûre sans inventer le solde, l’état du job ni une adresse de compte.',
      items: [
        { question: 'L’assistant me demande de me reconnecter', answer: 'Terminez OAuth dans le navigateur puis revenez dans la discussion. Ne collez jamais votre mot de passe ou une clé API dans le chat.' },
        { question: 'Mon solde est insuffisant', answer: 'Demandez un lien de recharge sécurisé. Le paiement reste sur MaxVideoAI ; rechargez, vérifiez le solde puis préparez un nouveau devis.' },
        { question: 'Je ne trouve pas un résultat terminé', answer: 'Demandez les générations récentes ou ouvrez la bibliothèque MaxVideoAI. Ne relancez pas un job payant en double.' },
      ],
    },
    disconnect: {
      title: `Déconnecter ${clientLabel}`,
      body: 'Supprimez la connexion dans l’assistant et révoquez l’autorisation dans les réglages MaxVideoAI.',
      steps: [`Supprimer MaxVideoAI de ${clientLabel}`, 'Ouvrir les connexions du compte MaxVideoAI et révoquer l’accès', 'Se reconnecter plus tard avec une nouvelle approbation si nécessaire'],
    },
    support: { label: 'Contacter le support MaxVideoAI', href: '/fr/contact' },
  };
}

function spanishCopy(client: McpClientId): IntegrationPageCopy {
  const base = englishCopy(client);
  const clientLabel = label(client);
  const term = client === 'chatgpt'
    ? 'App MaxVideoAI'
    : client === 'claude'
      ? 'Conector MaxVideoAI'
      : 'Plugin MaxVideoAI';
  const setupDescription = client === 'chatgpt'
    ? 'Tras la aprobación de OpenAI, instala MaxVideoAI desde el directorio compartido de ChatGPT o conecta el MCP en modo desarrollador; OAuth empieza al usarlo.'
    : client === 'claude'
      ? 'Configura el conector remoto en Claude para preparar prompts y referencias, comparar modelos de vídeo con IA, revisar el precio y aprobar la generación.'
      : 'Instala el plugin de Codex para preparar prompts y referencias, comparar modelos de vídeo con IA, revisar el precio exacto y aprobar la generación.';
  const setupIntro = client === 'chatgpt'
    ? 'ChatGPT y Codex usan el mismo directorio de plugins compartido y la misma conexión MCP. Instala MaxVideoAI desde la ficha pública después de la aprobación, o conecta ahora el MCP para desarrolladores, inicia un chat nuevo y completa OAuth en el primer uso.'
    : client === 'claude'
      ? 'Esta página de Claude reúne la configuración del conector remoto y el paso a producción: desarrolla el brief, compara modelos y presupuestos actuales, valida las referencias y aprueba un precio exacto de MaxVideoAI cuando la solicitud esté lista.'
      : 'Esta página de Codex reúne la instalación del plugin y el paso a producción: desarrolla el brief, compara modelos y presupuestos actuales, valida las referencias y aprueba un precio exacto de MaxVideoAI cuando la solicitud esté lista.';
  return {
    ...base,
    meta: {
      title: `${term} para ${clientLabel} | MaxVideoAI`,
      description: setupDescription,
    },
    hero: {
      ...base.hero,
      eyebrow: client === 'chatgpt' ? 'APP MAXVIDEOAI' : client === 'claude' ? 'CONECTOR MAXVIDEOAI' : 'PLUGIN MAXVIDEOAI',
      title: `Crea vídeo con IA usando MaxVideoAI en ${clientLabel}`,
      intro: setupIntro,
      unavailable: 'Prepara prompts y referencias, compara modelos, presupuesta el proyecto y revisa el flujo de producción de MaxVideoAI.',
      liveStatus: client === 'chatgpt'
        ? 'Conectar MaxVideoAI en ChatGPT es gratis y no añade otra suscripción. Usa el plugin público después de la aprobación de la ficha o conecta ahora el MCP para desarrolladores, e inicia sesión o crea una cuenta mediante OAuth en el primer uso; solo los renders aprobados usan créditos de MaxVideoAI.'
        : 'Conectar MaxVideoAI es gratis y no añade otra suscripción. Inicia sesión o crea una cuenta; solo los renders aprobados usan créditos de pago por uso.',
      accountStatus: 'Necesitas una cuenta MaxVideoAI, que puedes crear gratis. La conexión no añade otra suscripción; solo los renders aprobados usan créditos de MaxVideoAI.',
      setupLabel: client === 'chatgpt' ? 'Instalar MaxVideoAI en ChatGPT' : `Configurar MaxVideoAI en ${clientLabel}`,
      backLabel: 'Ver el flujo completo en tu asistente de IA',
      backHref: localized('es', 'mcp'),
    },
    compatibility: {
      checkpointLabel: client === 'chatgpt' ? 'Flujo documentado' : 'Compatibilidad comprobada',
      machineStatusLabel: 'Estado de evidencia del host',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 completó en staging controlado OAuth, catálogo, presupuestos, precio exacto, medios, recuperación, carga y recarga.',
        claudeCode: 'La configuración del conector compartido está lista, pero todavía no se ha registrado una comprobación directa de Claude Code en producción.',
        chatgptWeb: 'ChatGPT y Codex usan el mismo plugin y la misma conexión MCP. Instala MaxVideoAI y conecta tu cuenta mediante OAuth en el primer uso.',
        codexCli: 'Codex CLI 0.150.0-alpha.8 completó en producción la instalación, OAuth, cuenta, catálogo, recomendaciones, presupuestos, precio exacto, generación de pago, recuperación y contrato del reproductor integrado.',
      },
    },
    setup: {
      ...base.setup,
      eyebrow: 'CONECTA TU CUENTA',
      title: `Configura MaxVideoAI en ${clientLabel}`,
      intro: 'Inicia sesión o crea tu cuenta MaxVideoAI durante la configuración. OAuth enlaza el asistente con tus créditos, medios privados y resultados en la biblioteca MaxVideoAI.',
      installAction: installAction('es', clientLabel),
      hostGuides: spanishGuides(client),
      oauthTitle: 'Qué ocurre al conectar',
      oauthBody: 'El navegador abre el acceso y consentimiento de MaxVideoAI. El asistente nunca recibe tu contraseña, datos de pago ni acceso directo a la base.',
      oauthSteps: ['Inicia sesión o crea la cuenta MaxVideoAI elegida', 'Confirma tu correo y después revisa y aprueba la conexión', `Vuelve a ${clientLabel} y consulta el estado de la cuenta`],
    },
    workflow: {
      ...base.workflow,
      eyebrow: 'DE LA IDEA AL RESULTADO',
      title: `Crea con ${clientLabel}; genera con MaxVideoAI`,
      intro: 'Mantén la conversación creativa en el asistente. MaxVideoAI aporta datos actuales y controla la ejecución de pago.',
      previewSteps: [
        { title: 'Desarrollar el brief', body: `${clientLabel} aclara decisiones, prepara el plan y escribe prompts.` },
        { title: 'Comparar opciones reales', body: 'MaxVideoAI devuelve capacidades y presupuestos actuales para calidad, ahorro o una mezcla razonada.' },
        { title: 'Revisar el precio exacto', body: 'Modelo, ajustes, referencias y precio se validan juntos antes de gastar.' },
        { title: 'Aprobar y seguir', body: 'La generación espera tu aprobación; el resultado queda en la biblioteca MaxVideoAI conectada.' },
      ],
      liveSteps: [
        { title: 'Desarrollar el brief', body: `${clientLabel} aclara creatividad, formato, calidad y presupuesto.` },
        { title: 'Comparar modelos actuales', body: 'MaxVideoAI propone la mejor opción y alternativas creíbles con sus diferencias.' },
        { title: 'Revisar el precio exacto', body: 'Comprueba prompt, ajustes, referencias, precio y efecto sobre el saldo.' },
        { title: 'Generar y seguir', body: 'Aprueba una vez, recupera el estado y encuentra el resultado en tu biblioteca MaxVideoAI.' },
      ],
    },
    references: {
      title: 'Usa referencias de imagen, vídeo o audio cuando el modelo lo permita',
      planningBody: `${clientLabel} puede crear o mejorar ideas de referencia y elegir el activo adecuado para cada plano.`,
      liveBody: 'Selecciona un medio privado existente en tu biblioteca MaxVideoAI o abre una carga segura. Los tipos y límites proceden de los detalles actuales del modelo.',
      gatedBody: 'Planifica referencias en la conversación y reúne cargas privadas, generación y resultados en tu cuenta MaxVideoAI.',
    },
    troubleshooting: {
      eyebrow: 'AYUDA',
      title: `Ayuda de conexión para ${clientLabel}`,
      intro: 'El asistente puede explicar el siguiente paso seguro sin inventar el saldo, el estado del trabajo ni una URL de cuenta.',
      items: [
        { question: 'El asistente me pide iniciar sesión otra vez', answer: 'Completa OAuth en el navegador y vuelve a la conversación. Nunca pegues tu contraseña o una clave API en el chat.' },
        { question: 'No tengo saldo suficiente', answer: 'Pide un enlace seguro de recarga. El pago permanece en MaxVideoAI; después comprueba el saldo y prepara un precio nuevo.' },
        { question: 'No encuentro un resultado terminado', answer: 'Pide las generaciones recientes o abre la biblioteca MaxVideoAI devuelta. No envíes un trabajo de pago duplicado.' },
      ],
    },
    disconnect: {
      title: `Desconectar ${clientLabel}`,
      body: 'Elimina la conexión en el asistente y revoca la autorización desde los ajustes de MaxVideoAI.',
      steps: [`Eliminar MaxVideoAI de ${clientLabel}`, 'Abrir las conexiones de la cuenta MaxVideoAI y revocar el acceso', 'Volver a conectar con una nueva aprobación cuando sea necesario'],
    },
    support: { label: 'Contactar con soporte de MaxVideoAI', href: '/es/contact' },
  };
}

export function getIntegrationCopy(locale: AppLocale, client: McpClientId): IntegrationPageCopy {
  if (locale === 'fr') return frenchCopy(client);
  if (locale === 'es') return spanishCopy(client);
  return englishCopy(client);
}
