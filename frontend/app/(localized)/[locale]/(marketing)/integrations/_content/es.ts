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
import { buildN8nIntegrationCopy } from './n8n';
import { buildOpenClawIntegrationCopy } from './openclaw';
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
          { title: 'Abrir los ajustes', body: "Abre Customize → Connectors → + → Add custom connector. En Team o Enterprise, un propietario añade primero el conector en Organization settings → Connectors." },
          { title: 'Añadir MaxVideoAI', body: "Usa el servidor de producción siguiente y el nombre MaxVideoAI. Elige Add y después Connect. No pegues una clave API ni tu contraseña." },
          { title: 'Aprobar la conexión', body: "Conecta tu cuenta MaxVideoAI existente, revisa los permisos y vuelve a Claude. Activa el conector en el menú + → Connectors del chat." },
        ],
        commands: [],
        setupValues: [{ label: 'Servidor MaxVideoAI', value: MCP_PRODUCTION_RESOURCE_URL }],
        limitation: 'Los créditos, referencias privadas y videos terminados quedan en la misma cuenta MaxVideoAI que usas en la web.',
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
        "hostId": "chatgptWeb",
        "title": "Conectar MaxVideoAI en ChatGPT",
        "intro": "Añade la conexión MCP de producción en ChatGPT, conecta tu cuenta MaxVideoAI existente y vuelve a un chat nuevo. MaxVideoAI no se ha presentado al directorio de OpenAI; usa esta configuración directa.",
        installInstruction: getIntegrationInstallInstruction('es', 'chatgptWeb'),
        "steps": [
          {
            "title": "Abrir la configuración MCP personalizada",
            "body": "Si hace falta, activa el modo desarrollador en Ajustes → Seguridad e inicio de sesión. Abre Plugins, elige el botón de añadir y crea una app MCP personalizada. Las etiquetas dependen de la cuenta y los permisos del espacio."
          },
          {
            "title": "Crear MaxVideoAI y conectar la cuenta",
            "body": "Usa el nombre MaxVideoAI, el servidor de producción siguiente y OAuth. Crea la conexión, elige Conectar, inicia sesión en maxvideoai.com y revisa los permisos. Si aparece MaxVideoAI Staging, detente y comprueba el servidor configurado."
          },
          {
            "title": "Probar en un chat nuevo",
            "body": "Elige Probar en el chat o selecciona MaxVideoAI en el menú de herramientas de un chat nuevo. Consulta primero el estado de la cuenta y los modelos disponibles, sin generar."
          }
        ],
        "commands": [],
        "setupValues": [
          {
            "label": "Servidor MCP de producción",
            "value": MCP_PRODUCTION_RESOURCE_URL
          }
        ],
        "authTrigger": "OAuth puede empezar durante la creación al elegir Conectar. Usa tu cuenta MaxVideoAI existente. Crea una cuenta solo si aún no tienes una.",
        "limitation": "La configuración MCP personalizada depende de tu plan ChatGPT, los permisos del espacio y la interfaz disponible. No requiere una ficha en el directorio público. La instalación y la consulta de cuenta y modelos se comprobaron el 01/10/2026; la generación de pago y el ciclo completo de conexión no se probaron en ese control."
      }
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
  if (client === 'openclaw') return buildOpenClawIntegrationCopy('es');
  if (client === 'n8n') return buildN8nIntegrationCopy('es');
  const base = buildEnglishIntegrationCopy(client);
  const clientLabel = getIntegrationLabel(client);
  const term = client === 'chatgpt'
    ? 'App MaxVideoAI'
    : client === 'claude'
      ? 'Conector MaxVideoAI'
      : 'Plugin MaxVideoAI';
  const setupDescription = client === 'chatgpt'
    ? "Conecta MaxVideoAI con ChatGPT mediante una app MCP de producción y OAuth; compara modelos, revisa precios y recupera resultados."
    : client === 'claude'
      ? 'Configura el conector remoto en Claude para preparar prompts y referencias, comparar modelos de video con IA, revisar el precio y aprobar la generación.'
      : 'Instala el plugin de Codex para preparar prompts y referencias, comparar modelos de video con IA, revisar el precio exacto y aprobar la generación.';
  const setupIntro = client === 'chatgpt'
    ? "Añade el MCP de producción de MaxVideoAI en ChatGPT y autoriza la cuenta que ya usas en maxvideoai.com. Después abre un chat nuevo con MaxVideoAI seleccionado. La conexión directa es independiente de la publicación en el directorio."
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
      title: `Crea video con IA usando MaxVideoAI en ${clientLabel}`,
      intro: setupIntro,
      unavailable: 'Prepara prompts y referencias, compara modelos, presupuesta el proyecto y revisa el flujo de producción de MaxVideoAI.',
      liveStatus: client === 'chatgpt'
        ? "La conexión MCP personalizada de MaxVideoAI es gratuita. Usa tu cuenta existente en maxvideoai.com; las generaciones aprobadas usan créditos MaxVideoAI. No hay una ficha publicada en el directorio de OpenAI."
        : 'Conectar MaxVideoAI es gratis y no añade otra suscripción. Inicia sesión o crea una cuenta; solo los renders aprobados usan créditos de pago por uso.',
      accountStatus: 'Necesitas una cuenta MaxVideoAI, que puedes crear gratis. La conexión no añade otra suscripción; solo los renders aprobados usan créditos de MaxVideoAI.',
      setupLabel: client === 'chatgpt' ? 'Conectar MaxVideoAI en ChatGPT' : `Configurar MaxVideoAI en ${clientLabel}`,
      backLabel: 'Ver el flujo completo en tu asistente de IA',
      backHref: localizedIntegrationPath('es', 'mcp'),
    },
    compatibility: {
      checkpointLabel: client === 'chatgpt' ? 'Flujo documentado' : 'Compatibilidad comprobada',
      machineStatusLabel: 'Estado de evidencia del host',
      statuses: {
        claudeDesktop: 'Claude Desktop 1.37937.1 completó en staging controlado OAuth, catálogo, presupuestos, precio exacto, medios, recuperación, carga y recarga.',
        claudeCode: 'La configuración del conector compartido está lista, pero todavía no se ha registrado una comprobación directa de Claude Code en producción.',
        chatgptWeb: "Instalación en producción, OAuth en el navegador, regreso a ChatGPT y consulta de cuenta y modelos comprobados el 01/10/2026. Generación de pago, renovación, revocación y reconexión siguen sin verificar en ChatGPT.",
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
      oauthSteps: ["Conecta la misma cuenta MaxVideoAI que usas en la web; crea una solo si hace falta", "Revisa y aprueba los permisos en MaxVideoAI; confirma el correo si acabas de crear una cuenta", `Vuelve a ${clientLabel} y comprueba la cuenta y los modelos sin generar`],
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
      title: 'Usa referencias de imagen, video o audio cuando el modelo lo permita',
      planningBody: `${clientLabel} puede crear o mejorar ideas de referencia y elegir el activo adecuado para cada plano.`,
      liveBody: 'Selecciona un medio privado existente en tu biblioteca MaxVideoAI o abre una carga segura. Los tipos y límites proceden de los detalles actuales del modelo.',
      gatedBody: 'Planifica referencias en la conversación y reúne cargas privadas, generación y resultados en tu cuenta MaxVideoAI.',
    },
    troubleshooting: {
      eyebrow: 'AYUDA',
      title: `Ayuda de conexión para ${clientLabel}`,
      intro: 'El asistente puede explicar el siguiente paso seguro sin inventar el saldo, el estado del trabajo ni una URL de cuenta.',
      items: [
        { question: "Veo MaxVideoAI Staging o se rechaza mi contraseña de la web", answer: "Staging es un entorno de prueba con cuentas distintas. Comprueba el servidor de la conexión: usa https://api.maxvideoai.com/mcp y el inicio de sesión de producción en maxvideoai.com. No crees una cuenta de prueba para recuperar la de la web. Si falla el acceso en producción, usa tu acceso habitual con Google o restablece la contraseña." },
        { question: "¿Puede el asistente instalar MaxVideoAI por mí?", answer: client === 'chatgpt' ? "ChatGPT puede guiarte para añadir el MCP personalizado; una petición en el chat no añade por sí sola la conexión. Usa los controles de instalación e inicia sesión en MaxVideoAI en el navegador. Después selecciona MaxVideoAI en un chat nuevo." : client === 'claude' ? "Claude en el chat te guía por Connectors. Claude Code puede ejecutar el comando de configuración si tiene acceso autorizado al terminal. En ambos casos apruebas la conexión de tu cuenta en el navegador." : "Codex puede ejecutar los comandos del plugin con acceso al terminal y tu permiso. Inicia sesión y aprueba los permisos en el navegador; una tarea nueva carga el plugin." },
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
