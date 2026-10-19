import { USECASE_GUIDANCE } from './best-for-usecase-guidance';
import type { AppLocale } from '@/i18n/locales';
import { text, type LocalizedText } from './best-for-editorial-copy';

type ModelGuidance = { tag: LocalizedText; reason: LocalizedText; limit: LocalizedText };
// Editorial interpretation of live model contracts, checked 2026-10-19.
// These are workflow differences, not measured quality or speed rankings.
export const MODEL_GUIDANCE: Record<string, ModelGuidance> = {
  'gemini-omni-flash': {
    tag: text("Revise a short scene", "Reprendre une scène courte", "Revisar una escena corta"),
    reason: text("Create 3–10 second scenes, guide them with images, or edit and extend a supplied clip, with output options up to 4K.", "Créez des scènes de 3 à 10 secondes, guidez-les avec des images ou retravaillez un clip source, avec des options jusqu’en 4K.", "Crea escenas de 3 a 10 segundos, guíalas con imágenes o edita y extiende un clip, con opciones hasta 4K."),
    limit: text("Availability is limited. MCP editing needs a supplied source; conversation-based retakes stay in the website workspace.", "La disponibilité est limitée. Une modification via MCP demande une vidéo source ; les reprises liées à la conversation restent dans l’espace de travail du site.", "La disponibilidad es limitada. La edición por MCP requiere un vídeo de origen; las revisiones ligadas a la conversación quedan en el espacio web."),
  },
  'luma-ray-3-2': {
    tag: text("Rework the image, then the frame", "Retravailler l’image et le cadrage", "Revisar la imagen y el encuadre"),
    reason: text("Animate an image or transform existing footage, then explore reframing for another composition. Text and image clips run 5 or 10 seconds.", "Animez une image ou transformez une vidéo existante, puis explorez le recadrage. Les clips créés depuis un texte ou une image durent 5 ou 10 secondes.", "Anima una imagen o transforma un vídeo y explora otro encuadre. Los clips desde texto o imagen duran 5 o 10 segundos."),
    limit: text("Ray 3.2 does not generate audio in these workflows. Plan sound separately; output goes up to 1080p.", "Ray 3.2 ne génère pas de son dans ces parcours. Prévoyez-le séparément ; la sortie va jusqu’au 1080p.", "Ray 3.2 no genera audio en estos flujos. Planifica el sonido por separado; la salida llega a 1080p."),
  },
  'flux-3': {
    tag: text("Plan where the scene lands", "Choisir où la scène arrive", "Elegir dónde termina la escena"),
    reason: text("Use a first and last frame to shape a transition, or extend an existing clip. Generate 5–20 seconds at 720p or 1080p with optional audio.", "Utilisez une première et une dernière image pour diriger une transition, ou prolongez un clip. Générez de 5 à 20 secondes en 720p ou 1080p, avec son optionnel.", "Usa un primer y último fotograma para dirigir una transición o extiende un clip. Genera de 5 a 20 segundos en 720p o 1080p con audio opcional."),
    limit: text("Frame control is different from a mixed-reference workflow. This model does not offer a separate reference-to-video mode.", "Le contrôle des images de début et de fin diffère des références mixtes. Ce modèle ne propose pas de mode distinct de références vers vidéo.", "El control de fotogramas no es un flujo de referencias mixtas. Este modelo no ofrece un modo independiente de referencias a vídeo."),
  },
  'flux-3-draft': {
    tag: text("Sketch a transition at 720p", "Esquisser une transition en 720p", "Esbozar una transición en 720p"),
    reason: text("Test the opening, ending and timing of a 5–20 second scene at 720p, with optional audio and clip extension.", "Testez le début, la fin et le rythme d’une scène de 5 à 20 secondes en 720p, avec son optionnel et possibilité d’extension.", "Prueba el inicio, el final y el ritmo de una escena de 5 a 20 segundos en 720p, con audio opcional y extensión."),
    limit: text("Draft output is limited to 720p. It is not an automatic preview of what another model will produce.", "La sortie Draft est limitée au 720p. Elle ne prédit pas automatiquement le résultat d’un autre modèle.", "La salida Draft está limitada a 720p. No predice automáticamente lo que producirá otro modelo."),
  },
  'kling-o3-4k': {
    tag: text("Take references into 4K", "Passer des références à la 4K", "Llevar las referencias a 4K"),
    reason: text("Generate 3–15 second 4K clips from text, an opening image or image references, with optional audio.", "Générez des clips 4K de 3 à 15 secondes depuis un texte, une image de départ ou des références image, avec son optionnel.", "Genera clips 4K de 3 a 15 segundos desde texto, una imagen inicial o referencias visuales, con audio opcional."),
    limit: text("Omni 4K is a separate variant from Kling 3 4K. Its output size does not prove better animation or character consistency.", "Omni 4K est une variante distincte de Kling 3 4K. La taille de sortie ne prouve pas une meilleure animation ni une meilleure cohérence des personnages.", "Omni 4K es una variante distinta de Kling 3 4K. El tamaño de salida no demuestra mejor animación ni coherencia de personajes."),
  },
  'veo-3-1-lite': {
    tag: text("Try a short, bounded scene", "Tester une scène courte", "Probar una escena corta"),
    reason: text("Choose 4, 6 or 8 seconds from text or an image, with 720p or 1080p output and optional audio. First-and-last-frame control is also available.", "Choisissez 4, 6 ou 8 secondes depuis un texte ou une image, en 720p ou 1080p avec son optionnel. Le contrôle des images de début et de fin est aussi disponible.", "Elige 4, 6 u 8 segundos desde texto o imagen, en 720p o 1080p con audio opcional. También puedes controlar el primer y último fotograma."),
    limit: text("Lite has no reference-to-video mode and no 4K option. Compare current quotes at the same settings before choosing on price.", "Lite ne propose ni mode références vers vidéo ni 4K. Comparez les devis avec les mêmes réglages avant de choisir sur le prix.", "Lite no ofrece referencias a vídeo ni 4K. Compara presupuestos con los mismos ajustes antes de elegir por precio."),
  },
  'kling-3-turbo-standard': {
    tag: text("A compact scene with sound", "Une scène compacte avec son", "Una escena compacta con sonido"),
    reason: text("Explore a 3–15 second scene from text or an image at 720p, with sound generated alongside the picture.", "Explorez une scène de 3 à 15 secondes depuis un texte ou une image en 720p, avec du son généré avec l’image.", "Explora una escena de 3 a 15 segundos desde texto o imagen en 720p, con sonido generado junto a la imagen."),
    limit: text("Availability is limited and audio is generated automatically. Turbo is a variant name, not a measured turnaround guarantee.", "La disponibilité est limitée et le son est généré automatiquement. Turbo désigne une variante, sans garantir un délai mesuré.", "La disponibilidad es limitada y el audio se genera automáticamente. Turbo es el nombre de la variante, no una garantía de tiempo medido."),
  },
  'seedance-2-5': {
    tag: text('Room for a longer scene', 'De la place pour raconter', 'Espacio para una escena más larga'),
    reason: text('Build a scene up to 30 seconds, starting with text, an image or a mix of visual and audio references.', 'Construisez une scène jusqu’à 30 secondes à partir de texte, d’une image ou de références visuelles et sonores.', 'Construye una escena de hasta 30 segundos desde texto, una imagen o referencias visuales y sonoras.'),
    limit: text('Output goes up to 1080p. References guide the result; they do not guarantee an identical face or object.', 'La sortie va jusqu’au 1080p. Les références guident le résultat sans garantir un visage ou un objet identique.', 'La salida llega a 1080p. Las referencias guían el resultado sin garantizar caras u objetos idénticos.'),
  },
  'minimax-h3': {
    tag: text('Create for a larger screen', 'Créer pour le grand écran', 'Crear para una pantalla grande'),
    reason: text('Generate 5–15 second clips with audio, with output options up to 4K and support for image, video and audio references.', 'Générez des clips de 5 à 15 secondes avec son, jusqu’en 4K, avec des références image, vidéo et audio.', 'Genera clips de 5 a 15 segundos con audio, hasta 4K, con referencias de imagen, vídeo y audio.'),
    limit: text('Audio is generated with the clip. 4K describes output size, not a guarantee of better motion.', 'Le son est généré avec le clip. La 4K décrit la taille de sortie, pas une garantie de meilleurs mouvements.', 'El audio se genera con el clip. 4K describe el tamaño de salida, no garantiza un movimiento mejor.'),
  },
  'minimax-h3-max': {
    tag: text('A short scene with sound', 'Une scène courte avec du son', 'Una escena corta con sonido'),
    reason: text('Work with 5–15 second scenes and mixed references, with audio generated alongside the picture.', 'Travaillez des scènes de 5 à 15 secondes et des références variées, avec le son généré en même temps que l’image.', 'Trabaja escenas de 5 a 15 segundos y referencias mixtas, con audio generado junto a la imagen.'),
    limit: text('H3 Max stops at 1080p. Choose H3 if you need a 4K output option.', 'H3 Max s’arrête au 1080p. Choisissez H3 si vous avez besoin d’une sortie 4K.', 'H3 Max llega a 1080p. Elige H3 si necesitas la opción de salida 4K.'),
  },
  'grok-imagine-video-1-5': {
    tag: text('Start from a single image', 'Partir d’une image', 'Partir de una imagen'),
    reason: text('Animate an opening image with generated audio, or explore a scene from text. Both routes offer output up to 1080p.', 'Animez une image de départ avec du son, ou explorez une scène à partir de texte. Les deux parcours vont jusqu’au 1080p.', 'Anima una imagen inicial con audio o explora una escena desde texto. Ambas opciones llegan a 1080p.'),
    limit: text('The separate reference-to-video mode is limited to 720p. Check the mode, not just the model name.', 'Le mode distinct de références vers vidéo est limité au 720p. Vérifiez le mode, pas seulement le nom du modèle.', 'El modo de referencias a vídeo tiene un límite de 720p. Comprueba el modo además del modelo.'),
  },
  'wan-3-prime': {
    tag: text('Direct the beginning and end', 'Diriger le début et la fin', 'Dirigir el inicio y el final'),
    reason: text('Use opening and ending frames, mix references or extend a clip, with generation lengths up to 30 seconds.', 'Utilisez des images de début et de fin, combinez les références ou prolongez un clip, jusqu’à 30 secondes de génération.', 'Usa fotogramas iniciales y finales, combina referencias o extiende un clip, con generaciones de hasta 30 segundos.'),
    limit: text('For video input and extension, source plus generated duration must fit within the 30-second limit.', 'Avec une vidéo source ou une extension, la durée source et la durée générée doivent tenir dans la limite de 30 secondes.', 'Con vídeo de entrada o extensión, la duración de origen más la generada debe caber en el límite de 30 segundos.'),
  },
  'wan-3': {
    tag: text('Build on an existing scene', 'Construire à partir d’une scène', 'Continuar una escena existente'),
    reason: text('Start with text or an image, guide the scene with references, or continue an existing clip. Audio is optional.', 'Partez d’un texte ou d’une image, guidez la scène par des références ou prolongez un clip. Le son est optionnel.', 'Parte de texto o una imagen, guía la escena con referencias o continúa un clip. El audio es opcional.'),
    limit: text('The 30-second limit includes the source when transforming or extending video. Output goes up to 1080p.', 'La limite de 30 secondes inclut la source pour transformer ou prolonger une vidéo. La sortie va jusqu’au 1080p.', 'El límite de 30 segundos incluye el original al transformar o extender vídeo. La salida llega a 1080p.'),
  },
  'kling-o3-pro': {
    tag: text('Give references a clear role', 'Donner un rôle aux références', 'Dar un papel claro a las referencias'),
    reason: text('A 1080p option for image-led scenes, reference-guided work and video transformation. Plan what each reference should control.', 'Une option 1080p pour animer une image, guider une scène par des références ou transformer une vidéo. Précisez le rôle de chaque référence.', 'Una opción 1080p para animar imágenes, guiar escenas con referencias o transformar vídeo. Define el papel de cada referencia.'),
    limit: text('Inputs and audio behavior differ between modes. A storyboard is direction, not a promise that every cut will match.', 'Les entrées et le comportement du son changent selon le mode. Un storyboard donne une direction sans garantir chaque raccord.', 'Las entradas y el audio cambian según el modo. Un storyboard orienta, pero no garantiza cada corte.'),
  },
  'veo-3-1': {
    tag: text('Picture, sound and final frames', 'Image, son et image de fin', 'Imagen, sonido y fotograma final'),
    reason: text('Explore text, image and reference workflows, including first-and-last-frame control and 4K output options.', 'Explorez les parcours texte, image et références, avec contrôle des images de début et de fin et des options de sortie 4K.', 'Explora flujos de texto, imagen y referencias, con control del primer y último fotograma y opciones 4K.'),
    limit: text('Duration and resolution choices depend on the mode. Check the exact combination before quoting a scene.', 'Les choix de durée et de résolution dépendent du mode. Vérifiez la combinaison avant de préparer le devis.', 'Las opciones de duración y resolución dependen del modo. Comprueba la combinación antes del presupuesto.'),
  },
  'veo-3-1-fast': {
    tag: text('Try the Fast route', 'Explorer la variante Fast', 'Probar la variante Fast'),
    reason: text('The Fast variant offers text, image and reference workflows, with its own quote and resolution options up to 4K.', 'La variante Fast propose des parcours texte, image et références, avec son propre devis et des options jusqu’en 4K.', 'La variante Fast ofrece texto, imagen y referencias, con su propio presupuesto y opciones hasta 4K.'),
    limit: text('Compare the same settings against Veo 3.1. The variant name alone does not establish latency or final cost.', 'Comparez les mêmes réglages avec Veo 3.1. Le nom de la variante ne suffit pas à établir le délai ou le prix final.', 'Compara los mismos ajustes con Veo 3.1. El nombre de la variante no determina el tiempo ni el coste final.'),
  },
  'kling-3-4k': {
    tag: text('A dedicated 4K option', 'Une option dédiée à la 4K', 'Una opción dedicada a 4K'),
    reason: text('Create a 4K clip from text or an opening image, with optional audio. Useful when delivery size is a requirement.', 'Créez un clip 4K à partir d’un texte ou d’une image, avec son optionnel. Utile lorsque la taille de livraison est imposée.', 'Crea un clip 4K desde texto o una imagen inicial, con audio opcional. Útil si la entrega exige ese tamaño.'),
    limit: text('This variant has text and image modes. Do not assume the reference controls of other Kling models are included.', 'Cette variante propose les modes texte et image. Les contrôles de référence des autres Kling ne sont pas automatiquement inclus.', 'Esta variante ofrece modos de texto e imagen. No presupongas los controles de referencia de otros modelos Kling.'),
  },
  'seedance-2-0': {
    tag: text('References with 4K options', 'Références et options 4K', 'Referencias con opciones 4K'),
    reason: text('Work from text, images or mixed references, transform or extend a clip, with output options up to 4K.', 'Travaillez depuis un texte, des images ou des références mixtes, transformez ou prolongez un clip, avec des options jusqu’en 4K.', 'Trabaja desde texto, imágenes o referencias mixtas, transforma o extiende un clip, con opciones hasta 4K.'),
    limit: text('Seedance versions have different contracts: the 4K option here does not mean Seedance 2.5 has it.', 'Les versions de Seedance ont des possibilités différentes : cette option 4K n’implique pas sa présence sur Seedance 2.5.', 'Las versiones de Seedance tienen opciones distintas: la opción 4K aquí no implica que Seedance 2.5 la tenga.'),
  },
  'seedance-2-0-fast': {
    tag: text('Develop a direction at 720p', 'Développer une direction en 720p', 'Desarrollar una dirección en 720p'),
    reason: text('Explore text, image and reference ideas at 480p or 720p before committing to a final delivery workflow.', 'Explorez des idées depuis un texte, une image ou des références en 480p ou 720p, avant de choisir le parcours de livraison.', 'Explora ideas desde texto, imagen o referencias en 480p o 720p antes de elegir el flujo de entrega.'),
    limit: text('This Fast variant does not offer 1080p or 4K. A later generation with another model must be reviewed separately.', 'Cette variante Fast ne propose ni 1080p ni 4K. Une génération avec un autre modèle doit être évaluée séparément.', 'Esta variante Fast no ofrece 1080p ni 4K. Una generación posterior con otro modelo debe revisarse por separado.'),
  },
  'happy-horse-1-1': {
    tag: text('Bring sound into the scene', 'Faire entrer le son dans la scène', 'Dar sonido a la escena'),
    reason: text('Create from text, an image or references with audio generated alongside the video, up to 1080p.', 'Créez depuis un texte, une image ou des références, avec son généré avec la vidéo, jusqu’au 1080p.', 'Crea desde texto, imagen o referencias con audio generado junto al vídeo, hasta 1080p.'),
    limit: text('Generated audio still needs listening checks. For dialogue, review the exact words and mouth timing.', 'Le son généré demande une écoute attentive. Pour un dialogue, vérifiez les mots prononcés et la synchronisation.', 'El audio generado necesita una revisión. En diálogos, comprueba las palabras y la sincronización de la boca.'),
  },
  'ltx-2-5-pro': {
    tag: text('Build around an audio track', 'Construire autour d’une piste son', 'Crear alrededor de una pista de audio'),
    reason: text('Use text or an image, or choose audio-to-video with an owned audio file to guide a 1080p scene.', 'Utilisez un texte ou une image, ou choisissez l’audio vers vidéo avec votre fichier son pour guider une scène 1080p.', 'Usa texto o imagen, o elige audio a vídeo con un archivo propio para guiar una escena 1080p.'),
    limit: text('Audio-to-video requires an audio input. Text and image modes have a different set of available settings.', 'L’audio vers vidéo exige un fichier son. Les modes texte et image proposent d’autres réglages.', 'Audio a vídeo requiere una entrada de audio. Los modos de texto e imagen tienen otros ajustes disponibles.'),
  },
  'ltx-2-5-fast': {
    tag: text('Test the movement first', 'Tester le mouvement d’abord', 'Probar primero el movimiento'),
    reason: text('Explore text or image-led motion, or use your own audio with audio-to-video. Start with one action you can judge clearly.', 'Explorez le mouvement depuis un texte ou une image, ou utilisez votre propre son en audio vers vidéo. Commencez par une action facile à évaluer.', 'Explora movimiento desde texto o imagen, o usa tu audio con audio a vídeo. Empieza con una acción fácil de evaluar.'),
    limit: text('Available duration changes with resolution. Check the exact quote; do not infer cost from the Fast label.', 'La durée disponible varie avec la résolution. Vérifiez le devis exact sans déduire le coût du nom Fast.', 'La duración disponible cambia con la resolución. Revisa el presupuesto sin deducir el coste del nombre Fast.'),
  },
  'kling-3-standard': {
    tag: text('Keep the first test focused', 'Garder un premier test simple', 'Centrar la primera prueba'),
    reason: text('Create a 1080p clip from text or an opening image, with optional audio. A focused scene makes revisions easier to judge.', 'Créez un clip 1080p depuis un texte ou une image, avec son optionnel. Une scène ciblée facilite l’évaluation des variantes.', 'Crea un clip 1080p desde texto o una imagen, con audio opcional. Una escena concreta facilita evaluar las variantes.'),
    limit: text('Standard is a distinct variant. Do not assume it has the multimodal reference workflow of Kling O3 Pro.', 'Standard est une variante distincte. Elle ne reprend pas automatiquement le parcours de références multimodales de Kling O3 Pro.', 'Standard es una variante distinta. No presupongas el flujo de referencias multimodales de Kling O3 Pro.'),
  },
};

export function getModelGuidance(slug: string, locale: AppLocale, usecase?: string) {
  const value = MODEL_GUIDANCE[slug];
  if (!value) return null;
  const candidate = usecase ? USECASE_GUIDANCE[usecase] : undefined;
  const task = candidate?.model === slug ? candidate : undefined;
  return { tag: (task?.tag ?? value.tag)[locale], reason: (task?.reason ?? value.reason)[locale], limit: value.limit[locale] };
}
