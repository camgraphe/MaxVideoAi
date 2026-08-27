import mcpPublication from '@/config/mcp-publication.json';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { getMcpPublicationState } from '@/lib/mcp-publication';

export type McpInternalLinkPlacement =
  | 'home'
  | 'footer'
  | 'payg'
  | 'models'
  | 'model'
  | 'comparison'
  | 'examples'
  | 'docs';

type McpPublicationInputs = Parameters<typeof getMcpPublicationState>[0];

const LABELS: Record<AppLocale, Record<McpInternalLinkPlacement, string>> = {
  en: {
    home: 'Use MaxVideoAI with ChatGPT or Claude',
    footer: 'MaxVideoAI for ChatGPT & Claude',
    payg: 'Plan a video budget in ChatGPT or Claude',
    models: 'Compare models from an agent-assisted brief',
    model: 'Ask ChatGPT or Claude to budget this model in your film',
    comparison: 'Turn this comparison into a complete video budget',
    examples: 'Plan your next result with ChatGPT or Claude',
    docs: 'See the ChatGPT and Claude video workflow',
  },
  fr: {
    home: 'Utiliser MaxVideoAI avec ChatGPT ou Claude',
    footer: 'MaxVideoAI pour ChatGPT et Claude',
    payg: 'Préparer un budget vidéo avec ChatGPT ou Claude',
    models: 'Comparer les modèles depuis un brief assisté',
    model: 'Demander à ChatGPT ou Claude de budgéter ce modèle dans votre film',
    comparison: 'Transformer ce comparatif en budget vidéo complet',
    examples: 'Préparer le prochain résultat avec ChatGPT ou Claude',
    docs: 'Voir le parcours vidéo avec ChatGPT et Claude',
  },
  es: {
    home: 'Usar MaxVideoAI con ChatGPT o Claude',
    footer: 'MaxVideoAI para ChatGPT y Claude',
    payg: 'Planifica un presupuesto de vídeo con ChatGPT o Claude',
    models: 'Compara modelos desde una idea asistida',
    model: 'Pide a ChatGPT o Claude que presupueste este modelo en tu película',
    comparison: 'Convierte esta comparativa en un presupuesto de vídeo completo',
    examples: 'Planifica tu próximo resultado con ChatGPT o Claude',
    docs: 'Ver el flujo de vídeo con ChatGPT y Claude',
  },
};

export function getMcpInternalLink(
  locale: AppLocale,
  placement: McpInternalLinkPlacement,
  publication: McpPublicationInputs = mcpPublication,
): { href: string; label: string } | null {
  if (!getMcpPublicationState(publication).indexable) {
    return null;
  }
  const prefix = localePathnames[locale];
  return {
    href: `/${[prefix, 'mcp'].filter(Boolean).join('/')}`,
    label: LABELS[locale][placement],
  };
}
