import type { OpenArtCopy } from './types';

export const es = {
  meta: {
    title: 'Alternativa a OpenArt para tus planos — MaxVideoAI',
    description: 'Compara MaxVideoAI y OpenArt Director para crear planos sueltos o una película montada. Suscripciones, créditos, chat gratuito y conexión MCP.',
  },
  hero: {
    title: 'Una alternativa a OpenArt\npara los planos que necesitas.',
    lead: 'Genera los clips que quieres editar tú mismo. Consulta el precio antes de cada generación y financia tu proyecto sin suscripción a MaxVideoAI.',
    action: 'Cotizar un plano',
    compare: 'Comparar ambos flujos',
    note: 'Recargas de créditos para medios desde 10 USD. Cada generación aprobada usa el saldo de tu cuenta.',
    imageAlt: 'Seis viñetas de un storyboard con una carrera nocturna por una ciudad bajo la lluvia',
    imageCaption: 'Storyboard de MaxVideoAI Studio',
  },
  decision: {
    label: 'Empieza por el resultado que necesitas',
    title: '¿Unos cuantos clips o una película montada?',
    options: [
      {
        title: 'Genera planos para tu propia edición',
        text: 'Elige MaxVideoAI si ya tienes una lista de planos y quieres decidir el modelo, la duración y el presupuesto de cada clip.',
        steps: ['Elige un plano', 'Revisa la cotización', 'Descarga el clip'],
      },
      {
        title: 'Parte de una idea y obtén una película',
        text: 'Elige OpenArt Director si buscas un flujo que prepare el storyboard, las escenas y el sonido y entregue un video montado.',
        steps: ['Describe la película', 'Dirige las escenas', 'Obtén el video montado'],
      },
    ],
  },
  matrix: {
    title: 'Compara acceso, créditos y entrega',
    caption: 'Comparación de las ofertas de MaxVideoAI y OpenArt',
    criterion: 'Criterio',
    note: 'Los importes se muestran en dólares estadounidenses. OpenArt muestra Starter a 14 USD por usuario al mes antes del descuento visible en la fecha de revisión. Comprueba el período de facturación, el precio y los requisitos antes de comprar.',
    sources: 'Consulta las fuentes oficiales',
  },
  rows: {
    entry: {
      label: 'Antes del primer pago',
      max: 'Consulta precios y obtén una cotización en tiempo real para la configuración elegida antes de recargar tu cuenta.',
      openart: 'Las cuentas nuevas reciben 40 créditos de prueba durante 7 días sin tarjeta. Starter anuncia 4000 créditos mensuales.',
    },
    funding: {
      label: 'Financiar un proyecto',
      max: 'Recarga créditos para medios desde 10 USD cuando los necesites. Revisa el precio de cada generación antes de iniciarla.',
      openart: 'Los planes de pago incluyen créditos mensuales. Con Plus, Pro o Wonder, los paquetes adicionales se renuevan automáticamente cada mes hasta que los canceles.',
    },
    balance: {
      label: 'Entre proyectos',
      max: 'Los créditos comprados para medios quedan disponibles en tu cuenta para proyectos futuros.',
      openart: 'Los créditos mensuales del plan se reinician en cada ciclo. Los créditos adicionales sin usar pueden pasar al siguiente mes mientras la suscripción siga activa.',
    },
    chat: {
      label: 'Asistente integrado',
      max: 'Planifica con Milo Lite sin costo adicional de asistencia, sujeto a límites de solicitudes y disponibilidad. La asistencia avanzada y la generación de medios usan créditos separados.',
      openart: 'Conversar en Chat Mode es gratuito. Generar y retocar consume créditos. Activa Ask First para revisar el modelo, la configuración y el costo antes de generar.',
    },
    mcp: {
      label: 'Asistentes externos',
      max: 'Planifica mediante MCP con un asistente compatible sin cargos de MaxVideoAI. Revisa y aprueba la cotización antes de pagar con tu saldo. El asistente puede tener sus propios costos y límites.',
      openart: 'MCP está incluido desde Starter sin costo adicional de OpenArt. Web, MCP y CLI comparten los mismos créditos. Las guías de Claude y ChatGPT también anuncian la prueba para cuentas nuevas. El acceso depende del asistente.',
    },
    delivery: {
      label: 'Qué puedes llevarte',
      max: 'Crea y descarga clips para tu propia edición. Usa Studio para planificar los planos y aprobar cada cotización de medios.',
      openart: 'Director prepara las escenas, crea un storyboard y monta el video con sonido. OpenArt anuncia películas de hasta cinco minutos.',
    },
  },
  workflow: {
    label: 'El flujo de MaxVideoAI',
    title: 'De la idea a la edición, plano a plano.',
    text: 'Prepara el plano con Milo en Studio o trae la idea desde un asistente compatible mediante MCP. Ponle precio antes de decidir si quieres producirla.',
    steps: [
      { title: 'Describe el plano', text: 'Define qué ocurre en el encuadre y añade una referencia si le sirve al modelo.' },
      { title: 'Configura el plano', text: 'Elige modelo, duración, resolución y sonido. Revisa la cotización en tiempo real para esos ajustes.' },
      { title: 'Aprueba y descarga', text: 'Aprueba el precio, descarga el clip generado y llévalo a tu edición.' },
    ],
    studio: 'Descubre Studio y Milo',
    mcp: 'Ver asistentes compatibles',
  },
  budget: {
    title: 'Calcula el costo de los planos que usarás.',
    intro: 'Compara con la misma idea, versión del modelo, duración, resolución y sonido. Cotiza en cada plataforma el resultado que necesitas.',
    items: [
      { title: 'Pago inicial', text: 'Comprueba el primer pago de la recarga o la suscripción y el período que cubre.' },
      { title: 'Intentos de pago', text: 'Cuenta las generaciones completadas, incluso las que descartes al editar. Cada nuevo intento tiene su propia cotización.' },
      { title: 'Créditos restantes', text: 'Comprueba cuándo se reinicia el saldo y qué puedes usar en el próximo proyecto.' },
    ],
    guide: 'Estimar el costo de un proyecto',
    calculator: 'Ver precios en tiempo real',
  },
  closing: {
    title: 'Trae un plano. Averigua cuánto cuesta.',
    text: 'Prueba tu configuración y revisa la cotización antes de decidir si generas el clip.',
    action: 'Cotizar un plano',
    guide: 'Comparar plataformas de video con IA',
  },
  faq: {
    title: 'Preguntas sobre OpenArt y MaxVideoAI',
    items: [
      {
        question: '¿Puedo comprar créditos adicionales de OpenArt sin suscripción?',
        answer: 'OpenArt ofrece paquetes de créditos adicionales con una suscripción activa a Plus, Pro o Wonder. Los paquetes se renuevan automáticamente cada mes hasta que los canceles. Las cuentas nuevas reciben 40 créditos de prueba durante siete días. MaxVideoAI ofrece recargas de créditos para medios desde 10 USD sin suscripción.',
      },
      {
        question: '¿Pasan al mes siguiente los créditos de OpenArt que no usé?',
        answer: 'Los créditos mensuales del plan se reinician en cada ciclo. OpenArt indica que los créditos adicionales sin usar se acumulan mientras siga activa la suscripción. Comprueba el tipo de crédito y las condiciones de facturación antes de comprar.',
      },
      {
        question: '¿Son gratuitos Chat Mode y MCP de OpenArt?',
        answer: 'Conversar en Chat Mode es gratuito. Las generaciones y los retoques consumen créditos. MCP está incluido desde Starter sin costo adicional de OpenArt. Las guías de Claude y ChatGPT también anuncian la prueba para cuentas nuevas. Comprueba por separado el acceso y las tarifas del asistente externo.',
      },
      {
        question: '¿Cuándo me conviene OpenArt Director?',
        answer: 'Director está diseñado para producir un video montado con varias escenas, storyboard y sonido. OpenArt anuncia una duración de hasta cinco minutos. Elige MaxVideoAI para planificar, cotizar y generar los clips que editarás por tu cuenta.',
      },
      {
        question: '¿MaxVideoAI siempre cuesta menos que OpenArt?',
        answer: 'El total depende de los ajustes del modelo, los intentos de pago y el uso que hagas de los créditos del plan. Compara por separado el primer pago, el costo de las generaciones y el saldo restante. Director y la generación de clips ofrecen resultados distintos.',
      },
    ],
  },
  evidence: {
    title: 'Fuentes y alcance',
    date: '10 de noviembre de 2026',
    note: 'Comparación publicada por MaxVideoAI a partir de páginas públicas oficiales. Los precios, los requisitos del plan y el acceso desde cada asistente pueden cambiar. La comparación cubre las funciones y las condiciones de créditos documentadas.',
  },
  sourceLabels: {
    'openart-pricing': 'Planes y créditos de Starter',
    'openart-trial': 'Créditos y duración de la prueba',
    'openart-credits': 'Créditos mensuales y adicionales',
    'openart-chat': 'Chat Mode y Ask First',
    'openart-director': 'Director y montaje de video',
    'openart-mcp': 'MCP, CLI y saldo compartido',
    'openart-claude': 'Acceso desde Claude y prueba',
    'openart-chatgpt': 'Acceso desde ChatGPT y prueba',
    'max-pricing': 'Recargas y cotizaciones en tiempo real',
    'max-wallet': 'Saldo para medios',
    'max-studio': 'Studio, Milo y aprobación de medios',
    'max-mcp': 'Acceso desde asistentes y precio de generación',
  },
} satisfies OpenArtCopy;
