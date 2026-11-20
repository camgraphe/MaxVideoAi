'use client';
import Link from 'next/link';
import type { GroupMemberSummary } from '@/types/groups';
import { useState, type Ref } from 'react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { MediaActionPanel } from './MediaActionPanel.client';
import { MediaDestinationActions } from './MediaDestinationActions.client';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
export function GalleryMediaActionPanel({ assets, members, onClose, menuRef, onRemake, onSave, getRecreateLink, onRemove, saving }: {
  assets: AssetBrowserAsset[]; members?: GroupMemberSummary[]; onClose: () => void; menuRef: Ref<HTMLDivElement>;
  getRecreateLink?: (outputId: string) => { href: string; label: string } | null;
  onRemove?: () => void; saving?: boolean;
  onPreview: () => void; onRemake?: () => void; onSave?: () => void; onCopy?: () => void;
}) {
  const { user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { locale } = useI18n();
  const [index, setIndex] = useState(0);
  const asset = assets[index] ?? assets[0];
  const member = members?.find(item => item.id === asset.id);
  const recreateLink = getRecreateLink?.(asset.id);
  const labels = locale.startsWith('fr') ? ['Reprendre les réglages', 'Sauvegarder le résultat principal'] : locale.startsWith('es') ? ['Recuperar ajustes', 'Guardar resultado principal'] : ['Reuse settings', 'Save main output'];
  return <MediaActionPanel boundaryRef={menuRef} asset={asset} neighbors={assets} onNavigateAsset={selected => setIndex(assets.indexOf(selected))} locale={locale} onClose={onClose} title={member?.engineLabel} details={member ? <>
      {member.prompt ? <p>{member.prompt}</p> : null}
      <dl><div><dt>{locale.startsWith('fr') ? 'Créé le' : locale.startsWith('es') ? 'Creado' : 'Created'}</dt><dd>{new Date(member.createdAt).toLocaleDateString(locale)}</dd></div>
      {typeof member.priceCents === 'number' ? <div><dt>{locale.startsWith('fr') ? 'Coût' : locale.startsWith('es') ? 'Coste' : 'Cost'}</dt><dd>{new Intl.NumberFormat(locale, { style: 'currency', currency: member.currency || 'USD' }).format(member.priceCents / 100)}</dd></div> : null}</dl>
    </> : undefined}>
    {recreateLink ? <Link href={recreateLink.href} prefetch={false} onClick={onClose}>{recreateLink.label}</Link> : null}
    <MediaDestinationActions key={asset.id} asset={asset} sourceEngineId={member?.engineId} userId={user?.id} locale={locale} onNavigate={onClose} />
    {onRemake && index === 0 ? <button type="button" onClick={onRemake}>{labels[0]}</button> : null}
    {onSave && index === 0 ? <button type="button" onClick={onSave} disabled={saving}>{labels[1]}</button> : null}
    {onRemove ? <button type="button" onClick={onRemove}>{locale.startsWith('fr') ? 'Retirer de l’historique' : locale.startsWith('es') ? 'Quitar del historial' : 'Remove from history'}</button> : null}
  </MediaActionPanel>;
}
