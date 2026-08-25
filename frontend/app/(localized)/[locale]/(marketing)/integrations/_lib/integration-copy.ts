import { localePathnames, type AppLocale } from '@/i18n/locales';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import type { McpClientId, McpCompatibilityHostId } from '../../mcp/_lib/mcp-page-types';

type IntegrationSetupValue = {
  label: string;
  value: string;
};

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

function englishCopy(client: McpClientId): IntegrationPageCopy {
  const claude = client === 'claude';
  const label = claude ? 'Claude' : 'Codex';
  return {
    client,
    clientLabel: label,
    meta: {
      title: `MaxVideoAI MCP for ${label} — Preview`,
      description: `Get model advice, compare budgets, use private references, and prepare and generate through ${label}. Preview — host validation in progress; local implementation verified.`,
    },
    hero: {
      eyebrow: 'CLIENT SETUP GUIDE',
      title: `MaxVideoAI MCP for ${label}`,
      intro: `Get model advice, compare budgets, use private references, and prepare and generate through the integration in ${label}. Preview — host validation in progress; local implementation verified, while hosted OAuth, rendering, refresh and revocation remain unverified.`,
      unavailable: 'Public connection is not available. This guide documents local package evidence and an intended, host-unverified setup path.',
      liveStatus: 'Any future public state still requires separate host evidence and publication approval.',
      backLabel: 'Back to the MaxVideoAI workflow hub',
      backHref: '/mcp',
    },
    compatibility: {
      checkpointLabel: 'Local evidence checkpoint',
      statuses: {
        claudeDesktop: 'Hosted compatibility is unverified. Only local package structure and protocol contracts are recorded.',
        claudeCode: 'Hosted compatibility is unverified. Only local adapter structure and protocol contracts are recorded.',
        codexCli: 'Hosted compatibility is unverified. Only local package structure and protocol contracts are recorded.',
      },
    },
    setup: {
      eyebrow: 'Connection',
      title: `Review the intended ${label} setup`,
      intro: claude
        ? 'Claude Desktop and Claude Code have different intended connection paths. Both remain unverified in a real host; use these steps only for a separately approved test.'
        : 'The intended path uses Codex CLI with explicit least-privilege scopes. Real-host installation and OAuth remain unverified, and the default first-run add flow is not approved for public use.',
      hostGuides: claude
        ? [
            {
              hostId: 'claudeDesktop',
              title: 'Claude Desktop remote connector',
              intro: 'This candidate procedure would configure a custom remote connector with the MaxVideoAI server address after approval.',
              steps: [
                { title: 'Open remote connector settings', body: 'In Claude Desktop, create a custom remote connector.' },
                { title: 'Add the MaxVideoAI server address', body: 'Use the documented remote address exactly; do not paste a user credential into the configuration.' },
                { title: 'Review browser approval', body: 'A future authorized test must verify sign-in, requested access, denial, approval and return behavior.' },
              ],
              commands: [],
              setupValues: [{ label: 'MCP server URL', value: MCP_PRODUCTION_RESOURCE_URL }],
              limitation: 'Hosted installation, OAuth, tool calls, refresh, revocation and reconnect are unverified. Treat these steps as an intended test procedure only.',
            },
            {
              hostId: 'claudeCode',
              title: 'Claude Code HTTP connection',
              intro: 'This candidate procedure would register the HTTP server and start authorization from the MCP panel after approval.',
              steps: [
                { title: 'Add the HTTP connection', body: 'Use the candidate command below only during a separately approved host test.' },
                { title: 'Open the MCP panel', body: 'Open /mcp in Claude Code and choose the MaxVideoAI connection to start browser authorization.' },
                { title: 'Complete browser approval', body: 'Review the requested identity access, approve it, and return to Claude Code.' },
              ],
              commandLabel: 'Candidate Claude Code commands',
              commands: [`claude mcp add --transport http maxvideoai ${MCP_PRODUCTION_RESOURCE_URL}`, 'claude mcp get maxvideoai'],
              setupValues: [],
              authTrigger: 'After adding the server, open /mcp in Claude Code to authenticate.',
              limitation: 'Host installation, OAuth, tool calls, refresh, revocation and reconnect are unverified. Treat these steps as an intended test procedure only.',
            },
          ]
        : [
            {
              hostId: 'codexCli',
              title: 'Codex CLI explicit-scope connection preview',
              intro: 'This candidate procedure would register the remote server and request the intended least-privilege scopes after approval.',
              steps: [
                { title: 'Add the remote connection', body: 'Use the current Codex CLI command below to register the MaxVideoAI server address.' },
                { title: 'Start explicit login', body: 'A future authorized test must request only the three intended identity scopes.' },
                { title: 'Verify read-only access', body: 'A future authorized test must verify the connection and model discovery before any later workflow claim.' },
              ],
              commandLabel: 'Candidate Codex CLI commands',
              commands: [
                `codex mcp add maxvideoai --url ${MCP_PRODUCTION_RESOURCE_URL}`,
                'codex mcp login maxvideoai --scopes openid,email,profile',
                'codex mcp get maxvideoai',
              ],
              setupValues: [],
              limitation: 'Host installation, OAuth permissions, tool calls, refresh, revocation and reconnect are unverified. Stop any test that requests scopes beyond the documented least-privilege set.',
            },
          ],
      oauthTitle: 'What happens during OAuth authorization',
      oauthBody:
        'A browser window opens MaxVideoAI sign-in and consent. Approval identifies the account to the remote connection; it does not give the host direct database access or payment details.',
      oauthSteps: ['Sign in with the intended MaxVideoAI account', 'Review the requested identity access', `Approve or deny, then return to ${label}`],
    },
    workflow: {
      eyebrow: 'Example workflow',
      title: 'Local planning and model comparison preview',
      intro: `Local contracts cover planning, model comparison and budgets. No workflow behavior in ${label} is verified.`,
      previewSteps: [
        { title: 'Clarify the brief', body: 'The local planning contract captures subject, motion, format, style, audio intent and budget.' },
        { title: 'Formulate the prompt and references', body: 'The local contract supports prompt and private-reference planning without claiming host file creation.' },
        { title: 'Compare read-only model facts', body: 'Locally verified evidence covers model discovery and factual trade-offs only.' },
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
      planningBody: `Local contracts support prompt and private-reference planning. No creation or transfer behavior in ${label} is verified.`,
      liveBody: 'When enabled, use an account-owned image, an allowed web image, or a secure MaxVideoAI upload handoff. The selected model must support the reference mode.',
      gatedBody: 'Connected file and reference transfer is not publicly enabled. Add supported reference images in the MaxVideoAI web product instead.',
    },
    troubleshooting: {
      eyebrow: 'Troubleshooting',
      title: `${label} pre-validation checklist`,
      intro: 'No host version is tested or recorded as compatible. Fail closed until Task 10 verifies the requested access and visible behavior.',
      items: claude
        ? [
            { question: 'Claude says authentication is required', answer: 'No Claude OAuth behavior is verified. Stop and record the exact host/version for an approved Task 10 test.' },
            { question: 'The connector shows only read-only actions', answer: 'No rendered host inventory is verified. Do not infer generation, upload or trial availability.' },
            { question: 'The connection stops after access expires', answer: 'Refresh and reconnect behavior is unverified. Do not present a workaround as supported behavior.' },
          ]
        : [
            { question: 'The default add flow asks for extra access', answer: 'Stop the flow. No Codex scope behavior is verified; never approve more than the intended least-privilege scopes.' },
            { question: 'Codex cannot call generation actions', answer: 'No Codex rendering or generation behavior is verified, and generation is not publicly enabled.' },
            { question: 'Login no longer works after revocation', answer: 'Revocation and reapproval are unverified. Record this only in an approved Task 10 host test.' },
          ],
    },
    disconnect: {
      title: `Disconnect ${label}`,
      body: 'This is an intended future procedure only: remove the client connection and revoke its MaxVideoAI grant. Task 10 must verify every host-specific result.',
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
      title: `MCP MaxVideoAI pour ${label} — Préversion`,
      description: `Obtenez des conseils sur les modèles, comparez les budgets, utilisez des références privées, puis préparez et générez via ${label}. Préversion — validation des hôtes en cours ; implémentation locale vérifiée.`,
    },
    hero: {
      eyebrow: 'GUIDE DE CONFIGURATION CLIENT',
      title: `MCP MaxVideoAI pour ${label}`,
      intro: `Obtenez des conseils sur les modèles, comparez les budgets, utilisez des références privées, puis préparez et générez via l’intégration dans ${label}. Préversion — validation des hôtes en cours ; implémentation locale vérifiée, tandis que l’OAuth, le rendu, le renouvellement et la révocation dans les hôtes restent non vérifiés.`,
      unavailable: 'La connexion publique n’est pas disponible. Ce guide décrit les preuves locales du paquet et un parcours prévu, non vérifié dans un hôte réel.',
      liveStatus: 'Tout état public futur exige encore des preuves d’hôte distinctes et une autorisation de publication.',
      backLabel: 'Retour au parcours MaxVideoAI',
      backHref: '/fr/mcp',
    },
    compatibility: {
      checkpointLabel: 'Point de contrôle local',
      statuses: {
        claudeDesktop: 'La compatibilité hébergée reste non vérifiée. Seuls la structure locale du paquet et les contrats de protocole sont documentés.',
        claudeCode: 'La compatibilité hébergée reste non vérifiée. Seuls la structure locale de l’adaptateur et les contrats de protocole sont documentés.',
        codexCli: 'La compatibilité hébergée reste non vérifiée. Seuls la structure locale du paquet et les contrats de protocole sont documentés.',
      },
    },
    setup: {
      eyebrow: 'Connexion',
      title: `Consulter la configuration ${label} prévue`,
      intro: claude
        ? 'Claude Desktop et Claude Code ont deux parcours de connexion prévus différents. Les deux restent non vérifiés dans un hôte réel ; utilisez ces étapes uniquement pour un test approuvé séparément.'
        : 'Le parcours prévu utilise Codex CLI avec des autorisations explicites et minimales. L’installation et OAuth dans un hôte réel restent non vérifiés, et le premier parcours d’ajout par défaut n’est pas approuvé pour le public.',
      hostGuides: claude
        ? [
            {
              hostId: 'claudeDesktop',
              title: 'Connecteur distant Claude Desktop',
              intro: 'Créez un connecteur distant personnalisé dans Claude Desktop avec l’adresse du serveur MaxVideoAI.',
              steps: [
                { title: 'Ouvrez les réglages de connexion distante', body: 'Dans Claude Desktop, créez un connecteur distant personnalisé.' },
                { title: 'Ajoutez l’adresse du serveur MaxVideoAI', body: 'Utilisez exactement l’adresse documentée et ne collez aucun identifiant utilisateur dans la configuration.' },
                { title: 'Terminez l’approbation dans le navigateur', body: 'Connectez-vous à MaxVideoAI, vérifiez l’accès demandé et revenez dans Claude Desktop après approbation.' },
              ],
              commands: [],
              setupValues: [{ label: 'URL du serveur MCP', value: MCP_PRODUCTION_RESOURCE_URL }],
              limitation: 'L’installation hébergée, OAuth, les appels d’outils, l’actualisation, la révocation et la reconnexion restent non vérifiés. Ces étapes constituent uniquement une procédure de test prévue.',
            },
            {
              hostId: 'claudeCode',
              title: 'Connexion HTTP Claude Code',
              intro: 'Enregistrez le serveur HTTP depuis Claude Code, puis lancez l’autorisation depuis son panneau MCP.',
              steps: [
                { title: 'Ajoutez la connexion HTTP', body: 'Exécutez la commande enregistrée ci-dessous pour ajouter MaxVideoAI.' },
                { title: 'Ouvrez le panneau MCP', body: 'Ouvrez /mcp dans Claude Code et choisissez la connexion MaxVideoAI pour lancer l’autorisation dans le navigateur.' },
                { title: 'Terminez l’approbation', body: 'Vérifiez l’accès d’identité demandé, approuvez-le et revenez dans Claude Code.' },
              ],
              commandLabel: 'Commandes Claude Code enregistrées',
              commands: [`claude mcp add --transport http maxvideoai ${MCP_PRODUCTION_RESOURCE_URL}`, 'claude mcp get maxvideoai'],
              setupValues: [],
              authTrigger: 'Après l’ajout du serveur, ouvrez /mcp dans Claude Code pour vous authentifier.',
              limitation: 'L’installation dans l’hôte, OAuth, les appels d’outils, l’actualisation, la révocation et la reconnexion restent non vérifiés. Ces étapes constituent uniquement une procédure de test prévue.',
            },
          ]
        : [
            {
              hostId: 'codexCli',
              title: 'Connexion Codex CLI aux autorisations explicites',
              intro: 'Enregistrez le serveur distant, puis utilisez le parcours de connexion explicite avec le minimum d’autorisations.',
              steps: [
                { title: 'Ajoutez la connexion distante', body: 'Utilisez la commande Codex CLI ci-dessous pour enregistrer l’adresse du serveur MaxVideoAI.' },
                { title: 'Lancez la connexion explicite', body: 'Utilisez la commande distincte avec uniquement les trois autorisations d’identité enregistrées.' },
                { title: 'Vérifiez l’accès en lecture seule', body: 'Contrôlez la connexion enregistrée et testez la découverte des modèles avant tout autre parcours.' },
              ],
              commandLabel: 'Commandes Codex CLI enregistrées',
              commands: [
                `codex mcp add maxvideoai --url ${MCP_PRODUCTION_RESOURCE_URL}`,
                'codex mcp login maxvideoai --scopes openid,email,profile',
                'codex mcp get maxvideoai',
              ],
              setupValues: [],
              limitation: 'L’installation dans l’hôte, les autorisations OAuth, les appels d’outils, l’actualisation, la révocation et la reconnexion restent non vérifiés. Interrompez tout test qui demande plus que les autorisations minimales documentées.',
            },
          ],
      oauthTitle: 'Déroulement de l’autorisation OAuth',
      oauthBody: 'Une fenêtre de navigateur ouvre la connexion et le consentement MaxVideoAI. L’approbation identifie le compte pour la connexion distante ; elle ne donne pas au client un accès direct à la base de données ni aux informations de paiement.',
      oauthSteps: ['Connectez-vous au compte MaxVideoAI prévu', 'Vérifiez l’accès d’identité demandé', `Approuvez ou refusez, puis revenez dans ${label}`],
    },
    workflow: {
      eyebrow: 'Exemple de parcours',
      title: 'Préversion locale de planification et de comparaison',
      intro: `Les contrats locaux couvrent la planification, la comparaison des modèles et les budgets. Aucun comportement de parcours dans ${label} n’est vérifié.`,
      previewSteps: [
        { title: 'Précisez le brief', body: 'Le contrat local de planification couvre le sujet, le mouvement, le format, le style, l’intention audio et le budget.' },
        { title: 'Formulez le prompt et les références', body: 'Le contrat local couvre le prompt et les références privées sans revendiquer la création d’un fichier par l’hôte.' },
        { title: 'Comparez les données en lecture seule', body: 'Les preuves vérifiées localement couvrent uniquement la découverte des modèles et leurs compromis factuels.' },
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
      planningBody: `Les contrats locaux couvrent les prompts et les références privées. Aucun comportement de création ou de transfert dans ${label} n’est vérifié.`,
      liveBody: 'Lorsque cette fonction est active, utilisez une image liée au compte, une image web autorisée ou un transfert sécurisé MaxVideoAI. Le modèle choisi doit prendre en charge le mode de référence.',
      gatedBody: 'Le transfert connecté de fichiers et de références n’est pas activé publiquement. Ajoutez plutôt les images compatibles dans le produit web MaxVideoAI.',
    },
    troubleshooting: {
      eyebrow: 'Dépannage',
      title: `Liste de prévalidation ${label}`,
      intro: 'Aucune version d’hôte n’est testée ni enregistrée comme compatible. Interrompez le parcours jusqu’à la vérification Task 10 des accès et comportements visibles.',
      items: claude
        ? [
            { question: 'Claude demande une authentification', answer: 'Aucun comportement OAuth Claude n’est vérifié. Arrêtez-vous et relevez l’hôte et la version exacts pour un test Task 10 approuvé.' },
            { question: 'Le connecteur ne propose que la lecture', answer: 'Aucun inventaire rendu par l’hôte n’est vérifié. N’en déduisez pas que la génération, le transfert ou l’essai sont disponibles.' },
            { question: 'La connexion s’arrête après expiration', answer: 'L’actualisation et la reconnexion restent non vérifiées. Ne présentez pas de contournement comme un comportement pris en charge.' },
          ]
        : [
            { question: 'Le parcours par défaut demande un accès supplémentaire', answer: 'Interrompez-le. Aucun comportement d’autorisation Codex n’est vérifié ; ne dépassez jamais les autorisations minimales prévues.' },
            { question: 'Codex ne peut pas lancer une génération', answer: 'Aucun comportement de rendu ou de génération Codex n’est vérifié, et la génération n’est pas activée publiquement.' },
            { question: 'La connexion ne fonctionne plus après révocation', answer: 'La révocation et la nouvelle approbation restent non vérifiées. Consignez-les uniquement dans un test d’hôte Task 10 approuvé.' },
          ],
    },
    disconnect: {
      title: `Déconnecter ${label}`,
      body: 'Il s’agit uniquement d’une procédure future prévue : supprimez la connexion du client et révoquez son autorisation MaxVideoAI. Task 10 doit vérifier chaque résultat propre à l’hôte.',
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
      title: `MCP de MaxVideoAI para ${label} — Vista previa`,
      description: `Obtén asesoramiento sobre modelos, compara presupuestos, usa referencias privadas y prepara y genera mediante ${label}. Vista previa — validación de clientes en curso; implementación local verificada.`,
    },
    hero: {
      eyebrow: 'GUÍA DE CONFIGURACIÓN DEL CLIENTE',
      title: `MCP de MaxVideoAI para ${label}`,
      intro: `Obtén asesoramiento sobre modelos, compara presupuestos, usa referencias privadas y prepara y genera mediante la integración en ${label}. Vista previa — validación de clientes en curso; implementación local verificada, mientras que OAuth, renderizado, renovación y revocación en clientes alojados siguen sin verificar.`,
      unavailable: 'La conexión pública no está disponible. Esta guía documenta evidencia local del paquete y un flujo previsto, sin verificar en un host real.',
      liveStatus: 'Cualquier estado público futuro todavía requiere evidencia separada del host y aprobación de publicación.',
      backLabel: 'Volver al centro de flujos de MaxVideoAI',
      backHref: '/es/mcp',
    },
    compatibility: {
      checkpointLabel: 'Control local de evidencia',
      statuses: {
        claudeDesktop: 'La compatibilidad alojada sigue sin verificar. Solo están documentados la estructura local del paquete y los contratos de protocolo.',
        claudeCode: 'La compatibilidad alojada sigue sin verificar. Solo están documentados la estructura local del adaptador y los contratos de protocolo.',
        codexCli: 'La compatibilidad alojada sigue sin verificar. Solo están documentados la estructura local del paquete y los contratos de protocolo.',
      },
    },
    setup: {
      eyebrow: 'Conexión',
      title: `Revisa la configuración prevista de ${label}`,
      intro: claude
        ? 'Claude Desktop y Claude Code tienen rutas de conexión previstas diferentes. Ambas siguen sin verificar en un host real; usa estos pasos solo en una prueba aprobada por separado.'
        : 'La ruta prevista usa Codex CLI con permisos explícitos y mínimos. La instalación y OAuth en un host real siguen sin verificar, y el flujo predeterminado inicial no está aprobado para uso público.',
      hostGuides: claude
        ? [
            {
              hostId: 'claudeDesktop',
              title: 'Conector remoto de Claude Desktop',
              intro: 'Crea un conector remoto personalizado en Claude Desktop con la dirección del servidor de MaxVideoAI.',
              steps: [
                { title: 'Abre la configuración de conectores remotos', body: 'En Claude Desktop, crea un conector remoto personalizado.' },
                { title: 'Agrega la dirección del servidor de MaxVideoAI', body: 'Usa exactamente la dirección documentada y no pegues credenciales de usuario en la configuración.' },
                { title: 'Completa la aprobación en el navegador', body: 'Inicia sesión en MaxVideoAI, revisa el acceso solicitado y vuelve a Claude Desktop después de aprobar.' },
              ],
              commands: [],
              setupValues: [{ label: 'URL del servidor MCP', value: MCP_PRODUCTION_RESOURCE_URL }],
              limitation: 'La instalación alojada, OAuth, las llamadas a herramientas, la renovación, la revocación y la reconexión siguen sin verificar. Estos pasos son solo un procedimiento de prueba previsto.',
            },
            {
              hostId: 'claudeCode',
              title: 'Conexión HTTP de Claude Code',
              intro: 'Registra el servidor HTTP desde Claude Code y después inicia la autorización desde su panel MCP.',
              steps: [
                { title: 'Agrega la conexión HTTP', body: 'Ejecuta el comando registrado que aparece abajo para agregar MaxVideoAI.' },
                { title: 'Abre el panel MCP', body: 'Abre /mcp en Claude Code y elige la conexión de MaxVideoAI para iniciar la autorización en el navegador.' },
                { title: 'Completa la aprobación', body: 'Revisa el acceso de identidad solicitado, apruébalo y vuelve a Claude Code.' },
              ],
              commandLabel: 'Comandos registrados de Claude Code',
              commands: [`claude mcp add --transport http maxvideoai ${MCP_PRODUCTION_RESOURCE_URL}`, 'claude mcp get maxvideoai'],
              setupValues: [],
              authTrigger: 'Después de agregar el servidor, abre /mcp en Claude Code para autenticarte.',
              limitation: 'La instalación en el host, OAuth, las llamadas a herramientas, la renovación, la revocación y la reconexión siguen sin verificar. Estos pasos son solo un procedimiento de prueba previsto.',
            },
          ]
        : [
            {
              hostId: 'codexCli',
              title: 'Conexión de Codex CLI con permisos explícitos',
              intro: 'Registra el servidor remoto y después usa la ruta de inicio de sesión explícita con los permisos mínimos.',
              steps: [
                { title: 'Agrega la conexión remota', body: 'Usa el comando actual de Codex CLI que aparece abajo para registrar la dirección del servidor de MaxVideoAI.' },
                { title: 'Inicia la sesión explícita', body: 'Usa el comando separado con solo los tres permisos de identidad registrados.' },
                { title: 'Comprueba el acceso de solo lectura', body: 'Confirma la conexión registrada y prueba la consulta de modelos antes de depender de cualquier flujo posterior.' },
              ],
              commandLabel: 'Comandos registrados de Codex CLI',
              commands: [
                `codex mcp add maxvideoai --url ${MCP_PRODUCTION_RESOURCE_URL}`,
                'codex mcp login maxvideoai --scopes openid,email,profile',
                'codex mcp get maxvideoai',
              ],
              setupValues: [],
              limitation: 'La instalación en el host, los permisos OAuth, las llamadas a herramientas, la renovación, la revocación y la reconexión siguen sin verificar. Detén cualquier prueba que solicite más permisos que el conjunto mínimo documentado.',
            },
          ],
      oauthTitle: 'Qué sucede durante la autorización OAuth',
      oauthBody: 'Una ventana del navegador abre el inicio de sesión y el consentimiento de MaxVideoAI. La aprobación identifica la cuenta para la conexión remota; no da al cliente acceso directo a la base de datos ni a los datos de pago.',
      oauthSteps: ['Inicia sesión con la cuenta de MaxVideoAI prevista', 'Revisa el acceso de identidad solicitado', `Aprueba o rechaza y vuelve a ${label}`],
    },
    workflow: {
      eyebrow: 'Flujo de ejemplo',
      title: 'Vista previa local de planificación y comparación',
      intro: `Los contratos locales cubren la planificación, la comparación de modelos y los presupuestos. No se ha verificado ningún comportamiento de flujo en ${label}.`,
      previewSteps: [
        { title: 'Aclara la idea', body: 'El contrato local de planificación cubre el sujeto, el movimiento, el formato, el estilo, la intención de audio y el presupuesto.' },
        { title: 'Formula el prompt y las referencias', body: 'El contrato local cubre prompts y referencias privadas sin afirmar que el host creó un archivo.' },
        { title: 'Compara datos de solo lectura', body: 'La evidencia verificada localmente cubre únicamente el descubrimiento de modelos y sus diferencias factuales.' },
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
      planningBody: `Los contratos locales cubren prompts y referencias privadas. No se ha verificado ningún comportamiento de creación o transferencia en ${label}.`,
      liveBody: 'Cuando esté habilitado, usa una imagen de tu cuenta, una imagen web permitida o una transferencia segura de MaxVideoAI. El modelo elegido debe admitir el modo de referencia.',
      gatedBody: 'La transferencia conectada de archivos y referencias no está habilitada públicamente. Agrega las imágenes compatibles en el producto web de MaxVideoAI.',
    },
    troubleshooting: {
      eyebrow: 'Solución de problemas',
      title: `Lista de prevalidación de ${label}`,
      intro: 'Ninguna versión de host está probada ni registrada como compatible. Detén el flujo hasta que Task 10 verifique el acceso solicitado y el comportamiento visible.',
      items: claude
        ? [
            { question: 'Claude indica que hace falta autenticación', answer: 'No se ha verificado ningún comportamiento OAuth de Claude. Detente y registra el host y la versión exactos para una prueba Task 10 aprobada.' },
            { question: 'El conector solo muestra acciones de lectura', answer: 'No se ha verificado ningún inventario renderizado por el host. No supongas que la generación, la transferencia o la prueba están disponibles.' },
            { question: 'La conexión se detiene al vencer el acceso', answer: 'La renovación y la reconexión siguen sin verificar. No presentes una solución alternativa como comportamiento compatible.' },
          ]
        : [
            { question: 'El flujo predeterminado pide acceso adicional', answer: 'Detén el flujo. No se ha verificado ningún comportamiento de permisos de Codex; no superes los permisos mínimos previstos.' },
            { question: 'Codex no puede iniciar acciones de generación', answer: 'No se ha verificado ningún comportamiento de renderizado o generación de Codex, y la generación no está habilitada públicamente.' },
            { question: 'El acceso deja de funcionar después de revocarlo', answer: 'La revocación y la nueva aprobación siguen sin verificar. Regístralas solo en una prueba de host Task 10 aprobada.' },
          ],
    },
    disconnect: {
      title: `Desconecta ${label}`,
      body: 'Este es solo un procedimiento futuro previsto: elimina la conexión del cliente y revoca su acceso a MaxVideoAI. Task 10 debe verificar cada resultado específico del host.',
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
