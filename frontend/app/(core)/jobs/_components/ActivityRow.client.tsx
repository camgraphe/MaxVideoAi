'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AudioLines, ArrowUpRight, Film, ImageIcon, MoreHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import { LibraryImageThumbnail } from '@/components/library/LibraryImageThumbnail.client';
import { galleryMediaAssets } from '@/components/library/gallery-media-assets';
import { hasStoredLibraryThumbnail } from '@/lib/library-image';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { isPlaceholderMediaUrl } from '@/lib/media';
import type { GroupSummary } from '@/types/groups';
import type { GroupedJobAction } from '@/components/grouped-job-card-types';
import { activityGroupStatus } from '../_lib/jobs-activity';
import { resolveActivityDestination } from '../_lib/activity-entry';
import { resolveClientJobSurface } from '../_lib/jobs-page-helpers';
import type { JobsCopy } from '../_lib/jobs-copy';
import styles from './jobs-activity.module.css';

const ActivityMenu = dynamic(() => import('@/components/GroupedJobCardMenu').then(mod => mod.GroupedJobCardMenu), { ssr: false });

/** A history entry only loads its small poster. Playback belongs to the detail viewer. */
export function ActivityRow({ group, copy, onOpen, onAction, allowRemove, savingToLibrary }: {
  group: GroupSummary;
  copy: JobsCopy;
  onOpen: (group: GroupSummary) => void;
  onAction: (group: GroupSummary, action: GroupedJobAction) => void;
  allowRemove: boolean;
  savingToLibrary: boolean;
}) {
  const { locale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hero = group.hero;
  const surface = hero.job ? resolveClientJobSurface(hero.job) : hero.audioUrl ? 'audio' : 'video';
  const hasImageOutput = Boolean(hero.originalUrl || hero.job?.renderIds?.length);
  const isImageGroup = ['image', 'storyboard', 'character', 'angle', 'background-removal'].includes(surface)
    || (['upscale', 'tool'].includes(surface) && hasImageOutput && !hero.videoUrl && !hero.job?.videoUrl);
  const Icon = surface === 'audio' ? AudioLines : isImageGroup ? ImageIcon : Film;
  const status = activityGroupStatus(group);
  const destination = resolveActivityDestination(group);
  const destinationLabel = destination ? copy.activity.destinations[destination.target] : '';
  const openInLabel = copy.activity.openIn.replace('{tool}', destinationLabel);
  const kind = isImageGroup ? 'image' : surface === 'audio' ? 'audio' : 'video';
  const asset = galleryMediaAssets(group, kind).find(asset => asset.id === hero.id);
  // Legacy groups use the full-size image as thumbUrl when a poster is missing.
  // That fallback is useful in a viewer, but too expensive for a history row.
  const hasPoster = asset && hasStoredLibraryThumbnail(asset) && !isPlaceholderMediaUrl(asset.thumbUrl ?? '');
  const model = hero.engineLabel || copy.activity.sources[surface];
  const allFree = group.members.length === group.count && group.members.every(member => member.priceCents === 0);
  const amount = group.totalPriceCents ?? (group.count === 1 || allFree ? hero.priceCents : null);
  let price = '—';
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    try { price = new Intl.NumberFormat(locale, { style: 'currency', currency: group.currency ?? hero.currency ?? 'USD' }).format(amount / 100); }
    catch { /* Keep unknown/invalid currency visibly unknown. */ }
  }
  const date = new Date(group.createdAt);
  const dateLabel = Number.isFinite(date.getTime()) ? date.toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const action = (next: GroupedJobAction) => { setMenuOpen(false); onAction(group, next); };

  return <li className={styles.row} data-activity-id={group.id} data-status={status}>
    <button type="button" className={styles.entry} onClick={() => onOpen(group)} aria-label={`${copy.actions.openDetails} · ${model}`}>
      <span className={styles.thumbnail} aria-hidden="true">
        <Icon size={20} />
        {hasPoster ? <LibraryImageThumbnail key={`${group.id}:${hero.id}`} asset={asset} posterOnly /> : null}
      </span>
      <span className={styles.summary}>
        <span className={styles.title}>{model}{group.count > 1 ? <span className={styles.count}>×{group.count}</span> : null}</span>
        <span className={styles.prompt}>{hero.prompt || copy.activity.sources[surface]}</span>
        <span className={styles.metadata}>
          <span>{copy.activity.sources[surface]}</span>
          {!isImageGroup && hero.durationSec > 0 ? <span>{hero.durationSec}s</span> : null}
          {destination?.origin ? <span className={styles.origin}>{destination.origin === 'mcp' ? 'MCP' : 'Studio'}</span> : null}
          <time dateTime={group.createdAt} suppressHydrationWarning>{dateLabel}</time>
        </span>
      </span>
    </button>
    <div className={styles.outcome}>
      <span className={styles.status} data-status={status}><span aria-hidden="true" />{copy.activity.statuses[status]}</span>
      <span className={styles.price} title={copy.activity.cost}>{price}</span>
    </div>
    <div className={styles.rowActions}>
      {destination ? <Link prefetch={false} href={destination.href} className={styles.destination} aria-label={openInLabel} title={openInLabel}>
        <span>{destinationLabel}</span><ArrowUpRight size={15} aria-hidden="true" />
      </Link> : null}
      <button type="button" className={styles.menuButton} aria-label={`${copy.actions.actions} · ${model}`} aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
    </div>
    {menuOpen ? <ActivityMenu menuRef={menuRef} menuVariant="activity" group={group} isImageGroup={isImageGroup}
      allowRemove={allowRemove} savingToLibrary={savingToLibrary} closeMenu={() => setMenuOpen(false)}
      handleAction={action} handleRemake={() => action('open')} onOpen={onOpen} openLabel={copy.actions.openDetails}
      recreateHref={destination?.href} recreateLabel={destination?.resumesSettings ? copy.actions.recreate : openInLabel} /> : null}
  </li>;
}
