import type { AppLocale } from '@/i18n/locales';
import type { McpClientId } from '../../mcp/_lib/mcp-page-types';
import { buildEnglishIntegrationCopy } from '../_content/en';
import { buildFrenchIntegrationCopy } from '../_content/fr';
import { buildSpanishIntegrationCopy } from '../_content/es';
import type { IntegrationPageCopy } from '../_content/types';

export type { IntegrationPageCopy } from '../_content/types';

export function getIntegrationCopy(
  locale: AppLocale,
  client: McpClientId,
): IntegrationPageCopy {
  if (locale === 'fr') return buildFrenchIntegrationCopy(client);
  if (locale === 'es') return buildSpanishIntegrationCopy(client);
  return buildEnglishIntegrationCopy(client);
}
