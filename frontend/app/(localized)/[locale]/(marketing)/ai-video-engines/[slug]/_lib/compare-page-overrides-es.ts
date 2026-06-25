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
  } satisfies ComparePageOverridesBySlug;
