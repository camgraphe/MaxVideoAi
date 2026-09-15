import { refineIntegrationCopy } from '../_content/editorial';
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
  const copy = locale === 'fr' ? buildFrenchIntegrationCopy(client) : locale === 'es' ? buildSpanishIntegrationCopy(client) : buildEnglishIntegrationCopy(client);
  return refineIntegrationCopy(copy, locale);
}
