import type { CanonicalExampleModelSlug, LocalizedModelDescriptor } from '@/lib/examples/modelLandingTypes';

export const ES_MODEL_DATA: Partial<Record<CanonicalExampleModelSlug, LocalizedModelDescriptor>> = {
  sora: {
    "metaTitle": "Ejemplos históricos de Sora | MaxVideoAI",
    "metaDescription": "Estos vídeos se crearon con Sora. Las nuevas generaciones con Sora están cerradas. Explora Seedance 2.5, MiniMax H3 y Wan 3 para tu próximo vídeo.",
    "heroTitle": "Ejemplos históricos de Sora",
    "subtitle": "Estos vídeos se crearon con Sora. Las nuevas generaciones con Sora están cerradas. Explora Seedance 2.5, MiniMax H3 y Wan 3 para tu próximo vídeo.",
    "intro": "La generación con Sora está cerrada. OpenAI y fal.ai cierran la API el 24 de septiembre de 2026. Elige Seedance 2.5, MiniMax H3 o Wan 3 para un nuevo vídeo. Tus vídeos existentes permanecen en tu biblioteca.",
    "promptPatterns": "Estos vídeos se crearon con Sora. Las nuevas generaciones con Sora están cerradas. Explora Seedance 2.5, MiniMax H3 y Wan 3 para tu próximo vídeo.",
    "strengthsLimits": "Estos vídeos se crearon con Sora. Las nuevas generaciones con Sora están cerradas. Explora Seedance 2.5, MiniMax H3 y Wan 3 para tu próximo vídeo.",
    "pricingNotes": "Los costes registrados son históricos. Elige un modelo disponible y revisa un nuevo presupuesto antes de generar.",
    "faq": [
        {
            "question": "¿Se puede seguir generando con Sora?",
            "answer": "La generación con Sora está cerrada. OpenAI y fal.ai cierran la API el 24 de septiembre de 2026. Elige Seedance 2.5, MiniMax H3 o Wan 3 para un nuevo vídeo. Tus vídeos existentes permanecen en tu biblioteca."
        },
        {
            "question": "Archivo de Sora y alternativas",
            "answer": "Los costes registrados son históricos. Elige un modelo disponible y revisa un nuevo presupuesto antes de generar."
        }
    ]
},
  veo: {
    metaTitle: "Ejemplos de Veo 3.1, prompts y ajustes de video | MaxVideoAI",
    metaDescription: "Mira ejemplos de Veo 3.1 con prompts, ajustes y costos registrados. Explora cómo crear videos a partir de texto o imágenes y adapta un ejemplo.",
    heroTitle: "Ejemplos de Veo 3.1, prompts y ajustes de video",
    subtitle: "Ejemplos de Veo 3.1 y Gemini Omni Flash 1.1: prompts, fuentes y ajustes para revisar.",
    intro: "Compara ejemplos de video de Google: Veo 3.1, Fast y Lite junto a Gemini Omni Flash 1.1. Abre un resultado para revisar su prompt y ajustes y adaptarlo en tu espacio de trabajo.",
    summary: "Veo y Gemini Omni son modelos distintos de Google reunidos en esta galería. Toma como referencia el nombre indicado en cada ejemplo. Las fichas y comparativas ayudan a elegir el flujo adecuado; revisa después el precio actual antes de generar.",
    promptPatterns: "Describe primero el sujeto, la acción y el movimiento de cámara. Con una imagen inicial, indica qué cambia y qué se conserva. Mantén la misma idea al comparar modelos y cambia una sola instrucción cada vez.",
    strengthsLimits: "Compara movimiento, encuadre y continuidad del sujeto en todo el clip. Veo y Omni no comparten todas las entradas ni opciones de edición: comprueba el modelo y el modo antes de añadir imágenes, referencias o un video fuente. Un ejemplo logrado no garantiza el mismo resultado con otro prompt.",
    pricingNotes: "La ficha del ejemplo muestra el costo registrado del render. Tu siguiente generación utiliza el precio actual según el modelo, las fuentes, la duración y la resolución. Reutiliza los ajustes disponibles, añade tus propias fuentes cuando sea necesario y revisa el precio antes de enviar.",
    faq: [
      {
        question: "¿Por qué hay ejemplos de Gemini Omni en esta galería de Veo?",
        answer: "Esta galería reúne ejemplos de video de Google, incluidos Veo y Gemini Omni. Siguen siendo modelos distintos: consulta el nombre del ejemplo y la comparativa Omni frente a Veo para elegir el flujo adecuado.",
      },
      {
        question: "¿Cómo recreo un ejemplo de Veo u Omni?",
        answer: "Abre su ficha para revisar el prompt, los ajustes y el costo registrado y utiliza la acción de recrear. Comprueba el modelo seleccionado, añade los medios fuente necesarios y revisa el nuevo precio en el espacio de trabajo antes de generar.",
      },
      {
        question: "¿Cómo comparo Veo 3.1, Fast, Lite y Omni?",
        answer: "Mantén el mismo sujeto y objetivo creativo y compara el resultado completo y el precio actual. Especifica el modo de entrada: los controles de referencia y edición varían según el modelo, por lo que no todos los ajustes se transfieren sin cambios.",
      },
    ],
  },
  luma: {
    metaTitle: 'Ejemplos de Luma Ray 3.2 Modify y Reframe | MaxVideoAI',
    metaDescription: "Mira ejemplos de video Luma Ray 3.2 Modify y Reframe, con prompts y ajustes. Edita tu propio video y consulta el precio antes de generar.",
    subtitle: "Cambia una escena con Modify o adapta su encuadre con Reframe: ejemplos de video Luma Ray 3.2.",
    intro: "Explora ejemplos de Luma Ray 3.2 Modify y Reframe. Abre un video para ver el prompt y los ajustes utilizados. Los ejemplos de Ray 2 y Ray 2 Flash conservan el nombre del modelo que los generó.",
    promptPatterns: "Para Modify, indica qué quieres conservar del video original y después qué quieres cambiar. Para Reframe, señala qué sujeto debe seguir visible y cómo completar el nuevo encuadre. Las imágenes guía y los fotogramas clave dependen del modo elegido.",
    strengthsLimits: "Evalúa cuánto se conserva del video original, si se cumple el cambio solicitado y si el sujeto se mantiene consistente. Ray 3.2 no genera audio en MaxVideoAI. Las fuentes y los ajustes admitidos difieren de Ray 2 y Ray 2 Flash: revisa el modelo de cada ejemplo.",
    pricingNotes: "La ficha muestra el costo registrado del ejemplo. Tu nuevo video tiene una cotización según el modo y los ajustes elegidos. Revisa el precio antes de generar y empieza con una prueba corta antes de editar un video más largo.",
    faq: [
      {
        question: "¿Cómo reutilizo una edición de video Luma?",
        answer: "Abre el ejemplo para consultar su prompt y sus ajustes, y adapta las instrucciones a tu propio video. Los archivos fuente privados no están incluidos y una nueva generación puede producir un resultado diferente.",
      },
      {
        question: "¿Ray 3.2 genera audio?",
        answer: "No. Los ejemplos de Ray 3.2 son videos sin sonido. Agrega voz, música o efectos de sonido por separado.",
      },
      {
        question: "¿Me conviene usar Modify o Reframe?",
        answer: "Usa Modify para cambiar el contenido visual de un video original. Usa Reframe para adaptar su encuadre. Consulta la ficha del modelo para ver las fuentes y los ajustes admitidos en cada modo.",
      },
    ],
  },
  wan: {
    subtitle: "Ejemplos de video Wan con prompts, ajustes y el modelo utilizado en cada resultado.",
    intro: "Mira ejemplos de Wan para comparar movimiento, encuadre y continuidad. Abre un video para ver su prompt, sus ajustes y su costo registrado, y adáptalo a tu proyecto. Revisa la versión del modelo antes de reutilizar los ajustes.",
    promptPatterns: "Describe un sujeto, una acción principal y un movimiento de cámara. Si la toma tiene varias etapas, indica su orden y mantén una secuencia fácil de seguir. Cambia una sola instrucción a la vez durante las pruebas.",
    strengthsLimits: "Revisa todo el video para detectar cambios en el sujeto, cortes inesperados o movimientos que no siguen el prompt. Las fuentes, duraciones y opciones de salida varían según el modelo Wan y el modo elegido.",
    pricingNotes: "La ficha del ejemplo muestra su costo registrado. El modelo, la duración y los demás ajustes determinan una nueva cotización en el estudio. Revisa el precio antes de generar y empieza con una prueba corta para evaluar el resultado.",
    faq: [
      {
        question: "¿Puedo partir de un ejemplo Wan para crear mi video?",
        answer: "Sí. Consulta su prompt y sus ajustes, y adáptalos en el estudio. Agrega tus propios archivos cuando el modo lo requiera. Reutilizar un prompt no garantiza un resultado idéntico.",
      },
      {
        question: "¿Puedo adaptar un ejemplo Wan al formato vertical?",
        answer: "Comprueba que el modelo y el modo elegidos admitan el formato que necesitas. Ajusta el encuadre para mantener visibles al sujeto y la acción, y revisa el resultado de una prueba.",
      },
      {
        question: "¿Cambiar la duración modifica el precio de Wan?",
        answer: "La duración es uno de los ajustes que pueden cambiar la cotización. Elige el modelo y las opciones que necesitas, y consulta el precio antes de generar.",
      },
    ],
  },
  kling: {
    metaTitle: 'Ejemplos de video IA Kling, prompts y ajustes | MaxVideoAI',
    metaDescription: "Mira ejemplos de video de Kling 3 y Kling 3.0 Omni: prompts, animación de imágenes, referencias, ajustes y costos registrados.",
    heroTitle: 'Ejemplos de video IA Kling, prompts y ajustes',
    subtitle: "Ejemplos de Kling 3 y Kling 3.0 Omni: descubre cómo una imagen inicial o las referencias guían una toma.",
    intro: "Mira ejemplos de video Kling y abre un resultado para ver su prompt y sus ajustes. Compara la animación de una imagen con Kling 3 y los usos de referencias y edición de video con Kling 3.0 Omni. Cada ejemplo indica el modelo utilizado.",
    summary: "Kling 3.0 Omni Pro y Standard admiten imágenes de referencia, storyboards y edición de un video original. Kling 3 Pro y Standard animan una imagen inicial. Kling 3.0 Omni 4K ofrece video en 4K nativo guiado por referencias.",
    promptPatterns: "Decide si una imagen debe guiar el video como referencia o aparecer como primer fotograma. Usa @Image1 y @Video1 para identificar las fuentes en los modos Omni compatibles. Para imagen a video con Kling 3, describe el movimiento desde la imagen inicial.",
    strengthsLimits: "Kling 3.0 Omni usa referencias para guiar la identidad, el estilo, el storyboard o la edición de video. Una referencia no necesariamente será el primer fotograma. Kling 3 en imagen a video anima la imagen que subes. Revisa el modelo y el modo antes de reutilizar las fuentes.",
    pricingNotes: "Compara duraciones, formatos, opciones de audio y resoluciones equivalentes en los modos disponibles. La ficha conserva el costo del ejemplo; el estudio muestra la cotización actual para el modelo y los ajustes elegidos. Revísala antes de generar.",
    faq: [
      {
        question: '¿Cuánto pueden durar los videos de Kling AI?',
        answer:
          'Kling 3.0 Omni Standard y Pro admiten renders 1080p guiados por referencias de hasta 15 segundos, con V2V desde video fuente en Standard y Pro. La ruta O3 4K es para entregas 4K nativas guiadas por referencias, mientras Kling 3 sigue siendo la ruta imagen a video con fotograma inicial.',
      },
      {
        question: '¿Cuánto tarda Kling AI en generar un video?',
        answer: "El tiempo de generación depende del modelo, la duración, las fuentes, el audio, la resolución y la demanda del momento. No hay un tiempo fijo para todos los videos. Una prueba corta te ayuda a evaluar el resultado y la espera con tus ajustes.",
      },
      {
        question: '¿Qué modelo de Kling AI debería usar para prompts y ejemplos?',
        answer:
          'Usa Kling 3.0 Omni Standard o Pro cuando referencias, storyboard o @Video1 deben guiar el render sin convertirse en la apertura del clip. Usa Kling 3 Standard o Pro cuando la imagen subida debe ser el fotograma inicial visible.',
      },
      {
        question: '¿Cómo debería usar Kling AI para pruebas de prompt en imagen a video?',
        answer:
          'Para O3, asigna un rol claro a cada referencia con @Image1, @Image2 o @Video1. Para Kling 3, parte de una imagen fuente clara, una instrucción de movimiento y un objetivo de cámara, porque la imagen debe abrir el clip.',
      },
      {
        question: '¿Cómo debería adaptar prompts de Kling AI entre Kling 3 Pro y Kling 3 Standard?',
        answer: "Mantén el mismo sujeto, acción, dirección de cámara y ajustes equivalentes al comparar Kling 3 Pro y Standard. Revisa los videos completos y las cotizaciones actuales. Ambos animan la imagen inicial; Omni es una opción distinta para trabajar con referencias.",
      },
    ],
  },
  seedance: {
    metaTitle: 'Ejemplos de Seedance 2.5, prompts y ajustes | MaxVideoAI',
    metaDescription: "Mira ejemplos de video Seedance 2.5 con prompts y ajustes. Compara resultados de otras versiones y usa un ejemplo como punto de partida.",
    heroTitle: 'Ejemplos de video IA Seedance 2.5, prompts y ajustes',
    subtitle: "Seedance 2.5 y versiones anteriores: mira los resultados y encuentra un prompt para tu idea.",
    intro: "Explora ejemplos de Seedance 2.5 junto a Seedance 2.0, Fast y Mini. Abre un video para ver su prompt, sus ajustes y su costo registrado. Cada resultado conserva el nombre del modelo que lo generó.",
    summary: "Seedance 2.5 permite crear videos de 4 a 30 segundos hasta 1080p, con audio generado, referencias, edición y extensión. Seedance 2.0 sigue disponible para 4K; Fast y Mini ofrecen otras opciones para pruebas y series de videos. Los ejemplos anteriores de 1.5 Pro conservan su nombre original.",
    promptPatterns:
      'Para Seedance 2.5, define una acción principal, la dirección de cámara y el papel de cada referencia antes de añadir detalles de escena. Mantén la misma estructura de prompt al comparar 2.5 con Seedance 2.0, Fast o Mini.',
    strengthsLimits:
      'Usa Seedance 2.5 cuando importen una mayor duración, el audio generado, las referencias mixtas, la edición o la extensión. En MaxVideoAI, este modelo admite salida horizontal, cuadrada y vertical en 480p, 720p o 1080p; conserva Seedance 2.0 cuando necesites 4K.',
    pricingNotes: "La duración, el audio y los archivos fuente pueden influir en el precio. La ficha muestra el costo registrado del ejemplo; el generador indica la cotización actual para tus ajustes antes de iniciar.",
    faq: [
      {
        question: '¿Todos los ejemplos de Seedance de esta página se generaron con Seedance 2.5?',
        answer:
          'No. La galería conserva las etiquetas exactas de los renders Seedance 2.5, Seedance 2.0, Fast, Mini y 1.5 Pro aún compatibles para que puedas comparar el modelo utilizado.',
      },
      {
        question: '¿Con qué modelo Seedance debería empezar para ejemplos y pruebas de prompt?',
        answer:
          'Empieza con Seedance 2.5 para el modelo principal actual hasta 1080p. Usa Seedance 2.0 para necesidades de 4K, Fast para borradores más rápidos y Mini para variantes repetibles por lotes.',
      },
      {
        question: '¿Qué ajustes afectan más al precio de un video Seedance?',
        answer:
          'La duración, el audio generado y el uso de un video fuente son los factores que más influyen en el precio. Mantén estos ajustes alineados al comparar rutas.',
      },
    ],
  },
  ltx: {
    metaTitle: "Ejemplos de video LTX, prompts y ajustes | MaxVideoAI",
    metaDescription: "Mira ejemplos de video LTX 2.5 Pro y Fast, con prompts y ajustes. Compara también resultados de LTX 2.3 y LTX 2, identificados por modelo.",
    heroTitle: "Ejemplos de video LTX, prompts y ajustes",
    subtitle: "Ejemplos de LTX 2.5 Pro y Fast, con las versiones anteriores claramente identificadas.",
    intro: "Mira ejemplos de LTX 2.5 Pro y Fast y abre un video para ver su prompt, sus ajustes y su costo registrado. Los resultados de LTX 2.3 y LTX 2 conservan el nombre del modelo que los generó.",
    summary:
      "LTX 2.5 Pro y Fast encabezan esta página. Los ejemplos de LTX 2.3 y LTX 2 conservan sus etiquetas originales para comparar generaciones sin confundir sus capacidades.",
    promptPatterns: "Describe el sujeto, la acción, el movimiento de cámara y el estilo visual. Para imagen a video, explica cómo debe moverse la escena desde la imagen inicial. Mantén ese punto de partida y cambia una sola instrucción a la vez.",
    strengthsLimits: "Compara todo el video entre Pro y Fast: ¿el movimiento sigue el prompt y el sujeto se mantiene consistente? Usa la misma imagen para las pruebas de imagen a video. Un ejemplo logrado es un punto de partida, no una garantía de resultados idénticos.",
    pricingNotes: "Especifica el modelo, el modo, la duración, la resolución y las opciones de audio disponibles al comparar costos. La ficha conserva el costo registrado del ejemplo; revisa la cotización actual en el estudio antes de generar tu versión.",
    faq: [
      {
        question: '¿Cuáles son los mejores ejemplos de prompts de LTX 2.5 para empezar?',
        answer:
          'El mejor punto de partida es una estructura simple: sujeto, acción, dirección de cámara y objetivo visual. Los ejemplos más útiles mantienen esa estructura estable y solo cambian una variable a la vez.',
      },
      {
        question: '¿Cómo debería estructurar un prompt de LTX 2.5?',
        answer:
          'Empieza con un sujeto claro, una acción principal, una instrucción de cámara y una referencia de estilo visual. Los prompts de LTX 2.5 suelen funcionar mejor cuando el objetivo de movimiento es explícito y la escena se mantiene compacta.',
      },
      {
        question: '¿Qué ajustes importan más en los resultados de LTX 2.5?',
        answer:
          'Los ajustes más importantes son la duración, la relación de aspecto, la imagen fuente para imagen a video y el nivel de complejidad de movimiento que pides en un solo prompt. Mantenerlos estables hace mucho más fácil probar prompts.',
      },
      {
        question: '¿Cómo debería escribir prompts para LTX 2.5 en imagen a video?',
        answer:
          'Parte de una imagen de partida bien definida y añade una instrucción de movimiento, un movimiento de cámara y un objetivo de salida. LTX 2.5 funciona mejor cuando el prompt amplía la imagen original en lugar de intentar sustituirla por una escena totalmente distinta.',
      },
      {
        question: '¿Qué modelo LTX debería usar: LTX 2.5 Pro o LTX 2.5 Fast?',
        answer:
          'Compara LTX 2.5 Pro y Fast con el mismo prompt y los mismos ajustes. Usa los ejemplos para valorar el resultado y la página de precios para comparar costos actuales. Consulta cada modelo para sus modos y límites; los ejemplos anteriores describen la versión indicada en su etiqueta.',
      },
    ],
  },
  pika: {
    subtitle: 'Ejemplos de Pika pensados para loops cortos, un estilo social marcado y una edición ágil.',
    intro:
      'Esta página de Pika se centra en formatos cortos y estilizados. Permite reutilizar patrones de movimiento ya probados y ajustar sujeto y estilo sin rehacer toda la configuración.',
    promptPatterns:
      'Empieza por el estilo, suma la acción principal y cierra con una instrucción breve de cámara.',
    strengthsLimits:
      'Pika suele funcionar bien para loops rápidos y piezas muy pensadas para redes. Evita prompts sobrecargados para reducir la inestabilidad.',
    pricingNotes:
      'El precio es más predecible con duraciones cortas y presets constantes.',
    faq: [
      {
        question: '¿Cómo reutilizo bien un ejemplo de Pika?',
        answer: 'Clona el patrón de movimiento y cambia primero sujeto y estilo.',
      },
      {
        question: '¿Estos ejemplos de Pika sirven para variantes de anuncios en redes sociales?',
        answer: 'Sí, están pensados para iteraciones rápidas.',
      },
      {
        question: '¿Cómo mantengo costes estables en Pika?',
        answer: 'Fija duración y resolución antes de lanzar múltiples variantes.',
      },
    ],
  },
  hailuo: {
    subtitle: "Ejemplos de video MiniMax H3 Max, H3 y versiones anteriores de Hailuo, con prompts y ajustes.",
    intro: "Mira MiniMax H3 Max y H3 junto a ejemplos anteriores de Hailuo. Abre un video para consultar su prompt, sus ajustes y su costo registrado, y úsalo como punto de partida para tu propia escena.",
    summary: "Cada ejemplo de MiniMax o Hailuo conserva el nombre del modelo que lo generó. Compara el movimiento, la continuidad y el audio, si lo tiene, en todo el video. Las fichas de H3 y H3 Max detallan las fuentes y los ajustes disponibles para tu proyecto.",
    promptPatterns: "Empieza por el sujeto, una acción clara y la dirección de cámara. Añade indicaciones de escena o sonido pertinentes para el modelo elegido. Si utilizas referencias, asigna una función clara a cada fuente autorizada y comprueba que el modelo admite esa entrada.",
    strengthsLimits: "Evalúa el resultado completo: identidad del sujeto, movimiento, encuadre y cualquier audio generado. H3 Max, H3 y los Hailuo anteriores tienen modos y opciones de salida diferentes. Un ejemplo muestra un resultado, sin garantizar coherencia perfecta ni controles idénticos en toda la familia.",
    pricingNotes: "Compara H3 y H3 Max con la misma idea y objetivo de salida. La ficha conserva el costo del ejemplo; el espacio de trabajo ofrece el precio actual para tu siguiente render. Valida un plano corto y amplía las versiones que cumplan tus criterios visuales.",
    faq: [
      {
        question: "¿Por qué MiniMax H3 y H3 Max aparecen en la galería Hailuo?",
        answer: "Esta galería reúne modelos de video MiniMax, incluidos H3, H3 Max y versiones anteriores de Hailuo. Cada video indica el modelo utilizado. Los ejemplos anteriores no representan las capacidades de H3 o H3 Max.",
      },
      {
        question: "¿Cómo elijo entre MiniMax H3 y H3 Max?",
        answer: "Abre la comparativa H3 frente a H3 Max y sus fichas. Compara las entradas admitidas, las resoluciones disponibles y el precio actual con tu objetivo de salida y revisa ejemplos del modelo exacto que quieres utilizar.",
      },
      {
        question: "¿Puedo reutilizar un ejemplo de MiniMax en mi espacio de trabajo?",
        answer: "Abre su ficha, revisa el prompt y los ajustes registrados y utiliza la acción de recrear. Añade tus propios medios necesarios y comprueba el precio actual antes de generar; un ejemplo público no da acceso a fuentes privadas.",
      },
    ],
  },
  grok: {
    subtitle: 'Ejemplos de Grok Imagine Video 1.5 para texto a vídeo, imagen inicial y clips guiados por referencia.',
    intro:
      'Esta página permite estudiar Grok Imagine Video 1.5 mediante la ruta Fal de MaxVideoAI. Incluye texto a vídeo, imagen a vídeo desde una imagen inicial y generación guiada por entre una y siete imágenes de referencia; esta disponibilidad no implica una integración directa con xAI. La galería sirve para elegir una estrategia de entrada, no para asumir que un mismo prompt funciona en todos los modos. El texto es adecuado cuando la composición puede inventarse desde el brief. Una imagen inicial resulta más útil cuando el primer encuadre, la posición del sujeto, el producto, el vestuario o la paleta ya existen. Un conjunto de referencias encaja cuando cada fuente autorizada tiene una función distinta, como identidad, diseño de objeto, entorno o iluminación. Para leer un ejemplo, revisa juntos el prompt, el modo, la duración, la resolución, el encuadre y la salida aceptada. Una imagen atractiva no demuestra por sí sola fidelidad a las referencias, texto incidental legible, manos estables o continuidad hasta el último beat. Define criterios de aceptación antes del render y conserva revisión humana para semejanzas, derechos de las fuentes y seguridad de marca.',
    promptPatterns:
      'Para texto a vídeo, define sujeto, acción, cámara y luz, y describe el final que debe seguir visible cuando termine el clip. Mantén una acción principal y una intención de cámara para poder diagnosticar los fallos de movimiento. Con una imagen inicial, describe solo lo que debe evolucionar: qué permanece fijo, qué se mueve, cómo reacciona la cámara y qué detalles visuales deben sobrevivir. No pidas al prompt rediseñar la fuente y conservarla exactamente al mismo tiempo. Para referencias, asigna una función clara a cada imagen en lugar de repetir todos sus detalles. Nombra las imágenes en orden, indica cuál controla a la persona, prenda, objeto, lugar o paleta y explica cómo se combinan esos papeles en una sola toma. Una o dos referencias precisas pueden ser más claras que siete fuentes contradictorias. Coloca las restricciones negativas después de la dirección positiva y resérvalas para riesgos visibles como logotipos no deseados, sujetos duplicados, extremidades extra, subtítulos accidentales o cortes de cámara. Al comparar dos prompts, cambia una sola variable y mantén estables las fuentes, la duración, la resolución y el encuadre.',
    strengthsLimits:
      'Grok admite puntos de partida flexibles con texto, imagen inicial y múltiples referencias. Los flujos de texto e imagen pueden usar el nivel de salida superior que muestre la página del modelo, mientras el modo de referencia queda limitado a sus opciones visibles de 480p o 720p. La imagen inicial determina el encuadre en imagen a vídeo, así que no debe inferirse una promesa separada de relación de aspecto. El modo referencia recibe imágenes, no un vídeo fuente, una pista de audio o un documento genérico. Añadir referencias aumenta la complejidad de la dirección y no garantiza coherencia. Evalúa por separado la lectura inicial, identidad, movimiento, anatomía, geometría, texto o marcas de agua no deseados y beat final. La página no afirma audio nativo, ejecución directa en xAI, lip sync garantizado, tipografía perfecta ni controles ausentes del modo elegido. La cola, disponibilidad y cotización exacta pueden cambiar sin alterar el contrato creativo; consulta por ello los detalles en vivo y el presupuesto previo al render. Para una semejanza o producto sensible, ejecuta primero un diagnóstico corto, inspecciona todos los fotogramas y conserva una aprobación humana antes de publicar.',
    pricingNotes:
      'Usa la cotización mostrada antes de generar: esta página no fija una tarifa del proveedor ni un total acabado. Empieza con un diagnóstico corto a 480p o 720p para referencias, o una prueba de texto o imagen a 720p, antes de subir a los ajustes superiores disponibles en ese modo. La cotización de referencias debe recibir el número real de imágenes, no una suposición genérica de texto a vídeo. Compara costes solo si coinciden modo, duración, resolución y cantidad de referencias. Conserva también los intentos rechazados en el registro de producción para no evaluar velocidad y estabilidad únicamente a partir de los ejemplos que salieron bien.',
    faq: [
      { question: '¿Grok puede partir de una imagen?', answer: 'Sí. Imagen a vídeo utiliza una imagen inicial y pide al prompt dirigir el movimiento desde esa composición. Referencia a vídeo admite un grupo de imágenes con funciones nombradas. Elige una imagen inicial cuando exista un único fotograma autoritativo y referencias cuando identidad, objeto, entorno o paleta procedan de fuentes autorizadas distintas.' },
      { question: '¿Cuántas referencias admite?', answer: 'El flujo de referencia admite de una a siete imágenes. La capacidad no es un objetivo: usa solo las fuentes necesarias, da a cada una un propósito distinto y elimina material redundante o contradictorio. Mantén también el orden de las imágenes al probar prompts para poder atribuir los cambios de fidelidad a la instrucción y no a una lista reordenada.' },
      { question: '¿Es una ruta directa de xAI?', answer: 'No. xAI es propietario de la familia Grok, mientras MaxVideoAI distribuye actualmente este modelo mediante Fal. Los ejemplos describen la capacidad expuesta por esa ruta y no prometen acceso directo a la API de xAI, comportamiento idéntico de cola ni funciones que no aparezcan en los detalles actuales.' },
      { question: '¿Cómo debería revisar un ejemplo de Grok?', answer: 'Comprueba si la composición inicial o las referencias nombradas siguen siendo reconocibles y puntúa después movimiento, cámara, anatomía, geometría, texto no deseado, marcas de agua y beat final. Revisa el clip completo, no solo la miniatura, y considera cualquier comportamiento pedido pero ausente como un dato de la prueba.' },
    ],
  },
  flux: {
    subtitle: 'Ejemplos de FLUX 3 y FLUX 3 Draft para texto a vídeo, fotogramas inicial/final y Extend.',
    intro:
      'Esta página compara la ruta FLUX 3 estándar con FLUX 3 Draft mediante la distribución Fal de MaxVideoAI. Incluye texto a vídeo, imagen a vídeo desde un fotograma inicial, transiciones entre primera y última imagen y el flujo Extend separado para continuar un clip existente. La vista de familia ayuda a elegir tanto el nivel de modelo como la entrada. Draft sirve para exploración controlada a 720p cuando el equipo todavía debe validar acción, cámara, compatibilidad de fuentes o lógica de transición. FLUX 3 estándar es el modelo hermano orientado a producción y expone la opción de resolución superior indicada en su página. Ninguna etiqueta elimina la necesidad de revisar la salida. Un ejemplo útil registra el papel de la fuente, el prompt, el modo, la duración, la resolución y la pregunta visual que debe responder. Compara tareas equivalentes: un puente entre dos imágenes se evalúa por el recorrido entre anclas, una extensión por la continuidad con el clip fuente y un inicio de texto por la toma inventada desde el brief. Black Forest Labs es propietario de FLUX; la ruta aquí descrita se distribuye mediante Fal y no afirma ejecución directa en el proveedor.',
    promptPatterns:
      'Describe una sola toma, un movimiento de cámara específico, una acción medible del sujeto, el entorno físico y un final que pueda revisarse. Evita combinar varios beats sin relación en un render de diagnóstico. Para imagen a vídeo, indica primero qué debe conservarse de la composición inicial y añade después el movimiento. Al usar primera y última imagen, aporta las dos anclas obligatorias y escribe la transición: cómo evolucionan pose, posición del objeto, material, cámara y luz sin un salto imposible. Perspectiva e identidad compatibles facilitan evaluar el puente. Para Extend, describe lo que sucede después del clip fuente en vez de repetirlo. Continúa primero el vector final de cámara, la trayectoria del sujeto, la iluminación, el ritmo y el estado de la escena antes de introducir algo nuevo. Un corte oculto, una pose reiniciada o un sujeto sustituido son fallos de continuidad aunque el último fotograma resulte atractivo. Usa Draft para comparar una sola variable y conserva los archivos fuente ganadores, la estructura del prompt y los criterios de aceptación al probar FLUX 3 estándar.',
    strengthsLimits:
      'FLUX 3 es la ruta de calidad estándar y Draft está pensado para iterar con mayor rapidez en su nivel fijo de 720p. Ambos modelos exponen contratos distintos de texto, imagen inicial, primera/última imagen y extensión; una entrada obligatoria no se vuelve opcional en Draft. Extend es un modo separado de continuación de vídeo con un clip fuente elegible y hechos canónicos de precio propios. Un flujo de inicio/final no equivale a un conjunto libre de referencias, y el uso de imagen inicial no debe implicar una relación de aspecto seleccionable aparte cuando la fuente controla el encuadre. No infieras audio nativo, lip sync, transformación de vídeo de referencia fuera de Extend ni controles que no aparezcan en el modo elegido. Revisa conservación de fuente, continuidad de cámara, identidad, anatomía, geometría, texto accidental, marcas de agua y beat final. Un resultado Draft aporta evidencia para una decisión creativa; no garantiza que estándar reproduzca cada píxel. Para la entrega, vuelve a ejecutar la dirección elegida en el modelo hermano previsto y revisa ese resultado de forma independiente.',
    pricingNotes:
      'Draft ayuda a validar una dirección antes de una pasada FLUX 3 estándar. Confirma la cotización previa porque duración, resolución, nivel y modo afectan al coste, y Extend nunca debe heredar por omisión una tarifa de generación normal. Esta página familiar no contiene una cantidad fija. Compara costes con la misma fuente y ajustes, registra intentos fallidos o rechazados y sube de nivel únicamente las direcciones que cumplen el criterio visual escrito. Un borrador más barato es valioso cuando elimina incertidumbre; repetir borradores sin control no constituye automáticamente un proceso eficiente.',
    faq: [
      { question: '¿Cuándo conviene FLUX 3 Draft?', answer: 'Usa Draft cuando una prueba a 720p pueda responder una pregunta concreta sobre dirección del prompt, movimiento, conservación de la imagen inicial, compatibilidad de fotogramas o continuidad de la extensión. Guarda el prompt y las fuentes aprobados para la pasada estándar. No presentes Draft como equivalencia de entrega ni asumas que una miniatura atractiva demuestra que la transición funciona.' },
      { question: '¿FLUX 3 puede ampliar un vídeo?', answer: 'Sí. Elige el modo Extend separado, aporta un clip fuente elegible y describe la continuación después de su estado final visible. Conserva dirección de cámara, posición del sujeto, luz y ritmo antes de introducir una acción nueva. El precio y la validación de extensión siguen siendo específicos del modo y no heredan el contrato de generación normal.' },
      { question: '¿En qué se diferencian inicio/final e imagen a vídeo?', answer: 'Imagen a vídeo anima una sola composición inicial. El modo de primera y última imagen exige dos anclas y debe construir un recorrido plausible entre ellas. Usa imágenes compatibles, indica qué se transforma y qué permanece estable y evalúa el puente completo en lugar de mirar únicamente sus extremos.' },
      { question: '¿FLUX 3 genera audio nativo?', answer: 'Esta página familiar no afirma capacidad de audio. Utiliza solo las entradas y controles visibles para el modo FLUX seleccionado y planifica voz, música o diseño sonoro como una etapa de producción separada salvo que los detalles en vivo del modelo indiquen explícitamente un cambio.' },
    ],
  },
};
