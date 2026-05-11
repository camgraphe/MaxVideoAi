import type { AppLocale } from '@/i18n/locales';
import type { ExampleFaqItem } from '@/lib/examples/modelLandingTypes';

const HUB_FAQ_BY_LOCALE: Record<AppLocale, { title: string; items: ExampleFaqItem[] }> = {
  en: {
    title: 'Examples FAQ',
    items: [
      {
        question: 'Can I clone these examples directly?',
        answer: 'Yes. Open an example and reuse its prompt and settings as a starting point in your workspace.',
      },
      {
        question: 'Do examples cover text-to-video AI, image-to-video AI, and video-to-video AI workflows?',
        answer: 'Yes. The gallery covers text-to-video AI, image-to-video AI, and selected video-to-video AI workflows when the underlying models support them.',
      },
      {
        question: 'Is pricing shown for each example?',
        answer: 'Pricing is shown per clip so you can compare cost before running similar renders.',
      },
      {
        question: 'Why can two runs differ with the same prompt?',
        answer: 'Model behavior can vary by mode, settings, and queue context, even with the same prompt.',
      },
      {
        question: 'Where can I compare model specs and limits?',
        answer: 'Use the models pages for specs/limits and the engine hub for use-case decision workflows.',
      },
      {
        question: 'How do I pick the right engine for this shot?',
        answer: 'Start from example quality and cost, then validate with a short test run on your target format.',
      },
    ],
  },
  fr: {
    title: 'FAQ Exemples',
    items: [
      {
        question: 'Puis-je cloner ces exemples directement ?',
        answer: 'Oui. Ouvrez un exemple, puis réutilisez son prompt et ses réglages dans votre studio.',
      },
      {
        question: 'Les exemples couvrent-ils les flux texte-vers-vidéo IA, image-vers-vidéo IA et vidéo-vers-vidéo IA ?',
        answer: 'Oui. La galerie couvre le texte-vers-vidéo IA, l’image-vers-vidéo IA et certains flux vidéo-vers-vidéo IA lorsque les modèles sous-jacents les prennent en charge.',
      },
      {
        question: 'Le prix est-il affiché pour chaque exemple ?',
        answer: 'Oui. Un prix par clip est affiché pour comparer les coûts avant de relancer.',
      },
      {
        question: 'Pourquoi un même prompt donne-t-il deux résultats différents ?',
        answer: 'Le résultat peut varier selon le mode, les réglages et le contexte de génération.',
      },
      {
        question: 'Où comparer les caractéristiques et limites des modèles ?',
        answer: 'Utilisez les pages Modèles pour les caractéristiques et limites, et la page Comparatifs pour choisir selon l’usage.',
      },
      {
        question: 'Comment choisir le bon modèle pour ce plan ?',
        answer: 'Partez du niveau qualité/coût observé dans les exemples, puis validez avec un test court au format cible.',
      },
    ],
  },
  es: {
    title: 'FAQ de ejemplos',
    items: [
      {
        question: '¿Puedo reutilizar estos ejemplos directamente?',
        answer: 'Sí. Abre un ejemplo y reutiliza su prompt y ajustes en tu espacio de trabajo.',
      },
      {
        question: '¿Los ejemplos incluyen flujos de texto a video, imagen a video y video a video?',
        answer: 'Sí. La galería cubre flujos de texto a video, imagen a video y algunos casos de video a video cuando los modelos subyacentes los admiten.',
      },
      {
        question: '¿Se muestra el precio por ejemplo?',
        answer: 'Sí. El precio por clip se muestra para comparar el precio antes de generar.',
      },
      {
        question: '¿Por qué dos resultados cambian con el mismo prompt?',
        answer: 'El resultado puede variar según el modo, los ajustes y el contexto de generación.',
      },
      {
        question: '¿Dónde comparo especificaciones y límites por modelo?',
        answer: 'Usa las fichas de modelo para ver especificaciones y límites, y la página comparativa para decidir según el objetivo.',
      },
      {
        question: '¿Cómo elijo el modelo correcto para esta toma?',
        answer: 'Compara calidad y precio en ejemplos y valida con una prueba corta en tu formato objetivo.',
      },
    ],
  },
};

export function getHubExamplesFaq(locale: AppLocale): { title: string; items: ExampleFaqItem[] } {
  return HUB_FAQ_BY_LOCALE[locale] ?? HUB_FAQ_BY_LOCALE.en;
}
