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
        limitation: 'Claude Desktop is verified against controlled MaxVideoAI staging. Production access opens with the public launch.',
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
        limitation: 'The package is ready for Claude Code; final production-host verification remains part of launch QA.',
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
        limitation: 'The universal server address uses your existing MaxVideoAI account, credits, private media and library.',
      },
    ];
  }

  return [
    {
      hostId: 'codexCli',
      title: 'Connect from Codex CLI',
      intro: 'Register the remote server, authorize MaxVideoAI in the browser, then use the plugin from your conversation.',
      steps: [
        { title: 'Add MaxVideoAI', body: 'Register the remote MCP server with the command below.' },
        { title: 'Authorize the account', body: 'Start OAuth login with the minimal identity scopes.' },
        { title: 'Check the connection', body: 'Read the saved connection, then ask Codex for current models or a project budget.' },
      ],
      commandLabel: 'Codex CLI commands',
      commands: [
        `codex mcp add maxvideoai --url ${MCP_PRODUCTION_RESOURCE_URL}`,
        'codex mcp login maxvideoai --scopes openid,email,profile',
        'codex mcp get maxvideoai',
      ],
      setupValues: [],
      limitation: 'Codex CLI is verified against controlled MaxVideoAI staging. The graphical ChatGPT/Codex directory path is tracked separately.',
    },
  ];
}

function englishCopy(client: McpClientId): IntegrationPageCopy {
  const clientLabel = label(client);
  const productTerm = client === 'claude' ? 'AI video connector' : 'AI video plugin';
  return {
    client,
    clientLabel,
    meta: {
      title: `${productTerm.replace(/^./, (value) => value.toUpperCase())} for ${clientLabel} | MaxVideoAI`,
      description: `Plan prompts and references, compare current AI video models, see the exact price, and generate through MaxVideoAI from ${clientLabel}.`,
    },
    hero: {
      eyebrow: client === 'claude' ? 'MAXVIDEOAI CONNECTOR' : 'MAXVIDEOAI AI VIDEO PLUGIN',
      title: `${productTerm.replace(/^./, (value) => value.toUpperCase())} for ${clientLabel}`,
      intro: `Turn ${clientLabel} into your video production partner. It can develop the brief, prompts and references while MaxVideoAI supplies current models, comparable budgets, exact quotes and the generation workflow.`,
      unavailable: 'Plan prompts and references, compare current models, budget the project and review the exact MaxVideoAI production workflow.',
      liveStatus: 'Connect your MaxVideoAI account with OAuth. Advice and project estimates are free; only an approved generation uses MaxVideoAI credits.',
      backLabel: 'See the complete AI assistant workflow',
      backHref: '/mcp',
    },
    compatibility: {
      checkpointLabel: 'Compatibility checked',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 completed OAuth, model discovery, budgeting, exact quote, media, recovery, upload-handoff and top-up-handoff checks on controlled staging.',
        claudeCode: 'The shared plugin and MCP configuration are ready; a separate Claude Code host check is still scheduled before a broad compatibility claim.',
        chatgptDesktop: 'ChatGPT desktop supports direct remote MCP setup. The final MaxVideoAI production connection will be checked on this exact surface before launch.',
        codexCli: 'Codex CLI 0.149.0-alpha.4.3 completed OAuth, account, catalog, budgeting, exact-quote and top-up-handoff checks on controlled staging.',
      },
    },
    setup: {
      eyebrow: 'CONNECT YOUR ACCOUNT',
      title: `Set up MaxVideoAI in ${clientLabel}`,
      intro: 'One secure OAuth connection links the assistant to your existing MaxVideoAI credits, private media and completed generations.',
      hostGuides: englishGuides(client),
      oauthTitle: 'What happens when you connect',
      oauthBody: 'The browser opens MaxVideoAI sign-in and consent. Approval identifies the connected account; the assistant never receives your password, payment details or direct database access.',
      oauthSteps: ['Sign in to the MaxVideoAI account you want to use', 'Review and approve the requested connection', `Return to ${clientLabel} and ask for your account status`],
    },
    workflow: {
      eyebrow: 'FROM IDEA TO RESULT',
      title: `Create with ${clientLabel}; generate with MaxVideoAI`,
      intro: 'Keep the creative conversation in your assistant. MaxVideoAI handles the changing product facts and the paid execution boundary.',
      previewSteps: [
        { title: 'Develop the creative brief', body: `${clientLabel} can ask only for the missing decisions, write the shot plan and prepare prompts.` },
        { title: 'Compare real options', body: 'MaxVideoAI returns current capabilities and project estimates so you can choose quality, budget or a deliberate model mix.' },
        { title: 'Review the exact quote', body: 'The selected model, settings, references and price are validated together before any spend.' },
        { title: 'Approve, track and recover', body: 'Generation starts only after clear approval; completed media stays in the connected MaxVideoAI library.' },
      ],
      liveSteps: [
        { title: 'Develop the creative brief', body: `${clientLabel} asks for the missing creative, format, quality and budget choices.` },
        { title: 'Compare current models', body: 'MaxVideoAI returns a best-fit recommendation plus credible alternatives with concrete trade-offs.' },
        { title: 'Review the exact quote', body: 'Check prompt, settings, references, price and account effect before approving.' },
        { title: 'Generate and follow the job', body: 'Approve once, recover status safely, and find the result in your MaxVideoAI library.' },
      ],
    },
    references: {
      title: 'Use image, video or audio references when the model supports them',
      planningBody: `${clientLabel} can help create or improve reference ideas and choose the right asset for each shot.`,
      liveBody: 'Select an existing private image, video or audio asset from your MaxVideoAI library, or open a secure upload handoff. Supported kinds and limits come from the selected model’s live details.',
      gatedBody: 'Plan references in the conversation, then keep private uploads, generation and completed media together in your MaxVideoAI account.',
    },
    troubleshooting: {
      eyebrow: 'HELP',
      title: `${clientLabel} connection help`,
      intro: 'The assistant can explain the next safe step without guessing your balance, job state or account destination.',
      items: [
        { question: 'The assistant asks me to sign in again', answer: 'Complete OAuth in the browser, then return to the conversation. Never paste your MaxVideoAI password or API credentials into chat.' },
        { question: 'My balance is too low', answer: 'Ask for a secure top-up link. Payment stays on MaxVideoAI; after funding, check the balance and prepare a fresh quote before approving.' },
        { question: 'I cannot find a completed result', answer: 'Ask the assistant to list recent generations or open the returned MaxVideoAI library destination. Do not submit a duplicate paid job.' },
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
  const term = client === 'claude' ? 'Connecteur vidéo IA' : 'Plugin vidéo IA';
  return {
    ...base,
    meta: {
      title: `${term} pour ${clientLabel} | MaxVideoAI`,
      description: `Préparez prompts et références, comparez les modèles vidéo IA, voyez le prix exact et générez avec MaxVideoAI depuis ${clientLabel}.`,
    },
    hero: {
      ...base.hero,
      eyebrow: client === 'claude' ? 'CONNECTEUR MAXVIDEOAI' : 'PLUGIN VIDÉO IA MAXVIDEOAI',
      title: `${term} pour ${clientLabel}`,
      intro: `Transformez ${clientLabel} en partenaire de production vidéo. Il développe le brief, les prompts et les références ; MaxVideoAI fournit les modèles actuels, les budgets comparables, le devis exact et la génération.`,
      unavailable: 'Préparez prompts et références, comparez les modèles, budgétez le projet et découvrez le parcours de production MaxVideoAI.',
      liveStatus: 'Connectez votre compte MaxVideoAI par OAuth. Les conseils et budgets sont gratuits ; seule une génération approuvée utilise vos crédits.',
      backLabel: 'Voir le parcours complet dans votre assistant IA',
      backHref: localized('fr', 'mcp'),
    },
    compatibility: {
      checkpointLabel: 'Compatibilité vérifiée le',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 a validé sur le staging contrôlé OAuth, catalogue, budgets, devis exact, médias, récupération, envoi et recharge.',
        claudeCode: 'Le plugin et la configuration MCP partagés sont prêts ; un contrôle Claude Code distinct reste prévu avant toute promesse large.',
        chatgptDesktop: 'ChatGPT desktop permet une connexion MCP distante directe. Le serveur MaxVideoAI de production sera validé sur cette surface précise avant lancement.',
        codexCli: 'Codex CLI 0.149.0-alpha.4.3 a validé sur le staging contrôlé OAuth, compte, catalogue, budgets, devis exact et recharge.',
      },
    },
    setup: {
      ...base.setup,
      eyebrow: 'CONNECTEZ VOTRE COMPTE',
      title: `Configurer MaxVideoAI dans ${clientLabel}`,
      intro: 'Une connexion OAuth sécurisée relie l’assistant à vos crédits MaxVideoAI, vos médias privés et vos générations terminées.',
      oauthTitle: 'Ce qui se passe lors de la connexion',
      oauthBody: 'Le navigateur ouvre la connexion et le consentement MaxVideoAI. L’assistant ne reçoit jamais votre mot de passe, vos données de paiement ni un accès direct à la base.',
      oauthSteps: ['Connectez-vous au compte MaxVideoAI voulu', 'Vérifiez puis approuvez la connexion', `Revenez dans ${clientLabel} et demandez l’état du compte`],
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
        { title: 'Approuver et suivre', body: 'La génération attend votre accord clair ; le résultat reste dans la galerie MaxVideoAI du compte.' },
      ],
      liveSteps: [
        { title: 'Développer le brief', body: `${clientLabel} précise les choix créatifs, le format, la qualité et le budget.` },
        { title: 'Comparer les modèles actuels', body: 'MaxVideoAI propose le meilleur choix et des alternatives crédibles avec leurs compromis.' },
        { title: 'Vérifier le devis exact', body: 'Contrôlez prompt, réglages, références, prix et effet sur le solde.' },
        { title: 'Générer et suivre', body: 'Approuvez une fois, récupérez le statut et retrouvez le résultat dans la galerie MaxVideoAI.' },
      ],
    },
    references: {
      title: 'Utiliser des références image, vidéo ou audio selon le modèle',
      planningBody: `${clientLabel} peut créer ou améliorer les idées de références et choisir le bon média pour chaque plan.`,
      liveBody: 'Sélectionnez un média privé existant dans la galerie MaxVideoAI ou ouvrez un envoi sécurisé. Les types et limites viennent des informations actuelles du modèle choisi.',
      gatedBody: 'Préparez les références dans la conversation puis centralisez envois privés, génération et résultats dans votre compte MaxVideoAI.',
    },
    troubleshooting: {
      eyebrow: 'AIDE',
      title: `Aide à la connexion ${clientLabel}`,
      intro: 'L’assistant peut expliquer la prochaine étape sûre sans inventer le solde, l’état du job ni une adresse de compte.',
      items: [
        { question: 'L’assistant me demande de me reconnecter', answer: 'Terminez OAuth dans le navigateur puis revenez dans la discussion. Ne collez jamais votre mot de passe ou une clé API dans le chat.' },
        { question: 'Mon solde est insuffisant', answer: 'Demandez un lien de recharge sécurisé. Le paiement reste sur MaxVideoAI ; rechargez, vérifiez le solde puis préparez un nouveau devis.' },
        { question: 'Je ne trouve pas un résultat terminé', answer: 'Demandez les générations récentes ou ouvrez la galerie MaxVideoAI renvoyée. Ne relancez pas un job payant en double.' },
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
  const term = client === 'claude' ? 'Conector de vídeo con IA' : 'Plugin de vídeo con IA';
  return {
    ...base,
    meta: {
      title: `${term} para ${clientLabel} | MaxVideoAI`,
      description: `Prepara prompts y referencias, compara modelos de vídeo con IA, revisa el precio exacto y genera con MaxVideoAI desde ${clientLabel}.`,
    },
    hero: {
      ...base.hero,
      eyebrow: client === 'claude' ? 'CONECTOR MAXVIDEOAI' : 'PLUGIN DE VÍDEO MAXVIDEOAI',
      title: `${term} para ${clientLabel}`,
      intro: `Convierte ${clientLabel} en tu socio de producción. Desarrolla el brief, los prompts y las referencias; MaxVideoAI aporta modelos actuales, presupuestos comparables, precio exacto y generación.`,
      unavailable: 'Prepara prompts y referencias, compara modelos, presupuesta el proyecto y revisa el flujo de producción de MaxVideoAI.',
      liveStatus: 'Conecta tu cuenta MaxVideoAI con OAuth. El asesoramiento y los presupuestos son gratuitos; solo una generación aprobada usa créditos.',
      backLabel: 'Ver el flujo completo en tu asistente de IA',
      backHref: localized('es', 'mcp'),
    },
    compatibility: {
      checkpointLabel: 'Compatibilidad comprobada',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 completó en staging controlado OAuth, catálogo, presupuestos, precio exacto, medios, recuperación, carga y recarga.',
        claudeCode: 'El plugin y la configuración MCP compartidos están listos; falta una comprobación específica de Claude Code antes de una promesa amplia.',
        chatgptDesktop: 'ChatGPT desktop admite una conexión MCP remota directa. El servidor de producción MaxVideoAI se validará en esta superficie antes del lanzamiento.',
        codexCli: 'Codex CLI 0.149.0-alpha.4.3 completó en staging controlado OAuth, cuenta, catálogo, presupuestos, precio exacto y recarga.',
      },
    },
    setup: {
      ...base.setup,
      eyebrow: 'CONECTA TU CUENTA',
      title: `Configura MaxVideoAI en ${clientLabel}`,
      intro: 'Una conexión OAuth segura enlaza el asistente con tus créditos, medios privados y generaciones terminadas de MaxVideoAI.',
      oauthTitle: 'Qué ocurre al conectar',
      oauthBody: 'El navegador abre el acceso y consentimiento de MaxVideoAI. El asistente nunca recibe tu contraseña, datos de pago ni acceso directo a la base.',
      oauthSteps: ['Inicia sesión en la cuenta MaxVideoAI elegida', 'Revisa y aprueba la conexión', `Vuelve a ${clientLabel} y consulta el estado de la cuenta`],
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
