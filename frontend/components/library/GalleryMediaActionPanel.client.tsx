'use client';
import Link from 'next/link';
import type { GroupMemberSummary } from '@/types/groups';
import { useState, type Ref } from 'react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { MediaActionPanel } from './MediaActionPanel.client';
import { MediaDestinationActions } from './MediaDestinationActions.client';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
export function GalleryMediaActionPanel({ assets, members, onClose, menuRef, onRemake, onSave, recreateHref, recreateLabel, onRemove, saving }: {
  assets: AssetBrowserAsset[]; members?: GroupMemberSummary[]; onClose: () => void; menuRef: Ref<HTMLDivElement>;
  recreateHref?: string; recreateLabel?: string; onRemove?: () => void; saving?: boolean;
  onPreview: () => void; onRemake?: () => void; onSave?: () => void; onCopy?: () => void;
}) {
  const { user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { locale } = useI18n();
  const [index, setIndex] = useState(0);
  const asset = assets[index] ?? assets[0];
  const member = members?.find(item => item.id === asset.id);
  const labels = locale.startsWith('fr') ? ['Voir le résultat', 'Reprendre les paramètres', 'Sauvegarder le résultat principal', 'Copier le lien principal', 'Sortie'] : locale.startsWith('es') ? ['Ver resultado', 'Recuperar ajustes', 'Guardar resultado principal', 'Copiar enlace principal', 'Resultado'] : ['View result', 'Reuse settings', 'Save main output', 'Copy main output link', 'Output'];
  return <MediaActionPanel boundaryRef={menuRef} asset={asset} locale={locale} onClose={onClose} title={member?.engineLabel} details={member ? <>
      {member.prompt ? <p>{member.prompt}</p> : null}
      <dl><div><dt>{locale.startsWith('fr') ? 'Créé le' : locale.startsWith('es') ? 'Creado' : 'Created'}</dt><dd>{new Date(member.createdAt).toLocaleDateString(locale)}</dd></div>
      {typeof member.priceCents === 'number' ? <div><dt>{locale.startsWith('fr') ? 'Coût' : locale.startsWith('es') ? 'Coste' : 'Cost'}</dt><dd>{new Intl.NumberFormat(locale, { style: 'currency', currency: member.currency || 'USD' }).format(member.priceCents / 100)}</dd></div> : null}</dl>
    </> : undefined} navigation={assets.length > 1 ? <label>{labels[4]}<select value={index} onChange={(event) => setIndex(Number(event.target.value))}>{assets.map((entry, position) => <option value={position} key={entry.id}>{labels[4]} {position + 1}</option>)}</select></label> : null}>
    <MediaDestinationActions key={asset.id} asset={asset} sourceEngineId={member?.engineId} userId={user?.id} locale={locale} onNavigate={onClose} />
    {onRemake && index === 0 ? <button type="button" onClick={onRemake}>{labels[1]}</button> : null}
    {onSave && index === 0 ? <button type="button" onClick={onSave} disabled={saving}>{labels[2]}</button> : null}
    {recreateHref && index === 0 ? <Link href={recreateHref} onClick={onClose}>{recreateLabel ?? labels[1]}</Link> : null}
    {onRemove ? <button type="button" onClick={onRemove}>{locale.startsWith('fr') ? 'Retirer de l’historique' : locale.startsWith('es') ? 'Quitar del historial' : 'Remove from history'}</button> : null}
  </MediaActionPanel>;
}
