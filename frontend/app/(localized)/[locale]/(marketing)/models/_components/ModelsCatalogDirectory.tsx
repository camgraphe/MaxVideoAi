import { listRuntimeModels } from '@/config/model-runtime';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { MODELS_SCOPE_NAV_LABELS, getModelsScopePath, type ModelsPageScope } from '../_lib/models-catalog-copy';
import type { ModelsCatalogHeroCard } from '../_lib/models-catalog-decision-data';

const copy = {
  en: { title: 'Model directory', current: 'Current models', previous: 'Earlier versions', nav: 'Browse model categories' },
  fr: { title: 'Répertoire des modèles', current: 'Modèles actuels', previous: 'Versions précédentes', nav: 'Parcourir les catégories de modèles' },
  es: { title: 'Directorio de modelos', current: 'Modelos actuales', previous: 'Versiones anteriores', nav: 'Explorar categorías de modelos' },
};

export function ModelsCatalogScopeNav({ locale, scope }: { locale: AppLocale; scope: ModelsPageScope }) {
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  return (
    <nav aria-label={copy[locale].nav} className="container-page flex max-w-[1248px] flex-wrap gap-3 py-5">
      {(['all', 'video', 'image'] as const).map(target => (
        <a key={target} href={`${prefix}${getModelsScopePath(target, locale)}`} aria-current={target === scope ? 'page' : undefined}
          className="inline-flex min-h-11 items-center rounded-lg border border-hairline px-4 text-sm font-semibold text-text-primary hover:underline">
          {MODELS_SCOPE_NAV_LABELS[locale][target]}
        </a>
      ))}
    </nav>
  );
}

/** Text-only SSR discovery shares the catalogue selection; filters and prices remain interactive. */
export function ModelsCatalogDirectory({ cards, locale }: { cards: ModelsCatalogHeroCard[]; locale: AppLocale }) {
  const previous = new Set(listRuntimeModels().filter(model => model.lifecycle === 'legacy').map(model => model.slug));
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const base = `${prefix}${getModelsScopePath('all', locale)}`;
  const groups = [
    { title: copy[locale].current, items: cards.filter(card => !previous.has(card.id)) },
    { title: copy[locale].previous, items: cards.filter(card => previous.has(card.id)) },
  ];
  return (
    <section data-model-directory className="container-page max-w-[1248px] border-t border-hairline py-8" aria-labelledby="model-directory-title">
      <h2 id="model-directory-title" className="text-xl font-semibold text-text-primary">{copy[locale].title}</h2>
      {groups.filter(group => group.items.length).map(group => (
        <div key={group.title} className="mt-5">
          <h3 className="text-sm font-semibold text-text-secondary">{group.title}</h3>
          <ul className="mt-2 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map(card => (
              <li key={card.id}>
                <a href={`${base}/${card.id}`} className="inline-flex min-h-11 items-center text-sm text-text-primary underline underline-offset-4 hover:text-brand">{card.label}</a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
