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
            question: 'Es mejor Seedance 2.0 para una salida de video de Seedance mas pulida?',
            answer:
              'Si. Seedance 2.0 encaja mejor cuando el objetivo es una salida de video de Seedance mas pulida, mientras que Fast encaja mejor cuando el objetivo es probar ideas y comparar workflows rapidamente.',
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
