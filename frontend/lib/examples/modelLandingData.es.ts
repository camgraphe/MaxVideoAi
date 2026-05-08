import type { CanonicalExampleModelSlug, LocalizedModelDescriptor } from '@/lib/examples/modelLandingTypes';

export const ES_MODEL_DATA: Partial<Record<CanonicalExampleModelSlug, LocalizedModelDescriptor>> = {
  sora: {
    subtitle: 'Ejemplos de Sora pensados para un acabado cinematográfico, prompts reutilizables y ajustes realmente útiles.',
    intro:
      'Esta página reúne ejemplos reales de Sora para clonar y ajustar en producción. La idea es ayudarte a repetir resultados con más consistencia usando prompts, duraciones y formatos que ya demostraron funcionar.',
    promptPatterns:
      'Define primero la intención de la toma, luego la cámara, el movimiento y la iluminación. Los prompts cortos, estructurados y bien jerarquizados suelen responder mejor.',
    strengthsLimits:
      'Sora suele destacar por su coherencia cinematográfica y por un movimiento más pulido. Los límites dependen del modo y del contexto de render.',
    pricingNotes:
      'El precio cambia según la duración, la resolución y las opciones activas. Revisa el costo por clip antes de escalar.',
    faq: [
      {
        question: '¿Qué prompts funcionan mejor en Sora?',
        answer: 'Prompts estructurados con sujeto, cámara y movimiento claramente separados.',
      },
      {
        question: '¿Puedo clonar estos ejemplos de Sora en el workspace?',
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
      'Consulta ejemplos de Veo 3.1, prompts, ajustes, patrones image-to-video y precios por clip para Veo 3.1, Veo 3.1 Fast y Veo 3.1 Lite en MaxVideoAI.',
    heroTitle: 'Ejemplos de Veo 3.1, prompts, ajustes y patrones image-to-video',
    subtitle: 'Ejemplos de Veo 3.1, prompts, ajustes y patrones image-to-video en la familia Veo actual.',
    intro:
      'Consulta ejemplos de Veo 3.1, Veo 3.1 Fast y Veo 3.1 Lite con prompts, ajustes reutilizables y patrones image-to-video, y luego abre las paginas de modelo para ver specs, limites y precios. Usa esta pagina para estudiar la estructura del prompt, los patrones de text-to-video AI y los ajustes image-to-video propios de cada modelo antes de abrir la pagina Veo correspondiente.',
    summary:
      'Veo 3.1 lidera esta pagina para ejemplos, prompts, ajustes y patrones image-to-video, con Veo 3.1 Fast y Veo 3.1 Lite visibles como variantes Veo actuales para iteracion mas rapida y borradores con audio a menor coste.',
    promptPatterns:
      'Empieza por el objetivo de la toma y luego concreta la camara, el ambiente y las restricciones de referencia utiles para image-to-video. Los ejemplos de Veo 3.1 funcionan mejor cuando la estructura del prompt se mantiene estable.',
    strengthsLimits:
      'Veo suele ofrecer buen control de encuadre y movimiento en runs cortos de text-to-video e image-to-video. Las capacidades varian segun el modo activo y el tipo de entrada.',
    pricingNotes:
      'Compara costos con presets iguales en duración y resolución para obtener una lectura más limpia.',
    faq: [
      {
        question: '¿Como deberia usar Veo 3 para image-to-video?',
        answer:
          'Parte de un still fuerte, define un solo objetivo de movimiento y mantén una direccion de camara explicita. Los workflows de Veo 3.1 en image-to-video suelen funcionar mejor cuando el prompt extiende la imagen fuente en lugar de reemplazarla por completo.',
      },
      {
        question: '¿Que modelo Veo 3 deberia usar para probar prompts?',
        answer:
          'Empieza con Veo 3.1 Fast o Veo 3.1 Lite cuando quieras borradores mas baratos y pruebas de prompt mas rapidas, y pasa a Veo 3.1 cuando necesites una salida cinematica mas pulida y mejor control guiado por referencias.',
      },
      {
        question: '¿Estos ejemplos de Veo 3.1 sirven como base para prompts de text-to-video AI?',
        answer:
          'Si. Utilizalos como base de text-to-video AI manteniendo el mismo sujeto, objetivo de movimiento, direccion de camara y formato, y cambia solo una variable del prompt cada vez.',
      },
    ],
  },
  luma: {
    metaTitle: 'Ejemplos de Luma Ray 2 y Ray 2 Flash (prompts + ajustes) | MaxVideoAI',
    metaDescription:
      'Revisa ejemplos de Luma Ray 2 y Ray 2 Flash con prompts reutilizables, patrones de modify y reframe, y referencias de precio por clip antes de elegir el tier premium o rapido en MaxVideoAI.',
    subtitle: 'Ejemplos de Luma Ray en Ray 2 y Ray 2 Flash, con prompts reutilizables, patrones de modify/reframe y senales de precio.',
    intro:
      'Esta pagina es la vista de familia de Luma Ray dentro de MaxVideoAI. Sirve para comparar rapidamente ejemplos de Ray 2 y Ray 2 Flash antes de decidir si el trabajo pertenece al tier premium o al tier draft mas rapido. Las paginas de modelo cubren las specs detalladas; esta galeria esta pensada para leer patrones de prompt, workflows y tradeoffs de coste entre los dos modelos Luma publicos.',
    promptPatterns:
      'Los ejemplos de Luma funcionan mejor cuando el prompt se mantiene a nivel de toma y de workflow: generate net-new, animacion desde still, modify sobre video fuente o reframe para entrega. Mantén la consigna compacta y deja claro que debe quedarse y que puede cambiar.',
    strengthsLimits:
      'Ray 2 encaja mejor en finales cinematicos premium y en pases con mayor confianza. Ray 2 Flash es la capa de throughput mas barata para validar conceptos, probar pases modify mas rapidos y preparar entregas cuadradas o verticales. Ninguno de los dos modelos genera audio nativo, asi que conviene evaluarlos por movimiento, encuadre y control sobre video fuente, no por lip sync.',
    pricingNotes:
      'Usa duraciones y resoluciones equivalentes para comparar bien los dos tiers Luma. Ray 2 suele justificar mejor el gasto en tomas finales, mientras que Ray 2 Flash es la mejor base para exploracion, iteracion sobre video fuente y variantes de entrega con menor coste.',
    faq: [
      {
        question: '¿Cuándo conviene empezar por la página de ejemplos de Luma?',
        answer: 'Empieza aquí cuando quieras comparar Ray 2 y Ray 2 Flash rapidamente antes de elegir el tier premium o rapido para un trabajo real.',
      },
      {
        question: '¿Cuál es la diferencia mas clara entre Ray 2 y Ray 2 Flash en ejemplos?',
        answer: 'Ray 2 sigue siendo el tier premium para finales, mientras que Ray 2 Flash sigue siendo el tier rapido para tests. Los workflows estan alineados, pero su papel en produccion es distinto.',
      },
      {
        question: '¿Puedo comparar aquí casos de modify y reframe?',
        answer: 'Sí. La galería está pensada para mostrar tanto generación nueva como patrones de edición sobre video fuente antes de abrir las páginas de modelo con todos los controles.',
      },
    ],
  },
  wan: {
    subtitle: 'Ejemplos de Wan pensados para secuencias estructuradas, transiciones limpias y continuidad guiada.',
    intro:
      'Los ejemplos de Wan de esta página están pensados para secuencias cortas con beats claros y transiciones controladas. Funcionan como punto de partida operativo antes de clonar en producción, sobre todo cuando el ritmo importa tanto como el acabado final.',
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
      'Revisa ejemplos de video IA de Kling con prompts, ajustes y patrones image-to-video para Kling 3 Pro, Kling 3 Standard y renders finales Kling 3 4K nativos, y compara workflows Kling antiguos aún compatibles en MaxVideoAI.',
    heroTitle: 'Ejemplos de video IA Kling, prompts y ajustes',
    subtitle:
      'Ejemplos de video IA Kling, prompts, ajustes, patrones image-to-video y guía de modelo para workflows Kling actuales y versiones anteriores aún compatibles.',
    intro:
      'Revisa ejemplos de video IA de Kling, prompts, ajustes reutilizables y patrones image-to-video para Kling 3 Pro, Kling 3 Standard y renders finales Kling 3 4K nativos, y luego explora setups Kling anteriores aún compatibles para workflows más antiguos, clips cortos listos para audio y borradores rápidos. Usa esta página para comparar prompts de Kling AI, patrones de control de movimiento y ajustes específicos de cada modelo antes de abrir la página Kling correspondiente.',
    summary:
      'Kling 3 Pro y Kling 3 Standard lideran esta página para ejemplos de video IA Kling de uso diario, mientras Kling 3 4K queda como ruta de entrega 4K nativa para renders finales aprobados. Kling 2.6 Pro y Kling 2.5 Turbo siguen disponibles más abajo como setups Kling anteriores aún compatibles.',
    promptPatterns:
      'Empieza con una acción clara, una instrucción de cámara y un objetivo visual. Los prompts de Kling AI se comparan mejor cuando la estructura del prompt se mantiene estable y solo cambian el modelo o el ajuste.',
    strengthsLimits:
      'Parte de una imagen fuente sólida, una sola instrucción de movimiento y un objetivo de cámara claro para que las salidas image-to-video de Kling AI sean más fáciles de comparar entre Pro y Standard.',
    pricingNotes:
      'Mantén alineados la duración, la relación de aspecto y los ajustes de salida al comparar resultados de video IA Kling. Así es más fácil evaluar el comportamiento del prompt, la elección de modelo y el coste por clip antes de abrir una página de modelo.',
    faq: [
      {
        question: '¿Cuánto pueden durar los videos de Kling AI?',
        answer:
          'Kling 3 Pro y Kling 3 Standard admiten renders de 3 a 15 segundos en 1080p. Kling 2.6 Pro encaja mejor en clips audio-ready más cortos de 5 a 10 segundos, y Kling 2.5 Turbo se usa sobre todo para borradores silenciosos rápidos de 5 o 10 segundos.',
      },
      {
        question: '¿Cuánto tarda Kling AI en generar un video?',
        answer:
          'El tiempo de render depende del modelo Kling, de la duración del clip, de los ajustes y de la cola. Las tandas de borrador más cortas en Kling 3 Standard o Kling 2.5 Turbo suelen ser la forma más rápida de probar prompts, mientras que los renders multi-shot o con audio tardan más.',
      },
      {
        question: '¿Qué modelo de Kling AI debería usar para prompts y ejemplos?',
        answer:
          'Empieza con Kling 3 Standard cuando quieras probar prompts a menor coste, hacer borradores repetibles y mantenerte en el comportamiento actual de Kling 3. Pasa a Kling 3 Pro para mayor control de escena y usa Kling 3 4K solo para renders finales nativos 4K aprobados.',
      },
      {
        question: '¿Cómo debería usar Kling AI para pruebas de prompt en image-to-video?',
        answer:
          'Parte de una imagen fuente clara, añade una sola instrucción de movimiento y un objetivo de cámara preciso. Las pruebas de Kling AI en image-to-video se leen mejor cuando la estructura del prompt se mantiene estable y solo cambian el modelo o el ajuste.',
      },
      {
        question: '¿Cómo debería adaptar prompts de Kling AI entre Kling 3 Pro y Kling 3 Standard?',
        answer:
          'Mantén la misma estructura base en ambos modelos: un sujeto claro, una acción por toma y una dirección de cámara explícita. Kling 3 Pro soporta mejor instrucciones multi-shot más densas y continuidad más exigente, mientras que Kling 3 Standard funciona mejor cuando la estructura de la toma es más compacta.',
      },
    ],
  },
  seedance: {
    metaTitle: 'Ejemplos de video IA Seedance, prompts y ajustes | MaxVideoAI',
    metaDescription:
      'Revisa ejemplos de video IA de Seedance con prompts, ajustes y precio por clip para Seedance 2.0, Seedance 2.0 Fast y el flujo Seedance 1.5 Pro aún compatible en MaxVideoAI.',
    heroTitle: 'Ejemplos de video IA Seedance, prompts y ajustes',
    subtitle: 'Ejemplos de video IA Seedance, prompts, ajustes y salidas para workflows Seedance actuales y versiones anteriores aún compatibles.',
    intro:
      'Revisa ejemplos de video IA de Seedance, prompts y ajustes reutilizables para Seedance 2.0 y Seedance 2.0 Fast, y luego explora la configuración de Seedance 1.5 Pro aún compatible para workflows más antiguos y patrones de clip más cortos. Usa esta página para comparar workflows de video de Seedance, estructuras de prompt y patrones de salida antes de abrir la página de modelo Seedance correspondiente.',
    summary:
      'Seedance 2.0 y Seedance 2.0 Fast lideran esta página de ejemplos de video IA de Seedance, mientras Seedance 1.5 Pro queda disponible más abajo como setup anterior aún compatible para clips cortos y repetibles.',
    promptPatterns:
      'Define una acción central y luego restricciones de cámara y entorno. Los prompts compactos suelen dar resultados más estables en workflows de video IA de Seedance.',
    strengthsLimits:
      'Seedance es útil cuando priorizas movimiento legible y cámara estable. Limita la complejidad de escena.',
    pricingNotes:
      'Compara Seedance con presets equivalentes para obtener una lectura de coste fiable.',
    faq: [
      {
        question: '¿Estos ejemplos de video IA de Seedance están optimizados para estabilidad de cámara?',
        answer: 'Sí. La mayoría de los ejemplos de video IA de Seedance de esta página priorizan claridad de cámara y patrones de movimiento con poca deriva.',
      },
      {
        question: '¿Qué modelo de video IA de Seedance debería usar para ejemplos y pruebas de prompt?',
        answer:
          'Empieza con Seedance 2.0 Fast cuando quieras borradores más baratos y pruebas de prompt más rápidas, y pasa a Seedance 2.0 cuando necesites mejor calidad multi-shot, audio nativo y salidas más listas para producción.',
      },
      {
        question: '¿Qué ajustes afectan más al precio en los workflows de video de Seedance?',
        answer:
          'La duración y la resolución son los factores principales de precio en los workflows de video de Seedance, seguidos por opciones específicas de cada workflow.',
      },
    ],
  },
  ltx: {
    metaTitle: 'Ejemplos de LTX, prompts, ajustes y salidas | MaxVideoAI',
    metaDescription:
      'Consulta ejemplos de prompts de LTX 2.3 Pro y LTX 2.3 Fast, ajustes, salidas y patrones de imagen a video, y luego revisa los workflows LTX 2 aún compatibles en MaxVideoAI.',
    heroTitle: 'Ejemplos de LTX, prompts, ajustes y salidas',
    subtitle: 'Ejemplos para los workflows actuales de LTX 2.3 Pro y LTX 2.3 Fast, más setups LTX anteriores aún compatibles.',
    intro:
      'Consulta los ejemplos de prompts, ajustes reutilizables y patrones de salida de LTX 2.3 Pro y LTX 2.3 Fast, y luego revisa LTX 2 y LTX 2 Fast como setups aún compatibles para workflows anteriores, bases históricas de prompts y contexto de migración. Usa esta página para estudiar la estructura de prompts, los patrones de imagen a video con IA y los ajustes específicos de cada modelo antes de abrir la página LTX correspondiente.',
    summary:
      'LTX 2.3 Pro y LTX 2.3 Fast lideran esta página para ejemplos de prompts, ajustes, salidas y patrones de imagen a video, mientras LTX 2 y LTX 2 Fast se mantienen más abajo para workflows anteriores y contexto de migración.',
    promptPatterns:
      'Empieza con estructuras de prompts reutilizables de LTX 2.3 para tomas de producto, clips cinematográficos cortos y pruebas de movimiento consistentes que se conviertan en salidas de video repetibles antes de adaptarlas a tu escena.',
    strengthsLimits:
      'Usa LTX 2.3 con una imagen fuente clara, una instrucción principal de movimiento y un único objetivo de cámara para comparar mejor las salidas entre Pro y Fast.',
    pricingNotes:
      'Mantén alineados la duración, la relación de aspecto, la complejidad del movimiento y los ajustes de salida al probar prompts para comparar con más claridad calidad, velocidad y coste.',
    faq: [
      {
        question: '¿Cuáles son los mejores ejemplos de prompts de LTX 2.3 para empezar?',
        answer:
          'El mejor punto de partida es una estructura simple: sujeto, acción, dirección de cámara y objetivo visual. Los ejemplos más útiles mantienen esa estructura estable y solo cambian una variable a la vez.',
      },
      {
        question: '¿Cómo debería estructurar un prompt de LTX 2.3?',
        answer:
          'Empieza con un sujeto claro, una acción principal, una instrucción de cámara y una referencia de estilo visual. Los prompts de LTX 2.3 suelen funcionar mejor cuando el objetivo de movimiento es explícito y la escena se mantiene compacta.',
      },
      {
        question: '¿Qué ajustes importan más en las salidas de LTX 2.3?',
        answer:
          'Los ajustes más importantes son la duración, la relación de aspecto, la imagen fuente para imagen a video y el nivel de complejidad de movimiento que pides en un solo prompt. Mantenerlos estables hace mucho más fácil probar prompts.',
      },
      {
        question: '¿Cómo debería escribir prompts para LTX 2.3 en imagen a video?',
        answer:
          'Parte de una imagen fuente fuerte y añade una instrucción de movimiento, un movimiento de cámara y un objetivo de salida. LTX 2.3 funciona mejor cuando el prompt amplía la imagen original en lugar de intentar sustituirla por una escena totalmente distinta.',
      },
      {
        question: '¿Qué modelo LTX debería usar: LTX 2.3 Pro o LTX 2.3 Fast?',
        answer:
          'Usa LTX 2.3 Pro cuando quieras la mejor calidad actual de LTX y workflows más avanzados como audio, Extend y Retake. Usa LTX 2.3 Fast cuando quieras pruebas de prompts más rápidas, más baratas y con más margen para iterar borradores largos.',
      },
    ],
  },
  pika: {
    subtitle: 'Ejemplos de Pika pensados para loops cortos, un estilo social marcado y una edición ágil.',
    intro:
      'Esta página de Pika se centra en formatos cortos y estilizados. Permite clonar patrones de movimiento ya probados y ajustar sujeto y estilo sin rehacer toda la configuración.',
    promptPatterns:
      'Empieza por el estilo, suma la acción principal y cierra con una instrucción breve de cámara.',
    strengthsLimits:
      'Pika suele funcionar bien para loops rápidos y piezas muy pensadas para redes. Evita prompts sobrecargados para reducir la inestabilidad.',
    pricingNotes:
      'El coste es más predecible con duraciones cortas y presets constantes.',
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
};
