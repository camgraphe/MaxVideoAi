export const pricingOpeningCopy = {
  "en": {
    filmLabel: "Cost to recreate this clip",
    filmSpecs: "Text to video · 15 s · 1080p · audio on",
    watch: "Watch the example",
    filmAlt: "A runner at night, between a wet crossing and the neon reflections on the pavement.",
    budgetTitle: "What would one minute cost?",
    "question": "How much does a 10-second video cost?",
    "format": "Text to video · 1080p",
    "model": "Model",
    "silent": "Without audio",
    "audio": "With audio",
    "unit": "USD per video",
    "openQuote": "Check a quote with these settings",
    "checked": "Prices checked",
    "full": "Full video price list",
    "nav": "Video, image, audio and tool prices",
    "fallback": "Check the current quote in the app.",
    "tools": "Tools",
    "cite": "Cite these prices",
    "source": "Pricing table"
  },
  "fr": {
    filmLabel: "Prix pour recréer ce clip",
    filmSpecs: "Texte vers vidéo · 15 s · 1080p · avec son",
    watch: "Voir l’exemple",
    filmAlt: "Un coureur de nuit entre un passage piéton mouillé et les reflets des néons sur la chaussée.",
    budgetTitle: "Quel budget pour une minute ?",
    "question": "Combien coûte une vidéo de 10 secondes ?",
    "format": "Du texte à la vidéo · 1080p",
    "model": "Modèle",
    "silent": "Sans audio",
    "audio": "Avec audio",
    "unit": "USD par vidéo",
    "openQuote": "Voir le devis avec ces réglages",
    "checked": "Tarifs vérifiés le",
    "full": "Tous les tarifs vidéo",
    "nav": "Tarifs vidéo, image, audio et outils",
    "fallback": "Vérifiez le devis dans l’app.",
    "tools": "Outils",
    "cite": "Citer ces tarifs",
    "source": "Grille tarifaire"
  },
  "es": {
    filmLabel: "Precio para recrear este clip",
    filmSpecs: "Texto a vídeo · 15 s · 1080p · con audio",
    watch: "Ver el ejemplo",
    filmAlt: "Un corredor de noche entre un paso de peatones mojado y los reflejos de neón en el asfalto.",
    budgetTitle: "¿Cuánto cuesta un minuto?",
    "question": "¿Cuánto cuesta un vídeo de 10 segundos?",
    "format": "De texto a vídeo · 1080p",
    "model": "Modelo",
    "silent": "Sin audio",
    "audio": "Con audio",
    "unit": "USD por vídeo",
    "openQuote": "Ver el presupuesto con estos ajustes",
    "checked": "Precios consultados el",
    "full": "Todos los precios de vídeo",
    "nav": "Precios de vídeo, imagen, audio y herramientas",
    "fallback": "Consulta el presupuesto en la app.",
    "tools": "Herramientas",
    "cite": "Citar estos precios",
    "source": "Tabla de precios"
  }
} as const;

export const pricingCitation = {
  en: (model: string, silent: string, audio: string, date: string) =>
    `On ${date}, MaxVideoAI quoted ${silent} without audio and ${audio} with audio for one 10-second, 1080p text-to-video generation with ${model} (USD).`,
  fr: (model: string, silent: string, audio: string, date: string) =>
    `Le ${date}, sur MaxVideoAI, générer une vidéo de 10 secondes en 1080p à partir d’un texte avec ${model} coûtait ${silent} sans audio et ${audio} avec audio.`,
  es: (model: string, silent: string, audio: string, date: string) =>
    `El ${date}, generar en MaxVideoAI un vídeo de 10 segundos en 1080p a partir de texto con ${model} costaba ${silent} sin audio y ${audio} con audio.`,
};

export const pricingMinuteEstimate = {
  en: (engine: string, silent: string, audio: string) =>
    `For six 10-second clips at 1080p with ${engine}, budget ${silent} without audio or ${audio} with audio (USD). This covers one generation per shot and excludes additional takes and post-production.`,
  fr: (engine: string, silent: string, audio: string) =>
    `Pour six plans de 10 secondes en 1080p avec ${engine}, comptez ${silent} sans audio ou ${audio} avec audio. Ce calcul prévoit une génération par plan. Les nouveaux essais et la postproduction sont exclus.`,
  es: (engine: string, silent: string, audio: string) =>
    `Para seis clips de 10 segundos en 1080p con ${engine}, calcula ${silent} sin audio o ${audio} con audio. El cálculo incluye una generación por plano. No incluye tomas adicionales ni posproducción.`,
};
