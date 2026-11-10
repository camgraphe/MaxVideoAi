import type { OpenArtCopy } from './types';

export const es = {
  meta: {
    title: 'Alternativa a OpenArt sin suscripción — MaxVideoAI',
    description: 'Crea planos de video sin suscripción con MaxVideoAI. Consulta el precio antes de generar, conserva tus créditos comprados y compara con OpenArt Director.',
  },
  hero: {
    title: 'Una alternativa a OpenArt.\nPaga por uso.',
    lead: 'Con MaxVideoAI, elige el modelo, la duración y el sonido de tu clip. Consulta el precio antes de generar. El saldo de los créditos para medios que compres queda disponible para tus próximos proyectos.',
    action: 'Cotizar un plano',
    compare: 'Comparar ambos flujos',
    note: 'Recargas de créditos para medios desde 10 USD, sin suscripción a MaxVideoAI.',
    imageAlt: 'Seis viñetas de un storyboard con una carrera nocturna por una ciudad bajo la lluvia',
    imageCaption: 'Storyboard de MaxVideoAI Studio',
  },
  decision: {
    label: 'Empieza por el resultado que necesitas',
    title: 'Mantén el control de cada plano.',
    options: [
      {
        title: 'Genera planos para tu propia edición',
        text: 'Dale forma a tu idea con Milo en Studio. Elige el modelo, la duración y el sonido, y descarga el clip para tu edición.',
        steps: ['Prepara el plano', 'Revisa la cotización', 'Descarga el clip'],
      },
      {
        title: 'Un video montado a partir de un brief',
        text: 'OpenArt Director prepara el storyboard y las escenas, y monta un video con sonido.',
        steps: ['Brief de la película', 'Storyboard y escenas', 'Video montado'],
      },
    ],
  },
  matrix: {
    title: 'Compara acceso, créditos y entrega',
    caption: 'Comparación de las ofertas de MaxVideoAI y OpenArt',
    criterion: 'Criterio',
    note: 'En la fecha de revisión, OpenArt mostraba Starter a 14 USD por usuario al mes antes del descuento. Comprueba el período de facturación y el precio que se aplica a tu cuenta.',
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
      max: 'Prepara tus planos con Milo Lite gratis dentro de sus límites de uso y disponibilidad. La asistencia avanzada y la generación de medios usan créditos separados.',
      openart: 'Conversar en Chat Mode es gratuito. Generar y retocar consume créditos. Ask First permite revisar el modelo, la configuración y el costo antes de generar.',
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
    title: 'Calcula el costo de tus planos y sus repeticiones.',
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
    text: 'Elige tus ajustes y consulta el precio antes de iniciar sesión.',
    action: 'Cotizar un plano',
    guide: 'Comparar plataformas de video con IA',
  },
  faq: {
    title: 'Preguntas sobre MaxVideoAI y OpenArt',
    items: [
      {
        question: '¿Puedo comprar créditos adicionales de OpenArt sin suscripción?',
        answer: 'OpenArt ofrece paquetes de créditos adicionales con una suscripción activa a Plus, Pro o Wonder. Los paquetes se renuevan automáticamente cada mes hasta que los canceles. Las cuentas nuevas reciben 40 créditos de prueba durante siete días. MaxVideoAI ofrece recargas de créditos para medios desde 10 USD sin suscripción.',
      },
      {
        question: '¿Pasan al mes siguiente los créditos de OpenArt que no usé?',
        answer: 'En MaxVideoAI, los créditos para medios que compres quedan disponibles entre proyectos sin suscripción. En OpenArt, los créditos mensuales del plan se reinician en cada ciclo. Los créditos adicionales sin usar se conservan mientras la suscripción siga activa.',
      },
      {
        question: '¿Son gratuitos Chat Mode y MCP de OpenArt?',
        answer: 'Conversar en Chat Mode es gratuito. Las generaciones y los retoques consumen créditos. MCP está incluido desde Starter sin costo adicional de OpenArt. Las guías de Claude y ChatGPT también anuncian la prueba para cuentas nuevas. El asistente externo puede tener sus propias condiciones de acceso y tarifas.',
      },
      {
        question: '¿En qué se diferencian MaxVideoAI y OpenArt Director?',
        answer: 'MaxVideoAI te ayuda a preparar un plano con Milo, consultar el precio y generar el clip para tu edición. OpenArt Director crea un storyboard y monta varias escenas con sonido. OpenArt anuncia videos de hasta cinco minutos.',
      },
      {
        question: '¿Cómo comparo el costo de un clip en MaxVideoAI y OpenArt?',
        answer: 'En MaxVideoAI puedes recargar créditos para medios desde 10 USD sin suscripción y consultar el precio antes de generar. Con los mismos ajustes, compara el pago inicial, los intentos completados, el saldo restante y la parte de la cuota que uses si tienes un plan. Calcula por separado el costo de un clip y el de un video montado con Director.',
      },
    ],
  },
  evidence: {
    title: 'Fuentes y alcance',
    date: '10 de noviembre de 2026',
    note: 'Comparación publicada por MaxVideoAI. Las fuentes públicas oficiales documentan las funciones y las condiciones de créditos que se presentan.',
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
