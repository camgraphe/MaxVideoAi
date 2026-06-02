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
      'El precio cambia según la duración, la resolución y las opciones activas. Revisa el precio por clip antes de escalar.',
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
      'Consulta ejemplos de Veo 3.1, prompts, ajustes, patrones image-to-video y precios por clip para Veo 3.1, Veo 3.1 Fast y Veo 3.1 Lite en MaxVideoAI.',
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
          'Usa LTX 2.3 Pro cuando quieras la mejor calidad actual de LTX y flujos más avanzados como audio, Extend y Retake. Usa LTX 2.3 Fast cuando quieras pruebas de prompts más rápidas, más baratas y con más margen para iterar borradores largos.',
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
};
