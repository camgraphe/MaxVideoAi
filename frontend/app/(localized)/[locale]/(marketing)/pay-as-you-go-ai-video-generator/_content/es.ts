import type { PayAsYouGoContent } from './types';

export const esPayAsYouGoContent = {
  metadata: {
    title: 'Generador de video con IA de pago por uso y precio por adelantado',
    description: 'Genera videos con IA con créditos de pago por uso, sin suscripción mensual. Compara Seedance 2, Kling, Google Veo, LTX, Wan y otros modelos, revisa el precio antes de generar y paga solo por renders completados.',
    imageAlt: 'Flujo de MaxVideoAI con precio antes de generar.',
    keywords: ['generador de video con IA de pago por uso', 'generador de video IA sin suscripción', 'precio de video con IA antes de generar', 'comparar Seedance 2 Kling Google Veo LTX Happy Horse', 'precio Happy Horse 1.1', 'precio Seedance 2 Mini'],
  },
  common: {
    aiVideoModelAlt: 'modelo de video con IA',
    liveQuote: 'Cotización en tiempo real',
    audioIncluded: 'Audio incluido',
    examplePrefix: 'Ejemplo',
  },
  hero: {
    eyebrow: 'Créditos de video con IA, sin compromiso mensual',
    title: 'Generador de video con IA de pago por uso',
    intro: 'Genera videos con IA a partir de texto, imágenes o video con créditos de pago por uso. Compara Seedance 2, Kling, Google Veo, LTX, Wan, Happy Horse y otros modelos, consulta el precio antes de cada generación y paga solo por renders completados.',
    primaryCta: 'Ver cotización del video',
    secondaryCta: 'Ver precios por modelo',
    trustItems: ['Sin suscripción obligatoria', 'Créditos iniciales desde 10 USD', 'Precio visible antes de generar', 'Fallos del proveedor reembolsados'],
    quote: {
      consoleLabel: 'Cotizador de MaxVideoAI',
      title: 'Precio antes de generar',
      promptLabel: 'Prompt',
      prompt: 'Presentación cinematográfica de producto, acercamiento lento de cámara e iluminación limpia de estudio.',
      modelLabel: 'Modelo',
      chooseModel: 'Elige un modelo',
      exampleCostLabel: 'Costo de ejemplo',
      chargeRuleLabel: 'Regla de cobro',
      chargeRuleValue: 'Solo renders completados',
    },
  },
  naturalQuestions: {
    header: {
      eyebrow: 'Respuestas rápidas',
      title: 'Lo esencial antes de usar tus créditos',
      intro: 'Un generador de video con IA de pago por uso te permite comprar créditos solo cuando los necesitas, elegir un modelo para cada proyecto, revisar el precio antes del render y gastar créditos únicamente cuando el resultado se completa.',
    },
    summaryLead: 'Con MaxVideoAI puedes:',
    summaryItems: [
      'Genera videos con IA desde texto, imágenes o video.',
      'Empieza con Seedance 2 y después compara Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX y Wan.',
      'Consulta el precio estimado antes de iniciar.',
      'Usa créditos solo para renders completados.',
    ],
    items: [
      { question: '¿Dónde puedo probar modelos de video con IA sin suscripción?', answer: 'Usa MaxVideoAI para empezar con Seedance 2 y después compara Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan y otros modelos con créditos de pago por uso, en lugar de un plan recurrente.' },
      { question: '¿Qué plataforma de video con IA muestra el precio antes de generar?', answer: 'MaxVideoAI muestra el precio estimado antes de iniciar un render, incluidos el modelo, la duración, la resolución y las opciones de audio.' },
      { question: '¿Qué modelo de video con IA de pago por uso debería probar primero?', answer: 'Empieza con Seedance 2.0 como referencia principal; después prueba Kling para control de movimiento, Google Veo para calidad cinematográfica, Happy Horse 1.1 para otro estilo visual, Seedance 2 Mini para ejecuciones ligeras y LTX para borradores eficientes.' },
      { question: '¿Dónde puedo comparar Seedance 2, Kling, Google Veo, Happy Horse y LTX?', answer: 'MaxVideoAI reúne Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan y otros motores de video en un solo espacio para comparar calidad, límites y precio antes de elegir.' },
      { question: '¿Qué hace bueno a un generador de video con IA de pago por uso?', answer: 'Un buen sistema de pago por uso permite probar modelos actuales, ver los precios antes de generar, cambiar de motor según el proyecto y evitar cargos por renders fallidos del proveedor.' },
    ],
  },
  modelTesting: {
    header: {
      eyebrow: 'Orden de prueba',
      title: 'Orden recomendado para probar video con IA de pago por uso',
      intro: 'Para una referencia actual, empieza con Seedance 2.0. Después compara Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX y Wan según el movimiento, la calidad cinematográfica, las referencias, la velocidad y el precio.',
    },
    footer: 'Happy Horse 1.1 y Seedance 2 Mini son lo bastante recientes como para probarlos directamente, en lugar de evaluarlos solo con rankings de modelos anteriores.',
    models: {
      'seedance-2-0': { family: 'Seedance 2', title: 'Seedance 2.0 as the first model to test', body: 'Elige primero Seedance 2 para texto a video, imagen a video, referencias, audio nativo y pruebas de calidad de producción.' },
      'kling-3-pro': { family: 'Kling', title: 'Kling as the solid motion-control choice', body: 'Usa Kling para movimientos de cámara fiables, tomas de producto, elementos y video guiado por imagen sin comprar una suscripción.' },
      'veo-3-1': { family: 'Google Veo', title: 'Google Veo as the cinematic-quality choice', body: 'Compara las variantes de Veo cuando importen más la interpretación del prompt, el acabado cinematográfico, el audio o las opciones de Google que el menor costo de borrador.' },
      'happy-horse-1-1': { family: 'Happy Horse 1.1', title: 'Happy Horse 1.1 for alternate visual output', body: 'Usa Happy Horse 1.1 para comparar una opción de video de Alibaba más reciente con Seedance, Kling, Google Veo y LTX.' },
      'seedance-2-0-mini': { family: 'Seedance 2 Mini', title: 'Seedance 2.0 Mini for lighter multimodal tests', body: 'Usa Seedance 2 Mini para referencias, verificaciones rápidas e iteración ajustada al presupuesto antes de ampliar un prompt.' },
      'ltx-2-3-fast': { family: 'LTX', title: 'LTX 2.3 Fast as the efficient strong option', body: 'Usa LTX 2.3 Fast cuando necesites buenos borradores, iteración rápida de prompts y un modelo eficiente que merece comparación.' },
      'wan-2-6': { family: 'Wan', title: 'Wan for lower-cost text and image-to-video exploration', body: 'Usa Wan para probar ideas y comparar resultados antes de gastar en motores premium.' },
    },
  },
  meaning: {
    title: 'Qué significa pagar por uso',
    body: 'Pagar por uso significa comprar créditos cuando los necesitas, en lugar de pagar un plan recurrente. Para cada video eliges el modelo, la duración, la resolución, el audio y el flujo de trabajo. MaxVideoAI muestra el precio estimado antes de iniciar la generación.',
    bullets: ['Sin compromiso mensual ni pagos durante meses sin uso', 'Elige un modelo distinto para cada proyecto', 'Usa créditos para texto a video, imagen a video y flujos de video'],
  },
  noSubscription: {
    title: 'Por qué importa no tener suscripción',
    body: 'Los modelos de video con IA cambian rápido. El mejor motor para un anuncio de producto, un plano cinematográfico, una escena de personaje o una prueba de imagen a video puede variar de un proyecto a otro.',
    cards: [
      { title: 'Prueba antes de escalar', body: 'Haz pruebas pequeñas de prompts e imágenes antes de comprometer el presupuesto de una campaña o producción.' },
      { title: 'Evita pagos sin uso', body: 'Si generas videos solo para lanzamientos, experimentos o clientes, los créditos se adaptan mejor al uso real.' },
      { title: 'Cambia de modelo libremente', body: 'Compara Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX y Wan por velocidad, movimiento, audio, duración y precio en un mismo lugar.' },
    ],
  },
  audienceFit: {
    cards: [
      {
        title: '¿Quién usa créditos de video con IA de pago por uso?',
        body: 'Creadores, agencias, equipos SaaS, marcas de ecommerce, especialistas en marketing y estudios usan créditos cuando la generación de video con IA depende de proyectos y no de una cuota mensual.',
        bullets: ['Prueba prompts antes de una campaña', 'Crea anuncios de producto y borradores para clientes', 'Convierte imágenes aprobadas en videos cortos', 'Compara si un modelo premium justifica el costo'],
      },
      {
        title: 'Cuándo puede convenir más una suscripción',
        body: 'Una suscripción puede tener sentido si generas grandes volúmenes cada semana en la misma plataforma. El pago por uso se adapta mejor a una demanda variable, a la comparación de modelos y a evitar pagos durante meses sin uso.',
        bullets: ['Uso por proyecto', 'Varias familias de modelos en un solo flujo', 'Cotización en tiempo real antes de cada render', 'Sin compromiso recurrente antes de probar la calidad'],
      },
    ],
  },
  subscriptionComparison: {
    header: {
      eyebrow: 'Sin suscripción obligatoria',
      title: 'Pago por uso vs. suscripción',
      intro: 'La opción adecuada depende de la frecuencia con la que generas, de cuántos modelos necesitas probar y de si los créditos mensuales sin usar se convierten en gasto perdido.',
    },
    columns: ['Criterio', 'MaxVideoAI de pago por uso', 'Suscripción típica'],
    rows: [
      { label: 'Control del presupuesto', payg: 'Añade créditos cuando necesites videos y detente al terminar el proyecto.', subscription: 'Paga un plan recurrente incluso los meses sin renders.' },
      { label: 'Elección de modelo', payg: 'Compara Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX y otros motores según el proyecto.', subscription: 'Suele limitarse a un proveedor, una familia de modelos o una bolsa de uso.' },
      { label: 'Visibilidad del precio', payg: 'Revisa la cotización antes de iniciar cada generación.', subscription: 'Los créditos incluidos pueden ocultar el costo real de las opciones premium.' },
      { label: 'Experimentación', payg: 'Haz pruebas pequeñas antes de escalar una campaña, un proyecto de cliente o una producción.', subscription: 'La decisión del plan suele tomarse antes de saber qué modelo encaja mejor.' },
    ],
  },
  workflow: {
    header: {
      title: 'Cómo funcionan los créditos de pago por uso',
      intro: 'El flujo está diseñado para mostrar el costo antes de iniciar y dejar las comparaciones detalladas en la página de precios.',
    },
    items: [
      { title: 'Elige un motor de video', body: 'Selecciona el modelo que mejor se adapte al proyecto, sin quedarte limitado a un solo catálogo de suscripción.', icon: 'engine' },
      { title: 'Revisa la cotización en tiempo real', body: 'Consulta el precio, la duración, la resolución, el audio y el flujo de trabajo antes de generar.', icon: 'preview' },
      { title: 'Inicia la generación', body: 'Inicia un flujo de texto a video, imagen a video o video solo después de ver el costo.', icon: 'video' },
      { title: 'Paga solo los resultados', body: 'Los renders completados consumen créditos. Los fallos del proveedor se reembolsan o no se cobran si no hay resultado utilizable.', icon: 'refund' },
    ],
  },
  quoteFactors: {
    header: {
      title: 'Qué cambia la cotización en tiempo real',
      intro: 'La cotización de la app combina las opciones que afectan al costo real, para que el precio que apruebas corresponda a la generación que vas a iniciar.',
    },
    items: [
      { title: 'Modelo', body: 'Los motores premium y las variantes rápidas pueden tener precios distintos.', icon: 'model' },
      { title: 'Duración', body: 'Los clips más largos consumen más créditos que los borradores cortos.', icon: 'duration' },
      { title: 'Resolución', body: 'La resolución 1080p, 4K y las salidas de alta calidad cambian la cotización.', icon: 'resolution' },
      { title: 'Audio y flujo de trabajo', body: 'El audio, las imágenes de referencia, las entradas de video y las herramientas pueden afectar el costo.', icon: 'audio' },
    ],
  },
  pricing: {
    header: {
      title: 'Compara el precio por modelo',
      intro: 'Estos ejemplos ayudan a estimar el costo rápidamente. Usa la página de precios para consultar la matriz completa por modelo y abre la app para ver la cotización exacta antes de generar.',
    },
    fullMatrixLabel: 'Matriz completa de precios',
    columns: { model: 'Modelo', bestFor: 'Ideal para', links: 'Enlaces' },
    modelLinkLabel: 'Modelo',
    compareLinkLabel: 'Comparar',
    bestFor: {
      seedanceMini: 'pruebas ligeras de Seedance 2, referencias multimodales e iteración rápida',
      seedance: 'generación de video versátil, referencias y pruebas de audio nativo',
      happyHorse: 'resultado visual alternativo de Alibaba y comparación de modelos recientes',
      kling: 'control de movimiento, imagen a video y flujos para creadores',
      veo: 'calidad cinematográfica, seguimiento de prompts y variantes de Google Veo',
      ltx: 'borradores eficientes, iteración de prompts y resultados ajustados al presupuesto',
      wan: 'exploración económica de texto e imagen a video',
      fallback: 'probar la calidad del modelo antes de usar créditos',
    },
  },
  priceLookups: {
    header: {
      eyebrow: 'Consultas rápidas de precio',
      title: 'Consulta precios de modelos de video con IA populares',
      intro: 'Usa estos accesos por modelo para obtener estimaciones rápidas. La matriz completa de precios sigue siendo la referencia para las combinaciones exactas de modelo, duración, resolución y audio.',
    },
    openRowLabel: 'Abrir fila de precios',
    items: {
      'seedance-2-0': { query: 'precio de Seedance 2', title: 'Consulta el precio de Seedance 2.0', body: 'Empieza aquí si buscas un modelo versátil: texto a video, referencias de imagen, opciones de audio nativo y cotización antes del render.' },
      'kling-3-pro': { query: 'precio de Kling 3 Pro', title: 'Consulta el precio de Kling 3 Pro', body: 'Una opción sólida para controlar el movimiento, trabajar movimientos de cámara, crear tomas de producto y probar imagen a video sin un plan mensual.' },
      'veo-3-1': { query: 'precio de Veo 3.1', title: 'Consulta el precio de Veo 3.1', body: 'Elige Google Veo cuando la interpretación cinematográfica del prompt, la calidad de Google o el acabado premium importen más que el costo del borrador.' },
      'happy-horse-1-1': { query: 'precio de Happy Horse 1.1', title: 'Consulta el precio de Happy Horse 1.1', body: 'Prueba Happy Horse 1.1 cuando quieras comparar el resultado de Alibaba, el uso de referencias o un estilo visual diferente.' },
      'seedance-2-0-mini': { query: 'precio de Seedance 2 Mini', title: 'Consulta el precio de Seedance 2.0 Mini', body: 'Usa Seedance 2 Mini para pruebas multimodales ligeras, iteraciones cortas y verificaciones rápidas antes de pasar al modelo Seedance 2 principal.' },
      'ltx-2-3-fast': { query: 'precio de LTX 2.3', title: 'Consulta el precio de LTX 2.3 Fast', body: 'Usa LTX 2.3 Fast para borradores eficientes, iteración de prompts y una planificación de producción cuidando el presupuesto.' },
    },
  },
  exampleCosts: {
    header: {
      title: 'Costos de ejemplo',
      intro: 'Estos ejemplos provienen de la página de precios actual y sirven como referencia. La cotización de la app es el precio final antes de generar.',
    },
    settingsLabel: 'Configuración de ejemplo',
    labels: {
      'seedance-2-0': 'Render inicial con Seedance 2',
      'kling-3-pro': 'Prueba de movimiento con Kling 3 Pro',
      'veo-3-1-fast': 'Prueba cinematográfica con Google Veo 3.1 Fast',
      'happy-horse-1-1': 'Prueba alternativa con Happy Horse 1.1',
      'seedance-2-0-mini': 'Prueba rápida con Seedance 2 Mini',
      'ltx-2-3-fast': 'Borrador con LTX 2.3 Fast',
    },
  },
  refundPolicy: {
    header: {
      title: '¿Qué ocurre si falla una generación?',
      intro: 'MaxVideoAI está diseñado para cobrar solo los renders completados. Los renders completados consumen créditos. Los trabajos fallidos del proveedor se reembolsan o no se cobran si no devuelven un resultado utilizable.',
    },
    bullets: [
      { icon: 'preview', body: 'Revisas el precio antes de iniciar una generación.' },
      { icon: 'credits', body: 'Los créditos se consumen solo en renders completados.' },
      { icon: 'refund', body: 'Los fallos del proveedor se reembolsan o no se cobran si no hay resultado utilizable.' },
    ],
  },
  faq: {
    title: 'FAQ',
    items: [
      { question: '¿Necesito una suscripción para generar videos con IA?', answer: 'No. MaxVideoAI utiliza créditos de pago por uso para que generes videos cuando los necesites.' },
      { question: '¿Puedo ver el precio del video con IA antes de generar?', answer: 'Sí. La app muestra una cotización en tiempo real según el modelo, la duración, la resolución, el audio y el flujo de trabajo.' },
      { question: '¿Qué modelo de video con IA debería probar primero?', answer: 'Empieza con Seedance 2.0 como referencia principal y después compara Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX y Wan según qué tan reciente sea cada modelo, el control de movimiento, la calidad cinematográfica, el estilo visual y el precio.' },
      { question: '¿Qué ocurre si falla un render?', answer: 'Los renders completados consumen créditos. Los trabajos fallidos del proveedor se reembolsan o no se cobran si no devuelven un resultado utilizable.' },
      { question: '¿Es lo mismo que la página de precios?', answer: 'No. Esta página responde directamente a la intención de pago por uso y sin suscripción. La página de precios ofrece la matriz detallada por modelo y escenario.' },
    ],
  },
  showcase: {
    section: {
      eyebrow: 'Resultados reales de pago por uso',
      title: 'Videos de ejemplo con modelo y precio',
      intro: 'Una selección breve de renders públicos de MaxVideoAI que muestra el modelo, la duración y el precio registrado cuando está disponible.',
      preview: 'Vista previa',
      result: 'Ver prompt y resultado',
      cta: 'Prueba tu prompt con una cotización en tiempo real',
      mediaPhrase: 'video de ejemplo generado con',
      engineImageAltSuffix: 'AI video model',
    },
    runtime: {
      priceUnavailable: 'Precio visible antes de generar',
      defaultEngineLabel: 'AI video model',
      defaultTitleEngineLabel: 'video IA',
      defaultTitleTemplate: 'Render de ejemplo con {engine}',
      titles: {
        rooftop: 'Persecución cinematográfica en una azotea',
        museum: 'Recorrido de una curadora de museo',
        'smooth-image': 'Animación fluida de imagen a video',
        'guided-image': 'Escena cinematográfica guiada por imagen',
        racer: 'Prueba de personaje de piloto',
        ugc: 'Prueba de selfie UGC vertical',
        warrior: 'Escena de guerrero en un templo oscuro',
        'product-image': 'Prueba de producto de imagen a video',
        'product-reveal': 'Presentación cinematográfica de producto',
      },
      fallbackTitles: { image: 'Escena cinematográfica guiada por imagen', character: 'Prueba de movimiento de personaje', prompt: 'Prueba de prompt de texto a video' },
      useCases: {
        seedanceMini: 'Prueba multimodal ligera antes de escalar.',
        seedance: 'Render de referencia para probar modelos.',
        kling: 'Prueba de control de movimiento o de imagen a video.',
        veo: 'Prueba de calidad cinematográfica y seguimiento de prompt.',
        happyHorseEarlier: 'Render anterior de Happy Horse usado como ejemplo de la opción de Alibaba.',
        happyHorse11: 'Opción alternativa de video Alibaba con Happy Horse 1.1.',
        happyHorse: 'Opción de video Alibaba alternativa.',
        ltx: 'Prueba de borrador eficiente e iteración de prompt.',
        wan: 'Prueba económica de texto o imagen a video.',
        fallback: 'Render público con modelo y contexto de precio.',
      },
    },
  },
  jsonLd: {
    breadcrumbName: 'Generador de video con IA de pago por uso',
    service: {
      name: 'Generador de video con IA de pago por uso',
      description: 'Genera videos con IA desde texto, imágenes o video sin suscripción, con una cotización antes de generar y reembolso de renders fallidos.',
      serviceType: 'Generación de video con IA de pago por uso',
      category: 'Generador de video con IA',
      offer: 'Los créditos iniciales están disponibles sin suscripción recurrente.',
    },
    webApplication: {
      description: 'Generador de video con IA de pago por uso para comparar varios modelos, con precio por adelantado y sin suscripción obligatoria.',
      offer: 'Los créditos iniciales están disponibles sin suscripción recurrente.',
      features: ['Genera videos con IA desde texto, imágenes o video', 'Compara Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan y otros modelos', 'Consulta el precio estimado antes de generar', 'Usa créditos solo para renders completados'],
    },
  },
} satisfies PayAsYouGoContent;
