export const pricingOpeningCopy = {
  "en": {
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
