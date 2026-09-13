import type { AppLocale } from '@/i18n/locales';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import { buildPreviewIntegrationCopy, getIntegrationInstallInstruction } from './shared';
import type { IntegrationPageCopy, PreviewIntegrationText } from './types';

function guides(locale: AppLocale, text: {
  deterministicTitle: string;
  deterministicIntro: string;
  agentTitle: string;
  agentIntro: string;
  select: string;
  credential: string;
  approval: string;
  limitation: string;
}) {
  return [
    {
      hostId: 'n8nMcpClient' as const,
      title: text.deterministicTitle,
      intro: text.deterministicIntro,
      installInstruction: getIntegrationInstallInstruction(locale, 'n8nMcpClient'),
      steps: [
        { title: text.credential, body: text.select },
        { title: text.approval, body: text.limitation },
      ],
      commands: [],
      setupValues: [{ label: 'MCP endpoint', value: MCP_PRODUCTION_RESOURCE_URL }],
      limitation: text.limitation,
    },
    {
      hostId: 'n8nMcpClientTool' as const,
      title: text.agentTitle,
      intro: text.agentIntro,
      installInstruction: getIntegrationInstallInstruction(locale, 'n8nMcpClientTool'),
      steps: [
        { title: text.credential, body: text.select },
        { title: text.approval, body: text.limitation },
      ],
      commands: [],
      setupValues: [{ label: 'MCP endpoint', value: MCP_PRODUCTION_RESOURCE_URL }],
      limitation: text.limitation,
    },
  ];
}

function english(): PreviewIntegrationText {
  return {
    metaTitle: 'Automate AI Video with n8n and MaxVideoAI | Preview',
    metaDescription: 'Preview approval-safe MaxVideoAI workflows using n8n MCP Client steps or selected MCP Client Tool actions for an AI Agent.',
    eyebrow: 'N8N WORKFLOW PREVIEW',
    heroTitle: 'Design repeatable AI video workflows in n8n with MaxVideoAI',
    heroIntro: 'This non-indexed preview separates deterministic MCP Client steps from selected MCP Client Tool actions for an AI Agent. Clean import and OAuth evidence are still required before launch.',
    unavailable: 'The workflow candidates are being validated. Review their OAuth, approval, idempotency and accepted-job recovery boundaries without treating the n8n integration as launched.',
    setupLabel: 'Review the n8n setup',
    backLabel: 'Return to the live assistant workflow',
    checkpointLabel: 'Documentation reviewed',
    machineStatusLabel: 'Host evidence state',
    statuses: {
      n8nMcpClient: 'n8n documents the MCP Client as a deterministic workflow step, but no MaxVideoAI clean import or OAuth run is recorded.',
      n8nMcpClientTool: 'n8n documents the MCP Client Tool for AI Agents, but MaxVideoAI tool selection, approval and recovery have not been tested in this host.',
    },
    setupEyebrow: 'CHOOSE THE EXECUTION SHAPE',
    setupTitle: 'Use deterministic steps for fixed workflows and agent tools for bounded decisions',
    setupIntro: 'Both paths connect to the same MaxVideoAI endpoint through an n8n-owned OAuth credential. The credential belongs to the n8n project or instance and is never embedded in an exported template.',
    guides: guides('en', {
      deterministicTitle: 'MCP Client for deterministic workflow steps',
      deterministicIntro: 'Choose one MaxVideoAI tool per node when the workflow order and inputs should remain explicit.',
      agentTitle: 'MCP Client Tool for a bounded AI Agent',
      agentIntro: 'Expose only selected discovery and planning tools to an AI Agent; keep paid confirmation behind a separate human gate.',
      select: 'Create an OAuth2 credential for the MaxVideoAI endpoint, then select the exact tool and JSON input in the node.',
      credential: 'Connect the OAuth credential',
      approval: 'Keep approval outside preparation',
      limitation: 'A prepared quote does not authorize spend. Carry a stable idempotency key through the human approval gate and recover any accepted job instead of confirming again.',
    }),
    oauthTitle: 'Credential ownership follows the supported n8n deployment',
    oauthBody: 'n8n stores the OAuth credential; exported workflows contain no MaxVideoAI token. Cloud and self-hosted deployments must each record their credential scope, callback, refresh, revocation and reconnect behavior.',
    oauthSteps: ['Create the OAuth2 credential for the remote MCP endpoint', 'Complete MaxVideoAI browser consent with the intended account', 'Test refresh, revocation and reconnect on the exact n8n deployment'],
    workflowEyebrow: 'APPROVAL-SAFE AUTOMATION',
    workflowTitle: 'Separate planning, exact quotation, approval and recovery',
    workflowIntro: 'Deterministic nodes make the spending boundary inspectable. Agent tools can help choose and plan, but they do not receive an automatic paid-confirmation path.',
    workflowSteps: [
      { title: 'Discover and budget', body: 'Read current capabilities and calculate a bounded project budget without a charge.' },
      { title: 'Prepare the exact request', body: 'Validate the chosen prompt, settings and references and store the fresh quote.' },
      { title: 'Pause for human approval', body: 'Show the exact quote and wait for an explicit approval event before confirmation.' },
      { title: 'Confirm once and recover', body: 'Use a stable idempotency key, then poll or resume the accepted job without resubmitting after a timeout.' },
    ],
    referencesTitle: 'Keep private media account-owned',
    referencesPlanning: 'Workflows can select existing MaxVideoAI assets or create a bounded upload handoff when the chosen model supports the reference type.',
    referencesGated: 'Do not embed signed media, credentials or private bytes in the template. Resolve them at runtime through the authenticated MaxVideoAI account.',
    helpEyebrow: 'WORKFLOW SAFETY',
    helpTitle: 'Avoid duplicate spend and hidden credentials',
    helpIntro: 'Import tests and a controlled deployment must confirm each invariant before publication.',
    helpItems: [
      { question: 'Which n8n node should I use?', answer: 'Use MCP Client for deterministic steps. Use MCP Client Tool only when a bounded AI Agent needs selected tools.' },
      { question: 'Can the workflow confirm automatically?', answer: 'No. The candidate templates pause for explicit approval of the fresh exact quote and preserve its stable idempotency key.' },
      { question: 'What happens when polling times out?', answer: 'Resume status for the accepted job. Do not route timeout recovery back into confirmation or create a replacement.' },
    ],
    disconnectTitle: 'Disconnect n8n from MaxVideoAI',
    disconnectBody: 'Delete or disable the n8n OAuth credential and revoke its grant in MaxVideoAI account connections. Templates remain credential-free and cannot reconnect themselves.',
    disconnectSteps: ['Disable the workflows that use the credential', 'Delete the n8n credential and revoke the MaxVideoAI grant', 'Confirm protected nodes fail before creating a new credential'],
    supportLabel: 'Contact MaxVideoAI support',
  };
}

function french(): PreviewIntegrationText {
  const copy = english();
  return {
    ...copy,
    metaTitle: 'Automatiser la vidéo IA avec n8n et MaxVideoAI | Aperçu',
    metaDescription: 'Aperçu de workflows MaxVideoAI sûrs avec des étapes n8n MCP Client ou des actions MCP Client Tool sélectionnées pour un agent IA.',
    eyebrow: 'APERÇU DE WORKFLOW N8N',
    heroTitle: 'Concevez des workflows vidéo IA répétables dans n8n avec MaxVideoAI',
    heroIntro: 'Cet aperçu non indexé sépare les étapes MCP Client déterministes des actions MCP Client Tool choisies pour un agent IA. L’import propre et OAuth restent à prouver.',
    unavailable: 'Les workflows candidats sont en validation. Examinez OAuth, approbation, idempotence et reprise des jobs acceptés sans considérer l’intégration n8n comme lancée.',
    setupLabel: 'Examiner la configuration n8n',
    backLabel: 'Revenir au workflow assistant déjà en ligne',
    checkpointLabel: 'Documentation examinée',
    machineStatusLabel: 'État de preuve de l’hôte',
    statuses: {
      n8nMcpClient: 'n8n documente MCP Client comme étape déterministe, mais aucun import propre ni cycle OAuth MaxVideoAI n’est enregistré.',
      n8nMcpClientTool: 'n8n documente MCP Client Tool pour les agents IA, mais la sélection, l’approbation et la reprise MaxVideoAI ne sont pas testées.',
    },
    setupEyebrow: 'CHOISIR LE MODE D’EXÉCUTION',
    setupTitle: 'Étapes déterministes pour les flux fixes, outils agent pour les décisions bornées',
    setupIntro: 'Les deux parcours utilisent le même point MaxVideoAI via un identifiant OAuth détenu par n8n. Aucun jeton n’est intégré au workflow exporté.',
    guides: guides('fr', {
      deterministicTitle: 'MCP Client pour des étapes déterministes',
      deterministicIntro: 'Choisissez un outil MaxVideoAI par nœud lorsque l’ordre et les entrées doivent rester explicites.',
      agentTitle: 'MCP Client Tool pour un agent IA borné',
      agentIntro: 'Exposez uniquement des outils choisis de découverte et planification ; gardez la confirmation payante derrière une validation humaine.',
      select: 'Créez l’identifiant OAuth2 pour le point MCP, puis choisissez l’outil et son entrée JSON exacte.',
      credential: 'Connecter l’identifiant OAuth',
      approval: 'Séparer préparation et accord',
      limitation: 'Préparer un devis n’autorise aucune dépense. Transmettez une clé d’idempotence stable après l’accord et reprenez le job accepté au lieu de confirmer à nouveau.',
    }),
    oauthTitle: 'La propriété de l’identifiant suit le déploiement n8n',
    oauthBody: 'n8n stocke OAuth ; les exports ne contiennent aucun jeton MaxVideoAI. Cloud et auto-hébergé doivent chacun consigner portée, callback, renouvellement, révocation et reconnexion.',
    oauthSteps: ['Créer l’identifiant OAuth2 du point MCP distant', 'Valider le consentement MaxVideoAI avec le bon compte', 'Tester renouvellement, révocation et reconnexion sur le déploiement exact'],
    workflowEyebrow: 'AUTOMATISATION AVEC APPROBATION',
    workflowTitle: 'Séparez planification, devis exact, accord et reprise',
    workflowIntro: 'Les nœuds déterministes rendent la dépense inspectable. Les outils agent aident à choisir sans recevoir de confirmation payante automatique.',
    workflowSteps: [
      { title: 'Découvrir et budgéter', body: 'Consultez les capacités actuelles et calculez un budget borné sans débit.' },
      { title: 'Préparer la demande exacte', body: 'Validez prompt, réglages et références puis stockez le devis récent.' },
      { title: 'Attendre l’accord humain', body: 'Présentez le devis exact et attendez un événement d’approbation explicite.' },
      { title: 'Confirmer une fois et reprendre', body: 'Gardez une clé d’idempotence stable, puis reprenez le job accepté sans le soumettre à nouveau.' },
    ],
    referencesTitle: 'Gardez les médias privés dans le compte',
    referencesPlanning: 'Le workflow sélectionne un média MaxVideoAI ou crée un relais borné si le modèle accepte cette référence.',
    referencesGated: 'N’intégrez ni média signé, ni identifiant, ni octets privés au modèle exporté ; résolvez-les à l’exécution.',
    helpEyebrow: 'SÉCURITÉ DU WORKFLOW',
    helpTitle: 'Évitez les dépenses doubles et les identifiants cachés',
    helpIntro: 'Les tests d’import et un déploiement contrôlé doivent confirmer chaque invariant avant publication.',
    helpItems: [
      { question: 'Quel nœud n8n utiliser ?', answer: 'MCP Client pour les étapes déterministes ; MCP Client Tool seulement pour fournir des outils choisis à un agent borné.' },
      { question: 'Le workflow peut-il confirmer automatiquement ?', answer: 'Non. Il attend l’accord explicite sur le devis récent et conserve sa clé d’idempotence stable.' },
      { question: 'Que faire après un délai de polling ?', answer: 'Reprenez le statut du job accepté ; ne revenez pas à la confirmation et ne créez pas de remplacement.' },
    ],
    disconnectTitle: 'Déconnecter n8n de MaxVideoAI',
    disconnectBody: 'Désactivez ou supprimez l’identifiant OAuth n8n puis révoquez-le dans MaxVideoAI. Les modèles sans identifiant ne peuvent pas se reconnecter seuls.',
    disconnectSteps: ['Désactiver les workflows concernés', 'Supprimer l’identifiant n8n et révoquer MaxVideoAI', 'Vérifier l’échec des nœuds protégés avant une nouvelle connexion'],
    supportLabel: 'Contacter le support MaxVideoAI',
  };
}

function spanish(): PreviewIntegrationText {
  const copy = english();
  return {
    ...copy,
    metaTitle: 'Automatiza vídeo IA con n8n y MaxVideoAI | Vista previa',
    metaDescription: 'Vista previa de flujos seguros con pasos n8n MCP Client o acciones MCP Client Tool seleccionadas para un agente de IA.',
    eyebrow: 'VISTA PREVIA DE N8N',
    heroTitle: 'Diseña flujos repetibles de vídeo IA en n8n con MaxVideoAI',
    heroIntro: 'Esta vista no indexada separa los pasos deterministas de MCP Client de las acciones MCP Client Tool elegidas para un agente. Aún faltan importación limpia y evidencia OAuth.',
    unavailable: 'Los flujos candidatos están en validación. Revisa OAuth, aprobación, idempotencia y recuperación de jobs aceptados sin considerar lanzada la integración n8n.',
    setupLabel: 'Revisar la configuración de n8n',
    backLabel: 'Volver al flujo de asistentes ya publicado',
    checkpointLabel: 'Documentación revisada',
    machineStatusLabel: 'Estado de evidencia del host',
    statuses: {
      n8nMcpClient: 'n8n documenta MCP Client como paso determinista, pero no existe una importación limpia ni una ejecución OAuth de MaxVideoAI registrada.',
      n8nMcpClientTool: 'n8n documenta MCP Client Tool para agentes, pero no se han probado selección, aprobación ni recuperación de MaxVideoAI.',
    },
    setupEyebrow: 'ELEGIR LA FORMA DE EJECUCIÓN',
    setupTitle: 'Pasos deterministas para flujos fijos y herramientas de agente para decisiones acotadas',
    setupIntro: 'Ambas rutas usan el mismo endpoint mediante una credencial OAuth propiedad de n8n. Nunca se incluye un token en el flujo exportado.',
    guides: guides('es', {
      deterministicTitle: 'MCP Client para pasos deterministas',
      deterministicIntro: 'Elige una herramienta MaxVideoAI por nodo cuando el orden y las entradas deban ser explícitos.',
      agentTitle: 'MCP Client Tool para un agente acotado',
      agentIntro: 'Expón solo herramientas elegidas de descubrimiento y planificación; mantén la confirmación de pago tras aprobación humana.',
      select: 'Crea la credencial OAuth2 para el endpoint MCP y selecciona la herramienta y su entrada JSON exacta.',
      credential: 'Conectar la credencial OAuth',
      approval: 'Separar preparación y aprobación',
      limitation: 'Preparar una cotización no autoriza gasto. Conserva una clave de idempotencia estable tras la aprobación y recupera el job aceptado sin confirmar otra vez.',
    }),
    oauthTitle: 'La credencial pertenece al despliegue n8n compatible',
    oauthBody: 'n8n guarda OAuth; los flujos exportados no incluyen tokens. Cloud y self-hosted deben registrar alcance, callback, renovación, revocación y reconexión.',
    oauthSteps: ['Crear la credencial OAuth2 del endpoint MCP', 'Completar el consentimiento con la cuenta correcta', 'Probar renovación, revocación y reconexión en el despliegue exacto'],
    workflowEyebrow: 'AUTOMATIZACIÓN CON APROBACIÓN',
    workflowTitle: 'Separa planificación, precio exacto, aprobación y recuperación',
    workflowIntro: 'Los nodos deterministas hacen visible el límite de gasto. Las herramientas del agente ayudan a elegir sin confirmación de pago automática.',
    workflowSteps: [
      { title: 'Descubrir y presupuestar', body: 'Consulta capacidades actuales y calcula un presupuesto acotado sin cargo.' },
      { title: 'Preparar la solicitud exacta', body: 'Valida prompt, ajustes y referencias y guarda la cotización reciente.' },
      { title: 'Esperar aprobación humana', body: 'Muestra el precio exacto y espera un evento de aprobación explícito.' },
      { title: 'Confirmar una vez y recuperar', body: 'Usa una clave de idempotencia estable y recupera el job aceptado sin reenviar tras un timeout.' },
    ],
    referencesTitle: 'Mantén los medios privados en la cuenta',
    referencesPlanning: 'El flujo selecciona un activo MaxVideoAI o crea una transferencia acotada cuando el modelo admite esa referencia.',
    referencesGated: 'No incluyas medios firmados, credenciales ni bytes privados en la plantilla; resuélvelos durante la ejecución autenticada.',
    helpEyebrow: 'SEGURIDAD DEL FLUJO',
    helpTitle: 'Evita gasto duplicado y credenciales ocultas',
    helpIntro: 'Las pruebas de importación y un despliegue controlado deben confirmar cada invariante antes de publicar.',
    helpItems: [
      { question: '¿Qué nodo n8n debo usar?', answer: 'MCP Client para pasos deterministas; MCP Client Tool solo para herramientas seleccionadas de un agente acotado.' },
      { question: '¿Puede confirmar automáticamente?', answer: 'No. Espera aprobación explícita de la cotización reciente y conserva su clave de idempotencia estable.' },
      { question: '¿Qué ocurre tras un timeout?', answer: 'Recupera el estado del job aceptado; no vuelvas a confirmar ni crees un reemplazo.' },
    ],
    disconnectTitle: 'Desconectar n8n de MaxVideoAI',
    disconnectBody: 'Desactiva o elimina la credencial OAuth de n8n y revócala en MaxVideoAI. Las plantillas sin credenciales no pueden reconectarse solas.',
    disconnectSteps: ['Desactivar los flujos que usan la credencial', 'Eliminar la credencial n8n y revocar MaxVideoAI', 'Confirmar el fallo de nodos protegidos antes de crear otra credencial'],
    supportLabel: 'Contactar con soporte de MaxVideoAI',
  };
}

export function buildN8nIntegrationCopy(locale: AppLocale): IntegrationPageCopy {
  return buildPreviewIntegrationCopy({
    client: 'n8n',
    locale,
    text: locale === 'fr' ? french() : locale === 'es' ? spanish() : english(),
  });
}
