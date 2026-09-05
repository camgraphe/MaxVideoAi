import type { CanonicalExampleModelSlug, LocalizedModelDescriptor } from '@/lib/examples/modelLandingTypes';

export const ES_MODEL_DATA: Partial<Record<CanonicalExampleModelSlug, LocalizedModelDescriptor>> = {
  sora: {
    subtitle: 'Ejemplos de Sora pensados para un acabado cinematográfico, prompts reutilizables y ajustes realmente útiles.',
    intro:
      'Esta página reúne ejemplos reales de Sora para reutilizar y ajustar en producción. La idea es ayudarte a repetir resultados con más consistencia usando prompts, duraciones y formatos que ya demostraron funcionar.',
    promptPatterns:
      'Define primero la intención de la toma, luego la cámara, el movimiento y la iluminación. Los prompts cortos, estructurados y bien jerarquizados suelen responder mejor.',
    strengthsLimits:
      'Sora suele destacar por su coherencia cinematográfica y por un movimiento más pulido. Los límites dependen del modo y del contexto de render.',
    pricingNotes:
      'El precio cambia según la duración, la resolución y las opciones activas. Abre un ejemplo para revisar su coste registrado antes de escalar.',
    faq: [
      {
        question: '¿Qué prompts funcionan mejor en Sora?',
        answer: 'Prompts estructurados con sujeto, cámara y movimiento claramente separados.',
      },
      {
        question: '¿Puedo reutilizar estos ejemplos de Sora en el espacio de trabajo?',
        answer: 'Sí, están diseñados para reutilizarse y adaptarse rápidamente.',
      },
      {
        question: '¿Cómo controlo el presupuesto en Sora?',
        answer: 'Empieza con clips cortos y escala solo las variantes ganadoras.',
      },
    ],
  },
  veo: {
    metaTitle: 'Ejemplos de Veo 3.1, prompts, ajustes e image-to-video | MaxVideoAI',
    metaDescription:
      'Consulta ejemplos de Veo 3.1, prompts, ajustes y patrones image-to-video, y abre la ficha de un video para ver el coste registrado del render en MaxVideoAI.',
    heroTitle: 'Ejemplos de Veo 3.1, prompts, ajustes y patrones image-to-video',
    subtitle: 'Ejemplos de Veo 3.1, prompts, ajustes y patrones image-to-video en la familia Veo actual.',
    intro:
      'Consulta ejemplos de Veo 3.1, Veo 3.1 Fast y Veo 3.1 Lite con prompts, ajustes reutilizables y patrones imagen a video, y luego abre las fichas de modelo para ver especificaciones, límites y precios. Usa esta página para estudiar la estructura del prompt, los patrones de texto a video y los ajustes imagen a video propios de cada modelo antes de abrir la página Veo correspondiente.',
    summary:
      'Veo 3.1 lidera esta página para ejemplos, prompts, ajustes y patrones imagen a video, con Veo 3.1 Fast y Veo 3.1 Lite visibles como variantes Veo actuales para iteración más rápida y borradores con audio a menor precio.',
    promptPatterns:
      'Empieza por el objetivo de la toma y luego concreta la cámara, el ambiente y las restricciones de referencia útiles para imagen a video. Los ejemplos de Veo 3.1 funcionan mejor cuando la estructura del prompt se mantiene estable.',
    strengthsLimits:
      'Veo suele ofrecer buen control de encuadre y movimiento en runs cortos de texto a video e imagen a video. Las capacidades varían según el modo activo y el tipo de entrada.',
    pricingNotes:
      'Compara costos con presets iguales en duración y resolución para obtener una lectura más limpia.',
    faq: [
      {
        question: '¿Cómo debería usar Veo 3 para imagen a video?',
        answer:
          'Parte de una imagen fuerte, define un solo objetivo de movimiento y mantén una dirección de cámara explícita. Los flujos de Veo 3.1 en imagen a video suelen funcionar mejor cuando el prompt extiende la imagen fuente en lugar de reemplazarla por completo.',
      },
      {
        question: '¿Que modelo Veo 3 deberia usar para probar prompts?',
        answer:
          'Empieza con Veo 3.1 Fast o Veo 3.1 Lite cuando quieras borradores mas baratos y pruebas de prompt mas rapidas, y pasa a Veo 3.1 cuando necesites una salida cinematica mas pulida y mejor control guiado por referencias.',
      },
      {
        question: '¿Estos ejemplos de Veo 3.1 sirven como base para prompts de texto a video?',
        answer:
          'Sí. Utilízalos como base de texto a video manteniendo el mismo sujeto, objetivo de movimiento, dirección de cámara y formato, y cambia solo una variable del prompt cada vez.',
      },
    ],
  },
  luma: {
    metaTitle: 'Ejemplos de Luma Ray 3.2 Modify y Reframe | MaxVideoAI',
    metaDescription:
      'Revisa ejemplos de Luma Ray 3.2 para Modify de video fuente, Reframe de video IA, cuadros guia, tests silenciosos 5 s / 10 s, prompts reutilizables y contexto Ray 2 / Flash.',
    subtitle: 'Ejemplos de Luma Ray 3.2 para Modify de video fuente, Reframe, cuadros guia, formatos y tests silenciosos con control de coste.',
    intro:
      'Esta pagina es la vista de familia de Luma Ray dentro de MaxVideoAI. Ahora prioriza Ray 3.2 para Modify de video fuente, pasadas guiadas por cuadro o imagenes clave y Reframe de entregables, mientras Ray 2 y Ray 2 Flash siguen sirviendo como contexto de ejemplos anteriores y cobertura de respaldo. Las paginas de modelo cubren las caracteristicas detalladas; esta galeria sirve para leer patrones de prompt, ejemplos de edicion y ajustes con coste controlado.',
    promptPatterns:
      'Los ejemplos de Luma funcionan mejor cuando el prompt se adapta al modo. Para Modify, escribe que se conserva del video fuente antes del cambio solicitado. Para Reframe, nombra prioridad de sujeto y relleno de encuadre. Para generacion complementaria, conserva un sujeto, un movimiento, direccion de camara, formato objetivo y duracion/resolucion.',
    strengthsLimits:
      'Ray 3.2 es la ruta Luma actual para modificacion de video fuente, direccion visual por imagenes clave, reencuadre de entregables, pasadas de producto y pruebas cortas complementarias. No es un motor de audio ni lip sync en MaxVideoAI, asi que evalua los ejemplos por preservacion de fuente, encuadre, continuidad de producto, disciplina de edicion y control del prompt. Ray 2 y Ray 2 Flash quedan disponibles como contexto de produccion anterior.',
    pricingNotes:
      'Empieza con clips de 5 s en 540p o 720p para validar movimiento, y pasa solo las tomas aprobadas a renders mas largos o de mayor resolucion. El precio cliente sigue el presupuesto del sitio antes de generar; la ruta directa Luma conserva ese precio y el respaldo Fal protege disponibilidad.',
    faq: [
      {
        question: '¿Cuándo conviene empezar por la página de ejemplos de Luma?',
        answer: 'Empieza aqui cuando quieras ver patrones Ray 3.2 Modify y Reframe antes de abrir la pagina del modelo o clonar un prompt en la app.',
      },
      {
        question: '¿Ray 3.2 genera audio?',
        answer: 'No. Trata los ejemplos Ray 3.2 como salidas de video silenciosas y añade voz, musica o sound design mas tarde.',
      },
      {
        question: '¿Conviene empezar con texto o con imagen?',
        answer: 'Empieza desde un video fuente cuando el timing ya funciona. Usa texto o imagen solo para crear un nuevo clip corto y silencioso antes de una pasada Modify o Reframe.',
      },
    ],
  },
  wan: {
    subtitle: 'Ejemplos de Wan pensados para secuencias estructuradas, transiciones limpias y continuidad guiada.',
    intro:
      'Los ejemplos de Wan de esta página están pensados para secuencias cortas con beats claros y transiciones controladas. Funcionan como punto de partida operativo antes de reutilizar en producción, sobre todo cuando el ritmo importa tanto como el acabado final.',
    promptPatterns:
      'Usa prompts en 2 o 3 beats: arranque, acción y cierre. Las transiciones explícitas suelen mejorar la estabilidad.',
    strengthsLimits:
      'Wan funciona bien en secuencias cortas estructuradas y continuidad guiada por referencia. Mantén escenas simples para reducir deriva.',
    pricingNotes:
      'Valida primero un clip corto con el preset objetivo y luego amplía a variantes.',
    faq: [
      {
        question: '¿Estos ejemplos de Wan están pensados para prompts multi-beat?',
        answer: 'Sí, están estructurados para secuencias cortas con transiciones claras.',
      },
      {
        question: '¿Puedo adaptar Wan a formatos verticales?',
        answer: 'Sí, conserva la lógica de movimiento y ajusta encuadre y ritmo.',
      },
      {
        question: '¿Cuál es la mejor forma de probar precio en Wan?',
        answer: 'Haz una prueba corta en preset final antes de lanzar lotes.',
      },
    ],
  },
  kling: {
    metaTitle: 'Ejemplos de video IA Kling, prompts y ajustes | MaxVideoAI',
    metaDescription:
      'Revisa ejemplos de video IA de Kling con prompts, referencias visuales, storyboard, V2V desde video fuente, image-to-video con frame inicial y precios para Kling 3.0 Omni y Kling 3.',
    heroTitle: 'Ejemplos de video IA Kling, prompts y ajustes',
    subtitle:
      'Ejemplos de video IA Kling, prompts, ajustes, referencias, patrones de imagen a video y guía de modelo para Kling 3.0 Omni, Kling 3 y versiones anteriores aún compatibles.',
    intro:
      'Revisa ejemplos de video IA de Kling, prompts y ajustes reutilizables para Kling 3.0 Omni Pro, Standard y 4K, y compáralos con las rutas Kling 3 con frame inicial visible y versiones anteriores aún compatibles. Usa esta página para separar prompts O3 guiados por referencias de prompts Kling 3 image-to-video clásicos antes de abrir la página de modelo correspondiente.',
    summary:
      'Kling 3.0 Omni Pro y Standard son las rutas actuales para imágenes de referencia, storyboards y V2V desde video fuente. Kling 3 Pro y Standard siguen siendo las rutas image-to-video con frame inicial visible, mientras Kling 3.0 Omni 4K sirve para entregas 4K nativas guiadas por referencias.',
    promptPatterns:
      'Empieza decidiendo si el medio subido debe guiar el render como referencia o convertirse en el primer frame visible. Usa @Image y @Video1 para O3; usa lenguaje de frame inicial cuando la toma corresponda a Kling 3.',
    strengthsLimits:
      'O3 encaja mejor cuando las referencias guían estilo, identidad, estructura de storyboard o movimiento de un video fuente sin abrir el clip. Kling 3 encaja mejor cuando una imagen fuente debe aparecer como primer frame y el prompt debe animar desde esa imagen.',
    pricingNotes:
      'Mantén alineados duración, relación de aspecto, audio y resolución al comparar resultados Kling. Usa Standard para pruebas O3 de menor costo, Pro para pasadas con referencias/V2V más sólidas y 4K solo cuando la dirección ya esté aprobada.',
    faq: [
      {
        question: '¿Cuánto pueden durar los videos de Kling AI?',
        answer:
          'Kling 3.0 Omni Standard y Pro admiten renders 1080p guiados por referencias de hasta 15 segundos, con V2V desde video fuente en Standard y Pro. La ruta O3 4K es para entregas 4K nativas guiadas por referencias, mientras Kling 3 sigue siendo la ruta image-to-video con frame inicial.',
      },
      {
        question: '¿Cuánto tarda Kling AI en generar un video?',
        answer:
          'El tiempo de render depende del modelo Kling, la duración, los medios subidos, el audio, la resolución y la cola. Las pruebas cortas en Standard suelen ser la forma más rápida de validar una dirección, mientras O3 V2V, audio activo y 4K nativo tardan más.',
      },
      {
        question: '¿Qué modelo de Kling AI debería usar para prompts y ejemplos?',
        answer:
          'Usa Kling 3.0 Omni Standard o Pro cuando referencias, storyboard o @Video1 deben guiar el render sin convertirse en la apertura del clip. Usa Kling 3 Standard o Pro cuando la imagen subida debe ser el frame inicial visible.',
      },
      {
        question: '¿Cómo debería usar Kling AI para pruebas de prompt en image-to-video?',
        answer:
          'Para O3, asigna un rol claro a cada referencia con @Image1, @Image2 o @Video1. Para Kling 3, parte de una imagen fuente clara, una instrucción de movimiento y un objetivo de cámara, porque la imagen debe abrir el clip.',
      },
      {
        question: '¿Cómo debería adaptar prompts de Kling AI entre Kling 3 Pro y Kling 3 Standard?',
        answer:
          'Mantén el mismo sujeto, acción, dirección de cámara y duración al comparar tiers. Cambia solo la intención de ruta: O3 para referencias/storyboard/V2V, Kling 3 para frame inicial y 4K solo para renders de entrega aprobados.',
      },
    ],
  },
  seedance: {
    metaTitle: 'Ejemplos de Seedance 2.5, prompts y ajustes | MaxVideoAI',
    metaDescription:
      'Explora ejemplos de video Seedance 2.5 y sus prompts, y compara los workflows Seedance 2.0, Fast, Mini y 1.5 Pro aún compatibles.',
    heroTitle: 'Ejemplos de video IA Seedance 2.5, prompts y ajustes',
    subtitle:
      'Ejemplos, prompts y ajustes de Seedance liderados por Seedance 2.5, con los workflows actuales y compatibles en contexto.',
    intro:
      'Empieza con Seedance 2.5 para los workflows actuales de 4 a 30 segundos hasta 1080p, con audio generado y referencias, y compara después ejemplos de Seedance 2.0, Fast y Mini sin presentar renders anteriores como salidas de Seedance 2.5. Abre primero un video para ver su prompt y ajustes; los enlaces de modelo y comparativa permanecen bajo la galería.',
    summary:
      'Seedance 2.5 es la ruta principal para workflows más largos hasta 1080p, audio generado, referencias, edición y extensión. Seedance 2.0 sigue disponible para necesidades de 4K, Fast y Mini cubren borradores o lotes, y Seedance 1.5 Pro continúa compatible como referencia anterior.',
    promptPatterns:
      'Para Seedance 2.5, define una acción principal, la dirección de cámara y el papel de cada referencia antes de añadir detalles de escena. Mantén la misma estructura de prompt al comparar 2.5 con Seedance 2.0, Fast o Mini.',
    strengthsLimits:
      'Usa Seedance 2.5 cuando importen una mayor duración, el audio generado, las referencias mixtas, la edición o la extensión. Su ruta pública de MaxVideoAI admite salida horizontal, cuadrada y vertical en 480p, 720p o 1080p; conserva Seedance 2.0 cuando necesites 4K.',
    pricingNotes:
      'La duración, el audio y el tipo de medio utilizado influyen en el precio. El generador muestra la tarifa antes de iniciar.',
    faq: [
      {
        question: '¿Todos los ejemplos de Seedance de esta página se generaron con Seedance 2.5?',
        answer:
          'No. La galería conserva las etiquetas exactas de los renders Seedance 2.5, Seedance 2.0, Fast, Mini y 1.5 Pro aún compatibles para que puedas comparar la ruta realmente utilizada.',
      },
      {
        question: '¿Con qué modelo Seedance debería empezar para ejemplos y pruebas de prompt?',
        answer:
          'Empieza con Seedance 2.5 para el workflow principal actual hasta 1080p. Usa Seedance 2.0 para necesidades de 4K, Fast para borradores más rápidos y Mini para variantes repetibles por lotes.',
      },
      {
        question: '¿Qué ajustes afectan más al precio de un video Seedance?',
        answer:
          'La duración, el audio generado y el uso de un video fuente son los factores que más influyen en el precio. Mantén estos ajustes alineados al comparar rutas.',
      },
    ],
  },
  ltx: {
    metaTitle: 'Ejemplos de LTX, prompts, ajustes y salidas | MaxVideoAI',
    metaDescription:
      "Explora ejemplos de video, prompts y ajustes de LTX 2.5 Pro y Fast, con ejemplos de LTX 2.3 y LTX 2 identificados para flujos anteriores.",
    heroTitle: 'Ejemplos de LTX, prompts, ajustes y salidas',
    subtitle: 'Ejemplos para los workflows actuales de LTX 2.5 Pro y LTX 2.5 Fast, más setups LTX anteriores aún compatibles.',
    intro:
      "Explora prompts, ajustes y resultados de LTX 2.5 Pro y Fast. La galería conserva ejemplos de LTX 2.3 Pro/Fast y LTX 2 Pro/Fast para flujos anteriores y comparaciones de migración. Cada video identifica el modelo que lo generó. Abre sus detalles para consultar el prompt, los ajustes y el precio registrado.",
    summary:
      "LTX 2.5 Pro y Fast encabezan esta página. Los ejemplos de LTX 2.3 y LTX 2 conservan sus etiquetas originales para comparar generaciones sin confundir sus capacidades.",
    promptPatterns:
      'Empieza con estructuras de prompts reutilizables de LTX 2.5 para tomas de producto, clips cinematográficos cortos y pruebas de movimiento consistentes que se conviertan en salidas de video repetibles antes de adaptarlas a tu escena.',
    strengthsLimits:
      'Usa LTX 2.5 con una imagen fuente clara, una instrucción principal de movimiento y un único objetivo de cámara para comparar mejor las salidas entre Pro y Fast.',
    pricingNotes:
      'Mantén alineados la duración, la relación de aspecto, la complejidad del movimiento y los ajustes de salida al probar prompts para comparar con más claridad calidad, velocidad y coste.',
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
        question: '¿Qué ajustes importan más en las salidas de LTX 2.5?',
        answer:
          'Los ajustes más importantes son la duración, la relación de aspecto, la imagen fuente para imagen a video y el nivel de complejidad de movimiento que pides en un solo prompt. Mantenerlos estables hace mucho más fácil probar prompts.',
      },
      {
        question: '¿Cómo debería escribir prompts para LTX 2.5 en imagen a video?',
        answer:
          'Parte de una imagen fuente fuerte y añade una instrucción de movimiento, un movimiento de cámara y un objetivo de salida. LTX 2.5 funciona mejor cuando el prompt amplía la imagen original en lugar de intentar sustituirla por una escena totalmente distinta.',
      },
      {
        question: '¿Qué modelo LTX debería usar: LTX 2.5 Pro o LTX 2.5 Fast?',
        answer:
          'Compara LTX 2.5 Pro y Fast con el mismo prompt y los mismos ajustes. Usa los ejemplos para valorar el resultado y la página de precios para comparar costes actuales. Consulta cada modelo para sus modos y límites; los ejemplos anteriores describen la versión indicada en su etiqueta.',
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
    subtitle: 'Ejemplos de Hailuo pensados para borradores económicos, pruebas de movimiento e iteración progresiva.',
    intro:
      'Esta página de Hailuo está pensada para una etapa de exploración de bajo costo antes de pasar a motores premium. Sirve para validar ideas de movimiento y composición con rapidez sin comprometer demasiado presupuesto.',
    promptPatterns:
      'Prioriza prompts cortos centrados en la acción y la dirección de cámara.',
    strengthsLimits:
      'Hailuo es útil para pases conceptuales y pruebas de movimiento. En escenas complejas, conviene trabajar por pasos cortos.',
    pricingNotes:
      'Úsalo como base de borrador y escala solo las variantes que de verdad funcionen.',
    faq: [
      {
        question: '¿Por qué usar Hailuo antes de un motor premium?',
        answer: 'Porque permite validar dirección visual con un coste inicial más bajo.',
      },
      {
        question: '¿Cómo estructuro un prompt de Hailuo?',
        answer: 'Prompt corto, una acción principal y una cámara clara.',
      },
      {
        question: '¿Qué estrategia de presupuesto conviene en Hailuo?',
        answer: 'Probar corto, seleccionar mejores salidas y luego subir calidad.',
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
