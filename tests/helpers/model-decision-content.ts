import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { FalEngineEntry } from '../../frontend/src/config/falEngines.ts';
import type { AppLocale } from '../../frontend/i18n/locales.ts';
import { buildModelDecisionData } from '../../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts';

export function readModelDecisionInput(modelSlug: string, locale: AppLocale): unknown {
  const document = JSON.parse(
    readFileSync(path.join(process.cwd(), 'content', 'models', locale, `${modelSlug}.json`), 'utf8'),
  ) as { decision?: unknown };
  return document.decision;
}

export function buildModelDecisionDataFromContent({
  engine,
  locale,
}: {
  engine: FalEngineEntry;
  locale: AppLocale;
}) {
  return buildModelDecisionData({
    engine,
    locale,
    decisionContent: readModelDecisionInput(engine.modelSlug, locale),
  });
}
