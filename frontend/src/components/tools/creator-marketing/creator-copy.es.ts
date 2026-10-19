import type { CreatorMarketingDictionary, CreatorMarketingLabels } from './creator-copy-types';

export const esLabels: CreatorMarketingLabels = {
  home: 'Inicio', tools: 'Todas las herramientas', eyebrow: 'Herramientas para tu próxima creación',
  open: 'Abrir la herramienta', how: 'Cómo funciona',
  inputs: '01 / Sube', settings: '02 / Personaliza', result: '03 / Descarga',
  workflow: 'Crea en tres pasos.', limits: 'Para un mejor resultado.', faq: 'Respuestas a tus preguntas.',
  quoteTitle: 'Ve el precio. Tú decides.',
  quoteBody: 'Añade tus archivos y elige los ajustes. Verás el precio exacto antes de confirmar.',
  related: '¿Qué vas a crear después?',
  illustration: 'Dirección artística · imagen de presentación — no es un resultado de la herramienta',
  preview: 'Próximamente', demo: 'Explorar la vista previa',
  photo: 'Foto', video: 'Vídeo', voice: 'Voz', character: 'Personaje', performance: 'Movimiento',
  source: 'Punto de partida', after: 'Dirección creativa',
  caption: 'Prueba con tus propias palabras', sample: 'Cada palabra, a tu ritmo.',
  style: 'Estilo de subtítulos', styles: ['Sencillo', 'Palabra resaltada', 'Alto contraste'],
  scene: 'Escenario', scenes: ['Estudio', 'En contexto', 'Luz'],
  compare: 'Comparar los dos escenarios', sequence: 'Movimiento que seguir',
  next: 'Dale forma a tu idea.', operation: 'Subtitula. Ponle voz. Cambia el escenario. Anima.',
};

export const esCopy: CreatorMarketingDictionary = {
  subtitles: {
    name: 'Subtítulos de vídeo',
    title: 'Subtitula tu vídeo. Cada palabra, a tu ritmo.',
    description: 'Añade subtítulos a tu vídeo: corrige el texto, ajusta los tiempos y el estilo, y descarga un SRT, un VTT o un MP4 subtitulado.',
    intro: 'Sube tu vídeo. Corrige las palabras, ajusta cuándo aparecen y elige su estilo. Exporta los subtítulos como texto o integrados en la imagen.',
    input: 'Un vídeo con voz o un archivo de audio.',
    adjustment: 'El texto, los tiempos, el tamaño, el estilo y la posición.',
    output: 'Un archivo SRT o VTT, o tu vídeo subtitulado en MP4.',
    steps: [
      'Sube tu vídeo o audio y elige el idioma.',
      'Revisa los subtítulos, ajusta los tiempos y personaliza su apariencia.',
      'Descarga el texto en SRT o VTT, o exporta el vídeo subtitulado.',
    ],
    limits: [
      'Añade nombres propios y términos especializados antes de transcribir para ayudar a reconocerlos. Revísalos antes de exportar.',
      'Con un archivo de audio puedes descargar subtítulos en SRT o VTT. El MP4 subtitulado necesita un vídeo.',
    ],
    questions: [
      { question: '¿Puedo editar los subtítulos después de transcribir?', answer: 'Sí. Cambia el texto, los tiempos y el estilo sin volver a transcribir. Después de reescribir una frase, comprueba que siga el ritmo de la voz.' },
      { question: '¿Qué formato me conviene?', answer: 'SRT y VTT permiten añadir subtítulos en un reproductor o editor de vídeo. El MP4 los integra directamente en la imagen; esta exportación tiene su propio precio, que confirmas después de editar.' },
    ],
  },
  'lip-sync': {
    name: 'Lip Sync',
    title: 'Haz hablar a un retrato. O dale otra voz a un vídeo.',
    description: 'Anima un retrato con tu voz o sincroniza los labios de un vídeo con un nuevo audio. Elige el modo Foto o Vídeo y añade tu grabación.',
    intro: 'Un rostro, una voz, un nuevo diálogo. Añade tu grabación a un retrato o a un vídeo y sincroniza los labios con las palabras.',
    input: 'Un retrato o un vídeo de un rostro, junto con una grabación de voz.',
    adjustment: 'El modo Foto o Vídeo y el fragmento de audio que quieres usar.',
    output: 'Un vídeo que habla con la voz que has elegido.',
    steps: [
      'Elige Foto para un retrato o Vídeo para un rostro ya en movimiento.',
      'Añade tu grabación de voz y selecciona el fragmento que quieres hacer pronunciar.',
      'Confirma el precio y después mira y escucha el nuevo vídeo.',
    ],
    limits: [
      'Elige un rostro bien visible y una grabación de voz clara. Revisa los labios y los rasgos en el vídeo final.',
      'En modo Vídeo, selecciona fragmentos de audio y vídeo de igual duración. La herramienta no los repite ni acelera para hacerlos coincidir.',
    ],
    questions: [
      { question: '¿Qué diferencia hay entre Foto y Vídeo?', answer: 'Foto anima un retrato fijo para hacerlo hablar. Vídeo adapta los labios de un rostro grabado a tu nuevo audio.' },
      { question: '¿Puedo usar una voz generada?', answer: 'Sí. Selecciona un audio de tu cuenta o sube tu grabación. Eliges la voz antes de empezar la creación.' },
    ],
  },
  'product-photo-editor': {
    name: 'Editor de fotos de producto',
    title: 'Tu producto. Otro escenario.',
    description: 'Cambia el escenario o la luz de tu foto de producto. Elige un fondo de estudio, una escena cotidiana o una iluminación diferente.',
    intro: 'Un fondo de estudio, una escena al aire libre, una luz más intensa. Parte de tu foto de producto y describe la imagen que quieres crear.',
    input: 'Tu foto de producto, con una imagen de ambiente opcional.',
    adjustment: 'El escenario, la luz, el formato y los detalles que quieres conservar.',
    output: 'Una nueva foto para comparar y descargar.',
    steps: [
      'Sube una foto donde se vean bien el producto y sus detalles.',
      'Elige el tipo de retoque y describe el escenario que tienes en mente.',
      'Compara la nueva imagen con tu foto y descárgala.',
    ],
    limits: [
      'Describe los detalles importantes: forma del frasco, color, material. Revisa los logotipos y el texto de la imagen final.',
      'Otra luz o perspectiva puede cambiar el aspecto del producto. Empieza con un cambio concreto para valorar mejor el resultado.',
    ],
    questions: [
      { question: '¿El logotipo y la etiqueta quedan idénticos?', answer: 'La edición con IA puede cambiar pequeños detalles o texto. Indica qué quieres conservar y revisa las letras a tamaño completo antes de usar la imagen.' },
      { question: '¿Puedo animar la foto después?', answer: 'Sí. Guarda la imagen y selecciónala en una herramienta de vídeo compatible. La creación del vídeo tiene su propio precio, que confirmas por separado.' },
    ],
  },
  'product-video-editor': {
    name: 'Editor de vídeos de producto',
    title: 'Cambia el escenario. Parte del plano que ya tienes.',
    description: 'Retoca un plano de vídeo de producto: elige un fragmento, describe otro escenario, luz o estilo visual y compara ambos vídeos.',
    intro: 'Tu producto ya está grabado. Selecciona un fragmento y pide un nuevo escenario, otra iluminación o un estilo visual diferente.',
    input: 'Un vídeo de producto corto, con un único plano continuo.',
    adjustment: 'El fragmento, el ambiente y si quieres conservar o quitar el sonido.',
    output: 'Un nuevo vídeo para comparar con tu plano original.',
    steps: [
      'Sube tu vídeo y selecciona el fragmento que quieres retocar.',
      'Describe el cambio de escenario, luz o estilo.',
      'Compara los dos vídeos en paralelo y descarga el resultado.',
    ],
    limits: [
      'Utiliza un plano continuo. Los cortes, las manos que tapan el producto o el movimiento rápido pueden dificultar el retoque.',
      'Mira el resultado completo: el texto, la forma del producto y el movimiento de cámara pueden cambiar con el retoque.',
    ],
    questions: [
      { question: '¿Puedo retocar un anuncio entero?', answer: 'La herramienta trabaja con un plano continuo. Para un anuncio con varios planos, retoca cada fragmento por separado y monta los vídeos en Studio.' },
      { question: '¿Puedo conservar el sonido de mi vídeo?', answer: 'Sí. Elige conservar el audio original o silenciarlo. Escucha el resultado antes de añadirlo a tu montaje.' },
    ],
  },
  'motion-transfer': {
    name: 'Motion Transfer',
    title: 'Dale movimiento a tu personaje.',
    description: 'Anima una imagen de personaje a partir de un movimiento grabado. Elige tu personaje, un fragmento de vídeo y el método de guía.',
    intro: 'Una pose, un paso de baile, un gesto. Combina la imagen de tu personaje con un vídeo de movimiento para crear una nueva animación.',
    input: 'Una imagen de personaje y un vídeo del movimiento que quieres seguir.',
    adjustment: 'El fragmento, el método, la orientación y el sonido.',
    output: 'Un vídeo de tu personaje inspirado en el movimiento elegido.',
    steps: [
      'Elige una imagen donde se vean bien el personaje y su pose.',
      'Añade el vídeo de movimiento y selecciona el fragmento que quieres seguir.',
      'Elige el método, confirma el precio y mira cómo se mueve tu personaje.',
    ],
    limits: [
      'Elige un vídeo donde el cuerpo permanezca visible. Los gestos ocultos y los movimientos muy rápidos son más difíciles de seguir.',
      'Revisa el rostro, las manos y los objetos que sostiene. El aspecto del personaje y los gestos pueden variar en el vídeo final.',
    ],
    questions: [
      { question: '¿En qué se diferencian los dos métodos?', answer: 'Control de movimiento utiliza un método dedicado a los gestos del personaje. Inspiración en vídeo utiliza el clip como referencia general. Los dos métodos no reproducen el movimiento de la misma manera.' },
      { question: '¿Puedo usar un personaje de Character Builder?', answer: 'Sí. Selecciona una imagen guardada en Medios. Si tienes una hoja con varias vistas, elige primero la imagen concreta que quieres animar.' },
    ],
  },
};
