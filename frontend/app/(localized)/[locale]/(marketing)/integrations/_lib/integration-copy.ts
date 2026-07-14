import { localePathnames, type AppLocale } from '@/i18n/locales';
import type { McpClientId } from '../../mcp/_lib/mcp-page-types';

export type IntegrationPageCopy = {
  client: McpClientId;
  clientLabel: 'Claude' | 'Codex';
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
    hostLabel: string;
    lastVerifiedLabel: string;
    versionLabel: string;
    status: string;
  };
  setup: {
    eyebrow: string;
    title: string;
    intro: string;
    steps: Array<{ title: string; body: string }>;
    commandLabel: string;
    commands: string[];
    oauthTitle: string;
    oauthBody: string;
    oauthSteps: string[];
    limitation: string;
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

function englishCopy(client: McpClientId): IntegrationPageCopy {
  const claude = client === 'claude';
  const label = claude ? 'Claude' : 'Codex';
  return {
    client,
    clientLabel: label,
    meta: {
      title: `${label} setup guide for MaxVideoAI MCP`,
      description: `Review the recorded ${label} compatibility status, connection steps, browser authorization, reference behavior, troubleshooting, and disconnect path for MaxVideoAI.`,
    },
    hero: {
      eyebrow: 'CLIENT SETUP GUIDE',
      title: `Plan your MaxVideoAI workflow with ${label}.`,
      intro: `Use ${label} to clarify an AI video brief, formulate a prompt, plan references, and compare model and budget choices before continuing in MaxVideoAI.`,
      unavailable: 'Public connection is not available yet. This guide documents controlled compatibility evidence and the intended setup path.',
      liveStatus: 'Public access is enabled for the capabilities shown in this guide.',
      backLabel: 'Back to the MaxVideoAI workflow hub',
      backHref: '/mcp',
    },
    compatibility: {
      hostLabel: claude ? 'Claude Desktop' : 'Codex CLI',
      lastVerifiedLabel: 'Last verified',
      versionLabel: 'Tested host version',
      status: claude
        ? 'Hosted read-only connection, revocation and reconnect checks passed. Token-expiry refresh remains pending.'
        : 'Explicit-scope hosted read-only login passed. The default add flow remains blocked by a permissions mismatch.',
    },
    setup: {
      eyebrow: 'Connection',
      title: `Connect ${label} to MaxVideoAI`,
      intro: claude
        ? 'The recorded paths use a custom remote connector in Claude Desktop or the HTTP connection command in Claude Code. Public access remains disabled.'
        : 'The recorded path uses Codex CLI with an explicit least-privilege login command. The default first-run add flow is not approved for public use.',
      steps: claude
        ? [
            { title: 'Open remote connector settings', body: 'In Claude Desktop, create a custom remote connector. In Claude Code, use the recorded HTTP command below.' },
            { title: 'Add the MaxVideoAI server address', body: 'Use the documented remote address exactly; do not paste a user credential into the configuration.' },
            { title: 'Complete browser approval', body: 'Sign in to MaxVideoAI, review the requested account access, and return to Claude only after approval.' },
          ]
        : [
            { title: 'Add the remote connection', body: 'Use the current Codex CLI command below to register the MaxVideoAI server address.' },
            { title: 'Start explicit login', body: 'Use the separate login command with only the three recorded identity permissions.' },
            { title: 'Verify read-only access', body: 'Confirm the registered connection and test model discovery before relying on any later workflow.' },
          ],
      commandLabel: claude ? 'Recorded Claude Code command' : 'Recorded Codex CLI commands',
      commands: claude
        ? ['claude mcp add --transport http maxvideoai https://api.maxvideoai.com/mcp', 'claude mcp get maxvideoai']
        : [
            'codex mcp add maxvideoai --url https://api.maxvideoai.com/mcp',
            'codex mcp login maxvideoai --scopes openid,email,profile',
            'codex mcp get maxvideoai',
          ],
      oauthTitle: 'What happens during OAuth authorization',
      oauthBody:
        'A browser window opens MaxVideoAI sign-in and consent. Approval identifies the account to the remote connection; it does not give the host direct database access or payment details.',
      oauthSteps: ['Sign in with the intended MaxVideoAI account', 'Review the requested identity access', `Approve or deny, then return to ${label}`],
      limitation: claude
        ? 'Claude Desktop evidence is read-only and version-specific. Automatic refresh after access expiry has not yet been recorded.'
        : 'The default Codex add flow requested an extra permission and was stopped. Only the explicit login path above passed the recorded read-only test.',
    },
    workflow: {
      eyebrow: 'Example workflow',
      title: `From a ${label} brief to a reviewed MaxVideoAI decision`,
      intro: 'The host can organize the creative reasoning; MaxVideoAI remains the source for current model facts, price and execution status.',
      previewSteps: [
        { title: 'Clarify the brief', body: `${label} can ask about subject, motion, format, style, audio intent and budget.` },
        { title: 'Formulate the prompt and references', body: `${label} can draft text and help plan a useful reference without implying that the host created the image.` },
        { title: 'Compare read-only model facts', body: 'Controlled evidence covers model discovery and factual trade-offs only.' },
        { title: 'Continue in MaxVideoAI', body: 'Until generation access is published, review the model and displayed price in the web product.' },
      ],
      liveSteps: [
        { title: 'Clarify the brief', body: `${label} asks for the missing creative, format and budget constraints.` },
        { title: 'Compare compatible models', body: 'MaxVideoAI returns a short factual selection with current trade-offs.' },
        { title: 'Review price and references', body: 'Check the exact settings, selected references, price and balance effect together.' },
        { title: 'Confirm and follow the result', body: 'A separate confirmation accepts the job; the result and next iteration remain in MaxVideoAI.' },
      ],
    },
    references: {
      title: 'Files and reference images',
      planningBody: `${label} can help formulate prompts and prepare a reference plan. It should not claim to have created or transferred a file unless the active client capability actually did so.`,
      liveBody: 'When enabled, use an account-owned image, an allowed web image, or a secure MaxVideoAI upload handoff. The selected model must support the reference mode.',
      gatedBody: 'Connected file and reference transfer is not publicly enabled. Add supported reference images in the MaxVideoAI web product instead.',
    },
    troubleshooting: {
      eyebrow: 'Troubleshooting',
      title: `${label} connection checks`,
      intro: 'Work from the recorded client version and fail closed when the requested access or visible capability differs from this guide.',
      items: claude
        ? [
            { question: 'Claude says authentication is required', answer: 'Open the connection again and complete a fresh MaxVideoAI approval. A revoked grant correctly requires reapproval.' },
            { question: 'The connector shows only read-only actions', answer: 'That matches the current recorded evidence. Do not infer generation, upload or trial availability.' },
            { question: 'The connection stops after access expires', answer: 'Token-expiry refresh is still pending verification. Remove and reconnect only in an approved preview account.' },
          ]
        : [
            { question: 'The default add flow asks for extra access', answer: 'Stop the flow. The default path remains blocked; do not approve access beyond the recorded explicit login command.' },
            { question: 'Codex cannot call generation actions', answer: 'That matches the current read-only evidence. Generation is not publicly enabled.' },
            { question: 'Login no longer works after revocation', answer: 'Run a fresh explicit login and approve the connection again with the intended MaxVideoAI account.' },
          ],
    },
    disconnect: {
      title: `Disconnect ${label}`,
      body: 'Remove the connection in the client and revoke its grant from MaxVideoAI account connections. Revocation should require a fresh approval before access returns.',
      steps: [`Remove or clear the MaxVideoAI connection in ${label}`, 'Open MaxVideoAI account connections and revoke the grant', 'Verify that the next protected action requires authentication'],
    },
    support: { label: 'Contact MaxVideoAI support', href: '/contact' },
  };
}

function frenchCopy(client: McpClientId): IntegrationPageCopy {
  const claude = client === 'claude';
  const label = claude ? 'Claude' : 'Codex';
  const copy = englishCopy(client);
  return {
    ...copy,
    meta: {
      title: `Guide de configuration ${label} pour le MCP MaxVideoAI`,
      description: `Consultez l’état de compatibilité enregistré pour ${label}, la connexion, l’autorisation dans le navigateur, les références, le dépannage et la déconnexion de MaxVideoAI.`,
    },
    hero: {
      eyebrow: 'GUIDE DE CONFIGURATION CLIENT',
      title: `Préparez votre parcours MaxVideoAI avec ${label}.`,
      intro: `Utilisez ${label} pour préciser un brief vidéo IA, formuler un prompt, préparer les références et comparer les modèles et budgets avant de poursuivre dans MaxVideoAI.`,
      unavailable: 'La connexion publique n’est pas encore disponible. Ce guide décrit des preuves de compatibilité contrôlées et le parcours de configuration prévu.',
      liveStatus: 'L’accès public est activé pour les fonctions présentées dans ce guide.',
      backLabel: 'Retour au parcours MaxVideoAI',
      backHref: '/fr/mcp',
    },
    compatibility: {
      hostLabel: copy.compatibility.hostLabel,
      lastVerifiedLabel: 'Dernière vérification',
      versionLabel: 'Version hôte testée',
      status: claude
        ? 'Les tests hébergés en lecture seule, de révocation et de reconnexion ont réussi. L’actualisation après expiration reste à vérifier.'
        : 'La connexion hébergée en lecture seule avec autorisations explicites a réussi. Le parcours d’ajout par défaut reste bloqué par une incompatibilité d’autorisations.',
    },
    setup: {
      ...copy.setup,
      eyebrow: 'Connexion',
      title: `Connecter ${label} à MaxVideoAI`,
      intro: claude
        ? 'Les parcours enregistrés utilisent un connecteur distant personnalisé dans Claude Desktop ou la commande HTTP dans Claude Code. L’accès public reste désactivé.'
        : 'Le parcours enregistré utilise Codex CLI avec une commande de connexion aux autorisations explicites. Le premier parcours d’ajout par défaut n’est pas approuvé pour le public.',
      steps: claude
        ? [
            { title: 'Ouvrez les réglages de connexion distante', body: 'Dans Claude Desktop, créez un connecteur distant personnalisé. Dans Claude Code, utilisez la commande HTTP enregistrée ci-dessous.' },
            { title: 'Ajoutez l’adresse du serveur MaxVideoAI', body: 'Utilisez exactement l’adresse documentée et ne collez aucun identifiant utilisateur dans la configuration.' },
            { title: 'Terminez l’approbation dans le navigateur', body: 'Connectez-vous à MaxVideoAI, vérifiez l’accès demandé et revenez dans Claude après approbation.' },
          ]
        : [
            { title: 'Ajoutez la connexion distante', body: 'Utilisez la commande Codex CLI ci-dessous pour enregistrer l’adresse du serveur MaxVideoAI.' },
            { title: 'Lancez la connexion explicite', body: 'Utilisez la commande distincte avec uniquement les trois autorisations d’identité enregistrées.' },
            { title: 'Vérifiez l’accès en lecture seule', body: 'Contrôlez la connexion enregistrée et testez la découverte des modèles avant tout autre parcours.' },
          ],
      commandLabel: claude ? 'Commande Claude Code enregistrée' : 'Commandes Codex CLI enregistrées',
      oauthTitle: 'Déroulement de l’autorisation OAuth',
      oauthBody: 'Une fenêtre de navigateur ouvre la connexion et le consentement MaxVideoAI. L’approbation identifie le compte pour la connexion distante ; elle ne donne pas à l’hôte un accès direct à la base de données ni aux informations de paiement.',
      oauthSteps: ['Connectez-vous au compte MaxVideoAI prévu', 'Vérifiez l’accès d’identité demandé', `Approuvez ou refusez, puis revenez dans ${label}`],
      limitation: claude
        ? 'La preuve Claude Desktop est en lecture seule et liée à une version précise. L’actualisation automatique après expiration n’a pas encore été enregistrée.'
        : 'Le parcours d’ajout par défaut de Codex a demandé une autorisation supplémentaire et a été interrompu. Seul le parcours explicite ci-dessus a réussi en lecture seule.',
    },
    workflow: {
      eyebrow: 'Exemple de parcours',
      title: `Du brief ${label} à une décision MaxVideoAI vérifiée`,
      intro: 'L’hôte peut structurer la réflexion créative ; MaxVideoAI reste la source des données modèles, du prix et de l’état d’exécution.',
      previewSteps: [
        { title: 'Précisez le brief', body: `${label} peut poser des questions sur le sujet, le mouvement, le format, le style, l’intention audio et le budget.` },
        { title: 'Formulez le prompt et les références', body: `${label} peut rédiger le texte et préparer une référence sans laisser entendre que l’hôte a créé l’image.` },
        { title: 'Comparez les données en lecture seule', body: 'Les preuves contrôlées couvrent uniquement la découverte des modèles et leurs compromis factuels.' },
        { title: 'Poursuivez dans MaxVideoAI', body: 'Tant que la génération connectée n’est pas publiée, vérifiez le modèle et le prix affiché dans le produit web.' },
      ],
      liveSteps: [
        { title: 'Précisez le brief', body: `${label} demande les contraintes créatives, de format et de budget manquantes.` },
        { title: 'Comparez les modèles compatibles', body: 'MaxVideoAI renvoie une courte sélection factuelle avec les compromis actuels.' },
        { title: 'Vérifiez le prix et les références', body: 'Contrôlez ensemble les réglages, les références, le prix exact et l’effet sur le solde.' },
        { title: 'Confirmez et suivez le résultat', body: 'Une confirmation séparée accepte la tâche ; le résultat et l’itération suivante restent dans MaxVideoAI.' },
      ],
    },
    references: {
      title: 'Fichiers et images de référence',
      planningBody: `${label} peut aider à formuler les prompts et à préparer une référence. Il ne doit pas prétendre avoir créé ou transféré un fichier sans que la fonction active du client l’ait réellement fait.`,
      liveBody: 'Lorsque cette fonction est active, utilisez une image liée au compte, une image web autorisée ou un transfert sécurisé MaxVideoAI. Le modèle choisi doit prendre en charge le mode de référence.',
      gatedBody: 'Le transfert connecté de fichiers et de références n’est pas activé publiquement. Ajoutez plutôt les images compatibles dans le produit web MaxVideoAI.',
    },
    troubleshooting: {
      eyebrow: 'Dépannage',
      title: `Vérifications de connexion ${label}`,
      intro: 'Partez de la version client enregistrée et interrompez le parcours si l’accès demandé ou les fonctions visibles diffèrent de ce guide.',
      items: claude
        ? [
            { question: 'Claude demande une authentification', answer: 'Rouvrez la connexion et approuvez de nouveau MaxVideoAI. Une autorisation révoquée doit exiger une nouvelle approbation.' },
            { question: 'Le connecteur ne propose que la lecture', answer: 'Cela correspond aux preuves actuelles. N’en déduisez pas que la génération, le transfert ou l’essai sont disponibles.' },
            { question: 'La connexion s’arrête après expiration', answer: 'L’actualisation après expiration reste à vérifier. Ne reconnectez qu’un compte de prévisualisation approuvé.' },
          ]
        : [
            { question: 'Le parcours par défaut demande un accès supplémentaire', answer: 'Interrompez-le. Le parcours par défaut reste bloqué ; n’approuvez aucun accès au-delà de la commande explicite enregistrée.' },
            { question: 'Codex ne peut pas lancer une génération', answer: 'Cela correspond aux preuves en lecture seule. La génération n’est pas activée publiquement.' },
            { question: 'La connexion ne fonctionne plus après révocation', answer: 'Relancez la connexion explicite et approuvez-la avec le compte MaxVideoAI prévu.' },
          ],
    },
    disconnect: {
      title: `Déconnecter ${label}`,
      body: 'Supprimez la connexion dans le client et révoquez son autorisation dans les connexions du compte MaxVideoAI. Un nouvel accès doit ensuite exiger une nouvelle approbation.',
      steps: [`Supprimez ou effacez la connexion MaxVideoAI dans ${label}`, 'Ouvrez les connexions du compte MaxVideoAI et révoquez l’autorisation', 'Vérifiez que la prochaine action protégée demande une authentification'],
    },
    support: { label: 'Contacter l’assistance MaxVideoAI', href: '/fr/contact' },
  };
}

function spanishCopy(client: McpClientId): IntegrationPageCopy {
  const claude = client === 'claude';
  const label = claude ? 'Claude' : 'Codex';
  const copy = englishCopy(client);
  return {
    ...copy,
    meta: {
      title: `Guía de configuración de ${label} para el MCP de MaxVideoAI`,
      description: `Revisa el estado registrado de compatibilidad con ${label}, la conexión, la autorización en el navegador, las referencias, la solución de problemas y la desconexión de MaxVideoAI.`,
    },
    hero: {
      eyebrow: 'GUÍA DE CONFIGURACIÓN DEL CLIENTE',
      title: `Planifica tu flujo de MaxVideoAI con ${label}.`,
      intro: `Usa ${label} para aclarar una idea de video con IA, formular un prompt, planificar referencias y comparar modelos y presupuestos antes de continuar en MaxVideoAI.`,
      unavailable: 'La conexión pública aún no está disponible. Esta guía documenta evidencia de compatibilidad controlada y el flujo de configuración previsto.',
      liveStatus: 'El acceso público está habilitado para las funciones que aparecen en esta guía.',
      backLabel: 'Volver al centro de flujos de MaxVideoAI',
      backHref: '/es/mcp',
    },
    compatibility: {
      hostLabel: copy.compatibility.hostLabel,
      lastVerifiedLabel: 'Última verificación',
      versionLabel: 'Versión del host probada',
      status: claude
        ? 'Las pruebas alojadas de solo lectura, revocación y reconexión pasaron. Queda pendiente la renovación tras el vencimiento del acceso.'
        : 'El acceso alojado de solo lectura con permisos explícitos pasó. El flujo predeterminado para agregar la conexión sigue bloqueado por una incompatibilidad de permisos.',
    },
    setup: {
      ...copy.setup,
      eyebrow: 'Conexión',
      title: `Conecta ${label} con MaxVideoAI`,
      intro: claude
        ? 'Las rutas registradas usan un conector remoto personalizado en Claude Desktop o el comando HTTP en Claude Code. El acceso público sigue deshabilitado.'
        : 'La ruta registrada usa Codex CLI con un comando de inicio de sesión de permisos explícitos. El flujo predeterminado inicial no está aprobado para uso público.',
      steps: claude
        ? [
            { title: 'Abre la configuración de conectores remotos', body: 'En Claude Desktop, crea un conector remoto personalizado. En Claude Code, usa el comando HTTP registrado que aparece abajo.' },
            { title: 'Agrega la dirección del servidor de MaxVideoAI', body: 'Usa exactamente la dirección documentada y no pegues credenciales de usuario en la configuración.' },
            { title: 'Completa la aprobación en el navegador', body: 'Inicia sesión en MaxVideoAI, revisa el acceso solicitado y vuelve a Claude después de aprobar.' },
          ]
        : [
            { title: 'Agrega la conexión remota', body: 'Usa el comando actual de Codex CLI que aparece abajo para registrar la dirección del servidor de MaxVideoAI.' },
            { title: 'Inicia la sesión explícita', body: 'Usa el comando separado con solo los tres permisos de identidad registrados.' },
            { title: 'Comprueba el acceso de solo lectura', body: 'Confirma la conexión registrada y prueba la consulta de modelos antes de depender de cualquier flujo posterior.' },
          ],
      commandLabel: claude ? 'Comando registrado de Claude Code' : 'Comandos registrados de Codex CLI',
      oauthTitle: 'Qué sucede durante la autorización OAuth',
      oauthBody: 'Una ventana del navegador abre el inicio de sesión y el consentimiento de MaxVideoAI. La aprobación identifica la cuenta para la conexión remota; no da al host acceso directo a la base de datos ni a los datos de pago.',
      oauthSteps: ['Inicia sesión con la cuenta de MaxVideoAI prevista', 'Revisa el acceso de identidad solicitado', `Aprueba o rechaza y vuelve a ${label}`],
      limitation: claude
        ? 'La evidencia de Claude Desktop es de solo lectura y corresponde a una versión concreta. La renovación automática tras vencer el acceso aún no se ha registrado.'
        : 'El flujo predeterminado de Codex solicitó un permiso adicional y se detuvo. Solo la ruta explícita anterior pasó la prueba registrada de solo lectura.',
    },
    workflow: {
      eyebrow: 'Flujo de ejemplo',
      title: `De una idea en ${label} a una decisión revisada en MaxVideoAI`,
      intro: 'El host puede organizar el razonamiento creativo; MaxVideoAI sigue siendo la fuente de los datos actuales de modelos, el precio y el estado de ejecución.',
      previewSteps: [
        { title: 'Aclara la idea', body: `${label} puede preguntar por el sujeto, el movimiento, el formato, el estilo, la intención de audio y el presupuesto.` },
        { title: 'Formula el prompt y las referencias', body: `${label} puede redactar el texto y ayudar a planificar una referencia sin insinuar que el host creó la imagen.` },
        { title: 'Compara datos de solo lectura', body: 'La evidencia controlada cubre únicamente el descubrimiento de modelos y sus diferencias factuales.' },
        { title: 'Continúa en MaxVideoAI', body: 'Hasta que se publique la generación conectada, revisa el modelo y el precio mostrado en el producto web.' },
      ],
      liveSteps: [
        { title: 'Aclara la idea', body: `${label} solicita las restricciones creativas, de formato y presupuesto que falten.` },
        { title: 'Compara modelos compatibles', body: 'MaxVideoAI devuelve una selección breve y factual con las diferencias actuales.' },
        { title: 'Revisa el precio y las referencias', body: 'Comprueba en conjunto los ajustes, las referencias, el precio exacto y el efecto sobre el saldo.' },
        { title: 'Confirma y sigue el resultado', body: 'Una confirmación separada acepta el trabajo; el resultado y la siguiente iteración permanecen en MaxVideoAI.' },
      ],
    },
    references: {
      title: 'Archivos e imágenes de referencia',
      planningBody: `${label} puede ayudar a formular prompts y preparar un plan de referencias. No debe afirmar que creó o transfirió un archivo salvo que la función activa del cliente lo haya hecho realmente.`,
      liveBody: 'Cuando esté habilitado, usa una imagen de tu cuenta, una imagen web permitida o una transferencia segura de MaxVideoAI. El modelo elegido debe admitir el modo de referencia.',
      gatedBody: 'La transferencia conectada de archivos y referencias no está habilitada públicamente. Agrega las imágenes compatibles en el producto web de MaxVideoAI.',
    },
    troubleshooting: {
      eyebrow: 'Solución de problemas',
      title: `Comprobaciones de conexión de ${label}`,
      intro: 'Parte de la versión registrada del cliente y detén el flujo si el acceso solicitado o las funciones visibles no coinciden con esta guía.',
      items: claude
        ? [
            { question: 'Claude indica que hace falta autenticación', answer: 'Abre la conexión de nuevo y completa una nueva aprobación de MaxVideoAI. Un acceso revocado debe exigir una aprobación nueva.' },
            { question: 'El conector solo muestra acciones de lectura', answer: 'Eso coincide con la evidencia actual. No supongas que la generación, la transferencia o la prueba están disponibles.' },
            { question: 'La conexión se detiene al vencer el acceso', answer: 'La renovación tras el vencimiento sigue pendiente de verificación. Reconecta únicamente una cuenta de vista previa aprobada.' },
          ]
        : [
            { question: 'El flujo predeterminado pide acceso adicional', answer: 'Detén el flujo. La ruta predeterminada sigue bloqueada; no apruebes acceso más allá del comando explícito registrado.' },
            { question: 'Codex no puede iniciar acciones de generación', answer: 'Eso coincide con la evidencia actual de solo lectura. La generación no está habilitada públicamente.' },
            { question: 'El acceso deja de funcionar después de revocarlo', answer: 'Inicia una nueva sesión explícita y aprueba la conexión con la cuenta prevista de MaxVideoAI.' },
          ],
    },
    disconnect: {
      title: `Desconecta ${label}`,
      body: 'Elimina la conexión en el cliente y revoca su acceso desde las conexiones de la cuenta de MaxVideoAI. La conexión posterior debe exigir una aprobación nueva.',
      steps: [`Elimina o borra la conexión de MaxVideoAI en ${label}`, 'Abre las conexiones de la cuenta de MaxVideoAI y revoca el acceso', 'Comprueba que la siguiente acción protegida solicite autenticación'],
    },
    support: { label: 'Contactar al soporte de MaxVideoAI', href: '/es/contact' },
  };
}

export function getIntegrationCopy(locale: AppLocale, client: McpClientId): IntegrationPageCopy {
  if (locale === 'fr') return frenchCopy(client);
  if (locale === 'es') return spanishCopy(client);
  return englishCopy(client);
}

export function getLocalizedMcpHref(locale: AppLocale): string {
  return localized(locale, 'mcp');
}
