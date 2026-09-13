import type { AppLocale } from '@/i18n/locales';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import { buildPreviewIntegrationCopy, getIntegrationInstallInstruction } from './shared';
import type { IntegrationPageCopy, PreviewIntegrationText } from './types';

const COMMANDS = [
  `openclaw mcp set maxvideoai '{"url":"${MCP_PRODUCTION_RESOURCE_URL}","transport":"streamable-http","auth":"oauth"}'`,
  'openclaw mcp login maxvideoai',
];

function english(): PreviewIntegrationText {
  return {
    metaTitle: 'MaxVideoAI for OpenClaw | Connection Preview',
    metaDescription: 'Preview the approval-safe path for planning and producing AI video from an OpenClaw-managed agent through the MaxVideoAI remote MCP server.',
    eyebrow: 'OPENCLAW CONNECTION PREVIEW',
    heroTitle: 'Prepare an OpenClaw video-production workflow with MaxVideoAI',
    heroIntro: 'This non-indexed preview documents the current OpenClaw remote MCP and OAuth setup. MaxVideoAI has not yet recorded the complete controlled-host lifecycle required for a public compatibility claim.',
    unavailable: 'Direct host validation is still in progress. Use this page to review the intended setup, account, approval and recovery boundaries without treating the OpenClaw path as launched.',
    setupLabel: 'Review the OpenClaw setup',
    backLabel: 'Return to the live assistant workflow',
    checkpointLabel: 'Documentation reviewed',
    machineStatusLabel: 'Host evidence state',
    statuses: { openclawGateway: 'OpenClaw documents remote Streamable HTTP and OAuth, but the MaxVideoAI clean-install, OAuth lifecycle, paid confirmation and recovery checklist has not been run.' },
    setupEyebrow: 'VALIDATION SETUP',
    setupTitle: 'Configure the remote MCP without storing MaxVideoAI credentials',
    setupIntro: 'OpenClaw supports shared operator OAuth and a per-requester identity mode. Choose the identity boundary for the channel before connecting; neither mode permits credentials in prompts or committed configuration.',
    guides: [{
      hostId: 'openclawGateway',
      title: 'Register MaxVideoAI in OpenClaw',
      intro: 'Save the production Streamable HTTP endpoint with OAuth, then start browser authorization from the OpenClaw MCP command.',
      installInstruction: getIntegrationInstallInstruction('en', 'openclawGateway'),
      steps: [
        { title: 'Choose the identity model', body: 'Use shared OAuth only for an operator-owned agent. Use per-requester OAuth when each trusted sender must connect a separate MaxVideoAI account.' },
        { title: 'Save the remote server', body: 'Register the HTTPS endpoint as Streamable HTTP with OAuth. Do not add bearer tokens or passwords to configuration.' },
        { title: 'Authenticate and inspect', body: 'Run login, complete browser consent, then inspect account status and the current catalogue before preparing a quote.' },
      ],
      commandLabel: 'OpenClaw validation commands',
      commands: COMMANDS,
      setupValues: [{ label: 'MaxVideoAI MCP endpoint', value: MCP_PRODUCTION_RESOURCE_URL }],
      authTrigger: 'Run openclaw mcp login maxvideoai after saving the server.',
      limitation: 'Channel attachment, inline result and approval interfaces vary. The controlled test must record those limits before this preview can become a public compatibility page.',
    }],
    oauthTitle: 'Keep channel identity and MaxVideoAI account identity explicit',
    oauthBody: 'Shared OAuth is operator-managed. Per-requester OAuth isolates accounts by trusted sender. In both cases the browser handles MaxVideoAI sign-in and consent; the conversation never receives the password or payment details.',
    oauthSteps: ['Choose shared or per-requester identity for the deployment', 'Complete MaxVideoAI sign-in and consent in the browser', 'Test logout, observed access loss and an explicit new login'],
    workflowEyebrow: 'INTENDED SAFE FLOW',
    workflowTitle: 'Plan autonomously; spend only after a fresh approval',
    workflowIntro: 'The agent can discover models, recommend options and budget a project before preparing one exact request. A prepared quote is not authorization to spend.',
    workflowSteps: [
      { title: 'Discover and budget', body: 'Read current account and model facts, then compare a bounded project budget without spending.' },
      { title: 'Prepare one exact quote', body: 'Validate prompt, settings and references together and present the short-lived quote to the user.' },
      { title: 'Require explicit approval', body: 'Confirm only the exact fresh quote the user approved; never infer consent from the brief or budget.' },
      { title: 'Recover the accepted job', body: 'After a timeout, query the accepted job and return its canonical result or library link instead of submitting a duplicate.' },
    ],
    referencesTitle: 'Keep private references inside MaxVideoAI-owned handoffs',
    referencesPlanning: 'OpenClaw can help plan reference roles, but the selected model supplies the current accepted kinds and limits.',
    referencesGated: 'Use an existing account-owned asset or a bounded MaxVideoAI upload handoff. Record each channel’s attachment limitations during host validation.',
    helpEyebrow: 'VALIDATION NOTES',
    helpTitle: 'What must be checked before launch',
    helpIntro: 'The public claim remains closed until the exact OpenClaw version completes the applicable lifecycle.',
    helpItems: [
      { question: 'Is MaxVideoAI listed on ClawHub?', answer: 'No listing is claimed. A ClawHub package is a separate distribution artifact and cannot prove direct MCP compatibility.' },
      { question: 'Can every channel send the same references?', answer: 'Do not assume that. Attachment and inline-result behavior must be recorded per supported channel.' },
      { question: 'What happens after a timeout?', answer: 'Recover the existing accepted job by its identifier. Never create a replacement paid job automatically.' },
    ],
    disconnectTitle: 'Disconnect OpenClaw and revoke MaxVideoAI access',
    disconnectBody: 'Remove the saved OpenClaw server or log it out, then revoke the grant in MaxVideoAI account connections. Reconnection requires a new explicit browser approval.',
    disconnectSteps: ['Run OpenClaw MCP logout or remove the saved server', 'Revoke the grant in MaxVideoAI account connections', 'Confirm access is lost before testing a fresh login'],
    supportLabel: 'Contact MaxVideoAI support',
  };
}

function french(): PreviewIntegrationText {
  const copy = english();
  return {
    ...copy,
    metaTitle: 'MaxVideoAI pour OpenClaw | Aperçu de connexion',
    metaDescription: 'Aperçu du parcours sécurisé pour planifier et produire une vidéo IA depuis un agent OpenClaw via le serveur MCP distant MaxVideoAI.',
    eyebrow: 'APERÇU DE CONNEXION OPENCLAW',
    heroTitle: 'Préparez un workflow de production vidéo OpenClaw avec MaxVideoAI',
    heroIntro: 'Cet aperçu non indexé documente la configuration MCP distante et OAuth actuelle d’OpenClaw. MaxVideoAI n’a pas encore enregistré le cycle complet requis pour revendiquer la compatibilité publique.',
    unavailable: 'La validation directe de l’hôte est en cours. Consultez ici la configuration et les limites de compte, d’approbation et de reprise sans considérer le parcours OpenClaw comme lancé.',
    setupLabel: 'Examiner la configuration OpenClaw',
    backLabel: 'Revenir au workflow assistant déjà en ligne',
    checkpointLabel: 'Documentation examinée',
    machineStatusLabel: 'État de preuve de l’hôte',
    statuses: { openclawGateway: 'OpenClaw documente Streamable HTTP distant et OAuth, mais le test MaxVideoAI d’installation propre, cycle OAuth, confirmation payante et reprise n’a pas été exécuté.' },
    setupEyebrow: 'CONFIGURATION DE VALIDATION',
    setupTitle: 'Configurez le MCP distant sans stocker d’identifiants MaxVideoAI',
    setupIntro: 'OpenClaw propose un OAuth opérateur partagé et un mode d’identité par demandeur. Choisissez la frontière d’identité du canal avant la connexion ; aucun mode n’autorise des identifiants dans les prompts ou la configuration versionnée.',
    guides: [{ ...copy.guides[0], installInstruction: getIntegrationInstallInstruction('fr', 'openclawGateway'), steps: [
      { title: 'Choisir le modèle d’identité', body: 'Utilisez OAuth partagé pour un agent contrôlé par l’opérateur. Utilisez OAuth par demandeur si chaque expéditeur de confiance doit connecter son propre compte.' },
      { title: 'Enregistrer le serveur distant', body: 'Ajoutez le point HTTPS en Streamable HTTP avec OAuth, sans jeton ni mot de passe dans la configuration.' },
      { title: 'S’authentifier et vérifier', body: 'Lancez la connexion navigateur, puis consultez le compte et le catalogue actuel avant de préparer un devis.' },
    ], limitation: 'Les interfaces de pièces jointes, résultats et approbations varient selon le canal. Le test contrôlé doit les consigner avant toute publication.' }],
    oauthTitle: 'Gardez explicites l’identité du canal et celle du compte MaxVideoAI',
    oauthBody: 'OAuth partagé appartient à l’opérateur ; OAuth par demandeur sépare les comptes. Dans les deux cas, le navigateur gère la connexion et le consentement sans transmettre mot de passe ni paiement à la conversation.',
    oauthSteps: ['Choisir une identité partagée ou par demandeur', 'Valider la connexion MaxVideoAI dans le navigateur', 'Tester la déconnexion, la perte d’accès puis une nouvelle connexion explicite'],
    workflowEyebrow: 'PARCOURS SÛR PRÉVU',
    workflowTitle: 'Planifiez de façon autonome ; dépensez après un accord récent',
    workflowIntro: 'L’agent découvre, recommande et budgète avant de préparer une demande exacte. Un devis préparé ne vaut jamais autorisation de dépense.',
    workflowSteps: [
      { title: 'Découvrir et budgéter', body: 'Consultez les faits actuels puis comparez un budget borné sans dépense.' },
      { title: 'Préparer un devis exact', body: 'Validez prompt, réglages et références, puis présentez le devis à durée limitée.' },
      { title: 'Exiger un accord explicite', body: 'Confirmez uniquement le devis récent approuvé ; n’inférez jamais l’accord du brief.' },
      { title: 'Reprendre le job accepté', body: 'Après un délai, récupérez le job existant et son lien canonique sans dupliquer la dépense.' },
    ],
    referencesTitle: 'Gardez les références privées dans les relais MaxVideoAI',
    referencesPlanning: 'OpenClaw peut planifier les rôles ; le modèle sélectionné fournit les types et limites actuels.',
    referencesGated: 'Utilisez un média du compte ou un relais d’envoi MaxVideoAI borné, puis consignez les limites de chaque canal.',
    helpEyebrow: 'NOTES DE VALIDATION',
    helpTitle: 'Ce qui doit être contrôlé avant le lancement',
    helpIntro: 'La revendication publique reste fermée jusqu’au test du cycle applicable sur une version OpenClaw précise.',
    helpItems: [
      { question: 'MaxVideoAI est-il listé sur ClawHub ?', answer: 'Aucune liste n’est revendiquée. Le paquet ClawHub est distinct et ne prouve pas la compatibilité MCP directe.' },
      { question: 'Tous les canaux acceptent-ils les mêmes références ?', answer: 'Ne le supposez pas : pièces jointes et résultats intégrés doivent être testés par canal.' },
      { question: 'Que faire après un délai ?', answer: 'Reprenez le job déjà accepté avec son identifiant ; ne créez jamais automatiquement un second job payant.' },
    ],
    disconnectTitle: 'Déconnecter OpenClaw et révoquer MaxVideoAI',
    disconnectBody: 'Supprimez le serveur ou déconnectez-le dans OpenClaw, puis révoquez l’autorisation dans MaxVideoAI. Toute reconnexion exige un nouvel accord navigateur.',
    disconnectSteps: ['Déconnecter ou supprimer le serveur dans OpenClaw', 'Révoquer l’autorisation dans les connexions MaxVideoAI', 'Constater la perte d’accès avant une nouvelle connexion'],
    supportLabel: 'Contacter le support MaxVideoAI',
  };
}

function spanish(): PreviewIntegrationText {
  const copy = english();
  return {
    ...copy,
    metaTitle: 'MaxVideoAI para OpenClaw | Vista previa de conexión',
    metaDescription: 'Vista previa del flujo seguro para planificar y producir vídeo IA desde un agente OpenClaw mediante el servidor MCP remoto de MaxVideoAI.',
    eyebrow: 'VISTA PREVIA DE OPENCLAW',
    heroTitle: 'Prepara un flujo de producción de vídeo OpenClaw con MaxVideoAI',
    heroIntro: 'Esta vista previa no indexada documenta la configuración MCP remota y OAuth actual de OpenClaw. MaxVideoAI todavía no ha registrado el ciclo completo necesario para afirmar compatibilidad pública.',
    unavailable: 'La validación directa del host sigue en curso. Revisa la configuración y los límites de cuenta, aprobación y recuperación sin considerar lanzada la ruta OpenClaw.',
    setupLabel: 'Revisar la configuración de OpenClaw',
    backLabel: 'Volver al flujo de asistentes ya publicado',
    checkpointLabel: 'Documentación revisada',
    machineStatusLabel: 'Estado de evidencia del host',
    statuses: { openclawGateway: 'OpenClaw documenta Streamable HTTP remoto y OAuth, pero aún no se ha ejecutado la instalación limpia, el ciclo OAuth, la confirmación pagada ni la recuperación de MaxVideoAI.' },
    setupEyebrow: 'CONFIGURACIÓN DE VALIDACIÓN',
    setupTitle: 'Configura el MCP remoto sin guardar credenciales de MaxVideoAI',
    setupIntro: 'OpenClaw admite OAuth compartido del operador y un modo de identidad por solicitante. Elige el límite de identidad del canal antes de conectar; ningún modo permite credenciales en prompts o configuración versionada.',
    guides: [{ ...copy.guides[0], installInstruction: getIntegrationInstallInstruction('es', 'openclawGateway'), steps: [
      { title: 'Elegir el modelo de identidad', body: 'Usa OAuth compartido para un agente del operador y OAuth por solicitante cuando cada remitente de confianza conecte su propia cuenta.' },
      { title: 'Guardar el servidor remoto', body: 'Registra el endpoint HTTPS como Streamable HTTP con OAuth, sin tokens ni contraseñas en la configuración.' },
      { title: 'Autenticar e inspeccionar', body: 'Completa el consentimiento en el navegador y consulta cuenta y catálogo antes de preparar un precio exacto.' },
    ], limitation: 'Las interfaces de adjuntos, resultados y aprobación cambian según el canal. Deben registrarse antes de publicar.' }],
    oauthTitle: 'Mantén explícitas la identidad del canal y la cuenta MaxVideoAI',
    oauthBody: 'OAuth compartido pertenece al operador; OAuth por solicitante separa cuentas. El navegador gestiona acceso y consentimiento sin entregar contraseña ni pagos a la conversación.',
    oauthSteps: ['Elegir identidad compartida o por solicitante', 'Completar acceso y consentimiento en el navegador', 'Probar cierre, pérdida de acceso y una nueva conexión explícita'],
    workflowEyebrow: 'FLUJO SEGURO PREVISTO',
    workflowTitle: 'Planifica de forma autónoma; gasta solo tras una aprobación reciente',
    workflowIntro: 'El agente descubre, recomienda y presupuesta antes de preparar una solicitud exacta. Preparar una cotización no autoriza el gasto.',
    workflowSteps: [
      { title: 'Descubrir y presupuestar', body: 'Consulta datos actuales y compara un presupuesto acotado sin gastar.' },
      { title: 'Preparar un precio exacto', body: 'Valida prompt, ajustes y referencias y presenta la cotización de corta duración.' },
      { title: 'Exigir aprobación explícita', body: 'Confirma solo la cotización reciente aprobada; nunca deduzcas consentimiento del brief.' },
      { title: 'Recuperar el job aceptado', body: 'Tras un timeout, recupera el job existente y su enlace canónico sin duplicar el gasto.' },
    ],
    referencesTitle: 'Mantén referencias privadas en transferencias de MaxVideoAI',
    referencesPlanning: 'OpenClaw puede planificar los roles; el modelo elegido devuelve tipos y límites actuales.',
    referencesGated: 'Usa un activo de la cuenta o una transferencia limitada de MaxVideoAI y registra las restricciones de cada canal.',
    helpEyebrow: 'NOTAS DE VALIDACIÓN',
    helpTitle: 'Qué debe comprobarse antes del lanzamiento',
    helpIntro: 'La afirmación pública sigue cerrada hasta probar el ciclo aplicable en una versión exacta de OpenClaw.',
    helpItems: [
      { question: '¿MaxVideoAI aparece en ClawHub?', answer: 'No se afirma ningún listado. El paquete ClawHub es independiente y no prueba la compatibilidad MCP directa.' },
      { question: '¿Todos los canales aceptan las mismas referencias?', answer: 'No debe suponerse: los adjuntos y resultados integrados se prueban por canal.' },
      { question: '¿Qué ocurre tras un timeout?', answer: 'Recupera el job aceptado por su identificador; nunca crees automáticamente otro job de pago.' },
    ],
    disconnectTitle: 'Desconectar OpenClaw y revocar MaxVideoAI',
    disconnectBody: 'Elimina o cierra la sesión del servidor en OpenClaw y revoca el permiso en MaxVideoAI. Reconectar exige una nueva aprobación en el navegador.',
    disconnectSteps: ['Cerrar sesión o eliminar el servidor en OpenClaw', 'Revocar el permiso en conexiones de MaxVideoAI', 'Confirmar la pérdida de acceso antes de volver a conectar'],
    supportLabel: 'Contactar con soporte de MaxVideoAI',
  };
}

export function buildOpenClawIntegrationCopy(locale: AppLocale): IntegrationPageCopy {
  return buildPreviewIntegrationCopy({
    client: 'openclaw',
    locale,
    text: locale === 'fr' ? french() : locale === 'es' ? spanish() : english(),
  });
}
