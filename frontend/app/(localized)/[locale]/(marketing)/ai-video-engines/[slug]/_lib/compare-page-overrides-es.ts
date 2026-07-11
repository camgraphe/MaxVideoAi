import type { ComparePageOverridesBySlug } from './compare-page-overrides-types';

export const ES_COMPARE_PAGE_OVERRIDES = {
    'seedance-1-5-pro-vs-seedance-2-0': {
      meta: {
        title: 'Seedance 1.5 Pro vs Seedance 2.0 | Que cambio, cuando actualizar y mejores objetivos | MaxVideoAI',
        description:
          'Compara Seedance 1.5 Pro y Seedance 2.0 en MaxVideoAI para ver que cambia en audio, continuidad multi-shot, referencias, precio y cuando conviene actualizar.',
      },
      heroIntro:
        'Compara Seedance 1.5 Pro y Seedance 2.0 para ver que cambio entre el workflow Seedance Pro anterior y el modelo de video IA de Seedance actual en audio nativo, continuidad multi-shot y workflows con referencias. Usa esta pagina para entender rapido los trade-offs antes de abrir el modelo Seedance actual, la pagina de ejemplos de video IA de Seedance o el workflow de video de Seedance que mejor encaja con tu objetivo.',
      topCards: [
        {
          title: 'Que cambio',
          body:
            'Seedance 2.0 es el workflow de video IA de Seedance mas reciente, con mejor continuidad multi-shot, entradas de referencia mas amplias y un camino de produccion audio-first mas actual que Seedance 1.5 Pro.',
        },
        {
          title: 'Cuando quedarse en Seedance 1.5 Pro',
          body:
            'Quedate en Seedance 1.5 Pro cuando necesites sobre todo clips cortos y repetibles, setups de camara mas simples y un workflow anterior que ya esta validado en produccion.',
        },
        {
          title: 'Cuando pasar a Seedance 2.0',
          body:
            'Actualiza cuando necesites mejor continuidad entre tomas, workflows de audio nativo mas ricos o un modelo actual mas flexible para trabajo creativo de mayor valor.',
        },
        {
          title: 'Mejor para',
          body:
            'Usa esta pagina para decidir entre un workflow Seedance anterior pero aun compatible para clips cortos y controlados, y el workflow actual de Seedance 2.0 para anuncios multi-shot, lanzamientos y secuencias mas ambiciosas guiadas por referencias.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Abrir la pagina del modelo Seedance 2.0',
        },
        {
          href: '/examples/seedance',
          label: 'Ver ejemplos de video IA de Seedance',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Abrir la pagina del modelo Seedance 2.0 Fast',
        },
        {
          href: '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
          label: 'Comparar Seedance 2.0 vs Seedance 2.0 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas rapidas para decidir si conviene quedarse en Seedance 1.5 Pro o pasar a Seedance 2.0.',
        items: [
          {
            question: 'Que cambio entre Seedance 1.5 Pro y Seedance 2.0?',
            answer:
              'Seedance 2.0 es el modelo mas nuevo, con mejor continuidad multi-shot, workflows de referencia mas amplios y el camino Seedance actual para produccion. Seedance 1.5 Pro sigue siendo util para clips mas cortos, simples y repetibles.',
          },
          {
            question: 'Es Seedance 2.0 mejor que Seedance 1.5 Pro?',
            answer:
              'Para la mayoria de workflows actuales, si. Seedance 2.0 es la mejor opcion por defecto si quieres el modelo de video IA de Seedance actual para mas continuidad, flexibilidad y un uso de produccion mas amplio, mientras que Seedance 1.5 Pro sigue siendo util como setup Seedance Pro anterior para clips mas cortos.',
          },
          {
            question: 'Cuando deberia pasar de Seedance 1.5 Pro a Seedance 2.0?',
            answer:
              'Actualiza cuando necesites mejor comportamiento multi-shot, workflows de audio nativo mas ricos o mas margen para produccion actual basada en prompts y referencias. Si tu workflow de 1.5 Pro ya es estable para clips cortos, no hace falta mover todos los trabajos de inmediato.',
          },
          {
            question: 'Sigue siendo suficiente Seedance 1.5 Pro para algunos workflows?',
            answer:
              'Si. Sigue encajando en clips cinematicos cortos y repetibles, y en equipos que ya tienen patrones de prompt validados en 1.5 Pro y todavia no necesitan el workflow mas amplio de 2.0.',
          },
          {
            question: 'Que modelo es mejor para multi-shot y audio nativo?',
            answer:
              'Seedance 2.0 es la mejor opcion para continuidad multi-shot y para el workflow de audio nativo mas actual. Seedance 1.5 Pro conviene tratarlo como una opcion anterior mas simple para clips cortos.',
          },
        ],
      },
    },
    'seedance-2-0-vs-seedance-2-0-fast': {
      heroIntro:
        'Compara Seedance 2.0 y Seedance 2.0 Fast para elegir el workflow de video IA de Seedance actual mas adecuado segun tu necesidad de trabajo multi-shot final, audio nativo y comparacion de workflow. Usa esta pagina para ver cuando el Seedance estandar encaja mejor en una salida de video de Seedance mas pulida y cuando Fast encaja mejor para pruebas, checks de timing e iteracion mas barata.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Abrir la pagina del modelo Seedance 2.0',
        },
        {
          href: '/examples/seedance',
          label: 'Ver ejemplos de video IA de Seedance',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Abrir la pagina del modelo Seedance 2.0 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir el workflow actual de Seedance adecuado.',
        items: [
          {
            question: 'Que modelo de video IA de Seedance deberia usar para trabajo de borrador?',
            answer:
              'Usa Seedance 2.0 Fast para borradores mas baratos, pruebas mas rapidas y comparaciones de workflow. Usa Seedance 2.0 cuando quieras una salida multi-shot mas pulida, audio nativo y un workflow mas listo para produccion.',
          },
          {
            question: 'En que se diferencia Seedance 2.0 de Seedance 2.0 Fast?',
            answer:
              'Seedance 2.0 es la opcion actual mas fuerte para trabajo multi-shot pulido, audio nativo y salidas mas exigentes guiadas por referencias, mientras que Seedance 2.0 Fast encaja mejor en borradores mas baratos, checks de timing e iteracion temprana.',
          },
          {
            question: 'Seedance 2.0 Fast vs normal: cual es la diferencia?',
            answer:
              '"Normal" suele referirse a la ruta Seedance 2.0 estandar. Usa Fast para borradores 480p/720p de menor coste y checks de timing; usa Seedance 2.0 estandar cuando el plano necesite mas acabado, 1080p o 4K, y consistencia final mas solida.',
          },
          {
            question: 'Seedance 2.0 y Fast soportan video edit y extend?',
            answer:
              'Si. En MaxVideoAI, Seedance 2.0 y Seedance 2.0 Fast soportan workflows de video edit y extend, ademas de text-to-video, image-to-video y reference-to-video.',
          },
          {
            question: 'Es mejor Seedance 2.0 para una salida de video de Seedance mas pulida?',
            answer:
              'Si. Seedance 2.0 encaja mejor cuando el objetivo es una salida de video de Seedance mas pulida, mientras que Fast encaja mejor cuando el objetivo es probar ideas y comparar workflows rapidamente.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-seedance-2-0': {
      heroIntro:
        'Usa Seedance 2.0 para la calidad final flagship, el output Seedance mas pulido, entrega de mayor resolucion y hero shots. Usa Seedance 2.0 Mini como la opcion de menor coste cuando importan mas el coste, el volumen batch, variantes 480p/720p, pruebas ecommerce, hooks UGC y experimentos de marketing frecuentes. Esta pagina ahora incluye videos lado a lado Mini vs Seedance 2.0 con los mismos prompts, ademas de scorecard, specs y contexto de pricing.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Abrir la pagina del modelo Seedance 2.0',
        },
        {
          href: '/models/dreamina-seedance-2-0-mini',
          label: 'Abrir la pagina del modelo Seedance 2.0 Mini',
        },
        {
          href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-seedance-2-0-fast',
          label: 'Comparar Fast vs Mini',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre Seedance 2.0 flagship y la ruta Mini de menor coste.',
        items: [
          {
            question: 'Cuando deberia elegir Seedance 2.0 Mini?',
            answer:
              'Elige Mini para batches de menor coste, variantes ecommerce, pruebas de hooks UGC, pases A/B de marketing y exploracion de prompts a volumen cuando 480p o 720p sea suficiente.',
          },
          {
            question: 'Cuando sigue siendo mejor Seedance 2.0?',
            answer:
              'Elige Seedance 2.0 para hero shots finales, mayor pulido visual, entrega de mayor resolucion y trabajos donde la mejor salida Seedance importa mas que el coste por variante.',
          },
          {
            question: 'Esta pagina incluye videos comparativos de Mini?',
            answer:
              'Si. Esta pagina de la familia Seedance usa outputs Mini y Seedance 2.0 lado a lado generados con los mismos prompts, asi que la seccion de video es directamente comparable.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-seedance-2-0-fast': {
      heroIntro:
        'Usa Seedance 2.0 Fast cuando la prioridad sea velocidad de borrador Seedance, checks de timing y una ruta rapida de vuelta al modelo flagship. Usa Seedance 2.0 Mini como la opcion de volumen batch de menor coste para variantes ecommerce o social, ediciones de video, extensiones y pruebas de marketing repetidas. Esta pagina ahora incluye videos lado a lado Mini vs Fast con los mismos prompts, ademas de scorecard, specs y contexto de pricing.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/seedance-2-0-fast',
          label: 'Abrir la pagina del modelo Seedance 2.0 Fast',
        },
        {
          href: '/models/dreamina-seedance-2-0-mini',
          label: 'Abrir la pagina del modelo Seedance 2.0 Mini',
        },
        {
          href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-seedance-2-0',
          label: 'Comparar Seedance 2.0 vs Mini',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre Fast orientado a velocidad de borrador y Mini orientado a valor batch.',
        items: [
          {
            question: 'Mini reemplaza a Seedance 2.0 Fast?',
            answer:
              'No. Fast sigue siendo la opcion Seedance para velocidad de borrador. Mini es la ruta de valor y batch para variantes de menor coste y alta frecuencia, sobre todo cuando 480p/720p es suficiente.',
          },
          {
            question: 'Cual conviene para variantes de marketing?',
            answer:
              'Mini queda posicionado para muchas variantes ecommerce, UGC y paid social de menor coste. Fast encaja mejor cuando importan mas el timing de borrador Seedance y una vuelta limpia a Seedance 2.0.',
          },
          {
            question: 'Esta pagina incluye videos lado a lado?',
            answer:
              'Si. Esta pagina de la familia Seedance usa outputs Mini y Fast lado a lado generados con los mismos prompts, asi que la seccion de video es directamente comparable.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-ltx-2-3-fast': {
      heroIntro:
        'Usa LTX 2.3 Fast para exploracion LTX rapida, mas margen de resolucion y borradores creativos ligeros. Usa Seedance 2.0 Mini como la opcion Dreamina Seedance de menor coste en batches 480p/720p, variantes ecommerce, hooks UGC, edicion de video y pruebas de extension. Esta pagina es de scorecard/specs por ahora; no muestra videos comparativos de Mini todavia.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/ltx-2-3-fast',
          label: 'Abrir la pagina del modelo LTX 2.3 Fast',
        },
        {
          href: '/models/dreamina-seedance-2-0-mini',
          label: 'Abrir la pagina del modelo Seedance 2.0 Mini',
        },
        {
          href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-seedance-2-0-fast',
          label: 'Comparar Seedance Fast vs Mini',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre borradores LTX rapidos y valor batch de Seedance Mini.',
        items: [
          {
            question: 'Cuando deberia elegir LTX 2.3 Fast?',
            answer:
              'Elige LTX 2.3 Fast para exploracion visual rapida, pruebas de prompt estilo LTX y workflows donde su resolucion y comportamiento de borrador encajan mejor con el brief.',
          },
          {
            question: 'Cuando deberia elegir Seedance 2.0 Mini?',
            answer:
              'Elige Mini para batches Seedance de menor coste, variantes de producto, pruebas social, hooks UGC, ediciones de video y extensiones cuando 480p/720p sea suficiente.',
          },
          {
            question: 'Por que esta comparacion es scorecard-only?',
            answer:
              'Las paginas Mini usan primero scorecards, specs y recomendaciones. Los videos lado a lado se agregaran mas adelante cuando se elijan outputs Mini curados.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-veo-3-1-fast': {
      heroIntro:
        'Usa Seedance 2.0 Mini como la opcion batch 480p/720p de menor coste para variantes ecommerce, hooks UGC, ediciones de video y experimentos de marketing frecuentes. Usa Veo 3.1 Fast cuando la calidad Veo, workflows con audio, mayor resolucion de entrega y mejor pulido de borrador importan mas que el coste batch. Esta pagina Mini es solo scorecard/specs por ahora y no incluye videos comparativos.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/dreamina-seedance-2-0-mini',
          label: 'Abrir la pagina del modelo Seedance 2.0 Mini',
        },
        {
          href: '/models/veo-3-1-fast',
          label: 'Abrir la pagina del modelo Veo 3.1 Fast',
        },
        {
          href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-seedance-2-0',
          label: 'Comparar Seedance 2.0 vs Mini',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre valor Seedance Mini y flexibilidad de produccion Veo 3.1 Fast.',
        items: [
          {
            question: 'Cuando deberia elegir Seedance 2.0 Mini sobre Veo 3.1 Fast?',
            answer:
              'Elige Mini cuando tu objetivo principal sea produccion batch de menor coste: muchas variantes ecommerce, hooks UGC, pruebas de marketing, ediciones de video o extensiones a 480p/720p.',
          },
          {
            question: 'Cuando encaja mejor Veo 3.1 Fast?',
            answer:
              'Elige Veo 3.1 Fast cuando necesites calidad Veo, salida con audio, mejor pulido de borrador o mayor resolucion en lugar de la ruta de volumen mas barata.',
          },
          {
            question: 'Hay videos comparativos de Mini aqui?',
            answer:
              'No. Esta pagina usa intencionalmente solo scorecards, specs y copy hasta que esten listos los videos Mini lado a lado.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-luma-ray-3-2': {
      heroIntro:
        'Usa Seedance 2.0 Mini cuando el trabajo necesita batches Dreamina Seedance de menor coste, variantes ecommerce, hooks social, extension de video, ediciones desde video fuente y pruebas con audio nativo en 480p o 720p. Usa Luma Ray 3.2 cuando el trabajo depende del movimiento cinematico de Luma, Modify Video, Reframe, preservacion de video fuente, guide frames y control visual 1080p sin audio nativo. Esta comparacion Mini es scorecard-only por ahora: se centra en specs, posicionamiento y ayuda de decision en lugar de videos lado a lado.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/dreamina-seedance-2-0-mini',
          label: 'Abrir la pagina del modelo Seedance 2.0 Mini',
        },
        {
          href: '/models/luma-ray-3-2',
          label: 'Abrir la pagina del modelo Luma Ray 3.2',
        },
        {
          href: '/ai-video-engines/luma-ray-3-2-vs-seedance-2-0',
          label: 'Comparar Luma Ray 3.2 vs Seedance 2.0',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre valor batch Seedance Mini y workflows de control de video Luma Ray 3.2.',
        items: [
          {
            question: 'Cuando elegir Seedance 2.0 Mini?',
            answer:
              'Elige Mini para variantes batch de menor coste, hooks UGC, pruebas de producto, extension de video, ediciones de video fuente y experimentos con audio nativo cuando 480p o 720p es suficiente.',
          },
          {
            question: 'Cuando Luma Ray 3.2 encaja mejor?',
            answer:
              'Elige Luma Ray 3.2 para Modify Video, Reframe, guide frames, preservacion de video fuente, movimiento cinematico y pruebas visuales 1080p cuando no necesitas audio nativo.',
          },
          {
            question: 'Por que esta pagina es scorecard-only?',
            answer:
              'Las paginas Mini siguen scorecard-only hasta que se elijan renders Mini lado a lado, asi que esta pagina prioriza specs, posicionamiento de workflow y tradeoffs de coste.',
          },
        ],
      },
    },
    'luma-ray-3-2-vs-veo-3-1-fast': {
      heroIntro:
        'Usa Luma Ray 3.2 cuando el problema creativo es el control de video fuente: Modify Video, Reframe, guide frames, preservacion del movimiento cinematico e iteracion visual 1080p sin audio nativo. Usa Veo 3.1 Fast cuando el brief necesita un borrador mas rapido con look Veo, opciones de audio nativo, mas margen de entrega y pulido short-form premium antes de produccion final. Esta comparacion ayuda a decidir si la siguiente pasada debe editar o reframar movimiento existente, o generar un draft Veo mas pulido y audio-ready.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/luma-ray-3-2',
          label: 'Abrir la pagina del modelo Luma Ray 3.2',
        },
        {
          href: '/models/veo-3-1-fast',
          label: 'Abrir la pagina del modelo Veo 3.1 Fast',
        },
        {
          href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-luma-ray-3-2',
          label: 'Comparar Seedance Mini vs Luma Ray 3.2',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre control de video Luma y borradores de produccion Veo rapidos.',
        items: [
          {
            question: 'Cuando elegir Luma Ray 3.2 en lugar de Veo 3.1 Fast?',
            answer:
              'Elige Luma Ray 3.2 cuando editar video fuente, reframe, guide frames y preservar o redirigir movimiento existente importan mas que el audio nativo.',
          },
          {
            question: 'Cuando Veo 3.1 Fast es mejor?',
            answer:
              'Elige Veo 3.1 Fast cuando necesitas un borrador visual premium mas rapido, opciones de audio nativo, una salida mas pulida o mas margen de entrega que Luma Ray 3.2.',
          },
          {
            question: 'Cual encaja mejor en pruebas de producto o ads?',
            answer:
              'Luma Ray 3.2 es mas fuerte si ya tienes video fuente para modificar o reframar. Veo 3.1 Fast es mas fuerte para nuevos drafts cinematicos, conceptos publicitarios audio-ready y pruebas cortas muy pulidas.',
          },
        ],
      },
    },
    'happy-horse-1-1-vs-kling-o3-pro': {
      heroIntro:
        'Usa Happy Horse 1.1 cuando el brief se centra en audio nativo, dialogo, lip-sync multilingue, personajes de referencia y workflows de texto, imagen o referencia-a-video. Usa Kling O3 Pro cuando el proyecto necesita mas control omni, transformacion desde video fuente, referencias visuales y continuidad estilo Kling. Esta comparacion ayuda a elegir entre un workflow de actor audio-first y una ruta de produccion mas pesada basada en referencias y video-to-video.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/happy-horse-1-1',
          label: 'Abrir la pagina del modelo Happy Horse 1.1',
        },
        {
          href: '/models/kling-o3-pro',
          label: 'Abrir la pagina del modelo Kling O3 Pro',
        },
        {
          href: '/ai-video-engines/happy-horse-1-1-vs-kling-3-pro',
          label: 'Comparar Happy Horse vs Kling 3 Pro',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre generacion Alibaba con audio nativo y control de produccion Kling omni.',
        items: [
          {
            question: 'Cuando elegir Happy Horse 1.1 en lugar de Kling O3 Pro?',
            answer:
              'Elige Happy Horse 1.1 para personajes que hablan, audio sincronizado nativo, pruebas de lip-sync y referencias de imagen cuando el actor y la voz son el centro del output.',
          },
          {
            question: 'Cuando Kling O3 Pro es mejor opcion?',
            answer:
              'Elige Kling O3 Pro cuando necesites mas control sobre video fuente, referencias o transformacion, y el proyecto dependa menos del dialogo nativo.',
          },
          {
            question: 'Ambos sirven para video con referencias?',
            answer:
              'Si, pero no con el mismo enfoque. Happy Horse 1.1 enfatiza imagenes de referencia y personajes con audio, mientras Kling O3 Pro encaja mejor en control omni y video-to-video.',
          },
        ],
      },
    },
    'happy-horse-1-1-vs-veo-3-1-fast': {
      heroIntro:
        'Usa Happy Horse 1.1 cuando el clip necesita audio nativo, dialogo, lip-sync y personajes de referencia controlables para escenas social o UGC. Usa Veo 3.1 Fast cuando quieres el look Veo, ciclos de borrador mas rapidos, mas margen de resolucion y conceptos cortos mas pulidos antes de un workflow Veo final. Esta pagina separa una generacion de actor audio-first de una ruta de borrador visual premium mas rapida.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/happy-horse-1-1',
          label: 'Abrir la pagina del modelo Happy Horse 1.1',
        },
        {
          href: '/models/veo-3-1-fast',
          label: 'Abrir la pagina del modelo Veo 3.1 Fast',
        },
        {
          href: '/ai-video-engines/happy-horse-1-1-vs-veo-3-1',
          label: 'Comparar Happy Horse vs Veo 3.1',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre trabajo de personaje con audio nativo y borradores Veo rapidos.',
        items: [
          {
            question: 'Cuando Happy Horse 1.1 es mejor que Veo 3.1 Fast?',
            answer:
              'Elige Happy Horse 1.1 cuando la interpretacion hablada, el audio sincronizado, el lip-sync y los personajes de referencia importan mas que el pulido visual de Veo.',
          },
          {
            question: 'Cuando usar Veo 3.1 Fast en su lugar?',
            answer:
              'Usa Veo 3.1 Fast para borradores rapidos y pulidos, conceptos cinematicos y workflows donde la calidad visual Veo y la resolucion pesan mas que el lip-sync.',
          },
          {
            question: 'Cual encaja mejor en anuncios UGC?',
            answer:
              'Happy Horse 1.1 es mas fuerte cuando el anuncio UGC depende de un sujeto que habla. Veo 3.1 Fast es mas fuerte para visuales premium de producto, acabado de escena o un borrador Veo rapido.',
          },
        ],
      },
    },
    'happy-horse-1-1-vs-seedance-2-0-fast': {
      heroIntro:
        'Usa Happy Horse 1.1 cuando el trabajo depende de personajes que hablan, audio sincronizado nativo, lip-sync y referencias reutilizables. Usa Seedance 2.0 Fast cuando necesitas borradores Seedance de menor coste, checks de timing, exploracion de prompts y una ruta rapida hacia Seedance 2.0. Esta comparacion ayuda a decidir si la siguiente prueba debe validar performance y dialogo o simplemente iterar mas rapido la direccion visual.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/happy-horse-1-1',
          label: 'Abrir la pagina del modelo Happy Horse 1.1',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Abrir la pagina del modelo Seedance 2.0 Fast',
        },
        {
          href: '/ai-video-engines/happy-horse-1-1-vs-seedance-2-0',
          label: 'Comparar Happy Horse vs Seedance 2.0',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre runs Happy Horse audio-first e iteracion Seedance rapida.',
        items: [
          {
            question: 'Cuando elegir Happy Horse 1.1?',
            answer:
              'Elige Happy Horse 1.1 cuando la prueba necesita audio nativo, lip-sync, sujetos que hablan o personajes de referencia que sostienen la escena.',
          },
          {
            question: 'Cuando elegir Seedance 2.0 Fast?',
            answer:
              'Elige Seedance 2.0 Fast para pruebas de prompt Seedance de menor coste, timing de borrador, storyboards e iteracion rapida antes de Seedance 2.0.',
          },
          {
            question: 'Cual conviene mas para batch testing?',
            answer:
              'Seedance 2.0 Fast suele encajar mejor en muchas iteraciones visuales. Happy Horse 1.1 es mejor cuando cada variante debe probar audio, dialogo o referencia de personaje.',
          },
        ],
      },
    },
    'dreamina-seedance-2-0-mini-vs-happy-horse-1-1': {
      heroIntro:
        'Usa Seedance 2.0 Mini cuando buscas una ruta Dreamina Seedance de menor coste para batches ecommerce, variantes social, ediciones de video, pruebas de extension y produccion frecuente en 480p o 720p. Usa Happy Horse 1.1 cuando la escena depende de audio sincronizado nativo, dialogo, lip-sync y mejor comportamiento de personajes que hablan. Esta comparacion Mini es scorecard-only por ahora: se centra en specs, posicionamiento y ayuda de decision en lugar de videos lado a lado.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/dreamina-seedance-2-0-mini',
          label: 'Abrir la pagina del modelo Seedance 2.0 Mini',
        },
        {
          href: '/models/happy-horse-1-1',
          label: 'Abrir la pagina del modelo Happy Horse 1.1',
        },
        {
          href: '/ai-video-engines/dreamina-seedance-2-0-mini-vs-seedance-2-0-fast',
          label: 'Comparar Seedance Fast vs Mini',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre valor batch Seedance Mini y output Happy Horse con audio nativo.',
        items: [
          {
            question: 'Cuando elegir Seedance 2.0 Mini?',
            answer:
              'Elige Mini para produccion batch de menor coste, variantes ecommerce, pruebas de hooks UGC, ediciones de video, extensiones y experimentos de alta frecuencia cuando 480p o 720p es suficiente.',
          },
          {
            question: 'Cuando Happy Horse 1.1 encaja mejor?',
            answer:
              'Elige Happy Horse 1.1 cuando audio nativo, lip-sync multilingue, personajes que hablan y sujetos de referencia importan mas que el coste por variante mas bajo.',
          },
          {
            question: 'Por que esta pagina Mini es scorecard-only?',
            answer:
              'Las paginas Mini usan scorecards, specs y copy de decision hasta que haya renders Mini lado a lado listos, por eso esta pagina no muestra videos comparativos todavia.',
          },
        ],
      },
    },
    'happy-horse-1-1-vs-ltx-2-3-pro': {
      heroIntro:
        'Usa Happy Horse 1.1 cuando la historia depende de audio nativo, lip-sync, dialogo y personajes de referencia en escenas cortas de marketing o UGC. Usa LTX 2.3 Pro cuando el proyecto necesita clips mas largos, entrega de mayor resolucion, margen 4K, workflows de extension o retake y mas acabado de produccion. Esta comparacion separa un modelo de actor audio-first de un modelo de produccion y edicion mas flexible.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/happy-horse-1-1',
          label: 'Abrir la pagina del modelo Happy Horse 1.1',
        },
        {
          href: '/models/ltx-2-3-pro',
          label: 'Abrir la pagina del modelo LTX 2.3 Pro',
        },
        {
          href: '/ai-video-engines/ltx-2-3-pro-vs-seedance-2-0',
          label: 'Comparar LTX 2.3 Pro vs Seedance 2.0',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre output de personaje con audio nativo y controles de produccion LTX.',
        items: [
          {
            question: 'Cuando elegir Happy Horse 1.1?',
            answer:
              'Elige Happy Horse 1.1 para audio nativo, lip-sync, escenas cortas de dialogo y personajes de referencia cuando la performance es la senal principal.',
          },
          {
            question: 'Cuando elegir LTX 2.3 Pro?',
            answer:
              'Elige LTX 2.3 Pro para clips mas largos, entrega orientada a 4K, workflows de extension o retake y acabado de produccion donde el control visual pesa mas que el lip-sync.',
          },
          {
            question: 'Que modelo es mejor para anuncios de producto?',
            answer:
              'Happy Horse 1.1 es mejor para anuncios tipo spokesperson o UGC con dialogo. LTX 2.3 Pro es mejor para movimiento de producto pulido, acabado de alta resolucion y produccion mas editada.',
          },
        ],
      },
    },
    'gemini-omni-flash-vs-veo-3-1': {
      meta: {
        title: 'Gemini Omni Flash vs Veo 3.1: specs de video Google y usos',
        description:
          'Compara Gemini Omni Flash y Veo 3.1 para edicion stateful, referencias, edicion de video fuente, first/last-frame, extend, limites 720p y precios de video Google.',
        titleBranding: 'none',
      },
      heroIntro:
        'Usa Gemini Omni Flash cuando el trabajo de video Google necesita refine stateful, stacks mas grandes de imagenes de referencia, ediciones cortas desde video fuente o direccion sonora por prompt dentro de una ruta preview 720p. Usa Veo 3.1 cuando necesitas el workflow Veo maduro para first/last-frame, extend, mas opciones de resolucion de entrega y una ruta de produccion mas establecida. Esta pagina es scorecard/specs hasta que existan videos comparativos Omni validados.',
      quickVerdict: {
        title: 'Veredicto rapido',
        body:
          'Gemini Omni Flash vs Veo 3.1 es sobre todo una eleccion de modelo de interaccion. Omni Flash encaja mejor en refine conversacional, previous interaction id, referencias mas numerosas y ediciones cortas desde video fuente. Veo 3.1 sigue siendo el default mas seguro para entrega Veo pulida, first/last-frame, extend y salidas de mayor resolucion.',
      },
      topCards: [
        {
          title: 'Elige Omni Flash para refine',
          body:
            'Omni Flash esta construido alrededor de Google Interactions, asi que previous interaction id y store/refine son controles centrales en MaxVideoAI.',
        },
        {
          title: 'Elige Veo 3.1 para entrega',
          body:
            'Veo 3.1 sigue siendo el mejor default cuando el brief necesita first/last-frame, extend, ruteo Veo mas maduro o acabado en mayor resolucion.',
        },
        {
          title: 'Estrategia de referencias',
          body:
            'Omni Flash puede usar stacks mas grandes de imagenes de referencia. Veo 3.1 sigue siendo mejor cuando el objetivo es un clip Veo cinematografico controlado.',
        },
        {
          title: 'Etapa de lanzamiento',
          body:
            'Omni Flash se expone como preview limitada. Veo 3.1 es hoy la ruta Google video mas establecida en MaxVideoAI.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/es/modelos/gemini-omni-flash',
          label: 'Abrir pagina de Gemini Omni Flash',
        },
        {
          href: '/es/modelos/veo-3-1',
          label: 'Abrir pagina de Veo 3.1',
        },
        {
          href: '/es/precios#gemini-omni-flash-pricing',
          label: 'Ver precio de Omni Flash',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre workflows Google Omni interactivos y la ruta de produccion Veo.',
        items: [
          {
            question: 'Gemini Omni Flash es mejor que Veo 3.1?',
            answer:
              'No de forma general. Gemini Omni Flash es mejor para refine stateful, workflows con previous interaction id, stacks grandes de referencias y ediciones desde video fuente. Veo 3.1 sigue siendo mejor para controles Veo maduros, first/last-frame, extend y rutas de mayor resolucion.',
          },
          {
            question: 'Cual usar para reference-to-video?',
            answer:
              'Usa Omni Flash si necesitas mas referencias o planeas refinar la misma interaccion. Usa Veo 3.1 si el objetivo es un render Veo mas establecido y cinematografico.',
          },
          {
            question: 'Cual soporta first/last-frame y extend?',
            answer:
              'Veo 3.1 es la pagina que debes usar para first/last-frame y extend. La ruta preview actual de Gemini Omni Flash en MaxVideoAI no expone esos controles.',
          },
          {
            question: 'Por que Omni Flash aparece como preview?',
            answer:
              'Google documenta Gemini Omni Flash como modelo preview. MaxVideoAI mantiene el ruteo publico con gate y etiqueta specs/precios como preview hasta que cuota y SKUs sean estables.',
          },
        ],
      },
    },
    'veo-3-1-vs-veo-3-1-fast': {
      heroIntro:
        'Compara Veo 3.1 y Veo 3.1 Fast para elegir el workflow de video IA Veo 3 actual mas adecuado segun tu necesidad de text-to-video mas pulido, image-to-video, borradores mas rapidos y control sobre el audio nativo.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir el workflow Veo actual adecuado.',
        items: [
          {
            question: 'Como deberia usar Veo 3 para text-to-video y borradores?',
            answer:
              'Usa Veo 3.1 Fast para borradores mas baratos, comparacion de prompts text-to-video e iteracion mas rapida. Usa Veo 3.1 cuando quieras una salida final mas fuerte, mejor control guiado por referencias y resultados image-to-video mas pulidos.',
          },
          {
            question: 'Puedo usar tanto Veo 3.1 como Veo 3.1 Fast para image-to-video?',
            answer:
              'Si. Ambos pueden manejar workflows de image-to-video, pero Veo 3.1 encaja mejor en resultados mas pulidos, mientras que Veo 3.1 Fast encaja mejor en pruebas mas baratas de prompt y encuadre.',
          },
          {
            question: 'Cuando deberia elegir Veo 3.1 en lugar de Veo 3.1 Fast?',
            answer:
              'Elige Veo 3.1 cuando la calidad final, el pulido del audio nativo y un mejor control guiado por referencias importan mas que la velocidad del borrador. Elige Fast cuando el objetivo es una iteracion mas barata y una validacion de workflow mas rapida.',
          },
        ],
      },
    },
    'veo-3-1-fast-vs-veo-3-1-lite': {
      heroIntro:
        'Compara Veo 3.1 Fast y Veo 3.1 Lite para elegir el workflow de video IA Veo 3 actual mas adecuado segun tu necesidad de borradores text-to-video mas baratos, pruebas image-to-video, comportamiento del audio e iteracion mas rapida.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre los tiers Veo Fast y Lite actuales.',
        items: [
          {
            question: 'Que modelo Veo 3 es mejor para pruebas de image-to-video?',
            answer:
              'Los dos pueden servir, pero Veo 3.1 Lite encaja mejor en las pruebas image-to-video con audio mas baratas, mientras que Veo 3.1 Fast encaja mejor cuando quieres mas flexibilidad y una subida mas fluida hacia Veo 3.1.',
          },
          {
            question: 'Veo 3.1 Lite o Veo 3.1 Fast es mejor para borradores text-to-video?',
            answer:
              'Veo 3.1 Lite encaja mejor cuando quieres los borradores con audio mas baratos. Veo 3.1 Fast encaja mejor cuando quieres mas flexibilidad, audio opcional y un puente mas limpio hacia el workflow principal de Veo 3.1.',
          },
          {
            question: 'Cuando deberia elegir Veo 3.1 Fast en lugar de Veo 3.1 Lite?',
            answer:
              'Elige Fast cuando quieras mas flexibilidad de workflow, control opcional del audio y una ruta de subida mas simple hacia Veo 3.1. Elige Lite cuando tu prioridad sea el testing Veo actual mas barato con audio siempre activado.',
          },
        ],
      },
    },
    'kling-3-pro-vs-kling-3-standard': {
      heroIntro:
        'Compara Kling 3 Pro y Kling 3 Standard para elegir el modelo Kling AI actual adecuado para video multi-shot, workflows Kling de imagen-a-video, Kling Elements reutilizables y calidad de salida con audio nativo.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre los tiers actuales de Kling Pro y Standard.',
        items: [
          {
            question: '¿Que modelo Kling AI actual es mejor para imagen-a-video y pruebas de prompt?',
            answer:
              'Kling 3 Standard es mejor para pruebas de prompt de menor coste y borradores repetibles de imagen-a-video, mientras que Kling 3 Pro es mejor cuando necesitas un control de escena mas preciso y salidas finales mas prioritarias.',
          },
          {
            question: '¿Kling 3 Pro y Kling 3 Standard soportan ambos los Kling Elements?',
            answer:
              'Si. Ambos modelos Kling actuales soportan Kling Elements para continuidad de personajes y props, pero Kling 3 Pro es la mejor opcion cuando la secuencia es mas exigente o la continuidad importa mas.',
          },
          {
            question: '¿Cuando deberia elegir Kling 3 Pro en lugar de Kling 3 Standard?',
            answer:
              'Elige Kling 3 Pro cuando necesites mejor control de escena, continuidad multi-shot mas exigente y una salida final mas prioritaria. Elige Kling 3 Standard cuando importe mas controlar el coste y repetir pruebas de borrador.',
          },
        ],
      },
    },
    'pika-text-to-video-vs-wan-2-6': {
      meta: {
        title: 'Pika 2.2 vs Wan 2.6: precio, audio y mejores usos',
        description:
          'Compara Pika 2.2 y Wan 2.6 en precio, duración, audio, resolución y referencias de video para elegir el modelo ideal para tu proyecto.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Pika 2.2 Text & Image to Video con Wan 2.6 Text & Image to Video para decidir entre un loop corto y económico o un flujo más completo con audio. Pika simplifica la animación desde texto o imagen, mientras Wan llega a 15 segundos y admite videos de referencia.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige Pika 2.2 para loops silenciosos de 5 o 10 segundos, pruebas estilizadas y animaciones simples a menor precio. Elige Wan 2.6 si la toma necesita hasta 15 segundos, audio nativo o entre uno y tres videos de referencia, aunque el costo en 720p y 1080p sea mayor.',
      },
      topCards: [
        {
          title: 'Elige Pika 2.2',
          body:
            'Úsalo para pruebas económicas en 720p, loops silenciosos y trabajos simples de texto a video o imagen a video.',
        },
        {
          title: 'Elige Wan 2.6',
          body:
            'Úsalo para tomas de hasta 15 segundos, audio opcional, entrega 1080p o un flujo guiado por videos de referencia.',
        },
        {
          title: 'Diferencia clave',
          body:
            'Pika parte de US$0.04 por segundo en 720p; Wan parte de US$0.10 y agrega duración, audio y control por referencias.',
        },
        {
          title: 'Mejores flujos',
          body:
            'Pika funciona para loops sociales y conceptos. Wan funciona para tomas más largas, narradas o guiadas por video.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/pika-text-to-video', label: 'Abrir la página del modelo Pika 2.2' },
        { href: '/models/wan-2-6', label: 'Abrir la página del modelo Wan 2.6' },
        {
          href: '/ai-video-engines/minimax-hailuo-02-text-vs-pika-text-to-video',
          label: 'Comparar Hailuo 02 y Pika 2.2',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas breves para elegir entre Pika 2.2 y Wan 2.6.',
        items: [
          {
            question: '¿Pika 2.2 o Wan 2.6 es más económico para hacer pruebas?',
            answer:
              'Pika 2.2 cuesta menos en 720p y funciona bien para loops silenciosos cortos. Wan 2.6 justifica su precio cuando la prueba requiere audio, más duración o videos de referencia.',
          },
          {
            question: '¿Qué puede hacer Wan 2.6 que Pika 2.2 no ofrece?',
            answer:
              'Wan 2.6 genera hasta 15 segundos, admite audio opcional y trabaja con uno a tres videos de referencia. Pika 2.2 se concentra en texto a video e imagen a video sin audio.',
          },
          {
            question: '¿Qué modelo conviene para una toma final en 1080p?',
            answer:
              'Los dos ofrecen 1080p. Pika sirve para una toma silenciosa simple y más económica; Wan conviene cuando el audio, la duración o la guía por video son esenciales.',
          },
        ],
      },
    },
    'kling-2-6-pro-vs-kling-3-pro': {
      meta: {
        title: 'Kling 2.6 Pro vs Kling 3 Pro: ¿conviene actualizar?',
        description:
          'Compara Kling 2.6 Pro y Kling 3 Pro en duración, audio, precio y control de varias tomas para decidir si vale la pena actualizar.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Kling 2.6 Pro con Kling 3 Pro para saber si tu flujo anterior sigue siendo suficiente o si la generación actual justifica el precio adicional. Ambos entregan video 1080p con audio, pero Kling 3 Pro llega a 15 segundos y apunta a secuencias cinematográficas de varias tomas.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Mantén Kling 2.6 Pro para diálogos conocidos de 5 o 10 segundos y un menor precio con audio. Actualiza a Kling 3 Pro cuando el proyecto necesite hasta 15 segundos, la generación Kling actual y un flujo mejor preparado para secuencias de varias tomas que justifiquen el costo extra.',
      },
      topCards: [
        {
          title: 'Elige Kling 2.6 Pro',
          body:
            'Conserva este modelo anterior para prompts 1080p validados, diálogos cortos y una tarifa de US$0.14 por segundo con audio.',
        },
        {
          title: 'Elige Kling 3 Pro',
          body:
            'Usa el Pro actual para clips de hasta 15 segundos y secuencias cinematográficas prioritarias de varias tomas.',
        },
        {
          title: 'Diferencia clave',
          body:
            'Ambos ofrecen texto, imagen, 1080p y audio; la decisión es valor del modelo anterior frente a duración y vigencia.',
        },
        {
          title: 'Mejores flujos',
          body:
            'Kling 2.6 Pro sirve para diálogos cortos repetibles. Kling 3 Pro sirve para piezas principales y secuencias planeadas.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/kling-2-6-pro', label: 'Abrir la página de Kling 2.6 Pro' },
        { href: '/models/kling-3-pro', label: 'Abrir la página de Kling 3 Pro' },
        {
          href: '/ai-video-engines/kling-3-pro-vs-kling-3-standard',
          label: 'Comparar Kling 3 Pro y Kling 3 Standard',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas breves antes de pasar de Kling 2.6 Pro a Kling 3 Pro.',
        items: [
          {
            question: '¿Kling 3 Pro es una actualización directa de Kling 2.6 Pro?',
            answer:
              'Kling 3 Pro es la ruta Pro actual y aumenta la duración máxima de 10 a 15 segundos. Kling 2.6 Pro sigue disponible como opción anterior para flujos cortos ya validados.',
          },
          {
            question: '¿Los dos modelos Kling Pro generan audio?',
            answer:
              'Sí. Ambos admiten audio en 1080p desde texto o imagen. Kling 2.6 Pro cuesta US$0.14 por segundo con audio y Kling 3 Pro lista US$0.168 antes del margen de la plataforma.',
          },
          {
            question: '¿Cuándo vale la pena pagar más por Kling 3 Pro?',
            answer:
              'Elige Kling 3 Pro para 15 segundos, la generación actual o la planeación de varias tomas. Conserva 2.6 Pro si tu flujo validado de 10 segundos ya resuelve el proyecto.',
          },
        ],
      },
    },
    'ltx-2-3-fast-vs-luma-ray-2': {
      meta: {
        title: 'LTX 2.3 Fast vs Luma Ray 2: velocidad, 4K y edición',
        description:
          'Compara LTX 2.3 Fast y Luma Ray 2 en duración, 4K, audio, transformación de video y reencuadre para elegir tu mejor flujo.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara LTX 2.3 Fast con Luma Ray 2 para elegir entre generación rápida con audio y una herramienta Luma anterior enfocada en edición. LTX alcanza 20 segundos en 1080p, 1440p o 4K; Luma se limita a 9 segundos, pero agrega transformación de video y reencuadre.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige LTX 2.3 Fast para generar rápidamente desde texto o imagen, con audio, clips más largos y salida hasta 4K. Elige Luma Ray 2 cuando necesites transformar un video existente o adaptarlo a una variedad mayor de formatos y una entrega 1080p sea suficiente.',
      },
      topCards: [
        {
          title: 'Elige LTX 2.3 Fast',
          body:
            'Para conceptos rápidos, audio nativo, clips de hasta 20 segundos y entregas desde 1080p hasta 4K.',
        },
        {
          title: 'Elige Luma Ray 2',
          body:
            'Para modificar un video existente o reencuadrarlo en formato ancho, cuadrado, vertical o ultraancho.',
        },
        {
          title: 'Diferencia clave',
          body:
            'LTX ofrece más duración, resolución y audio; Luma aporta transformación de una fuente y más relaciones de aspecto.',
        },
        {
          title: 'Mejores flujos',
          body:
            'LTX sirve para borradores de campaña y alta resolución. Luma sirve para reutilizar y adaptar material existente.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/ltx-2-3-fast', label: 'Abrir la página de LTX 2.3 Fast' },
        { href: '/models/luma-ray-2', label: 'Abrir la página de Luma Ray 2' },
        {
          href: '/ai-video-engines/ltx-2-3-fast-vs-veo-3-1-fast',
          label: 'Comparar LTX 2.3 Fast y Veo 3.1 Fast',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas breves para elegir entre generación LTX y edición Luma.',
        items: [
          {
            question: '¿Qué modelo conviene para generar video 4K rápidamente?',
            answer:
              'LTX 2.3 Fast es la opción clara porque admite 4K, audio y clips de hasta 20 segundos. Luma Ray 2 llega a 1080p y no genera audio.',
          },
          {
            question: '¿Qué permite Luma Ray 2 que LTX 2.3 Fast no hace?',
            answer:
              'Luma Ray 2 incluye transformación de video a video y reencuadre de material existente. LTX 2.3 Fast se enfoca en generar desde texto o una imagen.',
          },
          {
            question: '¿Todavía conviene usar Luma Ray 2?',
            answer:
              'Sí, cuando la prioridad es modificar una fuente de video o adaptarla a varios formatos. Para generación nueva con audio y alta resolución, usa LTX 2.3 Fast.',
          },
        ],
      },
    },
    'kling-2-6-pro-vs-minimax-hailuo-02-text': {
      meta: {
        title: 'Kling 2.6 Pro vs Hailuo 02: calidad, audio y precio',
        description:
          'Compara Kling 2.6 Pro y MiniMax Hailuo 02 en 1080p, audio, movimiento estilizado y precio por segundo para elegir el modelo correcto.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Kling 2.6 Pro con MiniMax Hailuo 02 Standard para decidir entre diálogo cinematográfico en 1080p y exploración estilizada más económica. Kling agrega audio nativo y mayor resolución, mientras Hailuo produce animaciones silenciosas accesibles en 512P o 768P.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige Kling 2.6 Pro para tomas cinematográficas en 1080p, diálogo y audio nativo opcional. Elige MiniMax Hailuo 02 Standard para probar estilos, formatos verticales o cuadrados y movimiento silencioso a menor precio cuando 512P o 768P sean suficientes.',
      },
      topCards: [
        {
          title: 'Elige Kling 2.6 Pro',
          body:
            'Para diálogos cinematográficos en 1080p, audio opcional y tomas donde el acabado importa más que el precio.',
        },
        {
          title: 'Elige Hailuo 02',
          body:
            'Para explorar conceptos estilizados a US$0.045 por segundo y producir movimiento silencioso de menor resolución.',
        },
        {
          title: 'Diferencia clave',
          body:
            'Kling entrega 1080p y audio por US$0.14 por segundo con sonido; Hailuo cuesta menos, pero es silencioso y llega a 768P.',
        },
        {
          title: 'Mejores flujos',
          body:
            'Kling sirve para diálogo y tomas terminadas. Hailuo sirve para ganchos estilizados y lotes de exploración económica.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/kling-2-6-pro', label: 'Abrir la página de Kling 2.6 Pro' },
        { href: '/models/minimax-hailuo-02-text', label: 'Abrir la página de MiniMax Hailuo 02' },
        {
          href: '/ai-video-engines/kling-2-6-pro-vs-wan-2-6',
          label: 'Comparar Kling 2.6 Pro y Wan 2.6',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas breves entre acabado Kling y movimiento Hailuo económico.',
        items: [
          {
            question: '¿Kling 2.6 Pro o Hailuo 02 conviene más para diálogo?',
            answer:
              'Kling 2.6 Pro es más adecuado por su audio nativo y salida 1080p. Hailuo 02 genera video silencioso y funciona mejor para pruebas visuales o estilizadas.',
          },
          {
            question: '¿Qué resolución ofrece cada modelo?',
            answer:
              'Kling 2.6 Pro entrega 1080p. MiniMax Hailuo 02 Standard ofrece 512P y 768P, por lo que sirve más para explorar conceptos que para terminar en alta resolución.',
          },
          {
            question: '¿Cuándo conviene el menor precio de Hailuo 02?',
            answer:
              'Usa Hailuo para multiplicar exploraciones estilizadas silenciosas a US$0.045 por segundo. Paga Kling cuando el audio y una entrega 1080p sean requisitos.',
          },
        ],
      },
    },
    'kling-3-standard-vs-kling-o3-standard': {
      meta: {
        title: 'Kling 3 Standard vs Omni Standard: ¿cuál elegir?',
        description:
          'Compara Kling 3 Standard y Kling 3.0 Omni Standard en referencias, edición de video, 1080p, audio y precio para elegir el flujo correcto.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Kling 3 Standard con Kling 3.0 Omni Standard cuando ambos ofrecen 15 segundos en 1080p con audio al mismo precio base. Standard simplifica la generación desde texto o una imagen inicial; Omni agrega referencias visuales y transformación de un video fuente.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige Kling 3 Standard para probar directamente un prompt o una imagen inicial sin complejidad extra. Elige Kling 3.0 Omni Standard cuando personajes, productos, referencias visuales o un video existente deban guiar el resultado mediante referencia a video o video a video.',
      },
      topCards: [
        {
          title: 'Elige Kling 3 Standard',
          body:
            'Para prompts directos, animación de una imagen inicial y borradores 1080p repetibles con audio opcional.',
        },
        {
          title: 'Elige Omni Standard',
          body:
            'Para guiar la toma con referencias o transformar un video fuente además de generar desde texto o imagen.',
        },
        {
          title: 'Diferencia clave',
          body:
            'Resolución, duración, audio y precio base coinciden; Omni amplía las entradas y Standard mantiene el flujo simple.',
        },
        {
          title: 'Mejores flujos',
          body:
            'Standard sirve para pruebas desde una imagen. Omni sirve para continuidad de personajes, productos y fuentes de video.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/kling-3-standard', label: 'Abrir la página de Kling 3 Standard' },
        { href: '/models/kling-o3-standard', label: 'Abrir la página de Kling 3.0 Omni Standard' },
        {
          href: '/ai-video-engines/kling-3-pro-vs-kling-3-standard',
          label: 'Comparar Kling 3 Pro y Kling 3 Standard',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas breves entre los flujos Kling Standard y Omni Standard.',
        items: [
          {
            question: '¿Cuál es la diferencia principal entre Standard y Omni Standard?',
            answer:
              'Ambos producen hasta 15 segundos en 1080p con audio. Omni Standard agrega referencia a video y video a video, modos que Kling 3 Standard no incluye.',
          },
          {
            question: '¿Kling 3 Standard y Omni Standard cuestan lo mismo?',
            answer:
              'El catálogo indica las mismas tarifas del proveedor: US$0.084 por segundo sin audio y US$0.126 con audio, antes del margen aplicado por MaxVideoAI.',
          },
          {
            question: '¿Qué modelo debo usar con recursos de referencia?',
            answer:
              'Elige Kling 3.0 Omni Standard si imágenes de referencia o un video fuente deben guiar el resultado. Kling 3 Standard basta cuando un prompt o imagen inicial resuelven la toma.',
          },
        ],
      },
    },
    'seedance-2-0-fast-vs-veo-3-1': {
      meta: {
        title: 'Seedance 2.0 Fast vs Veo 3.1: borradores o 4K final',
        description:
          'Compara Seedance 2.0 Fast y Google Veo 3.1 en borradores, referencias, edición, duración, audio y salida 4K para tu próximo video.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Seedance 2.0 Fast con Google Veo 3.1 para elegir entre un flujo amplio de borrador y edición o una entrega final de mayor resolución. Seedance llega a 15 segundos con referencias, edición y extensión en 480p o 720p; Veo alcanza 4K para anuncios y B-roll pulidos de 8 segundos.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige Seedance 2.0 Fast para planear con rapidez, crear borradores más largos, usar referencias, editar o extender un video cuando 720p sean suficientes. Elige Google Veo 3.1 para anuncios cortos terminados, control de primera y última imagen, y entrega 1080p o 4K.',
      },
      topCards: [
        {
          title: 'Elige Seedance 2.0 Fast',
          body:
            'Para borradores de 4 a 15 segundos, referencias visuales, edición, extensión y una variedad amplia de formatos.',
        },
        {
          title: 'Elige Veo 3.1',
          body:
            'Para anuncios o B-roll terminados de 8 segundos, audio, control de imágenes límite y entrega 1080p o 4K.',
        },
        {
          title: 'Diferencia clave',
          body:
            'Seedance ofrece más duración y herramientas en 480p/720p; Veo produce clips más cortos con mayor resolución final.',
        },
        {
          title: 'Mejores flujos',
          body:
            'Seedance sirve para planeación y ajustes. Veo sirve para tomas aprobadas de campaña y masters de alta resolución.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/seedance-2-0-fast', label: 'Abrir la página de Seedance 2.0 Fast' },
        { href: '/models/veo-3-1', label: 'Abrir la página de Google Veo 3.1' },
        {
          href: '/ai-video-engines/seedance-2-0-fast-vs-veo-3-1-fast',
          label: 'Comparar Seedance 2.0 Fast y Veo 3.1 Fast',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas breves entre borradores Seedance y entregas finales Veo.',
        items: [
          {
            question: '¿Seedance 2.0 Fast o Veo 3.1 conviene más para borradores?',
            answer:
              'Seedance 2.0 Fast está diseñado para borradores rápidos, pruebas con referencias y planeación de tomas. También llega a 15 segundos y permite editar o extender video.',
          },
          {
            question: '¿Qué modelo conviene para una entrega final en 4K?',
            answer:
              'Google Veo 3.1 es la mejor opción para un master 4K pulido. Seedance 2.0 Fast llega a 720p y funciona mejor como ruta de iteración y edición.',
          },
          {
            question: '¿Los dos modelos admiten audio y referencias?',
            answer:
              'Sí. Seedance agrega edición de video y más formatos, mientras Veo agrega control de primera y última imagen junto con una resolución final superior.',
          },
        ],
      },
    },
    'ltx-2-fast-vs-minimax-hailuo-02-text': {
      meta: {
        title: 'LTX 2 Fast vs Hailuo 02: resolución, audio y usos',
        description:
          'Compara LTX Video 2.0 Fast y MiniMax Hailuo 02 en duración, resolución, audio, formatos y precio para clips sociales y estilizados.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara LTX Video 2.0 Fast con MiniMax Hailuo 02 Standard para elegir entre clips horizontales largos en alta resolución o formatos estilizados más modestos. LTX alcanza 20 segundos con audio y salida hasta 4K; Hailuo agrega formatos vertical y cuadrado en 512P o 768P sin audio.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige LTX Video 2.0 Fast para clips horizontales rápidos, audio nativo, duración de hasta 20 segundos y salida 1080p, 1440p o 4K. Elige MiniMax Hailuo 02 Standard para un concepto estilizado silencioso en vertical, cuadrado u horizontal cuando 512P o 768P sean suficientes.',
      },
      topCards: [
        {
          title: 'Elige LTX 2 Fast',
          body:
            'Para clips sociales 16:9 más largos, generación con audio y entregas desde 1080p hasta 4K.',
        },
        {
          title: 'Elige Hailuo 02',
          body:
            'Para movimiento estilizado silencioso en 16:9, 9:16 o 1:1 cuando 512P o 768P cubran el canal.',
        },
        {
          title: 'Diferencia clave',
          body:
            'LTX ofrece duración, audio y alta resolución, pero solo 16:9; Hailuo ofrece más formatos sociales con menor resolución.',
        },
        {
          title: 'Mejores flujos',
          body:
            'LTX sirve para promociones horizontales con música. Hailuo sirve para ganchos verticales, cuadrados y pruebas visuales.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/ltx-2-fast', label: 'Abrir la página de LTX Video 2.0 Fast' },
        { href: '/models/minimax-hailuo-02-text', label: 'Abrir la página de MiniMax Hailuo 02' },
        {
          href: '/ai-video-engines/ltx-2-3-fast-vs-ltx-2-fast',
          label: 'Comparar LTX 2.3 Fast y LTX 2 Fast',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas breves entre LTX de alta resolución y Hailuo multiformato.',
        items: [
          {
            question: '¿Qué modelo conviene para clips largos en alta resolución?',
            answer:
              'LTX Video 2.0 Fast alcanza 20 segundos con audio y salida 1080p, 1440p o 4K. Hailuo 02 se limita a 10 segundos y 768P.',
          },
          {
            question: '¿Qué modelo funciona mejor en vertical o cuadrado?',
            answer:
              'MiniMax Hailuo 02 Standard admite 9:16 y 1:1 además de 16:9. LTX Video 2.0 Fast se limita al formato horizontal 16:9.',
          },
          {
            question: '¿LTX 2 Fast y Hailuo 02 generan audio?',
            answer:
              'No los dos. LTX Video 2.0 Fast admite audio nativo, mientras Hailuo 02 produce video silencioso que puede sonorizarse después si hace falta.',
          },
        ],
      },
    },
    'minimax-hailuo-02-text-vs-veo-3-1-fast': {
      meta: {
        title: 'Hailuo 02 vs Veo 3.1 Fast: precio, audio y 4K',
        description:
          'Compara MiniMax Hailuo 02 y Google Veo 3.1 Fast en precio, audio, referencias, resolución y duración para pruebas o entregas pulidas.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara MiniMax Hailuo 02 Standard con Google Veo 3.1 Fast para decidir entre exploración estilizada económica y un flujo de producción más completo. Hailuo crea movimiento silencioso en 512P o 768P por US$0.045 por segundo; Veo Fast agrega audio, referencias, extensión y salida hasta 4K.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige MiniMax Hailuo 02 Standard para conceptos estilizados silenciosos y económicos de hasta 10 segundos cuando 768P sean suficientes. Elige Google Veo 3.1 Fast para anuncios con audio, referencias, control de primera y última imagen, extensiones o una entrega final en 1080p o 4K.',
      },
      topCards: [
        {
          title: 'Elige Hailuo 02',
          body:
            'Para pruebas estilizadas a US$0.045 por segundo, conceptos sociales silenciosos y hasta 10 segundos en 768P.',
        },
        {
          title: 'Elige Veo 3.1 Fast',
          body:
            'Para audio, referencias, control de imágenes límite, extensión y entregas desde 720p hasta 4K.',
        },
        {
          title: 'Diferencia clave',
          body:
            'Hailuo cuesta menos y ofrece dos segundos más; Veo Fast amplía la resolución, el sonido y los controles.',
        },
        {
          title: 'Mejores flujos',
          body:
            'Hailuo sirve para pruebas estilizadas y ganchos económicos. Veo Fast sirve para anuncios, productos y masters pulidos.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/minimax-hailuo-02-text', label: 'Abrir la página de MiniMax Hailuo 02' },
        { href: '/models/veo-3-1-fast', label: 'Abrir la página de Google Veo 3.1 Fast' },
        {
          href: '/ai-video-engines/seedance-2-0-fast-vs-veo-3-1-fast',
          label: 'Comparar Seedance 2.0 Fast y Veo 3.1 Fast',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas breves entre Hailuo económico y Veo Fast más completo.',
        items: [
          {
            question: '¿Hailuo 02 o Veo 3.1 Fast cuesta menos?',
            answer:
              'Hailuo 02 cuesta US$0.045 por segundo. Veo 3.1 Fast parte de US$0.10 en 720p con audio y sube con la resolución, por lo que Hailuo es la ruta silenciosa más económica.',
          },
          {
            question: '¿Qué modelo admite audio y salida 4K?',
            answer:
              'Google Veo 3.1 Fast admite audio nativo y salida hasta 4K. MiniMax Hailuo 02 Standard es silencioso y llega como máximo a 768P.',
          },
          {
            question: '¿Cuándo conviene elegir Hailuo 02 en vez de Veo Fast?',
            answer:
              'Elige Hailuo para explorar estilos a bajo precio sin necesitar sonido ni alta resolución. Veo Fast conviene cuando importan referencias, audio y una entrega terminada.',
          },
        ],
      },
    },
    'kling-3-4k-vs-seedance-2-0': {
      meta: {
        title: 'Kling 3 4K vs Seedance 2.0: 4K final o más control',
        description:
          'Compara Kling 3 4K y Seedance 2.0 en 4K nativo, referencias, edición, extensión, audio y flexibilidad antes de renderizar tu proyecto.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Kling 3 4K con Seedance 2.0: ambos entregan 4K, pero siguen rutas de producción distintas. Kling es una opción de texto o imagen inicial dedicada al render final en 4K nativo; Seedance va de 480p a 4K con referencias, edición, extensión, controles de movimiento y audio.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige Kling 3 4K cuando un prompt o imagen aprobados deban renderizarse directamente en 4K nativo. Elige Seedance 2.0 cuando el proyecto necesite iteraciones de menor resolución, varias referencias, edición de video, extensión de clips, más formatos o mayor control antes del master 4K.',
      },
      topCards: [
        {
          title: 'Elige Kling 3 4K',
          body:
            'Para renderizar directamente un prompt o imagen aprobados en 4K nativo, con audio opcional.',
        },
        {
          title: 'Elige Seedance 2.0',
          body:
            'Para referencias, edición, extensión, controles de movimiento, varias resoluciones y más relaciones de aspecto.',
        },
        {
          title: 'Diferencia clave',
          body:
            'Kling bloquea cada render en 4K nativo; Seedance permite iterar desde 480p con entradas mucho más variadas.',
        },
        {
          title: 'Mejores flujos',
          body:
            'Kling sirve para piezas principales ya aprobadas. Seedance sirve para campañas iterativas, secuencias y ajustes.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/kling-3-4k', label: 'Abrir la página de Kling 3 4K' },
        { href: '/models/seedance-2-0', label: 'Abrir la página de Seedance 2.0' },
        {
          href: '/ai-video-engines/kling-3-4k-vs-veo-3-1',
          label: 'Comparar Kling 3 4K y Veo 3.1',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas breves entre 4K nativo dedicado y un flujo Seedance completo.',
        items: [
          {
            question: '¿Kling 3 4K y Seedance 2.0 admiten salida 4K?',
            answer:
              'Sí. Kling 3 4K está bloqueado en salida 4K nativa, mientras Seedance 2.0 ofrece 480p, 720p, 1080p y 4K para iterar antes de la entrega final.',
          },
          {
            question: '¿Qué modelo ofrece más control con referencias y edición?',
            answer:
              'Seedance 2.0 agrega referencias, edición, extensión, controles de movimiento y varias fuentes de imagen, video o audio. Kling 3 4K se concentra en texto e imagen inicial.',
          },
          {
            question: '¿Qué modelo conviene para una pieza principal final en 4K?',
            answer:
              'Kling 3 4K es una ruta directa para renderizar un prompt o imagen aprobados en 4K nativo. Seedance conviene si la toma todavía requiere referencias, ajustes o extensiones.',
          },
        ],
      },
    },
    'minimax-hailuo-02-text-vs-wan-2-6': {
      meta: {
        title: 'Hailuo 02 vs Wan 2.6: precio, audio y mejores usos',
        description:
          'Compara MiniMax Hailuo 02 y Wan 2.6 en precio, duración, 1080p, audio, referencias de video y movimiento estilizado para elegir bien.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara MiniMax Hailuo 02 Standard con Wan 2.6 Text & Image to Video para decidir entre movimiento estilizado económico y un flujo de uso general. Hailuo cuesta US$0.045 por segundo para clips silenciosos en 512P o 768P; Wan llega a 15 segundos en 1080p con audio y referencias de video.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige MiniMax Hailuo 02 Standard para conceptos estilizados silenciosos más económicos, formatos verticales o cuadrados y hasta 10 segundos cuando 768P sean suficientes. Elige Wan 2.6 para producción general en 1080p, hasta 15 segundos, con audio opcional o entre uno y tres videos de referencia.',
      },
      topCards: [
        {
          title: 'Elige Hailuo 02',
          body:
            'Para movimiento estilizado a US$0.045 por segundo y pruebas silenciosas horizontales, verticales o cuadradas.',
        },
        {
          title: 'Elige Wan 2.6',
          body:
            'Para entrega 720p o 1080p, audio opcional, hasta 15 segundos y guía por referencias de video.',
        },
        {
          title: 'Diferencia clave',
          body:
            'Hailuo minimiza el costo de contenido estilizado; Wan cuesta más, pero agrega resolución, duración, sonido y referencias.',
        },
        {
          title: 'Mejores flujos',
          body:
            'Hailuo sirve para conceptos sociales económicos. Wan sirve para narración, B-roll y secuencias guiadas.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/minimax-hailuo-02-text', label: 'Abrir la página de MiniMax Hailuo 02' },
        { href: '/models/wan-2-6', label: 'Abrir la página de Wan 2.6' },
        {
          href: '/ai-video-engines/veo-3-1-vs-wan-2-6',
          label: 'Comparar Veo 3.1 y Wan 2.6',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas breves entre Hailuo estilizado y Wan de uso general.',
        items: [
          {
            question: '¿Hailuo 02 o Wan 2.6 cuesta menos?',
            answer:
              'Hailuo 02 cuesta US$0.045 por segundo. Wan 2.6 parte de US$0.10 en 720p y US$0.15 en 1080p, así que Hailuo es más económico si basta una salida silenciosa de menor resolución.',
          },
          {
            question: '¿Qué modelo admite audio y videos de referencia?',
            answer:
              'Wan 2.6 admite audio opcional y entre uno y tres videos de referencia. MiniMax Hailuo 02 Standard genera desde texto o imagen sin audio.',
          },
          {
            question: '¿Cuándo debo elegir Wan 2.6 en vez de Hailuo 02?',
            answer:
              'Elige Wan cuando necesites 1080p, más de 10 segundos, audio nativo o guía por video. Elige Hailuo para explorar estilos y formatos sociales a menor precio.',
          },
        ],
      },
    },
    'ltx-2-3-fast-vs-sora-2-pro': {
      meta: {
        title: 'LTX 2.3 Fast vs Sora 2 Pro: precio, 4K y usos',
        description:
          'Compara LTX 2.3 Fast y Sora 2 Pro en precio, duración, 4K, audio nativo y referencias para elegir iteración rápida o acabado de estudio.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara LTX 2.3 Fast con OpenAI Sora 2 Pro para elegir entre iteración económica de alta resolución y un acabado Sora de estudio. LTX ofrece 1440p o 4K en clips de hasta 10 segundos y llega a 20 segundos en 1080p a 25 fps; Sora Pro admite imagen o referencias para tomas pulidas de hasta 12 segundos.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige LTX 2.3 Fast para iteraciones económicas en 1440p o 4K de hasta 10 segundos, o clips más largos en 1080p a 25 fps. Elige OpenAI Sora 2 Pro cuando el render de estudio y los flujos con imagen o referencias pesen más que la duración o el precio.',
      },
      topCards: [
        {
          title: 'LTX para iteraciones más largas',
          body:
            'LTX admite audio nativo y llega a 20 segundos en 1080p a 25 fps; las opciones 1440p y 4K están disponibles para clips de hasta 10 segundos.',
        },
        {
          title: 'Sora Pro para trabajar con referencias',
          body:
            'Sora Pro acepta texto, imágenes y referencias para equipos que buscan el estilo Sora de estudio en clips de hasta 12 segundos.',
        },
        {
          title: 'Resolución frente a costo',
          body:
            'LTX parte de US$0.04 por segundo en 1080p y puede renderizar en 4K; Sora Pro parte de US$0.30 por segundo en 720p y llega hasta 1080p.',
        },
        {
          title: 'Uso recomendado en producción',
          body:
            'Usa LTX para repetir conceptos de anuncios, producir tomas 1440p o 4K de hasta 10 segundos y extender clips 1080p/25 fps; usa Sora Pro para piezas principales guiadas por referencias.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/ltx-2-3-fast', label: 'Abrir la página de LTX 2.3 Fast' },
        { href: '/models/sora-2-pro', label: 'Abrir la página de OpenAI Sora 2 Pro' },
        {
          href: '/ai-video-engines/ltx-2-3-fast-vs-ltx-2-3-pro',
          label: 'Comparar LTX 2.3 Fast y LTX 2.3 Pro',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas para elegir entre iteración 4K económica y un flujo Sora con referencias.',
        items: [
          {
            question: '¿Qué modelo crea clips más largos, LTX 2.3 Fast o Sora 2 Pro?',
            answer:
              'LTX 2.3 Fast admite hasta 20 segundos en 1080p a 25 fps. OpenAI Sora 2 Pro llega a 12 segundos, mientras que la salida 1440p o 4K de LTX está limitada a 10 segundos.',
          },
          {
            question: '¿LTX 2.3 Fast y Sora 2 Pro generan audio nativo?',
            answer:
              'Sí. Ambos modelos admiten audio nativo. LTX separa la salida 1440p/4K de hasta 10 segundos de las ejecuciones 1080p/25 fps más largas; Sora Pro prioriza el acabado de estudio guiado por referencias.',
          },
          {
            question: '¿Conviene elegir LTX 2.3 Fast para entregar en 4K?',
            answer:
              'Elige LTX para una salida directa en 4K de hasta 10 segundos. Para más de 12 segundos, usa su ruta 1080p/25 fps; elige Sora Pro cuando la imagen o las referencias y el estilo Sora definan la toma.',
          },
        ],
      },
    },
    'veo-3-1-vs-wan-2-5': {
      meta: {
        title: 'Veo 3.1 vs Wan 2.5: 4K, audio, precio y migración',
        description:
          'Compara Google Veo 3.1 y Wan 2.5 en 4K, audio, controles, duración y precio para decidir si mantener el modelo anterior o migrar.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Google Veo 3.1 con Wan 2.5 Text & Image to Video para elegir entre producción pulida en 4K y clips económicos con un modelo anterior. Wan 2.5 sigue disponible en MaxVideoAI para trabajos simples de hasta 10 segundos; Veo agrega referencias, control de primer y último fotograma y extensión.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige Google Veo 3.1 para anuncios finales pulidos, 4K, referencias y controles avanzados. Mantén Wan 2.5 para clips económicos de texto o imagen de hasta 10 segundos; migra a Wan 2.6 actual para texto o imagen de hasta 15 segundos con audio, o para su modo separado de referencias de 5 o 10 segundos sin audio.',
      },
      topCards: [
        {
          title: 'Veo para producción pulida en 4K',
          body:
            'Veo admite desde 720p hasta 4K, audio nativo, referencias, primer y último fotograma y extensión para una producción final controlada.',
        },
        {
          title: 'Conservar Wan 2.5 por su valor',
          body:
            'Quédate en Wan 2.5 cuando su flujo disponible de texto o imagen en 480p, 720p o 1080p ya cubra un clip económico de hasta 10 segundos.',
        },
        {
          title: 'Actualizar el flujo de Wan',
          body:
            'Pasa a Wan 2.6 Text & Image to Video actual para clips de texto o imagen de 5, 10 o 15 segundos con audio opcional; el modo separado con video de referencia dura 5 o 10 segundos y no incluye audio.',
        },
        {
          title: 'Ocho segundos o diez',
          body:
            'Veo se enfoca en clips controlados de hasta ocho segundos; Wan 2.5 ofrece dos segundos extra cuando los controles avanzados no son necesarios.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/veo-3-1', label: 'Abrir la página de Google Veo 3.1' },
        { href: '/models/wan-2-5', label: 'Abrir la página del Wan 2.5 disponible' },
        {
          href: '/ai-video-engines/veo-3-1-vs-wan-2-6',
          label: 'Comparar Google Veo 3.1 y Wan 2.6 actual',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas para elegir los controles de Veo, la economía de Wan 2.5 o la migración a Wan 2.6.',
        items: [
          {
            question: '¿Wan 2.5 sigue disponible en MaxVideoAI?',
            answer:
              'Sí. Wan 2.5 sigue disponible para trabajos de texto a video e imagen a video de hasta 10 segundos en 480p, 720p o 1080p.',
          },
          {
            question: '¿Quién debería quedarse en Wan 2.5 en vez de elegir Veo 3.1?',
            answer:
              'Quédate en Wan 2.5 cuando los clips simples de menor costo y dos segundos extra importen más que el 4K, las referencias, el control de primer y último fotograma o la extensión.',
          },
          {
            question: '¿Cuándo conviene migrar de Wan 2.5 a Wan 2.6?',
            answer:
              'Actualiza a Wan 2.6 actual para clips de texto o imagen de hasta 15 segundos con audio opcional, o usa el modo separado de 5 o 10 segundos sin audio con entre uno y tres videos de referencia.',
          },
        ],
      },
    },
    'kling-2-6-pro-vs-wan-2-5': {
      meta: {
        title: 'Kling 2.6 Pro vs Wan 2.5: calidad, audio y precio',
        description:
          'Compara Kling 2.6 Pro y Wan 2.5 en diálogo 1080p, audio, duración y resolución para decidir si conservar estos modelos anteriores o migrar a sus sucesores.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Kling 2.6 Pro con Wan 2.5 Text & Image to Video como dos modelos anteriores que siguen disponibles en MaxVideoAI. Ambos llegan a 10 segundos con audio; Kling apunta a diálogo cinematográfico en 1080p fijo, mientras Wan ofrece una escala económica desde 480p hasta 1080p.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Quédate en Kling 2.6 Pro para diálogo cinematográfico probado en 1080p o mantén Wan 2.5 por su flexibilidad económica de resolución. Ambos siguen accesibles; migra trabajos nuevos exigentes a Kling 3 Pro actual o a Wan 2.6 para producción de texto o imagen de hasta 15 segundos.',
      },
      topCards: [
        {
          title: 'Conservar Kling para diálogo',
          body:
            'Mantén Kling 2.6 Pro cuando su flujo disponible y establecido en 1080p ya entregue diálogo cinematográfico corto con audio.',
        },
        {
          title: 'Seguir con Wan por resolución y precio',
          body:
            'Continúa con Wan 2.5 cuando los borradores económicos en 480p o 720p y la opción 1080p importen más que el enfoque cinematográfico.',
        },
        {
          title: 'Dos rutas hacia modelos actuales',
          body:
            'Pasa a Kling 3 Pro para la ruta Pro actual de Kling o a Wan 2.6 Text & Image to Video para clips de texto o imagen de hasta 15 segundos.',
        },
        {
          title: 'Límite compartido de la generación anterior',
          body:
            'Ambos modelos anteriores admiten audio y clips de hasta 10 segundos; la diferencia central es diálogo en 1080p fijo frente a una escala flexible de menor costo.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/kling-2-6-pro', label: 'Abrir la página del Kling 2.6 Pro disponible' },
        { href: '/models/wan-2-5', label: 'Abrir la página del Wan 2.5 disponible' },
        {
          href: '/ai-video-engines/kling-3-pro-vs-wan-2-6',
          label: 'Comparar Kling 3 Pro actual y Wan 2.6',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas sobre dos modelos anteriores y sus sucesores actuales de Kling y Wan.',
        items: [
          {
            question: '¿Kling 2.6 Pro y Wan 2.5 siguen disponibles?',
            answer:
              'Sí. MaxVideoAI mantiene ambos modelos anteriores disponibles para trabajos establecidos. Cada uno admite audio y clips de hasta 10 segundos.',
          },
          {
            question: '¿Quién debería quedarse en Kling 2.6 Pro o Wan 2.5?',
            answer:
              'Quédate en Kling para prompts de diálogo probados en 1080p. Conserva Wan para borradores simples de menor resolución cuando su escala de precio en 480p y 720p sea decisiva.',
          },
          {
            question: '¿Qué sucesores deberían elegir quienes usan versiones anteriores de Kling y Wan?',
            answer:
              'Actualiza los proyectos exigentes de Kling a Kling 3 Pro actual y migra a Wan 2.6 Text & Image to Video los proyectos Wan que necesiten clips de hasta 15 segundos.',
          },
        ],
      },
    },
    'veo-3-1-fast-vs-wan-2-5': {
      meta: {
        title: 'Veo 3.1 Fast vs Wan 2.5: velocidad, 4K y valor',
        description:
          'Compara Google Veo 3.1 Fast y Wan 2.5 en velocidad, 4K, audio, controles y duración para decidir si conservar Wan 2.5 o migrar a un modelo actual.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Google Veo 3.1 Fast con Wan 2.5 Text & Image to Video para elegir entre controles actuales en 4K y un flujo anterior económico. Veo Fast llega a ocho segundos; Wan 2.5 sigue disponible en MaxVideoAI y llega a 10 segundos con entradas simples de texto e imagen.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige Google Veo 3.1 Fast para iterar rápido con 4K, referencias, primer y último fotograma y extensión. Quédate en Wan 2.5 para clips simples económicos con dos segundos extra; migra a Wan 2.6 actual para texto o imagen de hasta 15 segundos con audio, o referencias separadas de 5 o 10 segundos sin audio.',
      },
      topCards: [
        {
          title: 'Veo Fast para mayor control',
          body:
            'Usa Veo Fast para salida 720p, 1080p o 4K con audio, referencias, primer y último fotograma y extensión dentro de un flujo de ocho segundos.',
        },
        {
          title: 'Mantener Wan 2.5 para clips simples',
          body:
            'Quédate en Wan cuando su generación disponible desde texto o imagen, su escala de 480p a 1080p y el límite de 10 segundos ya encajen con el trabajo.',
        },
        {
          title: 'Migrar a los modos de Wan 2.6',
          body:
            'Actualiza a Wan 2.6 Text & Image to Video para clips de texto o imagen de hasta 15 segundos con audio opcional; su modo separado sin audio acepta entre uno y tres videos de referencia durante 5 o 10 segundos.',
        },
        {
          title: 'La diferencia central de duración',
          body:
            'Veo Fast termina en ocho segundos, pero agrega controles actuales y 4K; Wan 2.5 ofrece simplicidad de 10 segundos con hasta 1080p.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/veo-3-1-fast', label: 'Abrir la página de Google Veo 3.1 Fast' },
        { href: '/models/wan-2-5', label: 'Abrir la página del Wan 2.5 disponible' },
        {
          href: '/ai-video-engines/veo-3-1-fast-vs-wan-2-6',
          label: 'Comparar Google Veo 3.1 Fast y Wan 2.6 actual',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas sobre producción rápida con Veo, la economía de Wan 2.5 y la migración a Wan 2.6.',
        items: [
          {
            question: '¿Wan 2.5 sigue disponible junto a Veo 3.1 Fast?',
            answer:
              'Sí. Wan 2.5 sigue disponible como ruta anterior de texto e imagen para clips de hasta 10 segundos en 480p, 720p o 1080p.',
          },
          {
            question: '¿Cuándo conviene quedarse en Wan 2.5?',
            answer:
              'Mantén Wan 2.5 para clips económicos directos cuando 10 segundos y hasta 1080p sean suficientes y los controles avanzados de referencias o fotogramas no agreguen valor.',
          },
          {
            question: '¿Cuándo es Wan 2.6 la mejor actualización desde Wan 2.5?',
            answer:
              'Pasa a Wan 2.6 actual para clips 1080p de texto o imagen de hasta 15 segundos con audio opcional, o para la generación separada sin audio de 5 o 10 segundos guiada por entre uno y tres videos de referencia.',
          },
        ],
      },
    },
    'luma-ray-2-vs-luma-ray-2-flash': {
      meta: {
        title: 'Luma Ray 2 vs Flash: velocidad, calidad y usos',
        description:
          'Compara Luma Ray 2 y Ray 2 Flash en velocidad de borrador, modificación, reencuadre, duración y la migración desde estos modelos anteriores a Ray 3.2.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Luma Ray 2 con Luma Ray 2 Flash como dos modelos anteriores de Luma que siguen disponibles en MaxVideoAI. Ambos son silenciosos, llegan a nueve segundos y 1080p, y admiten texto, imagen, modificación de video y reencuadre; Flash está orientado a borradores más rápidos.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Quédate en Luma Ray 2 para el flujo estándar anterior disponible o elige Luma Ray 2 Flash para iterar borradores más rápido con los mismos modos catalogados. Migra la producción nueva de Luma a Luma Ray 3.2 actual cuando su generación más reciente encaje con el proyecto.',
      },
      topCards: [
        {
          title: 'Flujo estándar de Ray 2',
          body:
            'Mantén Ray 2 cuando los prompts existentes y los trabajos de modificación o reencuadre dependan de la ruta estándar anterior disponible de Luma.',
        },
        {
          title: 'Borradores más rápidos con Flash',
          body:
            'Elige Ray 2 Flash cuando la velocidad de borrador sea prioritaria y basten los modos compartidos, silenciosos, de nueve segundos y hasta 1080p.',
        },
        {
          title: 'Modos de creación equivalentes',
          body:
            'Ambas rutas admiten texto, imagen, modificación desde video fuente y reencuadre en proporciones horizontales, cuadradas, verticales y ultrapanorámicas.',
        },
        {
          title: 'Sucesor actual de Luma',
          body:
            'Actualiza a Luma Ray 3.2 para usar la generación actual de Ray; los flujos establecidos de Ray 2 y Flash pueden seguir cuando todavía resuelvan el trabajo.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/luma-ray-2', label: 'Abrir la página del Luma Ray 2 disponible' },
        { href: '/models/luma-ray-2-flash', label: 'Abrir la página del Luma Ray 2 Flash disponible' },
        {
          href: '/ai-video-engines/luma-ray-2-vs-luma-ray-3-2',
          label: 'Comparar Luma Ray 2 anterior y Luma Ray 3.2 actual',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas sobre Ray 2 estándar, borradores Flash y la ruta actual de Ray 3.2.',
        items: [
          {
            question: '¿Luma Ray 2 y Ray 2 Flash siguen disponibles?',
            answer:
              'Sí. Ambos modelos anteriores de Luma siguen disponibles en MaxVideoAI para flujos de texto, imagen, modificación de video y reencuadre.',
          },
          {
            question: '¿Quién debería quedarse en Luma Ray 2 en vez de usar Flash?',
            answer:
              'Quédate en Ray 2 cuando el flujo estándar anterior ya esté validado. Elige Flash cuando iterar borradores más rápido sea la prioridad clara.',
          },
          {
            question: '¿Cuándo debería migrar un usuario de Ray 2 a Luma Ray 3.2?',
            answer:
              'Pasa a Luma Ray 3.2 actual para proyectos nuevos que aprovechen la generación más reciente de Ray, y conserva Ray 2 para trabajos establecidos de modificación o reencuadre.',
          },
        ],
      },
    },
    'kling-3-4k-vs-kling-3-standard': {
      meta: {
        title: 'Kling 3 4K vs Standard: 4K nativo o menor precio',
        description:
          'Compara Kling 3 4K y Kling 3 Standard en finales 4K nativos, borradores 1080p de menor costo, audio, duración y etapa de producción.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Kling 3 4K con Kling 3 Standard dentro de la familia Kling actual. Ambos llegan a 15 segundos, admiten texto o imagen con audio y cubren 16:9, 9:16 y 1:1; la resolución y el costo base catalogado determinan si conviene un borrador 1080p o un final 4K nativo.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige Kling 3 Standard para borradores 1080p de menor costo y entregas HD aprobadas, con o sin audio. Elige Kling 3 4K solo cuando el concepto esté aprobado y la pieza final realmente requiera un máster nativo en 4K.',
      },
      topCards: [
        {
          title: 'Borradores con Kling 3 Standard',
          body:
            'Standard renderiza en 1080p y permite controlar el costo catalogado de los borradores antes de llevar una toma aprobada a resolución final.',
        },
        {
          title: 'Finales con Kling 3 4K',
          body:
            'La variante 4K está limitada a 4K nativo, por lo que encaja con másteres aprobados, pantallas grandes y recortes de alta resolución.',
        },
        {
          title: 'Base compartida de Kling 3',
          body:
            'Ambas variantes actuales admiten texto a video, imagen a video, audio opcional, clips de 15 segundos y las mismas tres proporciones principales.',
        },
        {
          title: 'La resolución define la decisión',
          body:
            'Según el catálogo, Standard mantiene la iteración en 1080p con un costo base de proveedor menor; la variante 4K solo produce 4K nativo y tiene un costo base mayor.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/kling-3-4k', label: 'Abrir la página de Kling 3 4K' },
        { href: '/models/kling-3-standard', label: 'Abrir la página de Kling 3 Standard' },
        {
          href: '/ai-video-engines/kling-3-4k-vs-kling-3-pro',
          label: 'Comparar Kling 3 4K y Kling 3 Pro',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas para planear borradores 1080p económicos y másteres aprobados en 4K nativo.',
        items: [
          {
            question: '¿Kling 3 4K siempre es mejor que Kling 3 Standard?',
            answer:
              'No. Kling 3 4K encaja mejor cuando se requiere 4K nativo. Standard es más económico según el costo catalogado para iterar y también sirve para entregas aprobadas en 1080p.',
          },
          {
            question: '¿Ambas variantes Kling 3 admiten audio y clips de 15 segundos?',
            answer:
              'Sí. Ambas admiten audio opcional, entrada de texto o imagen y clips de hasta 15 segundos en 16:9, 9:16 o 1:1.',
          },
          {
            question: '¿Cuál es el mejor flujo Kling para un máster de campaña en 4K?',
            answer:
              'Desarrolla y aprueba el concepto con Kling 3 Standard en 1080p para controlar el costo, y usa Kling 3 4K cuando la toma final seleccionada necesite entrega 4K nativa.',
          },
        ],
      },
    },
    'kling-2-5-turbo-vs-veo-3-1': {
      meta: {
        title: 'Kling 2.5 Turbo vs Veo 3.1: precio, audio y 4K',
        description:
          'Compara Kling 2.5 Turbo y Google Veo 3.1 en costo de borrador, audio, 4K, referencias y controles, y descubre cuándo migrar a Kling 3 Pro.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Kling 2.5 Turbo con Google Veo 3.1 para elegir entre una ruta anterior económica y silenciosa para borradores o una producción pulida con un modelo actual. Kling sigue disponible en MaxVideoAI para clips de hasta 10 segundos; Veo agrega audio, referencias, controles de fotogramas, extensión y 4K.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Quédate en Kling 2.5 Turbo, que sigue disponible, para borradores silenciosos económicos de hasta 10 segundos. Elige Google Veo 3.1 para producción pulida con audio, referencias, controles y 4K; migra los nuevos trabajos Kling Pro a Kling 3 Pro actual cuando la producción de 15 segundos sea prioritaria.',
      },
      topCards: [
        {
          title: 'Conservar Kling para borradores silenciosos',
          body:
            'Mantén Kling 2.5 Turbo cuando su flujo disponible de texto, imagen o imagen a imagen en 720p o 1080p cubra un concepto de bajo costo.',
        },
        {
          title: 'Elegir Veo para control de producción',
          body:
            'Veo agrega audio nativo, referencias, control de primer y último fotograma, extensión y resoluciones desde 720p hasta 4K.',
        },
        {
          title: 'Actualizar dentro de Kling',
          body:
            'Pasa a Kling 3 Pro actual cuando un proyecto Kling nuevo necesite audio, clips de hasta 15 segundos y la ruta Pro de producción vigente.',
        },
        {
          title: 'Diez segundos o ocho controlados',
          body:
            'Kling 2.5 Turbo llega a 10 segundos sin audio; Veo termina en ocho, pero aporta herramientas más amplias para controlar la salida final.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/kling-2-5-turbo', label: 'Abrir la página del Kling 2.5 Turbo disponible' },
        { href: '/models/veo-3-1', label: 'Abrir la página de Google Veo 3.1' },
        {
          href: '/ai-video-engines/kling-3-pro-vs-veo-3-1',
          label: 'Comparar Kling 3 Pro actual y Google Veo 3.1',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas sobre borradores con Kling 2.5 Turbo, producción con Veo y el sucesor actual de Kling.',
        items: [
          {
            question: '¿Kling 2.5 Turbo sigue disponible para generar?',
            answer:
              'Sí. Kling 2.5 Turbo sigue disponible para trabajos silenciosos desde texto, imagen o imagen a imagen de hasta 10 segundos en 720p o 1080p.',
          },
          {
            question: '¿Quién debería quedarse en Kling 2.5 Turbo en vez de usar Veo 3.1?',
            answer:
              'Quédate en Kling 2.5 Turbo para borradores silenciosos económicos cuando una resolución de 1080p sea suficiente y el trabajo no necesite audio, referencias ni 4K.',
          },
          {
            question: '¿Cuándo conviene actualizar Kling 2.5 Turbo a Kling 3 Pro?',
            answer:
              'Migra los proyectos nuevos de Kling a Kling 3 Pro actual cuando el audio, los clips de hasta 15 segundos o el flujo Pro más reciente importen más que el costo de los borradores con Kling 2.5 Turbo.',
          },
        ],
      },
    },
    'seedance-2-0-vs-veo-3-1-fast': {
      meta: {
        title: 'Seedance 2.0 vs Veo 3.1 Fast: control o velocidad',
        description:
          'Compara Seedance 2.0 y Google Veo 3.1 Fast en duración, referencias, edición, 4K, audio, velocidad de iteración y estructura de precios.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Seedance 2.0 con Google Veo 3.1 Fast para elegir entre un flujo de hasta 15 segundos con varias referencias y edición, y una ruta rápida de producción enfocada en ocho segundos. Ambos admiten audio y 4K, pero organizan sus controles y precios de manera distinta.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Elige Seedance 2.0 para proyectos de mayor duración que requieran varias referencias, edición de video, extensión, controles de movimiento o más proporciones. Elige Google Veo 3.1 Fast para iteraciones cortas y rápidas con control de primer y último fotograma y una escala de precio por resolución más simple.',
      },
      topCards: [
        {
          title: 'Seedance para mayor control',
          body:
            'Seedance llega a 15 segundos y combina referencias, edición de video, extensión, controles de movimiento, audio y resoluciones desde 480p hasta 4K.',
        },
        {
          title: 'Veo Fast para iterar rápido',
          body:
            'Veo Fast se enfoca en producción rápida de ocho segundos con audio, referencias, primer y último fotograma, extensión y hasta 4K.',
        },
        {
          title: 'Sistemas de precios diferentes',
          body:
            'Seedance usa precios dinámicos por tokens, mientras Veo Fast usa una escala por segundo basada en resolución; ninguno es siempre más económico.',
        },
        {
          title: 'Edición larga o toma rápida',
          body:
            'Seedance encaja con secuencias extendidas, editadas y ricas en referencias; Veo Fast sirve para anuncios cortos con opciones de resolución previsibles.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/seedance-2-0', label: 'Abrir la página de Seedance 2.0' },
        { href: '/models/veo-3-1-fast', label: 'Abrir la página de Google Veo 3.1 Fast' },
        {
          href: '/ai-video-engines/seedance-2-0-vs-veo-3-1',
          label: 'Comparar Seedance 2.0 y Google Veo 3.1',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas para elegir un flujo largo y controlado o una ruta corta de producción rápida.',
        items: [
          {
            question: '¿Qué modelo admite clips más largos, Seedance 2.0 o Veo 3.1 Fast?',
            answer:
              'Seedance 2.0 llega a 15 segundos, mientras Google Veo 3.1 Fast llega a ocho. Seedance encaja mejor cuando la duración de la toma define la decisión.',
          },
          {
            question: '¿Qué modelo ofrece más controles de edición de video?',
            answer:
              'Seedance 2.0 ofrece edición de video a video, extensión, referencias y controles de movimiento. Veo Fast ofrece referencias, control de primer y último fotograma y extensión en un flujo más enfocado.',
          },
          {
            question: '¿Seedance 2.0 cuesta menos que Veo 3.1 Fast?',
            answer:
              'No hay un ganador universal: Seedance usa precios dinámicos por tokens, mientras Veo Fast usa una escala por segundo que cambia según la resolución y la elección de audio.',
          },
        ],
      },
    },
    'luma-ray-2-vs-seedance-2-0-fast': {
      meta: {
        title: 'Luma Ray 2 vs Seedance 2.0 Fast: editar o migrar',
        description:
          'Compara Luma Ray 2 y Seedance 2.0 Fast para modificar y reencuadrar en 1080p o acceder a audio, referencias, edición y extensión con un modelo actual.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Luma Ray 2 con Seedance 2.0 Fast para elegir entre modificación y reencuadre 1080p con un modelo anterior disponible en MaxVideoAI o un flujo actual con audio. Luma llega a nueve segundos y 1080p; Seedance Fast llega a 15 segundos y 720p con referencias, edición y extensión.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Quédate en Luma Ray 2, que sigue disponible, para modificar o reencuadrar video fuente en 1080p sin audio. Elige Seedance 2.0 Fast para un flujo actual de hasta 720p con audio, referencias, edición y extensión; migra los proyectos nuevos de Luma a Luma Ray 3.2 actual cuando corresponda.',
      },
      topCards: [
        {
          title: 'Conservar Luma para reencuadre 1080p',
          body:
            'Mantén Ray 2 cuando su flujo disponible y silencioso de modificación y reencuadre, sus proporciones amplias y su límite 1080p ya encajen con el video fuente.',
        },
        {
          title: 'Seedance Fast para trabajar con audio',
          body:
            'Seedance Fast agrega audio, referencias de imagen y video, edición, extensión, controles de movimiento y clips de hasta 15 segundos en un máximo de 720p.',
        },
        {
          title: 'Resolución frente a amplitud del flujo',
          body:
            'Luma llega a 1080p, pero es silencioso; Seedance Fast termina en 720p y suma un conjunto más amplio de herramientas actuales de producción.',
        },
        {
          title: 'Migración a la generación actual de Luma',
          body:
            'Actualiza los proyectos nuevos de Luma a Luma Ray 3.2, la generación actual de Ray, y conserva Ray 2 para tareas establecidas de modificación o reencuadre.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/luma-ray-2', label: 'Abrir la página del Luma Ray 2 disponible' },
        { href: '/models/seedance-2-0-fast', label: 'Abrir la página de Seedance 2.0 Fast' },
        {
          href: '/ai-video-engines/seedance-2-0-fast-vs-veo-3-1-fast',
          label: 'Comparar Seedance 2.0 Fast y Google Veo 3.1 Fast',
        },
        { href: '/models/luma-ray-3-2', label: 'Abrir la página de Luma Ray 3.2 actual' },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas sobre edición con Luma Ray 2, producción con Seedance y la generación reciente de Ray.',
        items: [
          {
            question: '¿Luma Ray 2 sigue disponible para modificar y reencuadrar?',
            answer:
              'Sí. Luma Ray 2 sigue disponible para modificar y reencuadrar video fuente sin audio en resoluciones de hasta 1080p.',
          },
          {
            question: '¿Quién debería quedarse en Ray 2 en vez de usar Seedance 2.0 Fast?',
            answer:
              'Conserva Ray 2 cuando modificar o reencuadrar video fuente en 1080p sea la necesidad central. Elige Seedance Fast para audio, referencias, clips más largos, edición o extensión.',
          },
          {
            question: '¿Cuándo deberían migrar los usuarios de Luma a Luma Ray 3.2?',
            answer:
              'Migra los proyectos nuevos de Luma a Luma Ray 3.2 actual cuando encaje su flujo Ray más reciente, y mantén los trabajos validados de modificación y reencuadre en Ray 2.',
          },
        ],
      },
    },
    'kling-2-5-turbo-vs-wan-2-6': {
      meta: {
        title: 'Kling 2.5 Turbo vs Wan 2.6: precio, audio y migración',
        description:
          'Compara Kling 2.5 Turbo y Wan 2.6 en costo de borrador silencioso, audio, duración, resolución y referencias, y descubre cuándo migrar a Kling 3 Pro.',
        titleBranding: 'none',
      },
      heroIntro:
        'Compara Kling 2.5 Turbo con Wan 2.6 Text & Image to Video para elegir entre una ruta anterior económica y silenciosa, todavía disponible en MaxVideoAI, y un modelo actual con modos separados para texto, imagen y referencias. Wan llega a 15 segundos con audio opcional en texto o imagen; su modo separado con video de referencia dura 5 o 10 segundos y no tiene audio.',
      quickVerdict: {
        title: 'Veredicto rápido',
        body:
          'Quédate en Kling 2.5 Turbo para borradores silenciosos económicos de hasta 10 segundos. Elige Wan 2.6 para texto o imagen de hasta 15 segundos con audio opcional, o su modo separado con referencias de 5 o 10 segundos sin audio; migra los nuevos trabajos Kling Pro a Kling 3 Pro actual.',
      },
      topCards: [
        {
          title: 'Conservar Kling para borradores económicos',
          body:
            'Mantén Kling 2.5 Turbo cuando un concepto silencioso en 720p o 1080p desde texto, imagen o imagen a imagen sea todo lo que requiere el trabajo.',
        },
        {
          title: 'Wan actual para texto, imagen y referencias',
          body:
            'Wan 2.6 en modo texto o imagen llega a 15 segundos en 720p o 1080p con audio opcional; su modo separado y silencioso acepta entre uno y tres videos de referencia durante 5 o 10 segundos.',
        },
        {
          title: 'Migrar al sucesor de Kling',
          body:
            'Pasa los proyectos Kling Pro nuevos a Kling 3 Pro actual cuando el audio, el límite de 15 segundos o el flujo Kling más reciente justifiquen la actualización.',
        },
        {
          title: 'Valor silencioso o mayor control',
          body:
            'Kling 2.5 Turbo minimiza el costo de borradores silenciosos; Wan actual agrega texto o imagen de 15 segundos con audio y un modo separado de referencias de 5 o 10 segundos sin audio.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        { href: '/models/kling-2-5-turbo', label: 'Abrir la página del Kling 2.5 Turbo disponible' },
        { href: '/models/wan-2-6', label: 'Abrir la página de Wan 2.6' },
        {
          href: '/ai-video-engines/kling-3-pro-vs-wan-2-6',
          label: 'Comparar Kling 3 Pro actual y Wan 2.6',
        },
      ],
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Respuestas sobre borradores económicos con Kling 2.5 Turbo, los modos de Wan 2.6 y la migración a Kling 3 Pro.',
        items: [
          {
            question: '¿Todavía puedo usar Kling 2.5 Turbo en MaxVideoAI?',
            answer:
              'Sí. Kling 2.5 Turbo sigue disponible para clips silenciosos con este modelo anterior, de hasta 10 segundos en 720p o 1080p.',
          },
          {
            question: '¿Quién debería mantener Kling 2.5 Turbo en vez de pasar a Wan 2.6?',
            answer:
              'Quédate en Kling cuando basten borradores silenciosos económicos. Cambia a Wan para texto o imagen de hasta 15 segundos con audio opcional, o para el modo separado con referencias de 5 o 10 segundos sin audio.',
          },
          {
            question: '¿Cuándo conviene actualizar Kling 2.5 Turbo a Kling 3 Pro?',
            answer:
              'Migra los proyectos Kling nuevos a Kling 3 Pro actual cuando el flujo necesite audio, clips de hasta 15 segundos o la ruta Pro más reciente.',
          },
        ],
      },
    },
  } satisfies ComparePageOverridesBySlug;
