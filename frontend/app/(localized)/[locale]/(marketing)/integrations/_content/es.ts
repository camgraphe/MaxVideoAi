import {
  MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND,
  MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND,
  MAXVIDEOAI_PUBLIC_PLUGIN_VERSION,
} from '@/config/maxvideoai-plugin-release';
import { MCP_PRODUCTION_RESOURCE_URL } from '@/server/mcp/config';
import type { McpClientId } from '../../mcp/_lib/mcp-page-types';
import { buildEnglishIntegrationCopy } from './en';
import {
  getIntegrationInstallAction,
  getIntegrationInstallInstruction,
  getIntegrationLabel,
  localizedIntegrationPath,
} from './shared';
import type { IntegrationHostGuide, IntegrationPageCopy } from './types';

function buildSpanishGuides(client: McpClientId): IntegrationHostGuide[] {
  if (client === 'claude') {
    return [
      {
        hostId: 'claudeDesktop',
        title: 'Conectar MaxVideoAI con Claude',
        intro: 'Añade MaxVideoAI como conector remoto personalizado y autoriza tu cuenta en el navegador.',
        installInstruction: getIntegrationInstallInstruction('es', 'claudeDesktop'),
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
        installInstruction: getIntegrationInstallInstruction('es', 'claudeCode'),
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
        installInstruction: getIntegrationInstallInstruction('es', 'chatgptWeb'),
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
      installInstruction: getIntegrationInstallInstruction('es', 'codexCli'),
      steps: [
        { title: 'Añadir el marketplace', body: `Registra el repositorio público de MaxVideoAI en la etiqueta revisada de la versión ${MAXVIDEOAI_PUBLIC_PLUGIN_VERSION}.` },
        { title: 'Instalar el plugin', body: 'Instala MaxVideoAI una vez para obtener los skills plan y generate y la conexión MCP de producción.' },
        { title: 'Iniciar una nueva tarea', body: 'Abre una nueva conversación de Codex, usa $maxvideoai:plan o $maxvideoai:generate y completa OAuth cuando se solicite.' },
      ],
      commandLabel: 'Comandos del plugin de Codex',
      commands: [
        MAXVIDEOAI_CODEX_MARKETPLACE_ADD_COMMAND,
        MAXVIDEOAI_CODEX_PLUGIN_ADD_COMMAND,
      ],
      setupValues: [],
      authTrigger: 'OAuth comienza cuando la nueva conversación usa MaxVideoAI por primera vez. Inicia sesión o crea la cuenta que quieras conectar.',
      limitation: 'El paquete etiquetado de GitHub incluye los skills plan y generate y la conexión MCP de producción. La generación siempre espera un precio exacto y tu aprobación explícita.',
    },
  ];
}
export function buildSpanishIntegrationCopy(client: McpClientId): IntegrationPageCopy {
  const base = buildEnglishIntegrationCopy(client);
  const clientLabel = getIntegrationLabel(client);
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
      backHref: localizedIntegrationPath('es', 'mcp'),
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
      installAction: getIntegrationInstallAction('es', clientLabel),
      hostGuides: buildSpanishGuides(client),
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
