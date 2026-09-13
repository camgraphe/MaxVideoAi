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
    heroIntro: 'This non-indexed preview separates deterministic MCP Client steps from selected MCP Client Tool actions for an AI Agent. A self-hosted n8n checkpoint is recorded; n8n Cloud and agent invocation still need separate validation.',
    unavailable: 'The self-hosted MCP Client path passed import, OAuth, exact approval, one confirmation and accepted-job recovery. The integration is not launched while n8n Cloud and the Chat-Model-backed agent path remain to be exercised.',
    setupLabel: 'Review the n8n setup',
    backLabel: 'Return to the live assistant workflow',
    checkpointLabel: 'Self-hosted checkpoint',
    machineStatusLabel: 'Host evidence state',
    statuses: {
      n8nMcpClient: 'Tested with limits on self-hosted n8n 2.38.7: clean import, project-scoped OAuth, deterministic planning, exact approval, one confirmation, recovery and revocation passed.',
      n8nMcpClientTool: 'MCP Client Tool 1.4 imported with five selected planning tools and no preparation or confirmation tool. Agent invocation was not exercised because no Chat Model credential was configured.',
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
      limitation: 'A prepared quote does not authorize spend. Match the approval event to its quoteId, confirm that quote once, and recover the accepted job instead of confirming again. Replays of the same quote are idempotent on MaxVideoAI.',
    }),
    oauthTitle: 'Credential ownership follows the supported n8n deployment',
    oauthBody: 'n8n stores the OAuth credential; exported workflows contain no MaxVideoAI token. The self-hosted checkpoint covered project scope, browser consent, revocation and observed access loss. Cloud, refresh and reconnect remain separate checks.',
    oauthSteps: ['Create the OAuth2 credential for the remote MCP endpoint', 'Complete MaxVideoAI browser consent with the intended account', 'Test refresh, revocation and reconnect on the exact n8n deployment'],
    workflowEyebrow: 'APPROVAL-SAFE AUTOMATION',
    workflowTitle: 'Separate planning, exact quotation, approval and recovery',
    workflowIntro: 'Deterministic nodes make the spending boundary inspectable. Agent tools can help choose and plan, but they do not receive an automatic paid-confirmation path.',
    workflowSteps: [
      { title: 'Discover and budget', body: 'Read current capabilities and calculate a bounded project budget without a charge.' },
      { title: 'Prepare the exact request', body: 'Validate the chosen prompt, settings and references and store the fresh quote.' },
      { title: 'Pause for human approval', body: 'Show the exact quote and wait for an explicit approval event before confirmation.' },
      { title: 'Confirm once and recover', body: 'Confirm only the exact approved quoteId, then poll or resume the accepted job without resubmitting after a timeout.' },
    ],
    referencesTitle: 'Keep private media account-owned',
    referencesPlanning: 'Workflows can select existing MaxVideoAI assets or create a bounded upload handoff when the chosen model supports the reference type.',
    referencesGated: 'Do not embed signed media, credentials or private bytes in the template. Resolve them at runtime through the authenticated MaxVideoAI account.',
    helpEyebrow: 'WORKFLOW SAFETY',
    helpTitle: 'Avoid duplicate spend and hidden credentials',
    helpIntro: 'Import tests and a controlled deployment must confirm each invariant before publication.',
    helpItems: [
      { question: 'Which n8n node should I use?', answer: 'Use MCP Client for deterministic steps. Use MCP Client Tool only when a bounded AI Agent needs selected tools.' },
      { question: 'Can the workflow confirm automatically?', answer: 'No. The candidate templates require a POST approval that matches the fresh quoteId. MaxVideoAI keeps confirmation idempotent for that quote.' },
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
    heroIntro: 'Cet aperçu non indexé sépare les étapes MCP Client déterministes des actions MCP Client Tool choisies pour un agent IA. Un contrôle n8n auto-hébergé est enregistré ; n8n Cloud et l’appel par agent restent à valider.',
    unavailable: 'Le parcours MCP Client auto-hébergé a validé import, OAuth, accord exact, confirmation unique et reprise du job. L’intégration n’est pas lancée tant que n8n Cloud et le parcours agent avec modèle de chat restent non vérifiés.',
    setupLabel: 'Examiner la configuration n8n',
    backLabel: 'Revenir au workflow assistant déjà en ligne',
    checkpointLabel: 'Contrôle auto-hébergé',
    machineStatusLabel: 'État de preuve de l’hôte',
    statuses: {
      n8nMcpClient: 'Testé avec limites sur n8n auto-hébergé 2.38.7 : import propre, OAuth de projet, planification, accord exact, confirmation unique, reprise et révocation ont réussi.',
      n8nMcpClientTool: 'MCP Client Tool 1.4 a été importé avec cinq outils de planification choisis, sans préparation ni confirmation. Aucun modèle de chat n’étant configuré, l’appel par agent reste non vérifié.',
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
      limitation: 'Préparer un devis n’autorise aucune dépense. Faites correspondre l’accord au quoteId, confirmez ce devis une fois puis reprenez le job accepté. Le même quoteId reste idempotent côté MaxVideoAI.',
    }),
    oauthTitle: 'La propriété de l’identifiant suit le déploiement n8n',
    oauthBody: 'n8n stocke OAuth ; les exports ne contiennent aucun jeton MaxVideoAI. Le contrôle auto-hébergé couvre la portée projet, le consentement, la révocation et la perte d’accès. Cloud, renouvellement et reconnexion restent à tester.',
    oauthSteps: ['Créer l’identifiant OAuth2 du point MCP distant', 'Valider le consentement MaxVideoAI avec le bon compte', 'Tester renouvellement, révocation et reconnexion sur le déploiement exact'],
    workflowEyebrow: 'AUTOMATISATION AVEC APPROBATION',
    workflowTitle: 'Séparez planification, devis exact, accord et reprise',
    workflowIntro: 'Les nœuds déterministes rendent la dépense inspectable. Les outils agent aident à choisir sans recevoir de confirmation payante automatique.',
    workflowSteps: [
      { title: 'Découvrir et budgéter', body: 'Consultez les capacités actuelles et calculez un budget borné sans débit.' },
      { title: 'Préparer la demande exacte', body: 'Validez prompt, réglages et références puis stockez le devis récent.' },
      { title: 'Attendre l’accord humain', body: 'Présentez le devis exact et attendez un événement d’approbation explicite.' },
      { title: 'Confirmer une fois et reprendre', body: 'Confirmez uniquement le quoteId approuvé, puis reprenez le job accepté sans le soumettre à nouveau.' },
    ],
    referencesTitle: 'Gardez les médias privés dans le compte',
    referencesPlanning: 'Le workflow sélectionne un média MaxVideoAI ou crée un relais borné si le modèle accepte cette référence.',
    referencesGated: 'N’intégrez ni média signé, ni identifiant, ni octets privés au modèle exporté ; résolvez-les à l’exécution.',
    helpEyebrow: 'SÉCURITÉ DU WORKFLOW',
    helpTitle: 'Évitez les dépenses doubles et les identifiants cachés',
    helpIntro: 'Les tests d’import et un déploiement contrôlé doivent confirmer chaque invariant avant publication.',
    helpItems: [
      { question: 'Quel nœud n8n utiliser ?', answer: 'MCP Client pour les étapes déterministes ; MCP Client Tool seulement pour fournir des outils choisis à un agent borné.' },
      { question: 'Le workflow peut-il confirmer automatiquement ?', answer: 'Non. Il exige un POST d’accord correspondant au quoteId récent. MaxVideoAI rend la confirmation de ce devis idempotente.' },
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
    heroIntro: 'Esta vista no indexada separa los pasos deterministas de MCP Client de las acciones MCP Client Tool elegidas para un agente. Ya existe una prueba self-hosted; n8n Cloud y la invocación del agente aún requieren validación separada.',
    unavailable: 'La ruta MCP Client self-hosted validó importación, OAuth, aprobación exacta, una confirmación y recuperación del job. La integración no se lanza mientras n8n Cloud y el agente con modelo de chat sigan sin verificar.',
    setupLabel: 'Revisar la configuración de n8n',
    backLabel: 'Volver al flujo de asistentes ya publicado',
    checkpointLabel: 'Prueba self-hosted',
    machineStatusLabel: 'Estado de evidencia del host',
    statuses: {
      n8nMcpClient: 'Probado con límites en n8n self-hosted 2.38.7: importación limpia, OAuth de proyecto, planificación, aprobación exacta, confirmación única, recuperación y revocación funcionaron.',
      n8nMcpClientTool: 'MCP Client Tool 1.4 se importó con cinco herramientas de planificación seleccionadas, sin preparar ni confirmar. La invocación del agente sigue sin verificar porque no había credencial de Chat Model.',
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
      limitation: 'Preparar una cotización no autoriza gasto. Vincula la aprobación a su quoteId, confirma esa cotización una vez y recupera el job aceptado. El mismo quoteId es idempotente en MaxVideoAI.',
    }),
    oauthTitle: 'La credencial pertenece al despliegue n8n compatible',
    oauthBody: 'n8n guarda OAuth; los flujos exportados no incluyen tokens. La prueba self-hosted cubrió alcance de proyecto, consentimiento, revocación y pérdida de acceso. Cloud, renovación y reconexión siguen pendientes.',
    oauthSteps: ['Crear la credencial OAuth2 del endpoint MCP', 'Completar el consentimiento con la cuenta correcta', 'Probar renovación, revocación y reconexión en el despliegue exacto'],
    workflowEyebrow: 'AUTOMATIZACIÓN CON APROBACIÓN',
    workflowTitle: 'Separa planificación, precio exacto, aprobación y recuperación',
    workflowIntro: 'Los nodos deterministas hacen visible el límite de gasto. Las herramientas del agente ayudan a elegir sin confirmación de pago automática.',
    workflowSteps: [
      { title: 'Descubrir y presupuestar', body: 'Consulta capacidades actuales y calcula un presupuesto acotado sin cargo.' },
      { title: 'Preparar la solicitud exacta', body: 'Valida prompt, ajustes y referencias y guarda la cotización reciente.' },
      { title: 'Esperar aprobación humana', body: 'Muestra el precio exacto y espera un evento de aprobación explícito.' },
      { title: 'Confirmar una vez y recuperar', body: 'Confirma solo el quoteId aprobado y recupera el job aceptado sin reenviar tras un timeout.' },
    ],
    referencesTitle: 'Mantén los medios privados en la cuenta',
    referencesPlanning: 'El flujo selecciona un activo MaxVideoAI o crea una transferencia acotada cuando el modelo admite esa referencia.',
    referencesGated: 'No incluyas medios firmados, credenciales ni bytes privados en la plantilla; resuélvelos durante la ejecución autenticada.',
    helpEyebrow: 'SEGURIDAD DEL FLUJO',
    helpTitle: 'Evita gasto duplicado y credenciales ocultas',
    helpIntro: 'Las pruebas de importación y un despliegue controlado deben confirmar cada invariante antes de publicar.',
    helpItems: [
      { question: '¿Qué nodo n8n debo usar?', answer: 'MCP Client para pasos deterministas; MCP Client Tool solo para herramientas seleccionadas de un agente acotado.' },
      { question: '¿Puede confirmar automáticamente?', answer: 'No. Exige un POST de aprobación que coincida con el quoteId reciente. MaxVideoAI mantiene idempotente la confirmación de esa cotización.' },
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
