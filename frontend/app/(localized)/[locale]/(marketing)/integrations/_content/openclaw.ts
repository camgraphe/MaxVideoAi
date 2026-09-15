import type { AppLocale } from '@/i18n/locales';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import { buildIntegrationCopy, getIntegrationInstallInstruction } from './shared';
import type { IntegrationPageCopy, IntegrationText } from './types';

const COMMANDS = [
  `openclaw mcp set maxvideoai '{"url":"${MCP_PRODUCTION_RESOURCE_URL}","transport":"streamable-http","auth":"oauth"}'`,
  'openclaw mcp login maxvideoai',
];

function english(): IntegrationText {
  return {
    metaTitle: 'MaxVideoAI for OpenClaw | AI Video Production',
    metaDescription: 'Connect OpenClaw to MaxVideoAI through direct MCP or ClawHub to plan, price, approve and recover AI video production with explicit limits.',
    eyebrow: 'OPENCLAW AI VIDEO INTEGRATION',
    heroTitle: 'Produce AI video from OpenClaw with MaxVideoAI',
    heroIntro: 'Connect through the direct remote MCP server or install MaxVideoAI 1.0.0 from ClawHub. The tested OpenClaw path covers OAuth, planning, an explicitly approved generation, recovery, revocation and reconnect; private-reference import and channel rendering remain unverified.',
    unavailable: 'OpenClaw is available through direct MCP and the listed ClawHub package, with explicit approval before spend. Private-reference import, channel attachments and inline channel rendering are outside the verified scope.',
    setupLabel: 'Connect OpenClaw',
    backLabel: 'See all supported workflows',
    checkpointLabel: 'Tested checkpoint',
    machineStatusLabel: 'Host evidence state',
    statuses: { openclawGateway: 'Tested with limits on OpenClaw 2026.9.4: OAuth denial and approval, discovery, planning, one explicit paid confirmation, accepted-job recovery, revocation, reconnect, refresh and ClawHub installation were exercised.' },
    setupEyebrow: 'CONNECT OPENCLAW',
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
      limitation: 'Private-reference import, channel attachments and inline channel rendering were not verified. Use the returned MaxVideoAI library destination when the channel does not render a result.',
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
    referencesGated: 'Private-reference import and channel attachments were not verified in OpenClaw. Add private media through MaxVideoAI, then use the account library and result link outside any unverified channel-rendering path.',
    helpEyebrow: 'SUPPORTED SCOPE',
    helpTitle: 'What the tested OpenClaw path includes',
    helpIntro: 'Direct MCP and the ClawHub package are available with the following host-specific boundaries.',
    helpItems: [
      { question: 'Is MaxVideoAI listed on ClawHub?', answer: 'Yes. MaxVideoAI 1.0.0 is listed on ClawHub under @camgraphe. The listing remains separate from direct MCP host evidence.' },
      { question: 'Can every channel send the same references?', answer: 'No supported claim is made for private-reference import or channel attachments. Channel rendering also remains unverified.' },
      { question: 'What happens after a timeout?', answer: 'Recover the existing accepted job by its identifier. Never create a replacement paid job automatically.' },
    ],
    disconnectTitle: 'Disconnect OpenClaw and revoke MaxVideoAI access',
    disconnectBody: 'Remove the saved OpenClaw server or log it out, then revoke the grant in MaxVideoAI account connections. Reconnection requires a new explicit browser approval.',
    disconnectSteps: ['Run OpenClaw MCP logout or remove the saved server', 'Revoke the grant in MaxVideoAI account connections', 'Confirm access is lost before testing a fresh login'],
    supportLabel: 'Contact MaxVideoAI support',
  };
}

function french(): IntegrationText {
  const copy = english();
  return {
    ...copy,
    metaTitle: 'MaxVideoAI pour OpenClaw | Production vidéo IA',
    metaDescription: 'Connectez OpenClaw à MaxVideoAI par MCP direct ou ClawHub pour planifier, chiffrer, approuver et reprendre une production vidéo IA.',
    eyebrow: 'INTÉGRATION VIDÉO IA OPENCLAW',
    heroTitle: 'Produisez vos vidéos IA depuis OpenClaw avec MaxVideoAI',
    heroIntro: 'Connectez le serveur MCP distant directement ou installez MaxVideoAI 1.0.0 depuis ClawHub. Le parcours testé couvre OAuth, planification, génération approuvée, reprise, révocation et reconnexion ; l’import de références privées et le rendu par canal restent non vérifiés.',
    unavailable: 'OpenClaw est disponible par MCP direct et via le paquet ClawHub listé, avec accord explicite avant toute dépense. Références privées, pièces jointes et rendu intégré aux canaux restent hors du périmètre vérifié.',
    setupLabel: 'Connecter OpenClaw',
    backLabel: 'Voir tous les workflows compatibles',
    checkpointLabel: 'Contrôle testé',
    machineStatusLabel: 'État de preuve de l’hôte',
    statuses: { openclawGateway: 'Testé avec limites sur OpenClaw 2026.9.4 : refus et accord OAuth, découverte, planification, une confirmation payante explicite, reprise, révocation, reconnexion, renouvellement et installation ClawHub ont été exercés.' },
    setupEyebrow: 'CONNECTER OPENCLAW',
    setupTitle: 'Configurez le MCP distant sans stocker d’identifiants MaxVideoAI',
    setupIntro: 'OpenClaw propose un OAuth opérateur partagé et un mode d’identité par demandeur. Choisissez la frontière d’identité du canal avant la connexion ; aucun mode n’autorise des identifiants dans les prompts ou la configuration versionnée.',
    guides: [{ ...copy.guides[0], title: 'Ajouter MaxVideoAI à OpenClaw', intro: 'Enregistrez le serveur Streamable HTTP avec OAuth, puis ouvrez l’autorisation dans votre navigateur depuis OpenClaw.', commandLabel: 'Commandes de connexion OpenClaw', setupValues: [{ label: 'Adresse MCP MaxVideoAI', value: MCP_PRODUCTION_RESOURCE_URL }], authTrigger: 'Après avoir enregistré le serveur, lancez openclaw mcp login maxvideoai.', installInstruction: getIntegrationInstallInstruction('fr', 'openclawGateway'), steps: [
      { title: 'Choisir le modèle d’identité', body: 'Utilisez OAuth partagé pour un agent contrôlé par l’opérateur. Utilisez OAuth par demandeur si chaque expéditeur de confiance doit connecter son propre compte.' },
      { title: 'Enregistrer le serveur distant', body: 'Ajoutez le point HTTPS en Streamable HTTP avec OAuth, sans jeton ni mot de passe dans la configuration.' },
      { title: 'S’authentifier et vérifier', body: 'Lancez la connexion navigateur, puis consultez le compte et le catalogue actuel avant de préparer un devis.' },
    ], limitation: 'L’import de références privées, les pièces jointes et le rendu intégré aux canaux ne sont pas vérifiés. Utilisez la bibliothèque MaxVideoAI si le canal n’affiche pas le résultat.' }],
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
    referencesGated: 'L’import de références privées et les pièces jointes ne sont pas vérifiés dans OpenClaw. Ajoutez les médias privés dans MaxVideoAI et utilisez la bibliothèque hors des parcours de rendu par canal non vérifiés.',
    helpEyebrow: 'PÉRIMÈTRE COMPATIBLE',
    helpTitle: 'Ce que couvre le parcours OpenClaw testé',
    helpIntro: 'Le MCP direct et le paquet ClawHub sont disponibles avec les limites propres à cet hôte.',
    helpItems: [
      { question: 'MaxVideoAI est-il listé sur ClawHub ?', answer: 'Oui. MaxVideoAI 1.0.0 est listé sur ClawHub sous @camgraphe. Cette liste reste distincte de la preuve MCP directe.' },
      { question: 'Tous les canaux acceptent-ils les mêmes références ?', answer: 'Aucune compatibilité n’est revendiquée pour les références privées ou pièces jointes. Le rendu intégré reste également non vérifié.' },
      { question: 'Que faire après un délai ?', answer: 'Reprenez le job déjà accepté avec son identifiant ; ne créez jamais automatiquement un second job payant.' },
    ],
    disconnectTitle: 'Déconnecter OpenClaw et révoquer MaxVideoAI',
    disconnectBody: 'Supprimez le serveur ou déconnectez-le dans OpenClaw, puis révoquez l’autorisation dans MaxVideoAI. Toute reconnexion exige un nouvel accord navigateur.',
    disconnectSteps: ['Déconnecter ou supprimer le serveur dans OpenClaw', 'Révoquer l’autorisation dans les connexions MaxVideoAI', 'Constater la perte d’accès avant une nouvelle connexion'],
    supportLabel: 'Contacter le support MaxVideoAI',
  };
}

function spanish(): IntegrationText {
  const copy = english();
  return {
    ...copy,
    metaTitle: 'MaxVideoAI para OpenClaw | Producción de vídeo IA',
    metaDescription: 'Conecta OpenClaw con MaxVideoAI mediante MCP directo o ClawHub para planificar, presupuestar, aprobar y recuperar producción de vídeo IA.',
    eyebrow: 'INTEGRACIÓN DE VÍDEO IA OPENCLAW',
    heroTitle: 'Produce vídeo IA desde OpenClaw con MaxVideoAI',
    heroIntro: 'Conecta directamente el servidor MCP remoto o instala MaxVideoAI 1.0.0 desde ClawHub. La ruta probada cubre OAuth, planificación, generación aprobada, recuperación, revocación y reconexión; la importación de referencias privadas y el renderizado por canal siguen sin verificar.',
    unavailable: 'OpenClaw está disponible mediante MCP directo y el paquete listado en ClawHub, con aprobación explícita antes del gasto. Las referencias privadas, los adjuntos y el renderizado dentro de canales quedan fuera del alcance verificado.',
    setupLabel: 'Conectar OpenClaw',
    backLabel: 'Ver todos los flujos compatibles',
    checkpointLabel: 'Prueba realizada',
    machineStatusLabel: 'Estado de evidencia del host',
    statuses: { openclawGateway: 'Probado con límites en OpenClaw 2026.9.4: rechazo y aprobación OAuth, descubrimiento, planificación, una confirmación pagada explícita, recuperación, revocación, reconexión, renovación e instalación desde ClawHub.' },
    setupEyebrow: 'CONECTAR OPENCLAW',
    setupTitle: 'Configura el MCP remoto sin guardar credenciales de MaxVideoAI',
    setupIntro: 'OpenClaw admite OAuth compartido del operador y un modo de identidad por solicitante. Elige el límite de identidad del canal antes de conectar; ningún modo permite credenciales en prompts o configuración versionada.',
    guides: [{ ...copy.guides[0], title: 'Agregar MaxVideoAI a OpenClaw', intro: 'Guarda el servidor Streamable HTTP con OAuth y abre la autorización en el navegador desde OpenClaw.', commandLabel: 'Comandos de conexión de OpenClaw', setupValues: [{ label: 'Dirección MCP de MaxVideoAI', value: MCP_PRODUCTION_RESOURCE_URL }], authTrigger: 'Después de guardar el servidor, ejecuta openclaw mcp login maxvideoai.', installInstruction: getIntegrationInstallInstruction('es', 'openclawGateway'), steps: [
      { title: 'Elegir el modelo de identidad', body: 'Usa OAuth compartido para un agente del operador y OAuth por solicitante cuando cada remitente de confianza conecte su propia cuenta.' },
      { title: 'Guardar el servidor remoto', body: 'Registra el endpoint HTTPS como Streamable HTTP con OAuth, sin tokens ni contraseñas en la configuración.' },
      { title: 'Autenticar e inspeccionar', body: 'Completa el consentimiento en el navegador y consulta cuenta y catálogo antes de preparar un precio exacto.' },
    ], limitation: 'La importación de referencias privadas, los adjuntos y el renderizado integrado en canales no se verificaron. Usa la biblioteca MaxVideoAI si el canal no muestra el resultado.' }],
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
    referencesGated: 'La importación de referencias privadas y los adjuntos no están verificados en OpenClaw. Añade medios privados en MaxVideoAI y usa la biblioteca fuera de las rutas de renderizado por canal no verificadas.',
    helpEyebrow: 'ALCANCE COMPATIBLE',
    helpTitle: 'Qué incluye la ruta probada de OpenClaw',
    helpIntro: 'El MCP directo y el paquete ClawHub están disponibles con estos límites específicos del host.',
    helpItems: [
      { question: '¿MaxVideoAI aparece en ClawHub?', answer: 'Sí. MaxVideoAI 1.0.0 está listado en ClawHub bajo @camgraphe. El listado es independiente de la evidencia MCP directa.' },
      { question: '¿Todos los canales aceptan las mismas referencias?', answer: 'No se afirma compatibilidad con referencias privadas o adjuntos. El renderizado integrado también sigue sin verificar.' },
      { question: '¿Qué ocurre tras un timeout?', answer: 'Recupera el job aceptado por su identificador; nunca crees automáticamente otro job de pago.' },
    ],
    disconnectTitle: 'Desconectar OpenClaw y revocar MaxVideoAI',
    disconnectBody: 'Elimina o cierra la sesión del servidor en OpenClaw y revoca el permiso en MaxVideoAI. Reconectar exige una nueva aprobación en el navegador.',
    disconnectSteps: ['Cerrar sesión o eliminar el servidor en OpenClaw', 'Revocar el permiso en conexiones de MaxVideoAI', 'Confirmar la pérdida de acceso antes de volver a conectar'],
    supportLabel: 'Contactar con soporte de MaxVideoAI',
  };
}

export function buildOpenClawIntegrationCopy(locale: AppLocale): IntegrationPageCopy {
  return buildIntegrationCopy({
    client: 'openclaw',
    locale,
    text: locale === 'fr' ? french() : locale === 'es' ? spanish() : english(),
  });
}
