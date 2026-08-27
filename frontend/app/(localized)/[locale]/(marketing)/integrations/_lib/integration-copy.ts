import { localePathnames, type AppLocale } from '@/i18n/locales';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import type { McpClientId, McpCompatibilityHostId } from '../../mcp/_lib/mcp-page-types';

type IntegrationSetupValue = { label: string; value: string };

type IntegrationHostGuide = {
  hostId: McpCompatibilityHostId;
  title: string;
  intro: string;
  steps: Array<{ title: string; body: string }>;
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
    statuses: Record<McpCompatibilityHostId, string>;
  };
  setup: {
    eyebrow: string;
    title: string;
    intro: string;
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

function englishGuides(client: McpClientId): IntegrationHostGuide[] {
  if (client === 'claude') {
    return [
      {
        hostId: 'claudeDesktop',
        title: 'Connect MaxVideoAI to Claude',
        intro: 'Add MaxVideoAI as a custom remote connector, then authorize your account in the browser.',
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
        hostId: 'chatgptDesktop',
        title: 'Connect from ChatGPT desktop',
        intro: 'Add MaxVideoAI as a Streamable HTTP MCP connection, then authorize the MaxVideoAI account you want to use.',
        steps: [
          { title: 'Open MCP settings', body: 'In ChatGPT desktop settings, add a remote MCP server.' },
          { title: 'Paste the server address', body: 'Use the MaxVideoAI address below; no API key is required in the client.' },
          { title: 'Authorize MaxVideoAI', body: 'Sign in, approve the connection, and return to the conversation.' },
        ],
        commands: [],
        setupValues: [{ label: 'MaxVideoAI server', value: MCP_PRODUCTION_RESOURCE_URL }],
        limitation: 'The universal server address uses your MaxVideoAI account, credits, private media and MaxVideoAI Library.',
      },
    ];
  }

  return [
    {
      hostId: 'codexCli',
      title: 'Connect from Codex CLI',
      intro: 'Register the remote server, authorize MaxVideoAI in the browser, then use MaxVideoAI from your conversation.',
      steps: [
        { title: 'Add MaxVideoAI', body: 'Register the remote MCP server. Current Codex versions normally open OAuth automatically.' },
        { title: 'Authorize the account', body: 'Complete browser sign-in. Use the manual login command only if OAuth did not open or needs renewal.' },
        { title: 'Check the connection', body: 'Read the saved connection, then ask Codex for current models or a project budget.' },
      ],
      commandLabel: 'Codex CLI commands',
      commands: [
        `codex mcp add maxvideoai --url ${MCP_PRODUCTION_RESOURCE_URL}`,
        'codex mcp login maxvideoai --scopes openid,email,profile',
        'codex mcp get maxvideoai',
      ],
      setupValues: [],
      authTrigger: 'The first command normally starts OAuth automatically; use the second only if browser authorization did not start or must be renewed.',
      limitation: 'These commands install the MCP connection, which is enough to use MaxVideoAI. They do not install the separate plan and generate skill package; that package must be distributed and installed independently.',
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
        hostId: 'chatgptDesktop',
        title: 'Connecter MaxVideoAI depuis ChatGPT',
        intro: 'Ajoutez MaxVideoAI comme connexion MCP distante, puis autorisez le compte que vous souhaitez utiliser.',
        steps: [
          { title: 'Ouvrir les réglages MCP', body: 'Dans les réglages ChatGPT, ajoutez un serveur MCP distant.' },
          { title: 'Coller l’adresse du serveur', body: 'Utilisez l’adresse MaxVideoAI ci-dessous ; aucune clé API n’est requise dans ChatGPT.' },
          { title: 'Autoriser MaxVideoAI', body: 'Connectez-vous ou créez votre compte, approuvez la connexion, puis revenez dans la conversation.' },
        ],
        commands: [],
        setupValues: [{ label: 'Serveur MaxVideoAI', value: MCP_PRODUCTION_RESOURCE_URL }],
        limitation: 'Le serveur universel utilise votre compte, vos crédits, vos médias privés et votre bibliothèque MaxVideoAI.',
      },
    ];
  }

  return [
    {
      hostId: 'codexCli',
      title: 'Connecter MaxVideoAI depuis Codex CLI',
      intro: 'Enregistrez le serveur distant, autorisez MaxVideoAI dans le navigateur, puis utilisez MaxVideoAI dans la conversation.',
      steps: [
        { title: 'Ajouter MaxVideoAI', body: 'Enregistrez le serveur MCP distant. Les versions actuelles de Codex ouvrent normalement OAuth automatiquement.' },
        { title: 'Autoriser le compte', body: 'Terminez la connexion dans le navigateur. Utilisez la commande de connexion manuelle uniquement si OAuth ne s’est pas ouvert ou doit être renouvelé.' },
        { title: 'Vérifier la connexion', body: 'Relisez la connexion puis demandez les modèles actuels ou un budget de projet.' },
      ],
      commandLabel: 'Commandes Codex CLI',
      commands: [
        `codex mcp add maxvideoai --url ${MCP_PRODUCTION_RESOURCE_URL}`,
        'codex mcp login maxvideoai --scopes openid,email,profile',
        'codex mcp get maxvideoai',
      ],
      setupValues: [],
      authTrigger: 'La première commande démarre normalement OAuth automatiquement ; utilisez la deuxième uniquement si l’autorisation ne s’est pas ouverte ou doit être renouvelée.',
      limitation: 'Ces commandes installent la connexion MCP, suffisante pour utiliser MaxVideoAI. Elles n’installent pas le package séparé des skills plan et generate ; ce package doit être distribué et installé indépendamment.',
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
        hostId: 'chatgptDesktop',
        title: 'Conectar MaxVideoAI desde ChatGPT',
        intro: 'Añade MaxVideoAI como conexión MCP remota y autoriza la cuenta que quieras utilizar.',
        steps: [
          { title: 'Abrir los ajustes MCP', body: 'En los ajustes de ChatGPT, añade un servidor MCP remoto.' },
          { title: 'Pegar la dirección', body: 'Usa la dirección MaxVideoAI siguiente; no necesitas una clave API en ChatGPT.' },
          { title: 'Autorizar MaxVideoAI', body: 'Inicia sesión o crea tu cuenta, aprueba la conexión y vuelve a la conversación.' },
        ],
        commands: [],
        setupValues: [{ label: 'Servidor MaxVideoAI', value: MCP_PRODUCTION_RESOURCE_URL }],
        limitation: 'El servidor universal utiliza tu cuenta, créditos, medios privados y biblioteca MaxVideoAI.',
      },
    ];
  }

  return [
    {
      hostId: 'codexCli',
      title: 'Conectar MaxVideoAI desde Codex CLI',
      intro: 'Registra el servidor remoto, autoriza MaxVideoAI en el navegador y usa MaxVideoAI en la conversación.',
      steps: [
        { title: 'Añadir MaxVideoAI', body: 'Registra el servidor MCP remoto. Las versiones actuales de Codex normalmente abren OAuth automáticamente.' },
        { title: 'Autorizar la cuenta', body: 'Completa el acceso en el navegador. Usa el comando de inicio manual solo si OAuth no se abrió o debe renovarse.' },
        { title: 'Comprobar la conexión', body: 'Lee la conexión y consulta los modelos actuales o un presupuesto de proyecto.' },
      ],
      commandLabel: 'Comandos de Codex CLI',
      commands: [
        `codex mcp add maxvideoai --url ${MCP_PRODUCTION_RESOURCE_URL}`,
        'codex mcp login maxvideoai --scopes openid,email,profile',
        'codex mcp get maxvideoai',
      ],
      setupValues: [],
      authTrigger: 'El primer comando normalmente inicia OAuth automáticamente; usa el segundo solo si la autorización no se abrió o debe renovarse.',
      limitation: 'Estos comandos instalan la conexión MCP, suficiente para usar MaxVideoAI. No instalan el paquete separado de skills plan y generate; ese paquete debe distribuirse e instalarse de forma independiente.',
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
  return {
    client,
    clientLabel,
    meta: {
      title: `${productTerm.replace(/^./, (value) => value.toUpperCase())} for ${clientLabel} | MaxVideoAI`,
      description: `Plan prompts and references, compare current AI video models, see the exact price, and generate through MaxVideoAI from ${clientLabel}.`,
    },
    hero: {
      eyebrow: client === 'chatgpt' ? 'MAXVIDEOAI APP' : client === 'claude' ? 'MAXVIDEOAI CONNECTOR' : 'MAXVIDEOAI PLUGIN',
      title: `Create AI video with MaxVideoAI in ${clientLabel}`,
      intro: `Keep the creative conversation in ${clientLabel}. It can develop the brief, prompts and references while MaxVideoAI supplies current models, comparable budgets, exact quotes and generation.`,
      unavailable: 'Plan prompts and references, compare current models, budget the project and review the exact MaxVideoAI production workflow.',
      liveStatus: 'MaxVideoAI is free to connect, with no separate subscription. Sign in or create an account; advice and project estimates are free, and only an approved generation uses pay-as-you-go credits.',
      accountStatus: 'A MaxVideoAI account is required and free to create. Connect with no separate subscription; only approved generations use pay-as-you-go credits.',
      setupLabel: `Set up MaxVideoAI in ${clientLabel}`,
      backLabel: 'See the complete AI assistant workflow',
      backHref: '/mcp',
    },
    compatibility: {
      checkpointLabel: 'Compatibility checked',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 completed OAuth, model discovery, budgeting, exact quote, media, recovery, upload-handoff and top-up-handoff checks on controlled staging.',
        claudeCode: 'The shared connector configuration is ready, but a direct Claude Code production check has not yet been recorded.',
        chatgptDesktop: 'ChatGPT desktop supports direct remote MCP setup, but a direct MaxVideoAI installation and output-rendering check has not yet been recorded on this exact surface.',
        codexCli: 'Codex CLI 0.150.0-alpha.8 completed production installation, OAuth, account, catalog, recommendation, budgeting, exact-quote, paid-generation, recovery and inline-player contract checks.',
      },
    },
    setup: {
      eyebrow: 'CONNECT YOUR ACCOUNT',
      title: `Set up MaxVideoAI in ${clientLabel}`,
      intro: 'Sign in or create your MaxVideoAI account during setup. One secure OAuth connection links the assistant to your pay-as-you-go credits, private media and completed generations in MaxVideoAI Library.',
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
  return {
    ...base,
    meta: {
      title: `${term} pour ${clientLabel} | MaxVideoAI`,
      description: `Préparez prompts et références, comparez les modèles vidéo IA, voyez le prix exact et générez avec MaxVideoAI depuis ${clientLabel}.`,
    },
    hero: {
      ...base.hero,
      eyebrow: client === 'chatgpt' ? 'APP MAXVIDEOAI' : client === 'claude' ? 'CONNECTEUR MAXVIDEOAI' : 'PLUGIN MAXVIDEOAI',
      title: `Créez vos vidéos IA avec MaxVideoAI dans ${clientLabel}`,
      intro: `Gardez la discussion créative dans ${clientLabel}. Il développe le brief, les prompts et les références ; MaxVideoAI fournit les modèles actuels, les budgets comparables, le devis exact et la génération.`,
      unavailable: 'Préparez prompts et références, comparez les modèles, budgétez le projet et découvrez le parcours de production MaxVideoAI.',
      liveStatus: 'La connexion MaxVideoAI est gratuite, sans abonnement supplémentaire. Connectez-vous ou créez un compte ; seuls les rendus approuvés utilisent vos crédits MaxVideoAI à la consommation.',
      accountStatus: 'Un compte MaxVideoAI est requis et sa création est gratuite. La connexion n’ajoute aucun abonnement ; seuls les rendus approuvés utilisent vos crédits MaxVideoAI.',
      setupLabel: `Configurer MaxVideoAI dans ${clientLabel}`,
      backLabel: 'Voir le parcours complet dans votre assistant IA',
      backHref: localized('fr', 'mcp'),
    },
    compatibility: {
      checkpointLabel: 'Compatibilité vérifiée le',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 a validé sur le staging contrôlé OAuth, catalogue, budgets, devis exact, médias, récupération, envoi et recharge.',
        claudeCode: 'La configuration du connecteur partagé est prête, mais aucun contrôle direct de Claude Code en production n’a encore été enregistré.',
        chatgptDesktop: 'ChatGPT desktop accepte les connexions MCP distantes, mais aucune installation MaxVideoAI ni aucun rendu de résultat n’a encore été enregistré sur cette surface précise.',
        codexCli: 'Codex CLI 0.150.0-alpha.8 a validé en production installation, OAuth, compte, catalogue, recommandations, budgets, devis exact, génération payante, récupération et contrat du lecteur intégré.',
      },
    },
    setup: {
      ...base.setup,
      eyebrow: 'CONNECTEZ VOTRE COMPTE',
      title: `Configurer MaxVideoAI dans ${clientLabel}`,
      intro: 'Connectez-vous ou créez votre compte MaxVideoAI pendant la configuration. OAuth relie ensuite l’assistant à vos crédits, vos médias privés et vos générations dans la bibliothèque MaxVideoAI.',
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
  return {
    ...base,
    meta: {
      title: `${term} para ${clientLabel} | MaxVideoAI`,
      description: `Prepara prompts y referencias, compara modelos de vídeo con IA, revisa el precio exacto y genera con MaxVideoAI desde ${clientLabel}.`,
    },
    hero: {
      ...base.hero,
      eyebrow: client === 'chatgpt' ? 'APP MAXVIDEOAI' : client === 'claude' ? 'CONECTOR MAXVIDEOAI' : 'PLUGIN MAXVIDEOAI',
      title: `Crea vídeo con IA usando MaxVideoAI en ${clientLabel}`,
      intro: `Mantén la conversación creativa en ${clientLabel}. Desarrolla el brief, los prompts y las referencias; MaxVideoAI aporta modelos actuales, presupuestos comparables, precio exacto y generación.`,
      unavailable: 'Prepara prompts y referencias, compara modelos, presupuesta el proyecto y revisa el flujo de producción de MaxVideoAI.',
      liveStatus: 'Conectar MaxVideoAI es gratis y no añade otra suscripción. Inicia sesión o crea una cuenta; solo los renders aprobados usan créditos de pago por uso.',
      accountStatus: 'Necesitas una cuenta MaxVideoAI, que puedes crear gratis. La conexión no añade otra suscripción; solo los renders aprobados usan créditos de MaxVideoAI.',
      setupLabel: `Configurar MaxVideoAI en ${clientLabel}`,
      backLabel: 'Ver el flujo completo en tu asistente de IA',
      backHref: localized('es', 'mcp'),
    },
    compatibility: {
      checkpointLabel: 'Compatibilidad comprobada',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 completó en staging controlado OAuth, catálogo, presupuestos, precio exacto, medios, recuperación, carga y recarga.',
        claudeCode: 'La configuración del conector compartido está lista, pero todavía no se ha registrado una comprobación directa de Claude Code en producción.',
        chatgptDesktop: 'ChatGPT desktop admite MCP remoto, pero todavía no se ha registrado en esta superficie una instalación directa de MaxVideoAI ni el renderizado del resultado.',
        codexCli: 'Codex CLI 0.150.0-alpha.8 completó en producción la instalación, OAuth, cuenta, catálogo, recomendaciones, presupuestos, precio exacto, generación de pago, recuperación y contrato del reproductor integrado.',
      },
    },
    setup: {
      ...base.setup,
      eyebrow: 'CONECTA TU CUENTA',
      title: `Configura MaxVideoAI en ${clientLabel}`,
      intro: 'Inicia sesión o crea tu cuenta MaxVideoAI durante la configuración. OAuth enlaza el asistente con tus créditos, medios privados y resultados en la biblioteca MaxVideoAI.',
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
