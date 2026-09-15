import mcpPublication from '@/config/mcp-publication.json';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { getMcpPublicationState, type McpPublicationState } from '@/lib/mcp-publication';

export type McpInternalLinkPlacement =
  | 'home'
  | 'homeHero'
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
    home: 'Connect Claude, ChatGPT, Codex, OpenClaw or n8n',
    homeHero: 'Create videos in your AI assistant',
    footer: 'AI assistants and MCP integrations',
    payg: 'Review the price in your AI assistant before generating',
    models: 'Choose a video model with your AI assistant',
    model: 'Create with an AI assistant: see compatible models',
    comparison: 'Continue this comparison in your AI assistant',
    examples: 'Create your next video with an AI assistant',
    docs: 'Explore video creation and automation with MCP',
  },
  fr: {
    home: 'Connecter Claude, ChatGPT, Codex, OpenClaw ou n8n',
    homeHero: 'Créez vos vidéos dans votre assistant IA',
    footer: 'Assistants IA et intégrations MCP',
    payg: 'Vérifier le prix dans votre assistant IA avant de générer',
    models: 'Choisir un modèle vidéo avec votre assistant IA',
    model: 'Créer avec un assistant IA : voir les modèles compatibles',
    comparison: 'Poursuivre ce comparatif dans votre assistant IA',
    examples: 'Créer votre prochaine vidéo avec un assistant IA',
    docs: 'Découvrir la création et l’automatisation vidéo avec MCP',
  },
  es: {
    home: 'Conecta Claude, ChatGPT, Codex, OpenClaw o n8n',
    homeHero: 'Crea videos en tu asistente de IA',
    footer: 'Asistentes de IA e integraciones MCP',
    payg: 'Revisa el precio en tu asistente de IA antes de generar',
    models: 'Elige un modelo de video con tu asistente de IA',
    model: 'Crea con un asistente de IA: consulta los modelos compatibles',
    comparison: 'Continúa esta comparación en tu asistente de IA',
    examples: 'Crea tu próximo video con un asistente de IA',
    docs: 'Explora la creación y automatización de video con MCP',
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
