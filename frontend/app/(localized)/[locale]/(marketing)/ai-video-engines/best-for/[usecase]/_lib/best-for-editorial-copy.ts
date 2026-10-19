import type { AppLocale } from '@/i18n/locales';

export type LocalizedText = Record<AppLocale, string>;
export const text = (en: string, fr: string, es: string): LocalizedText => ({ en, fr, es });

export const EDITORIAL_COPY = {
  reviewed: text('Selection reviewed', 'Sélection revue le', 'Selección revisada el'),
  watch: text('Start with a scene.', 'Tout commence par une scène.', 'Todo empieza con una escena.'),
  watchNote: text('Real generations, different briefs. Open a clip to watch, then explore its prompt.', 'De vraies générations, des briefs différents. Ouvrez un clip, puis explorez son prompt.', 'Generaciones reales, con briefs distintos. Abre un clip y explora su prompt.'),
  play: text('Watch the scene', 'Voir la scène', 'Ver la escena'),
  prompt: text('See the prompt & create', 'Voir le prompt et créer', 'Ver el prompt y crear'),
  look: text('Look for', 'À observer', 'Fíjate en'),
  shortlist: text('Find your starting point.', 'Trouvez votre point de départ.', 'Encuentra tu punto de partida.'),
  shortlistNote: text('Our recommended starting order, with alternatives for different needs.', 'Notre ordre de départ conseillé, avec des alternatives selon vos besoins.', 'Nuestro orden inicial recomendado, con alternativas según tus necesidades.'),
  limitation: text('Keep in mind', 'À garder en tête', 'Ten en cuenta'),
  method: text('How we choose', 'Comment nous choisissons', 'Cómo elegimos'),
  methodNote: text('This is an editorial order for starting your tests, not a measured quality ranking. We consider the available inputs, duration, audio and output options for this task. The clips use different prompts and settings; a single result cannot establish which model is best. Check the full model details before you create.', 'Cette sélection éditoriale tient compte des entrées disponibles, de la durée, du son et des formats utiles pour ce projet. L’ordre propose un point de départ pour vos essais ; il ne mesure pas une supériorité de qualité. Les clips ont des prompts et des réglages différents : un seul résultat ne départage pas les modèles. Vérifiez la fiche du modèle avant de créer.', 'Esta selección editorial considera las entradas, duración, audio y formatos útiles para este proyecto. El orden propone por dónde empezar las pruebas; no mide una superioridad de calidad. Los clips tienen prompts y ajustes distintos: un resultado no decide qué modelo es mejor. Consulta la ficha del modelo antes de crear.'),
  createTitle: text('Your idea. Your way in.', 'Votre idée. À vous de jouer.', 'Tu idea. Tu forma de crear.'),
  create: text('Choose your own settings', 'Choisir mes réglages', 'Elegir mis ajustes'),
  createBody: text('Pick a model, add your prompt or reference, then check the quote.', 'Choisissez un modèle, ajoutez votre prompt ou votre référence, puis vérifiez le devis.', 'Elige un modelo, añade un prompt o referencia y revisa el presupuesto.'),
  studio: text('Shape it in Studio', 'Développer mon idée dans Studio', 'Dar forma a mi idea en Studio'),
  studioBody: text('Bring a rough idea. Develop the direction in conversation and approve the quote for each creation.', 'Partez d’une idée. Affinez la direction en conversation et validez le devis de chaque création.', 'Parte de una idea. Afina la dirección en una conversación y aprueba cada creación.'),
  assistant: text('Stay with your assistant', 'Rester avec mon assistant', 'Seguir con mi asistente'),
  assistantBody: text('Explore the MCP connections for your assistant, with setup and capabilities for each host.', 'Découvrez les connexions MCP, leur installation et les possibilités de chaque assistant.', 'Explora las conexiones MCP, su instalación y las opciones de cada asistente.'),
  costs: text('Studio assistance and media generation have separate costs. Always review the current generation quote.', 'L’assistance Studio et la génération de médias ont des coûts distincts. Vérifiez toujours le devis de génération.', 'La asistencia de Studio y la generación de medios tienen costes distintos. Revisa siempre el presupuesto.'),
  details: text('A few things worth checking', 'Quelques repères avant de créer', 'Antes de crear'),
  choose: text('Explore the models', 'Explorer les modèles', 'Explorar los modelos'),
  noVideo: text('Explore all public examples', 'Explorer les exemples publics', 'Explorar los ejemplos públicos'),
} as const;
