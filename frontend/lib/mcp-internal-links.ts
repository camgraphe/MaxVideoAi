import mcpPublication from '@/config/mcp-publication.json';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { getMcpPublicationState, type McpPublicationState } from '@/lib/mcp-publication';

export type McpInternalLinkPlacement =
  | 'home'
  | 'footer'
  | 'payg'
  | 'models'
  | 'model'
  | 'comparison'
  | 'examples'
  | 'docs';

export type McpDocsLinkPlacement = 'footer' | 'hub' | 'integration';

type McpPublicationInputs = Parameters<typeof getMcpPublicationState>[0];

const LABELS: Record<AppLocale, Record<McpInternalLinkPlacement, string>> = {
  en: {
    home: 'Use MaxVideoAI with Claude, ChatGPT or Codex',
    footer: 'MaxVideoAI for Claude, ChatGPT & Codex',
    payg: 'Plan a video budget in Claude, ChatGPT or Codex',
    models: 'Compare models from an agent-assisted brief',
    model: 'Ask Claude, ChatGPT or Codex to budget this model in your film',
    comparison: 'Turn this comparison into a complete video budget',
    examples: 'Plan your next result with Claude, ChatGPT or Codex',
    docs: 'See the Claude, ChatGPT and Codex video workflow',
  },
  fr: {
    home: 'Utiliser MaxVideoAI avec Claude, ChatGPT ou Codex',
    footer: 'MaxVideoAI pour Claude, ChatGPT et Codex',
    payg: 'Préparer un budget vidéo avec Claude, ChatGPT ou Codex',
    models: 'Comparer les modèles depuis un brief assisté',
    model: 'Demander à Claude, ChatGPT ou Codex de budgéter ce modèle dans votre film',
    comparison: 'Transformer ce comparatif en budget vidéo complet',
    examples: 'Préparer le prochain résultat avec Claude, ChatGPT ou Codex',
    docs: 'Voir le parcours vidéo avec Claude, ChatGPT et Codex',
  },
  es: {
    home: 'Usar MaxVideoAI con Claude, ChatGPT o Codex',
    footer: 'MaxVideoAI para Claude, ChatGPT y Codex',
    payg: 'Planifica un presupuesto de video con Claude, ChatGPT o Codex',
    models: 'Compara modelos desde una idea asistida',
    model: 'Pide a Claude, ChatGPT o Codex que presupueste este modelo en tu película',
    comparison: 'Convierte esta comparativa en un presupuesto de vídeo completo',
    examples: 'Planifica tu próximo resultado con Claude, ChatGPT o Codex',
    docs: 'Ver el flujo de vídeo con Claude, ChatGPT y Codex',
  },
};

const DOCS_LABELS: Record<AppLocale, Record<McpDocsLinkPlacement, string>> = {
  en: {
    footer: 'MCP technical documentation',
    hub: 'Read the complete MCP technical guide',
    integration: 'Read the MCP technical guide',
  },
  fr: {
    footer: 'Documentation technique MCP',
    hub: 'Consulter le guide technique MCP complet',
    integration: 'Consulter le guide technique MCP',
  },
  es: {
    footer: 'Documentación técnica MCP',
    hub: 'Consultar la guía técnica MCP completa',
    integration: 'Consultar la guía técnica MCP',
  },
};

const DEFAULT_MCP_PUBLICATION_STATE = getMcpPublicationState(mcpPublication);

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

export function getMcpDocsLink(
  locale: AppLocale,
  placement: McpDocsLinkPlacement,
  publication: McpPublicationState = DEFAULT_MCP_PUBLICATION_STATE,
): { href: string; label: string } | null {
  if (!publication.indexable) {
    return null;
  }
  const prefix = localePathnames[locale];
  return {
    href: `/${[prefix, 'docs', 'mcp'].filter(Boolean).join('/')}`,
    label: DOCS_LABELS[locale][placement],
  };
}
