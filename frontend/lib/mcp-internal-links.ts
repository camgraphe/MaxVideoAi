import mcpPublication from '@/config/mcp-publication.json';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { getMcpPublicationState } from '@/lib/mcp-publication';

export type McpInternalLinkPlacement = 'footer' | 'payg' | 'models' | 'examples';

type McpPublicationInputs = Parameters<typeof getMcpPublicationState>[0];

const LABELS: Record<AppLocale, Record<McpInternalLinkPlacement, string>> = {
  en: {
    footer: 'Claude & Codex workflow',
    payg: 'Plan a video budget in Claude or Codex',
    models: 'Compare models from an agent-assisted brief',
    examples: 'Plan your next result with Claude or Codex',
  },
  fr: {
    footer: 'Parcours Claude et Codex',
    payg: 'Préparer un budget vidéo avec Claude ou Codex',
    models: 'Comparer les modèles depuis un brief assisté',
    examples: 'Préparer le prochain résultat avec Claude ou Codex',
  },
  es: {
    footer: 'Flujo con Claude y Codex',
    payg: 'Planifica un presupuesto de video con Claude o Codex',
    models: 'Compara modelos desde una idea asistida',
    examples: 'Planifica tu próximo resultado con Claude o Codex',
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
