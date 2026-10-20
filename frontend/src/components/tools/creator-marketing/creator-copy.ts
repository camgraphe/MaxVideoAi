import type { AppLocale } from '@/i18n/locales';
import type { CreatorToolId } from '@/lib/toolbox/creator-availability';
import { enCopy, enLabels } from './creator-copy.en';
import { frCopy, frLabels } from './creator-copy.fr';
import { esCopy, esLabels } from './creator-copy.es';
export function getCreatorMarketingCopy(locale: AppLocale, id: CreatorToolId) { return ({ en: enCopy, fr: frCopy, es: esCopy })[locale][id]; }
export function getCreatorMarketingLabels(locale: AppLocale) { return ({ en: enLabels, fr: frLabels, es: esLabels })[locale]; }
