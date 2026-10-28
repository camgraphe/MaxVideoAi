'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { AppGlyph } from './AppGlyph';
import { APP_ACTIVITIES, appNavLabel, type AppActivity } from './app-navigation';

type Props = { activity: AppActivity | null; locale: string };
const creationLabel = (locale: string) => locale === 'fr' ? 'Type de création' : locale === 'es' ? 'Tipo de creación' : 'Creation type';

export function AppCreationRailLinks({ activity, locale }: Props) {
  return <div className="app-creation-rail-links" role="group" aria-label={creationLabel(locale)}>
    {APP_ACTIVITIES.map(item => <Link key={item.id} href={item.href} prefetch={false} aria-current={activity === item.id ? 'page' : undefined}>
      <AppGlyph name={item.glyph} /><span>{appNavLabel(item, locale)}</span>
    </Link>)}
  </div>;
}

/** The native picker stays in the bottom navigation without adding a content row. */
export function AppCreationMobilePicker({ activity, locale }: Props) {
  const router = useRouter();
  const selected = APP_ACTIVITIES.find(item => item.id === activity);
  return <div className="app-creation-mobile-picker" data-active={Boolean(selected)}>
    <AppGlyph name={selected?.glyph ?? 'create'} />
    <span>{selected ? appNavLabel(selected, locale) : appNavLabel({ id: 'create', label: 'Create' }, locale)}<ChevronDown size={11} aria-hidden /></span>
    <select aria-label={creationLabel(locale)} value={activity ?? ''} onChange={event => {
      const destination = APP_ACTIVITIES.find(item => item.id === event.target.value);
      if (destination) router.push(destination.href);
    }}>
      <option value="" disabled>{creationLabel(locale)}</option>
      {APP_ACTIVITIES.map(item => <option key={item.id} value={item.id}>{appNavLabel(item, locale)}</option>)}
    </select>
  </div>;
}
